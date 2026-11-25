/* ---------- app (standalone: phone number + PIN, own database) ---------- */
const CFG = { url: '__SUPABASE_URL__', key: '__SUPABASE_KEY__' };
const configured = () => /^https?:/.test(CFG.url);
const CATS = ['Athletic', 'Academic', 'Business', 'Creative', 'Life', 'Flat'];
const REASONS = { c: ['Wrong day', "Can't tell", 'Not the goal'], g: ['Too easy', 'Too vague', 'No clear proof'] };
const TPL = [
  { t: 'Hit my protein', c: 'Athletic', p: "Screenshot of today's MyFitnessPal summary", ml: 'Protein', mu: 'g', mo: 'min' },
  { t: 'Stay under my calories', c: 'Athletic', p: "Screenshot of today's MyFitnessPal summary", ml: 'Calories', mu: 'kcal', mo: 'max' },
  { t: '10,000 steps', c: 'Athletic', p: 'Screenshot of the step count', ml: 'Steps', mu: '', mo: 'min', mt: '10000' },
  { t: '2 hours of focused study', c: 'Academic', p: 'Photo of notes or the timer' },
  { t: '1 hour on the business', c: 'Business', p: 'Screenshot of what you shipped' },
  { t: '30 minutes of practice', c: 'Creative', p: 'Photo from the session' },
  { t: 'Read 20 pages', c: 'Life', p: 'Photo of the page you reached' }
];
const S = { mode: 'loading', why: '', me: null, players: {}, weeks: {}, config: {}, profiles: {}, auth: 'join', tab: 'today', lbTab: 'week', lbWeek: null, open: null, edit: null, rejecting: null, photos: {}, busy: null, dirty: false, stale: false, pending: null };
let db = null, token = null;
try { token = localStorage.getItem('yuzu_token'); } catch (e) {}
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const now = () => Date.now();
const rid = () => Math.random().toString(36).slice(2, 8);
const ord = n => n + (n % 100 > 10 && n % 100 < 14 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const dur = ms => { const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60); return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + (m % 60) + 'm' : (m % 60) + 'm'; };
const wd = day => parse(day).toLocaleDateString('en-GB', { weekday: 'short' });
const prof = u => S.profiles[u] || {};
const name = u => (S.players[u] && S.players[u].nick) || prof(u).name || (u === S.me ? 'You' : 'Flatmate');
const avatar = u => `<span class="av">${esc(name(u).slice(0, 1).toUpperCase())}</span>`;
const curWeek = () => weekOf(gameDay(now()));
const startW = () => S.config.seasonStart || curWeek();
const seasonInfo = () => seasonOf(curWeek(), startW());
const eff = (u, w) => goalsFor(S.weeks, u, w);
const uidsFor = w => Object.keys(S.players).filter(u => (S.players[u].joined || 0) < weekEnd(w)).sort();
const myWeek = w => S.weeks[S.me] && S.weeks[S.me][w];
const fmtV = (v, unit) => v + (unit ? (unit.length > 1 ? ' ' : '') + unit : '');

function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 4000); }


