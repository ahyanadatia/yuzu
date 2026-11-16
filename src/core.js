/* ---------- core: time, review status, scoring (pure) ---------- */
const H = 3600e3, DAY = 24 * H, SEASON_WEEKS = 8, MIN_CATS = 3;
const pad = n => String(n).padStart(2, '0');
const fmt = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => { const [a, b, c] = s.split('-').map(Number); return new Date(a, b - 1, c); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
const gameDay = t => fmt(new Date(t - 3 * H));               // a day runs 03:00 to 03:00
const weekOf = day => { const d = parse(day); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return fmt(d); };
const weekDays = w => [0, 1, 2, 3, 4, 5, 6].map(i => addDays(w, i));
const at = (day, h) => { const d = parse(day); d.setHours(h); return d.getTime(); };
const weekEnd = w => at(addDays(w, 7), 3);                   // Monday 03:00
const weekFinal = w => at(addDays(w, 7), 12);                // Monday 12:00
const weekShow = w => at(addDays(w, 6), 20);                 // Sunday 20:00
const dayEnd = day => at(addDays(day, 1), 3);
const seasonOf = (w, start) => { const i = Math.max(0, Math.round((parse(w) - parse(start)) / (7 * DAY))); return { id: addDays(start, Math.floor(i / SEASON_WEEKS) * SEASON_WEEKS * 7), week: i % SEASON_WEEKS + 1, index: i }; };

/* Goals carry forward: a week uses its own goal list if one was saved, otherwise the latest earlier list. */
const hasGoals = wk => !!wk && Array.isArray(wk.goals) && (wk.goals.length > 0 || !!wk.lockedAt);
function goalsFor(weeks, uid, w) {
  const m = weeks[uid] || {};
  if (hasGoals(m[w])) return m[w].goals;
  let best = null;
  for (const k in m) if (k < w && hasGoals(m[k]) && (!best || k > best)) best = k;
  return best ? m[best].goals : [];
}

function verdict(ok, no, reason, noT, late) {
  if (no) return ok >= 2 ? { s: 'overturned', ok, no } : { s: 'rejected', reason, noT, ok, no };
  if (ok) return { s: 'verified', ok };
  return late ? { s: 'verified', auto: true, ok: 0 } : { s: 'counted', ok: 0 };
}
/* Proof counts on upload. One approval verifies it; so does 24 h with no review (or Monday 12:00).
   A rejection zeroes it unless two other flatmates approve. */
function itemStatus(weeks, owner, w, key, n, t, now) {
  const fin = weekFinal(w), deadline = Math.min(t + DAY, fin);
  let ok = 0, no = 0, reason = '', noT = 0;
  for (const r in weeks) {
    if (r === owner) continue;
    const rv = weeks[r] && weeks[r][w] && weeks[r][w].reviews && weeks[r][w].reviews[owner + '__' + key];
    if (!rv || rv.n !== n) continue;
    if (rv.v) { if (rv.t <= fin) ok++; }
    else if (rv.t <= deadline) { no++; reason = rv.r || ''; noT = Math.max(noT, rv.t); }
  }
  return verdict(ok, no, reason, noT, now >= deadline);
}
/* A goal's sign-off follows the goal across weeks, so a pushed-back goal stays pushed back until it changes. */
function goalStatus(weeks, owner, g, now) {
  const n = g.n || 1, t = g.at || 0, key = owner + '__g_' + g.id;
  let ok = 0, no = 0, reason = '', noT = 0;
  for (const r in weeks) {
    if (r === owner) continue;
    let rv = null;
    for (const k in weeks[r]) { const x = weeks[r][k].reviews && weeks[r][k].reviews[key]; if (x && x.n === n && (!rv || x.t > rv.t)) rv = x; }
    if (!rv) continue;
    if (rv.v) ok++; else if (rv.t <= t + DAY) { no++; reason = rv.r || ''; noT = Math.max(noT, rv.t); }
  }
  return verdict(ok, no, reason, noT, now >= t + DAY);
}
const metV = (g, v) => !g.m || (typeof v === 'number' && (g.m.op === 'max' ? v <= g.m.t : v >= g.m.t));
const met = (g, c) => metV(g, c.v);

/* Dailies: you tick what you did, close out the day, and one ticked goal is drawn as the spot check.
   One image proves the day. The draw is a fixed function of person, day and ticks, so anyone can verify it.
   A day scores only once it is closed out with its image, and not if its review is rejected. */
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const ticked = (goals, rec) => goals.filter(g => g.type === 'd' && rec && rec.ticks && rec.ticks[g.id] != null && rec.ticks[g.id] !== false && metV(g, rec.ticks[g.id])).map(g => g.id);
const auditPick = (uid, day, ids) => ids.length ? ids.slice().sort()[hash(uid + '|' + day) % ids.length] : null;
function dayState(weeks, uid, w, day, now) {
  const rec = weeks[uid] && weeks[uid][w] && weeks[uid][w].days && weeks[uid][w].days[day];
  if (!rec || !rec.ticks) return { s: 'none', hits: [] };
  const hits = ticked(goalsFor(weeks, uid, w), rec), open = now < dayEnd(day);
  if (!rec.closed) return { s: open && hits.length ? 'open' : open ? 'none' : 'void', hits };
  const audit = auditPick(uid, day, hits);
  if (!audit || rec.audit !== audit) return { s: 'void', hits, audit };
  if (!(rec.a || rec.ph)) return { s: open ? 'due' : 'void', hits, audit };
  const st = itemStatus(weeks, uid, w, 'day_' + day, rec.n, rec.t, now);
  return Object.assign({ hits, audit, rec }, st);
}
const dayCounts = st => st.s === 'counted' || st.s === 'verified' || st.s === 'overturned';

/* Seasonal goals: latest accepted weekly log between the season start and week w. */
function seasonValue(weeks, uid, g, w, sid, now) {
  let cur = g.base, logged = false;
  for (let k = sid; k <= w; k = addDays(k, 7)) {
    const c = weeks[uid] && weeks[uid][k] && weeks[uid][k].checkins && weeks[uid][k].checkins[g.id + '_w'];
    if (c && typeof c.v === 'number' && itemStatus(weeks, uid, k, g.id + '_w', c.n, c.t, now).s !== 'rejected') { cur = c.v; if (k === w) logged = true; }
  }
  const span = g.target - g.base;
  return { cur, logged, frac: span ? Math.max(0, Math.min(1, (cur - g.base) / span)) : 0 };
}

/* Every week is scored out of 100, however many goals you set:
   50 for dailies (share of daily check-ins hit), 30 for weekly outcomes, 20 for seasonal goals.
   Nothing scores until your goals span three categories. */
function score(weeks, uid, w, now, start) {
  const out = { pts: 0, d: 0, w: 0, s: 0, days: new Set(), daily: {}, nd: 0, reviews: 0, locked: false, cats: 0, valid: false, has: { d: false, w: false, s: false } };
  const wk = (weeks[uid] && weeks[uid][w]) || {}, cs = wk.checkins || {}, goals = goalsFor(weeks, uid, w), se = seasonOf(w, start);
  out.reviews = Object.keys(wk.reviews || {}).length;
  out.locked = goals.length > 0; out.cats = new Set(goals.map(g => g.cat)).size; out.valid = out.cats >= MIN_CATS;
  let dh = 0, dn = 0, ws = 0, wn = 0, ss = 0, sn = 0;
  const dst = {}; for (const d of weekDays(w)) dst[d] = dayState(weeks, uid, w, d, now);
  for (const g of goals) {
    const gok = goalStatus(weeks, uid, g, now).s !== 'rejected';
    const good = (key, c) => !!c && gok && met(g, c) && itemStatus(weeks, uid, w, key, c.n, c.t, now).s !== 'rejected';
    if (g.type === 'd') {
      dn += 7; out.nd++;
      if (gok) for (const d of weekDays(w)) if (dst[d].hits.includes(g.id) && dayCounts(dst[d])) { dh++; out.days.add(d); out.daily[d] = (out.daily[d] || 0) + 1; }
    } else if (g.type === 'w') {
      wn++; const c = cs[g.id + '_w'];
      if (good(g.id + '_w', c)) ws += g.str ? (c.lvl === 's' ? 1 : .8) : 1;
    } else {
      sn++;
      if (gok && g.sid === se.id) { const v = seasonValue(weeks, uid, g, w, se.id, now); if (v.logged) ss += .4 + .6 * Math.min(1, v.frac / (se.week / SEASON_WEEKS)); }
    }
  }
  out.has = { d: dn > 0, w: wn > 0, s: sn > 0 };
  out.d = dn ? 50 * dh / dn : 0; out.w = wn ? 30 * ws / wn : 0; out.s = sn ? 20 * ss / sn : 0;
  out.pts = out.valid ? Math.round(out.d + out.w + out.s) : 0;
  return out;
}

/* Rank by points, then days with a check-in, then reviews done. */
function standings(weeks, uids, w, now, start) {
  const rows = uids.map(u => Object.assign({ u }, score(weeks, u, w, now, start)));
  const cmp = (a, b) => b.pts - a.pts || b.days.size - a.days.size || b.reviews - a.reviews;
  rows.sort(cmp);
  rows.forEach((r, i) => { r.rank = i && cmp(rows[i - 1], r) === 0 ? rows[i - 1].rank : i + 1; });
  return { rows };
}

function streak(weeks, uid, gid, now) {
  let day = gameDay(now), n = 0;
  const hit = d => { const st = dayState(weeks, uid, weekOf(d), d, now); return st.hits.includes(gid) && dayCounts(st); };
  if (hit(day)) n++;
  for (let i = 0; i < 90; i++) { day = addDays(day, -1); if (hit(day)) n++; else break; }
  return n;
}

/* Each week everyone has one assigned ref, rotating so you review a different flatmate each week. */
function refOf(uids, owner, weekIndex) {
  const n = uids.length, i = uids.indexOf(owner);
  if (n < 2 || i < 0) return null;
  return uids[(i + weekIndex % (n - 1) + 1) % n];
}
