-- Yuzu database. Paste this whole file into the Supabase SQL editor and run it once.
-- Safe to run again: it never deletes data.
--
-- How it is locked down: the tables have row level security on and no policies,
-- so the public key cannot read or write them directly. Everything goes through
-- the yz_* functions below, which check a session token on every call.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.yz_users (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  pin_hash text not null,
  fails int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.yz_sessions (
  token uuid primary key default gen_random_uuid(),
  uid uuid not null references public.yz_users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.yz_docs (
  uid uuid not null references public.yz_users(id) on delete cascade,
  kind text not null check (kind in ('profile', 'week')),
  key text not null default '',
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (uid, kind, key)
);
create table if not exists public.yz_photos (
  uid uuid not null references public.yz_users(id) on delete cascade,
  id text not null,
  data text not null,
  created_at timestamptz not null default now(),
  primary key (uid, id)
);
create table if not exists public.yz_config (
  id int primary key default 1 check (id = 1),
  invite_code text not null,
  data jsonb not null default '{}'::jsonb
);

-- The invite code flatmates type when they join. Change it any time with:
--   update public.yz_config set invite_code = 'NEW-CODE' where id = 1;
insert into public.yz_config (id, invite_code) values (1, 'CHANGE-ME') on conflict (id) do nothing;

alter table public.yz_users enable row level security;
alter table public.yz_sessions enable row level security;
alter table public.yz_docs enable row level security;
alter table public.yz_photos enable row level security;
alter table public.yz_config enable row level security;

create or replace function public.yz_uid(p_token uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select uid from public.yz_sessions where token = p_token
$$;

create or replace function public.yz_join(p_phone text, p_pin text, p_name text, p_code text, p_week text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_cfg public.yz_config; v_uid uuid; v_token uuid; v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  select * into v_cfg from public.yz_config where id = 1;
  if v_cfg.invite_code is null or upper(btrim(coalesce(p_code, ''))) <> upper(v_cfg.invite_code) then perform pg_sleep(0.5); return json_build_object('error', 'BAD_CODE'); end if;
  if coalesce(p_phone, '') !~ '^\+[0-9]{8,15}$' then return json_build_object('error', 'BAD_PHONE'); end if;
  if coalesce(p_pin, '') !~ '^[0-9]{6}$' then return json_build_object('error', 'BAD_PIN'); end if;
  if length(v_name) < 2 or length(v_name) > 20 then return json_build_object('error', 'BAD_NAME'); end if;
  if exists (select 1 from public.yz_users where phone = p_phone) then return json_build_object('error', 'PHONE_TAKEN'); end if;
  if exists (select 1 from public.yz_docs where kind = 'profile' and lower(data->>'nick') = lower(v_name)) then return json_build_object('error', 'NAME_TAKEN'); end if;
  if (select count(*) from public.yz_users) >= 12 then return json_build_object('error', 'FULL'); end if;
  insert into public.yz_users (phone, pin_hash) values (p_phone, crypt(p_pin, gen_salt('bf'))) returning id into v_uid;
  insert into public.yz_docs (uid, kind, key, data) values (v_uid, 'profile', '', jsonb_build_object('joined', floor(extract(epoch from now()) * 1000)::bigint, 'nick', v_name));
  if not (v_cfg.data ? 'seasonStart') and coalesce(p_week, '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    update public.yz_config set data = data || jsonb_build_object('seasonStart', p_week) where id = 1;
  end if;
  insert into public.yz_sessions (uid) values (v_uid) returning token into v_token;
  return json_build_object('token', v_token, 'uid', v_uid);
end $$;

create or replace function public.yz_login(p_phone text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_user public.yz_users; v_token uuid;
begin
  select * into v_user from public.yz_users where phone = p_phone;
  if not found then perform pg_sleep(0.5); return json_build_object('error', 'BAD_LOGIN'); end if;
  if v_user.locked_until is not null and v_user.locked_until > now() then return json_build_object('error', 'LOCKED'); end if;
  if v_user.pin_hash = crypt(coalesce(p_pin, ''), v_user.pin_hash) then
    update public.yz_users set fails = 0, locked_until = null where id = v_user.id;
    insert into public.yz_sessions (uid) values (v_user.id) returning token into v_token;
    return json_build_object('token', v_token, 'uid', v_user.id);
  end if;
  -- eight wrong PINs in a row locks the number for 15 minutes
  if v_user.fails + 1 >= 8 then update public.yz_users set fails = 0, locked_until = now() + interval '15 minutes' where id = v_user.id;
  else update public.yz_users set fails = fails + 1 where id = v_user.id; end if;
  return json_build_object('error', 'BAD_LOGIN');
end $$;

create or replace function public.yz_logout(p_token uuid) returns json
language plpgsql security definer set search_path = public as $$
begin delete from public.yz_sessions where token = p_token; return json_build_object('ok', true); end $$;

create or replace function public.yz_sync(p_token uuid, p_since text) returns json
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public.yz_uid(p_token);
begin
  if v_uid is null then return json_build_object('error', 'NO_SESSION'); end if;
  return json_build_object(
    'me', v_uid,
    'config', (select data from public.yz_config where id = 1),
    'players', (select coalesce(jsonb_object_agg(uid::text, data), '{}'::jsonb) from public.yz_docs where kind = 'profile'),
    'weeks', (select coalesce(jsonb_object_agg(u, w), '{}'::jsonb) from (
      select uid::text as u, jsonb_object_agg(key, data) as w from public.yz_docs
      where kind = 'week' and key >= coalesce(p_since, '') group by uid) t));
end $$;

create or replace function public.yz_put(p_token uuid, p_kind text, p_key text, p_data jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.yz_uid(p_token); v_key text := coalesce(p_key, ''); v_nick text;
begin
  if v_uid is null then return json_build_object('error', 'NO_SESSION'); end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 300000 then return json_build_object('error', 'BAD_DATA'); end if;
  if p_kind = 'profile' then
    v_key := '';
    v_nick := btrim(coalesce(p_data->>'nick', ''));
    if length(v_nick) < 2 or length(v_nick) > 20 then return json_build_object('error', 'BAD_NAME'); end if;
    if exists (select 1 from public.yz_docs where kind = 'profile' and uid <> v_uid and lower(data->>'nick') = lower(v_nick)) then return json_build_object('error', 'NAME_TAKEN'); end if;
  elsif p_kind = 'week' then
    if v_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return json_build_object('error', 'BAD_DATA'); end if;
  else return json_build_object('error', 'BAD_DATA'); end if;
  insert into public.yz_docs (uid, kind, key, data) values (v_uid, p_kind, v_key, p_data)
  on conflict (uid, kind, key) do update set data = excluded.data, updated_at = now();
  return json_build_object('ok', true);
end $$;

create or replace function public.yz_photo_put(p_token uuid, p_id text, p_data text) returns json
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.yz_uid(p_token);
begin
  if v_uid is null then return json_build_object('error', 'NO_SESSION'); end if;
  if coalesce(p_id, '') !~ '^[A-Za-z0-9_-]{1,80}$' or coalesce(p_data, '') !~ '^data:image/(jpeg|png|webp);base64,' or length(p_data) > 400000 then return json_build_object('error', 'BAD_DATA'); end if;
  if (select count(*) from public.yz_photos where uid = v_uid) >= 3000 then return json_build_object('error', 'FULL'); end if;
  insert into public.yz_photos (uid, id, data) values (v_uid, p_id, p_data)
  on conflict (uid, id) do update set data = excluded.data, created_at = now();
  return json_build_object('ok', true);
end $$;

create or replace function public.yz_photo_get(p_token uuid, p_owner uuid, p_id text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if public.yz_uid(p_token) is null then return json_build_object('error', 'NO_SESSION'); end if;
  return json_build_object('d', (select data from public.yz_photos where uid = p_owner and id = p_id));
end $$;

revoke all on function public.yz_uid(uuid) from public, anon, authenticated;
revoke all on function public.yz_join(text, text, text, text, text) from public;
revoke all on function public.yz_login(text, text) from public;
revoke all on function public.yz_logout(uuid) from public;
revoke all on function public.yz_sync(uuid, text) from public;
revoke all on function public.yz_put(uuid, text, text, jsonb) from public;
revoke all on function public.yz_photo_put(uuid, text, text) from public;
revoke all on function public.yz_photo_get(uuid, uuid, text) from public;
grant execute on function public.yz_join(text, text, text, text, text) to anon, authenticated;
grant execute on function public.yz_login(text, text) to anon, authenticated;
grant execute on function public.yz_logout(uuid) to anon, authenticated;
grant execute on function public.yz_sync(uuid, text) to anon, authenticated;
grant execute on function public.yz_put(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.yz_photo_put(uuid, text, text) to anon, authenticated;
grant execute on function public.yz_photo_get(uuid, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