/* ---------- data layer: every call goes through a database function that checks the session token ---------- */
const live = () => S.mode === 'live';
async function rpc(fn, args) {
  let r;
  try { r = await fetch(CFG.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify(args) }); } catch (e) { throw { code: 'offline' }; }
  if (!r.ok) throw { code: 'http', status: r.status };
  const j = await r.json(); if (j && j.error) throw { code: j.error };
  return j;
}
function merge(a, b) { for (const k in b) { const v = b[k]; if (v && typeof v === 'object' && !Array.isArray(v)) { if (!a[k] || typeof a[k] !== 'object' || Array.isArray(a[k])) a[k] = {}; merge(a[k], v); } else a[k] = v; } return a; }
function onWriteError(e) {
  if (e && e.code === 'NO_SESSION') return signOut(true);
  toast(e && e.code === 'NAME_TAKEN' ? 'That name is already in the league.' : e && e.code === 'FULL' ? 'Yuzu is out of photo space. Ask whoever set it up to clear old photos.' : e && e.code === 'offline' ? "You're offline. That change wasn't saved." : "Couldn't save. Try again in a moment.");
}
let pend = 0, syncing = false; const chains = {};
function persist(kind, key, full) {
  if (!live()) return Promise.resolve(true);
  pend++;
  const run = async () => { try { await rpc('yz_put', { p_token: token, p_kind: kind, p_key: key, p_data: full() }); return true; } catch (e) { onWriteError(e); return false; } finally { pend--; } };
  return chains[kind + key] = (chains[kind + key] || Promise.resolve()).then(run);
}
function saveProfile(patch) { S.players[S.me] = merge(S.players[S.me] || {}, clone(patch)); render(true); return persist('profile', '', () => clone(S.players[S.me])); }
function saveWeek(w, patch) {
  S.weeks[S.me] = S.weeks[S.me] || {};
  const wk = S.weeks[S.me][w] = S.weeks[S.me][w] || { checkins: {}, reviews: {} };
  merge(wk, clone(patch)); render(true);
  return persist('week', w, () => clone(S.weeks[S.me][w]));
}
function saveConfig() { return Promise.resolve(true); }
async function sync() {
  if (!token || syncing) return; syncing = true;
  try {
    const j = await rpc('yz_sync', { p_token: token, p_since: addDays(curWeek(), -98) });
    const mineP = S.players[S.me], mineW = S.weeks[S.me], keep = pend > 0 && S.me === j.me;
    S.me = j.me; S.config = j.config || {}; S.players = j.players || {}; S.weeks = j.weeks || {};
    if (keep) { if (mineP) S.players[S.me] = mineP; if (mineW) S.weeks[S.me] = mineW; }
    for (const u in S.players) if (!S.weeks[u]) S.weeks[u] = {};
    S.mode = 'live'; S.stale = false; render();
  } catch (e) {
    if (e.code === 'NO_SESSION') signOut(true);
    else if (S.mode === 'loading' || S.mode === 'down') { S.mode = 'down'; render(true); }
    else { S.stale = true; render(); }
  } finally { syncing = false; }
}
function signOut(expired) {
  if (token && !expired) rpc('yz_logout', { p_token: token }).catch(() => {});
  token = null; try { localStorage.removeItem('yuzu_token'); } catch (e) {}
  S.me = null; S.players = {}; S.weeks = {}; S.photos = {}; S.edit = null; S.rename = false; S.tab = 'today';
  if (!configured()) { sample(); if (expired) toast('Please sign in again.'); return; }
  S.mode = 'auth'; S.auth = 'login';
  render(true); if (expired) toast('Please sign in again.');
}
setInterval(() => { if (token && document.visibilityState === 'visible' && S.mode !== 'auth') sync(); }, 20000);
document.addEventListener('visibilitychange', () => { if (token && document.visibilityState === 'visible' && S.mode !== 'auth') sync(); });

/* ---------- photos: shrunk on the phone, stored in the database, fetched when first shown ---------- */
async function shrink(file, max) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c;
  } finally { URL.revokeObjectURL(url); }
}
async function storePhoto(file, pid) {
  let d = '';
  for (const max of [1000, 720, 480]) {
    const c = await shrink(file, max); let q = .72; d = c.toDataURL('image/jpeg', q);
    while (d.length > 260000 && q > .35) { q -= .12; d = c.toDataURL('image/jpeg', q); }
    if (d.length <= 380000) break;
  }
  if (live()) await rpc('yz_photo_put', { p_token: token, p_id: pid, p_data: d });
  S.photos[S.me + '|' + pid] = d;
  return { a: null, ph: 1 };
}
function photo(u, pid, c, cls) {
  const id = u + '|' + pid, d = S.photos[id];
  if (d) return `<img class="${cls}" data-zoom src="${esc(d)}" alt="Proof image">`;
  if (c.ph && d === undefined && live()) return `<div class="${cls} ph" data-ph="${esc(id)}">Loading</div>`;
  return `<div class="${cls} ph">${c.ph && live() ? 'No image' : 'Sample proof'}</div>`;
}
const fetching = new Set();
function hydrate() {
  if (!live()) return;
  document.querySelectorAll('[data-ph]').forEach(el => {
    const id = el.dataset.ph; if (fetching.has(id)) return; fetching.add(id);
    const i = id.indexOf('|');
    rpc('yz_photo_get', { p_token: token, p_owner: id.slice(0, i), p_id: id.slice(i + 1) }).then(j => {
      S.photos[id] = typeof j.d === 'string' && j.d.startsWith('data:image/') ? j.d : null; render();
    }).catch(() => { fetching.delete(id); });
  });
}

