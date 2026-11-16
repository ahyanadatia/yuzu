# Yuzu

Earn your rank. A private league for one flat: daily, weekly and eight-week goals, proved with images, refereed by flatmates, scored out of 100 each week.

- `index.html` is the whole site, built from `src/`. It is deployed on Netlify.
- `supabase.sql` creates the database tables and functions on Supabase.
- Sign-in is phone number plus a 6-digit PIN, with a flat invite code for new members. No text messages are sent.

## Run your own
1. Create a free Supabase project. Open the SQL editor, paste `supabase.sql`, change `CHANGE-ME` to your invite code, and run it.
2. Copy the project URL and the publishable key from Project Settings > API Keys.
3. `SUPABASE_URL=... SUPABASE_KEY=... ./build.sh`
4. Drop `index.html` onto Netlify.

The publishable key is meant to be public. Tables have row level security with no policies, so the key cannot read or write them; every call goes through a function that checks a session token.

## Looking after it
- Change the invite code: `update public.yz_config set invite_code = 'NEW-CODE' where id = 1;`
- Reset a PIN: `update public.yz_users set pin_hash = extensions.crypt('123456', extensions.gen_salt('bf')), fails = 0, locked_until = null where phone = '+447700900123';`
- Remove someone and their data: `delete from public.yz_users where phone = '+447700900123';`
- Clear old photos: `delete from public.yz_photos where created_at < now() - interval '70 days';`
- Free Supabase projects pause after a week without use. Restore from the dashboard.

## Tests
- `node tests/core.test.js` checks the scoring and review rules.
- `tests/e2e.py` drives two simulated phones against a local Postgres through `tests/shim.py`.
