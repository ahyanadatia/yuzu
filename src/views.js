/* ---------- shared bits ---------- */
const YUZU = `<svg class="yz" viewBox="0 0 120 120" aria-hidden="true"><path class="leaf" d="M63 24C68 6 90 0 106 8 100 26 82 34 63 24Z" fill="#8DC63F"/><path d="M63 24C76 20 90 15 104 9" stroke="#5E9A22" stroke-width="2" fill="none"/><path d="M56 30l3-10 6 1-2 10z" fill="#6B5B2A"/><path d="M60 28c8-5 15-2 20 2 14 2 26 16 26 34 0 26-20 46-46 46S14 90 14 64c0-18 12-32 26-34 5-4 12-7 20-2z" fill="#F5E447"/><path d="M96 46c6 10 8 22 5 33-5 17-20 29-38 31 22 2 43-14 43-42 0-8-4-16-10-22z" fill="#DCC72E"/><g fill="#CDB820"><circle cx="38" cy="58" r="2"/><circle cx="52" cy="78" r="2"/><circle cx="72" cy="60" r="2"/><circle cx="84" cy="80" r="2"/><circle cx="62" cy="96" r="2"/><circle cx="34" cy="82" r="2"/><circle cx="58" cy="46" r="1.6"/><circle cx="90" cy="60" r="1.6"/></g><ellipse class="shine" cx="40" cy="48" rx="11" ry="6" transform="rotate(-35 40 48)" fill="#FFF8B0" opacity=".75"/></svg>`;
function celebrate(text) {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return toast(text);
  const el = document.createElement('div'); el.className = 'pop'; el.setAttribute('role', 'status');
  el.innerHTML = `<div class="pop-in">${YUZU}<svg class="pop-mark" viewBox="136 88 406 368" aria-hidden="true"><g fill="#F5E447"><polygon points="140,92 275,123 333,238 203,205"/><polygon points="538,92 407,123 345,238 473,205"/><polygon points="340,245 388,312 340,452 290,312"/></g></svg>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<i class="drop" style="--a:${a}deg"></i>`).join('')}<p class="pop-text"></p></div>`;
  el.querySelector('.pop-text').textContent = text;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2150);
}
function mark(l, r, b) {
  const seg = (pts, f) => `<polygon points="${pts}" fill="${f > 0 ? '#F5E447' : '#3B3E44'}" opacity="${f > 0 ? (.35 + .65 * Math.min(1, f)).toFixed(2) : 1}"/>`;
  return `<svg viewBox="136 88 406 368" role="img" aria-label="Daily, weekly and season progress" class="seg3">${seg('140,92 275,123 333,238 203,205', l)}${seg('538,92 407,123 345,238 473,205', r)}${seg('340,245 388,312 340,452 290,312', b)}</svg>`;
}
function banner() {
  if (S.mode === 'sample') return `<div class="note"><b>Sample data.</b> This is a preview with made-up flatmates. Nothing here is saved.${configured() ? ' <button type="button" class="link" data-act="signin">Sign in to your league</button>' : ''}</div>`;
  return S.stale ? `<div class="note">Still connecting. What you see may be out of date.</div>` : '';
}
const sel = (id, val) => `<select id="${id}">${CATS.map(c => `<option${c === val ? ' selected' : ''}>${c}</option>`).join('')}</select>`;
const TYPE = { d: 'Daily', w: 'Weekly', s: 'Season' };
const goalOf = (goals, key) => goals.find(g => key.startsWith(g.id + '_'));
const hasProof = (wk, g) => g.type === 'd' ? Object.values((wk && wk.days) || {}).some(r => r && r.ticks && r.ticks[g.id] != null) : !!((wk && wk.checkins) || {})[g.id + '_w'];
const dayOf = (u, w, d, t) => dayState(S.weeks, u, w, d, t);
const rule = m => (m.op === 'max' ? 'at most ' : 'at least ') + fmtV(m.t, m.u);
const brief = g => g.type === 's' ? `${fmtV(g.base, g.unit)} to ${fmtV(g.target, g.unit)} in ${SEASON_WEEKS} weeks` : g.m ? g.m.l + ' ' + rule(g.m) : '';
function typed(g, c) {
  if (typeof c.v !== 'number') return '';
  if (g.type === 's') return `<p class="typed"><b>${esc(fmtV(c.v, g.unit))}</b> · target ${esc(fmtV(g.target, g.unit))}</p>`;
  return g.m ? `<p class="typed"><b>${esc(fmtV(c.v, g.m.u))}</b> ${esc(g.m.l.toLowerCase())} · target ${esc(rule(g.m))}</p>` : '';
}
function stateChip(g, c, st) {
  if (st.s === 'rejected') return `<span class="state bad">Rejected${st.reason ? ' · ' + esc(st.reason) : ''}</span>`;
  if (!met(g, c)) return `<span class="state bad">Target missed</span>`;
  return st.s === 'counted' ? `<span class="state wait">Counted · awaiting review</span>` : `<span class="state ok">Verified</span>`;
}
const hm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const parentOf = (goals, g) => g.up ? goals.find(x => x.id === g.up && x.type === 's') : null;
function stepLine(u, g, w, t) {
  const cs = ((S.weeks[u] && S.weeks[u][w]) || {}).checkins || {}, ok = key => { const c = cs[key]; return !!c && met(g, c) && itemStatus(S.weeks, u, w, key, c.n, c.t, t).s !== 'rejected'; };
  if (g.type === 'd') { const today = gameDay(t), ds = weekDays(w), hit = d => { const st = dayOf(u, w, d, t); return st.hits.includes(g.id) && dayCounts(st); }; return `<li><span>${esc(g.title)}</span><span class="dots">${ds.map(d => `<i class="dot ${hit(d) ? 'f' : ''}${d === today ? ' today' : ''}"></i>`).join('')}<span class="wkm">${ds.filter(hit).length}/7</span></span></li>`; }
  return `<li><span>${esc(g.title)}</span><span class="wkm">${ok(g.id + '_w') ? 'Done this week' : 'Not yet this week'}</span></li>`;
}
const track = (u, goals, g, w, t) => { const kids = goals.filter(x => x.up === g.id && x.type !== 's'); return kids.length ? `<p class="eyebrow">The track · steps that build this</p><ul class="track">${kids.map(k => stepLine(u, k, w, t)).join('')}</ul>` : ''; };
const board = (w, t) => standings(S.weeks, uidsFor(w), w, t, startW());
const myRow = (w, t) => board(w, t).rows.find(r => r.u === S.me) || { pts: 0, rank: 0 };
const refFor = (u, w) => refOf(uidsFor(w), u, seasonOf(w, startW()).index);
const whenOf = (g, key, c) => g.type === 'd' ? wd(key.slice(g.id.length + 1)) + ' · Daily' : g.type === 's' ? 'Season log' : 'Weekly' + (g.str ? ' · ' + (c.lvl === 's' ? 'Stretch' : 'Standard') : '');
function myReview(key, n) { const m = S.weeks[S.me] || {}; for (const k in m) { const r = m[k].reviews && m[k].reviews[key]; if (r && r.n === n) return r; } return null; }
function reviewRow(kind, id, attrs, st, okLabel, noLabel) {
  if (S.rejecting === id) return `<p class="small mute">Why?</p><div class="row">${REASONS[kind].map(r => `<button class="btn danger sm" data-act="rv" data-v="0" data-r="${esc(r)}" ${attrs}>${esc(r)}</button>`).join('')}<button class="link" data-act="rej" data-id="">Cancel</button></div>`;
  return `<div class="row">${okLabel ? `<button class="btn" data-act="rv" data-v="1" ${attrs}>${okLabel}</button>` : ''}${st.s === 'rejected' ? '' : `<button class="${okLabel ? 'btn ghost sm' : 'link'}" data-act="rej" data-id="${esc(id)}">${noLabel}</button>`}</div>`;
}

/* ---------- Today ---------- */
function viewToday() {
  const t = now(), w = curWeek(), day = gameDay(t), se = seasonInfo(), out = [banner()];
  if (!S.players[S.me]) return out.join('') + joinCard();
  const wk = myWeek(w) || {}, cs = wk.checkins || {}, goals = eff(S.me, w);
  if (S.edit) return out.join('') + goalForm();
  out.push(whoCard());
  const rows = board(w, t).rows, me = rows.find(r => r.u === S.me) || { pts: 0, rank: 1, d: 0, w: 0, s: 0, cats: 0 };
  const ds = goals.filter(g => g.type === 'd'), ws = goals.filter(g => g.type === 'w'), ss = goals.filter(g => g.type === 's'), top = rows[0], second = rows[1];
  const done = (g, key) => { const c = cs[key]; return !!c && met(g, c); };
  const frac = (list, key) => list.length ? list.filter(g => done(g, key(g))).length / list.length : 0;
  const gap = rows.length < 2 ? 'Waiting for flatmates to join' : me.rank === 1 ? (second && me.pts > second.pts ? 'Leading by ' + (me.pts - second.pts) : 'Level at the top') : (top.pts - me.pts) + ' behind ' + esc(name(top.u));
  const ref = refFor(S.me, w), mine = uidsFor(w).find(u => u !== S.me && refFor(u, w) === S.me);
  const dst = dayOf(S.me, w, day, t), rec = (wk.days || {})[day] || {};
  out.push(`<section class="card"><div class="stand">${mark(ds.length ? dst.hits.length / ds.length : 0, frac(ws, g => g.id + '_w'), frac(ss, g => g.id + '_w'))}<div><div class="big">${me.pts}<small> / 100</small></div><p><b>${ord(me.rank || 1)}</b> of ${rows.length || 1} · ${gap}</p></div></div><div class="parts"><span class="part">Daily <b>${Math.round(me.d)}</b>/50</span><span class="part">Weekly <b>${Math.round(me.w)}</b>/30</span><span class="part">Season <b>${Math.round(me.s)}</b>/20</span></div><p class="small mute">Today closes in <b>${dur(dayEnd(day) - t)}</b>${ref ? ` · Your ref this week is <b>${esc(name(ref))}</b>${mine ? `, and you ref <b>${esc(name(mine))}</b>` : ''}` : ''}</p></section>`);
  if (!goals.length) return out.join('') + startCard(goals);
  const cats = [...new Set(goals.map(g => g.cat))];
  if (cats.length < MIN_CATS || !ds.length || !ws.length || !ss.length) out.push(checklist(goals, cats));
  if (ds.length) {
    const list = ds.map(g => dailyCard(g, w, t, rec, wk, goals)).join('');
    const close = closeCard(w, day, t, dst, rec, goals);
    const head = `<p class="sec">Today · ${dst.hits.length} of ${ds.length} done</p>`;
    // Keep the upload / problem card at the top. A finished day stays under the ticks
    // so the last status on the page is still the day's verdict.
    const pin = dst.s === 'due' || dst.s === 'void' || dst.s === 'rejected';
    out.push(pin ? close + head + list : head + list + close);
  }
  if (ws.length) out.push(`<p class="sec">This week</p>` + ws.map(g => goalCard(g, w, day, t, se)).join(''));
  if (ss.length) out.push(`<p class="sec">This season · week ${se.week} of ${SEASON_WEEKS}</p>` + ss.map(g => goalCard(g, w, day, t, se)).join(''));
  out.push(addRow());
  return out.join('');
}
const addRow = () => `<div class="row"><button class="btn ghost sm" data-act="add" data-t="d">Add daily</button><button class="btn ghost sm" data-act="add" data-t="w">Add weekly</button><button class="btn ghost sm" data-act="add" data-t="s">Add seasonal</button></div>`;
function checklist(goals, cats) {
  const li = (ok, text) => `<li class="${ok ? 'done' : ''}">${text}</li>`, has = t => goals.some(g => g.type === t);
  return `<section class="card"><p class="eyebrow">Your set-up</p><ul class="checklist">${li(cats.length >= MIN_CATS, `Goals across ${MIN_CATS} categories${cats.length ? ' (you have ' + esc(list(cats)) + ')' : ''}. <b>Nothing scores until this is done.</b>`)}${li(has('d'), 'A daily habit: worth up to 50 a week')}${li(has('w'), 'A weekly outcome: worth up to 30')}${li(has('s'), 'A seasonal goal: worth up to 20')}</ul></section>`;
}
const nameField = (id, val) => `<label>Your name in the league<input type="text" id="${id}" maxlength="20" autocomplete="nickname" value="${esc(val)}" placeholder="Maya"></label>`;
function joinCard() { return `<section class="card skel" aria-live="polite"><p class="eyebrow">Earn your rank.</p><div class="sk sk-title"></div><div class="sk sk-block"></div><div class="sk sk-line"></div></section>`; }
const normPhone = v => { let d = String(v || '').replace(/[^0-9+]/g, ''); if (d.startsWith('00')) d = '+' + d.slice(2); else if (d.startsWith('0')) d = '+44' + d.slice(1); else if (!d.startsWith('+')) d = '+' + d; return /^\+[0-9]{8,15}$/.test(d) ? d : null; };
function authView() {
  const join = S.auth === 'join';
  return `<div class="hero">${YUZU}<i class="sh"></i></div><form class="card" data-form="auth"><p class="eyebrow">Earn your rank.</p><h2>${join ? 'Join the league' : 'Welcome back'}</h2><div class="seg"><button type="button" data-act="auth" data-v="join" aria-pressed="${join}">New here</button><button type="button" data-act="auth" data-v="login" aria-pressed="${!join}">Sign in</button></div><label>Phone number<input type="tel" id="a_phone" autocomplete="tel" inputmode="tel" placeholder="07700 900123"></label>${join ? nameField('a_name', '') : ''}<label>${join ? 'Choose a 6-digit PIN' : 'Your PIN'}<input type="password" id="a_pin" inputmode="numeric" maxlength="6" pattern="[0-9]*" autocomplete="${join ? 'new-password' : 'current-password'}"></label>${join ? `<label>Flat invite code<input type="text" id="a_code" autocapitalize="characters" autocomplete="off" placeholder="Ask a flatmate for it"></label>` : ''}<p class="small mute">${join ? 'Your number is how you sign in. No text is sent, so pick a PIN you will remember.' : 'Forgot your PIN? Ask whoever set Yuzu up to reset it.'}</p><p class="err" id="authErr" role="alert"></p><button class="btn" id="authGo">${join ? 'Join' : 'Sign in'}</button>${configured() ? '<button type="button" class="link" data-act="preview">Look around first, with sample data</button>' : ''}</form>`;
}
function whoCard() {
  if (S.rename) return `<form class="card" data-form="rename">${nameField('nick', name(S.me))}<p class="err" id="nickErr" role="alert"></p><div class="row"><button class="btn sm">Save name</button><button type="button" class="btn ghost sm" data-act="rename" data-v="">Cancel</button></div></form>`;
  const others = Object.keys(S.players).filter(u => u !== S.me).map(name);
  return `<div class="acct">${avatar(S.me)}<div class="acct-id"><b>${esc(name(S.me))}</b>${others.length ? `<span class="mute">with ${esc(list(others))}</span>` : ''}</div><button type="button" class="link" data-act="rename" data-v="1">Change name</button><button type="button" class="link" data-act="signout">Sign out</button></div>`;
}
function nickOk() {
  const v = $('nick').value.trim().replace(/\s+/g, ' ');
  if (v.length < 2) { $('nickErr').textContent = 'Add a name of at least two letters.'; return null; }
  if (Object.keys(S.players).some(u => u !== S.me && name(u).toLowerCase() === v.toLowerCase())) { $('nickErr').textContent = v + ' is already in the league. Add an initial.'; return null; }
  return v;
}
function startCard(goals) {
  return `<section class="card"><p class="eyebrow">Step 1</p><h2>Set your goals</h2><p class="small mute">Add as many as you like across three time frames. Your week is always scored out of 100, so more goals means more to hit, not more points.</p>${checklist(goals, [])}<p class="eyebrow">Start from a common daily</p><div class="chips">${TPL.map((x, i) => `<button class="chip" data-act="tpl" data-i="${i}">${esc(x.t)}</button>`).join('')}</div>${addRow()}</section>`;
}
function dailyCard(g, w, t, rec, wk, goals) {
  const v = rec.ticks ? rec.ticks[g.id] : null, on = v != null && v !== false, locked = !!rec.closed, gs = goalStatus(S.weeks, S.me, g, t), sk = streak(S.weeks, S.me, g.id, t), par = parentOf(goals, g);
  const num = typeof v === 'number' ? ' · ' + esc(fmtV(v, g.m ? g.m.u : '')) : '';
  let h = `<article class="card goal"><div class="gh"><span class="tag">${esc(g.cat)}</span><span class="kind">Daily${sk > 1 ? ' · ' + sk + '-day streak' : ''}</span></div><h3>${esc(g.title)}</h3>`;
  if (par) h += `<p class="small mute">Step toward <b>${esc(par.title)}</b></p>`;
  h += `<p class="proof">If drawn, show: ${esc(g.proof)}${g.m ? ' · ' + esc(brief(g)) : ''}</p>`;
  if (gs.s === 'rejected') h += `<p class="state bad">Goal pushed back${gs.reason ? ' · ' + esc(gs.reason) : ''}</p><p class="small mute">It scores nothing until you change it or two flatmates sign it off.</p>`;
  else if (gs.s === 'counted') h += `<p class="small mute">Awaiting sign-off from your ref. It counts in the meantime.</p>`;
  const state = on ? (metV(g, v) ? `<span class="state ok">Done${num}</span>` : `<span class="state bad">Target missed${num}</span>`) : `<span class="state wait">Not done</span>`;
  if (locked) h += state;
  else if (on) h += `<div class="line"><div>${state}</div><button class="link" data-act="untick" data-g="${g.id}">Undo</button></div>`;
  else if (g.m) h += `<div class="row"><label>${esc(g.m.l)} today${g.m.u ? ' (' + esc(g.m.u) + ')' : ''}<input type="number" id="v_${g.id}" step="any" inputmode="decimal"></label><button class="btn ghost" data-act="tick" data-g="${g.id}">Done</button></div>`;
  else h += `<button class="btn ghost" data-act="tick" data-g="${g.id}">Mark done</button>`;
  if (!hasProof(wk, g)) h += `<button class="link" data-act="editGoal" data-g="${g.id}">Edit or remove</button>`;
  return h + '</article>';
}
function closeCard(w, day, t, st, rec, goals) {
  const left = dur(dayEnd(day) - t), ag = goals.find(g => g.id === st.audit);
  if (st.s === 'none') return `<div class="note" id="spot">Tick what you did today. When you're finished, close out the day: <b>one image proves all of it.</b></div>`;
  if (st.s === 'open') return `<section class="card show" id="spot"><p class="eyebrow">Close out today</p><h3>${st.hits.length} done. One will be drawn as your spot check.</h3><p class="small mute">You'll upload a single image for the goal that's drawn. After closing out, today's ticks can't change.</p><button class="btn" data-act="close">Close out the day</button></section>`;
  if (st.s === 'due') return `<section class="card show" id="spot"><p class="eyebrow">Spot check</p><h3>Show proof of: ${esc(ag ? ag.title : '')}</h3><p class="proof">${esc(ag ? ag.proof : '')}${ag && typeof rec.ticks[ag.id] === 'number' ? ' · you typed ' + esc(fmtV(rec.ticks[ag.id], ag.m ? ag.m.u : '')) : ''}</p>${S.busy === 'day' ? `<p class="state wait">Uploading…</p>` : `<label class="btn">Upload image<input type="file" accept="image/*" class="vh" data-day="${day}"></label>`}<p class="small mute">Due in ${left}, before the day closes. Without it, today scores nothing.</p></section>`;
  if (st.s === 'void') return `<div class="note" id="spot"><b>Today can't be scored.</b> The day was closed out without a valid spot check.</div>`;
  const retake = (st.s === 'counted' && !st.ok) || (st.s === 'rejected' && !rec.re && t - st.noT < 12 * H);
  const chip = st.s === 'rejected' ? `<span class="state bad">Day rejected${st.reason ? ' · ' + esc(st.reason) : ''}</span>` : st.s === 'counted' ? `<span class="state wait">Day counted · awaiting review</span>` : `<span class="state ok">Day verified</span>`;
  return `<section class="card" id="spot"><p class="eyebrow">Today is closed out</p><div class="line">${photo(S.me, w + '_day_' + day + '_' + rec.n, rec, 'thumb')}<div>${chip}<p class="small mute">Spot check: ${esc(ag ? ag.title : '')}</p>${st.s === 'rejected' ? `<p class="small mute">Two flatmates approving overturns it.</p>` : ''}</div>${retake && S.busy !== 'day' ? `<label class="link">Replace image<input type="file" accept="image/*" class="vh" data-day="${day}" data-re="${st.s === 'rejected' ? 1 : ''}"></label>` : ''}</div></section>`;
}
function goalCard(g, w, day, t, se) {
  const wk = myWeek(w) || {}, cs = wk.checkins || {}, daily = g.type === 'd', seasonal = g.type === 's', key = daily ? g.id + '_' + day : g.id + '_w', c = cs[key];
  const gs = goalStatus(S.weeks, S.me, g, t), sk = daily ? streak(S.weeks, S.me, g.id, t) : 0;
  let h = `<article class="card goal"><div class="gh"><span class="tag">${esc(g.cat)}</span><span class="kind">${TYPE[g.type]}${sk > 1 ? ' · ' + sk + '-day streak' : ''}</span></div><h3>${esc(g.title)}</h3>`;
  if (g.type === 'w') h += `<div class="targets"><span><b>Standard</b>${esc(g.std)}</span>${g.str ? `<span><b>Stretch</b>${esc(g.str)}</span>` : ''}</div>`;
  let stale = false;
  if (seasonal) {
    stale = g.sid !== se.id;
    const v = seasonValue(S.weeks, S.me, g, w, se.id, t), pace = v.frac >= se.week / SEASON_WEEKS;
    h += seasonBar(g, v) + (stale ? `<p class="state bad">New season</p><p class="small mute">Set a fresh start and target to score this goal.</p><button class="btn" data-act="editGoal" data-g="${g.id}">Reset for this season</button>` : `<p class="small mute">${Math.round(v.frac * 100)}% of the way · ${pace ? 'on pace' : 'behind pace'} for week ${se.week}</p>`);
  }
  const all = eff(S.me, w), par = parentOf(all, g);
  if (seasonal) h += (track(S.me, all, g, w, t) || `<p class="small mute">No steps yet. Add a daily or weekly goal that builds toward this.</p>`) + `<div class="row"><button class="link" data-act="add" data-t="d" data-up="${g.id}">Add a daily step</button><button class="link" data-act="add" data-t="w" data-up="${g.id}">Add a weekly step</button></div>`;
  if (par) h += `<p class="small mute">Step toward <b>${esc(par.title)}</b></p>`;
  h += `<p class="proof">Proof: ${esc(g.proof)}${g.m ? ' · ' + esc(brief(g)) : ''}</p>`;
  if (gs.s === 'rejected') h += `<p class="state bad">Goal pushed back${gs.reason ? ' · ' + esc(gs.reason) : ''}</p><p class="small mute">It scores nothing until you change it or two flatmates sign it off.</p>`;
  else if (gs.s === 'counted') h += `<p class="small mute">Awaiting sign-off from your ref. It counts in the meantime.</p>`;
  if (stale) { /* reset first */ }
  else if (S.busy === key) h += `<p class="state wait">Uploading…</p>`;
  else if (!c) {
    const lab = seasonal ? "This week's result" + (g.unit ? ' (' + esc(g.unit) + ')' : '') : g.m ? esc(g.m.l) + (daily ? ' today' : '') + (g.m.u ? ' (' + esc(g.m.u) + ')' : '') : '';
    const num = lab ? `<label>${lab}<input type="number" id="v_${g.id}" step="any" inputmode="decimal"></label>` : '';
    const b = (lvl, label, cls) => `<label class="btn${cls}" data-up="${g.id}">${label}<input type="file" accept="image/*" class="vh" data-g="${g.id}" data-key="${key}" data-lvl="${lvl}"></label>`;
    h += `<div class="row">${num}${g.type === 'w' && g.str ? b('n', 'Image: Standard', '') + b('s', 'Image: Stretch', ' ghost') : b('', seasonal ? 'Log with image' : 'Upload image', '')}</div>`;
  } else {
    const st = itemStatus(S.weeks, S.me, w, key, c.n, c.t, t);
    const retake = (st.s === 'counted' && !st.ok) || (st.s === 'rejected' && !c.re && t - st.noT < 12 * H);
    h += `<div class="line">${photo(S.me, w + '_' + key + '_' + c.n, c, 'thumb')}<div>${stateChip(g, c, st)}${typed(g, c)}${g.type === 'w' && g.str ? `<p class="small mute">${c.lvl === 's' ? 'Stretch' : 'Standard'} target</p>` : ''}${st.s === 'rejected' ? `<p class="small mute">Two flatmates approving overturns it.</p>` : ''}</div>${retake ? `<label class="link">Replace image<input type="file" accept="image/*" class="vh" data-g="${g.id}" data-key="${key}" data-lvl="${c.lvl || ''}" data-re="${st.s === 'rejected' ? 1 : ''}" data-keep="1"></label>` : ''}</div>`;
  }
  if (!hasProof(wk, g) && !stale) h += `<button class="link" data-act="editGoal" data-g="${g.id}">Edit or remove</button>`;
  return h + '</article>';
}
const seasonBar = (g, v) => `<div class="bar" role="img" aria-label="${Math.round(v.frac * 100)}% of the way to target"><i style="width:${Math.round(v.frac * 100)}%"></i></div><div class="barlab"><span>Start <b>${esc(fmtV(g.base, g.unit))}</b></span><span>Now <b>${esc(fmtV(v.cur, g.unit))}</b></span><span>Target <b>${esc(fmtV(g.target, g.unit))}</b></span></div>`;
function goalForm() {
  const e = S.edit, g = e.g, ty = g.type, word = { d: 'daily habit', w: 'weekly outcome', s: 'seasonal goal' }[ty];
  let h = `<form class="card" data-form="goal"><p class="eyebrow">${e.i < 0 ? 'New' : 'Edit'} ${word}</p><h2>${{ d: 'Something you do every day', w: 'Something you finish this week', s: 'A number you move in ' + SEASON_WEEKS + ' weeks' }[ty]}</h2><label>${{ d: 'Habit', w: 'Outcome', s: 'What you are improving' }[ty]}<input type="text" id="e_t" maxlength="60" value="${esc(g.title)}" placeholder="${{ d: 'Hit my protein', w: 'Finish a timed past paper', s: 'Timed past paper score' }[ty]}"></label><div class="row"><label>Category${sel('e_c', g.cat || 'Athletic')}</label><label>What image will prove it<input type="text" id="e_p" maxlength="80" value="${esc(g.proof)}" placeholder="${ty === 's' ? 'Photo of the result' : 'MyFitnessPal summary'}"></label></div><p class="small mute">Describe the image here. You upload the actual photo or screenshot each time you check in.</p>`;
  if (ty === 'w') h += `<label>Standard target<input type="text" id="e_s" maxlength="80" value="${esc(g.std)}" placeholder="One paper under exam conditions"></label><label>Stretch target (optional; Standard then earns 80%)<input type="text" id="e_x" maxlength="80" value="${esc(g.str)}" placeholder="Score 65% or more"></label>`;
  if (ty === 's') h += `<div class="row"><label>Where you are now<input type="number" id="e_b" step="any" inputmode="decimal" value="${esc(g.base)}" placeholder="54"></label><label>Target by week ${SEASON_WEEKS}<input type="number" id="e_g" step="any" inputmode="decimal" value="${esc(g.target)}" placeholder="65"></label><label>Unit<input type="text" id="e_u" maxlength="8" value="${esc(g.unit)}" placeholder="%"></label></div><p class="small mute">Each week you log the latest number with proof. Staying on pace earns the full season score.</p>`;
  else {
    const ss = eff(S.me, curWeek()).filter(x => x.type === 's');
    if (ss.length) h += `<label>Step toward a seasonal goal (optional)<select id="e_up"><option value="">Stands on its own</option>${ss.map(x => `<option value="${x.id}"${g.up === x.id ? ' selected' : ''}>${esc(x.title)}</option>`).join('')}</select></label>`;
  }
  if (ty !== 's') h += `<fieldset><legend>Number to type at check-in (optional)</legend><p class="small mute">You type it and your ref checks it against the screenshot. Miss the target and that check-in scores nothing.</p><div class="row"><label>What<input type="text" id="e_ml" maxlength="20" value="${esc(g.ml)}" placeholder="Protein"></label><label>Rule<select id="e_mo"><option value="min"${g.mo !== 'max' ? ' selected' : ''}>At least</option><option value="max"${g.mo === 'max' ? ' selected' : ''}>At most</option></select></label></div><div class="row"><label>Target<input type="number" id="e_mt" step="any" inputmode="decimal" value="${esc(g.mt)}" placeholder="150"></label><label>Unit<input type="text" id="e_mu" maxlength="8" value="${esc(g.mu)}" placeholder="g"></label></div></fieldset>`;
  return h + `<p class="err" id="goalErr" role="alert"></p><div class="row"><button class="btn">Save goal</button><button type="button" class="btn ghost sm" data-act="cancelEdit">Cancel</button>${e.i >= 0 ? `<button type="button" class="btn danger sm" data-act="rmGoal">Remove</button>` : ''}</div></form>`;
}

/* ---------- Feed: your ref duty first, then everyone's proof ---------- */
function inboxItems(t) {
  const items = []; if (!S.players[S.me]) return items;
  const cw = curWeek(), pw = addDays(cw, -7), ws = t < weekFinal(pw) ? [pw, cw] : [cw];
  for (const u of Object.keys(S.players)) {
    if (u === S.me) continue;
    for (const g of eff(u, cw)) {
      const st = goalStatus(S.weeks, u, g, t), key = 'g_' + g.id;
      if (myReview(u + '__' + key, g.n || 1)) continue;
      if (st.s === 'rejected' || (st.s === 'counted' && refFor(u, cw) === S.me)) items.push({ kind: 'g', u, w: cw, key, n: g.n || 1, g, st, t: g.at || 0 });
    }
    for (const w of ws) {
      const wk = S.weeks[u] && S.weeks[u][w]; if (!wk) continue;
      const goals = eff(u, w), mine = (myWeek(w) || {}).reviews || {}, isRef = refFor(u, w) === S.me;
      for (const d in wk.days || {}) {
        const st = dayOf(u, w, d, t); if (!st.rec) continue;
        const r = mine[u + '__day_' + d]; if (r && r.n === st.rec.n) continue;
        if (st.s === 'rejected' || (st.s === 'counted' && isRef)) items.push({ kind: 'day', u, w, d, key: 'day_' + d, n: st.rec.n, st, t: st.rec.t });
      }
      for (const key in wk.checkins || {}) {
        const c = wk.checkins[key], g = goalOf(goals, key); if (!g || !c || g.type === 'd') continue;
        const r = mine[u + '__' + key]; if (r && r.n === c.n) continue;
        const st = itemStatus(S.weeks, u, w, key, c.n, c.t, t);
        if (st.s === 'rejected' || (st.s === 'counted' && isRef)) items.push({ kind: 'c', u, w, key, n: c.n, c, g, st, t: c.t });
      }
    }
  }
  return items.sort((a, b) => a.t - b.t);
}
function dayBody(u, w, d, st) {
  const goals = eff(u, w), rec = st.rec, ag = goals.find(g => g.id === st.audit);
  return `<div class="who">${avatar(u)}<b>${esc(name(u))}</b><span class="kind">${wd(d)} · closed ${hm(rec.t)}</span></div><h3>Spot check: ${esc(ag ? ag.title : '')}</h3><p class="proof">Should show: ${esc(ag ? ag.proof : '')}</p>${photo(u, w + '_day_' + d + '_' + rec.n, rec, 'shot')}<p class="eyebrow">Claimed for the day</p><ul class="track">${st.hits.map(id => { const g = goals.find(x => x.id === id), v = rec.ticks[id]; return `<li><span>${esc(g.title)}${id === st.audit ? ' · drawn' : ''}</span><span class="wkm">${typeof v === 'number' ? esc(fmtV(v, g.m ? g.m.u : '')) : 'Done'}</span></li>`; }).join('')}</ul>`;
}
function viewFeed() {
  const t = now(), w = curWeek(), out = [banner()];
  if (!S.players[S.me]) return out.join('') + `<section class="card"><h2>Join first</h2><p class="mute">The feed opens once you've joined the league from Today.</p></section>`;
  const wk = myWeek(w), myGoals = eff(S.me, w);
  if (wk) for (const d in wk.days || {}) { const st = dayOf(S.me, w, d, t); if (st.s === 'rejected') out.push(`<div class="note"><b>Your ${wd(d)} was rejected</b>${st.reason ? ' (' + esc(st.reason) + ')' : ''}. Replace the image from Today within 12 hours, or ask two flatmates to approve it.</div>`); }
  if (wk) for (const key in wk.checkins || {}) {
    const g = goalOf(myGoals, key), c = wk.checkins[key]; if (!g || g.type === 'd') continue;
    const st = itemStatus(S.weeks, S.me, w, key, c.n, c.t, t);
    if (st.s === 'rejected') out.push(`<div class="note"><b>Your proof was rejected:</b> ${esc(g.title)}${st.reason ? ' (' + esc(st.reason) + ')' : ''}. Retake it from Today, or ask two flatmates to approve it.</div>`);
  }
  const items = inboxItems(t), seen = new Set(), mine = uidsFor(w).find(u => u !== S.me && refFor(u, w) === S.me);
  out.push(`<p class="sec">Your ref duty${items.length ? ' · ' + items.length : ''}</p>`);
  if (!items.length) out.push(`<div class="note">${mine ? `You're reffing <b>${esc(name(mine))}</b> this week. Nothing of theirs is waiting.` : 'Refs are assigned once a second flatmate joins.'} Proof nobody reviews verifies itself after 24 hours.</div>`);
  for (const it of items) {
    if (it.kind === 'day') { const id = it.u + '|' + it.w + '|' + it.key; seen.add(id); out.push(`<article class="card feed">${dayBody(it.u, it.w, it.d, it.st)}${it.st.s === 'rejected' ? `<p class="small mute">A flatmate rejected this day${it.st.reason ? ': ' + esc(it.st.reason) : ''}. Two approvals overturn it.</p>` : ''}${reviewRow('c', id, `data-u="${esc(it.u)}" data-w="${it.w}" data-key="${it.key}" data-n="${it.n}"`, it.st, 'Approve the day', 'Reject')}</article>`); continue; }
    const id = it.u + '|' + it.w + '|' + it.key, goal = it.kind === 'g', g = it.g, attrs = `data-u="${esc(it.u)}" data-w="${it.w}" data-key="${esc(it.key)}" data-n="${it.n}"`;
    seen.add(id);
    let h = `<article class="card feed"><div class="who">${avatar(it.u)}<b>${esc(name(it.u))}</b><span class="kind">${goal ? 'New ' + TYPE[g.type].toLowerCase() + ' goal' : whenOf(g, it.key, it.c) + ' · ' + hm(it.c.t)}</span></div><h3>${esc(g.title)}</h3>`;
    if (g.type === 'w') h += `<div class="targets"><span><b>Standard</b>${esc(g.std)}</span>${g.str ? `<span><b>Stretch</b>${esc(g.str)}</span>` : ''}</div>`;
    h += `<p class="proof"><span class="tag">${esc(g.cat)}</span> Proof: ${esc(g.proof)}${goal && brief(g) ? ' · ' + esc(brief(g)) : ''}</p>`;
    if (!goal) h += typed(g, it.c) + photo(it.u, it.w + '_' + it.key + '_' + it.n, it.c, 'shot');
    if (it.st.s === 'rejected') h += `<p class="small mute">A flatmate ${goal ? 'pushed this back' : 'rejected this'}${it.st.reason ? ': ' + esc(it.st.reason) : ''}. Two approvals overturn it.</p>`;
    out.push(h + reviewRow(it.kind, id, attrs, it.st, goal ? 'Sign off' : typeof it.c.v === 'number' ? 'Numbers match' : 'Approve', goal ? 'Push back' : 'Reject') + '</article>');
  }
  const all = [];
  for (const u in S.players) {
    const k = S.weeks[u] && S.weeks[u][w]; if (!k) continue; const goals = eff(u, w);
    for (const d in k.days || {}) { const st = dayOf(u, w, d, t); if (st.rec && !seen.has(u + '|' + w + '|day_' + d)) all.push({ u, d, st, key: 'day_' + d, c: st.rec }); }
    for (const key in k.checkins || {}) { const g = goalOf(goals, key), c = k.checkins[key]; if (g && c && g.type !== 'd' && !seen.has(u + '|' + w + '|' + key)) all.push({ u, key, c, g }); }
  }
  all.sort((a, b) => b.c.t - a.c.t);
  const today = gameDay(t), posted = !!dayOf(S.me, w, today, t).rec;
  const locked = !posted && myGoals.some(g => g.type === 'd'), hidden = all.filter(it => locked && it.u !== S.me && gameDay(it.c.t) === today);
  out.push(`<p class="sec">This week's proof</p>`);
  if (hidden.length) out.push(`<section class="card show"><p class="eyebrow">Post to see</p><h3>${esc(list([...new Set(hidden.map(it => name(it.u)))]))} ${new Set(hidden.map(it => it.u)).size > 1 ? 'have' : 'has'} posted today</h3><p class="small mute">Today's proof from the flat stays hidden until you've closed out your own day.</p><button class="btn" data-act="tab" data-v="today">Close out my day</button></section>`);
  if (!all.length) out.push(`<section class="card"><h2>Quiet so far</h2><p class="mute">Proof from the flat lands here as it's posted.</p></section>`);
  for (const it of all.slice(0, 24)) {
    if (hidden.includes(it)) { out.push(`<article class="card feed"><div class="who">${avatar(it.u)}<b>${esc(name(it.u))}</b><span class="kind">Today · ${hm(it.c.t)}</span></div><div class="shot ph">Hidden until you post</div></article>`); continue; }
    const id = it.u + '|' + w + '|' + it.key, mineRv = ((myWeek(w) || {}).reviews || {})[it.u + '__' + it.key];
    if (it.d) { const st = it.st, chip = st.s === 'rejected' ? `<span class="state bad">Day rejected${st.reason ? ' · ' + esc(st.reason) : ''}</span>` : st.s === 'counted' ? `<span class="state wait">Counted · awaiting review</span>` : `<span class="state ok">Verified</span>`; out.push(`<article class="card feed">${dayBody(it.u, w, it.d, st)}${chip}${it.u !== S.me && st.s === 'counted' && !mineRv ? reviewRow('c', id, `data-u="${esc(it.u)}" data-w="${w}" data-key="${it.key}" data-n="${it.c.n}"`, st, '', 'Challenge this') : ''}</article>`); continue; }
    const st = itemStatus(S.weeks, it.u, w, it.key, it.c.n, it.c.t, t);
    const can = it.u !== S.me && st.s === 'counted' && !mineRv;
    out.push(`<article class="card feed"><div class="who">${avatar(it.u)}<b>${esc(name(it.u))}</b><span class="kind">${whenOf(it.g, it.key, it.c)} · ${hm(it.c.t)}</span></div><h3>${esc(it.g.title)}</h3>${typed(it.g, it.c)}${photo(it.u, w + '_' + it.key + '_' + it.c.n, it.c, 'shot')}${stateChip(it.g, it.c, st)}${can ? reviewRow('c', id, `data-u="${esc(it.u)}" data-w="${w}" data-key="${esc(it.key)}" data-n="${it.c.n}"`, st, '', 'Challenge this') : ''}</article>`);
  }
  return out.join('');
}

/* ---------- League ---------- */
function weekWins(t) {
  const si = seasonInfo(), cw = curWeek(), wins = {};
  for (let k = 1; k < si.week; k++) { const w = addDays(cw, -7 * k); if (t < weekFinal(w)) continue; for (const r of board(w, t).rows) if (r.rank === 1 && r.pts > 0) wins[r.u] = (wins[r.u] || 0) + 1; }
  return wins;
}
function viewBoard() {
  const t = now(), cw = curWeek(), pw = addDays(cw, -7), out = [banner()];
  out.push(`<div class="seg"><button data-act="lb" data-v="week" aria-pressed="${S.lbTab === 'week'}">Week</button><button data-act="lb" data-v="season" aria-pressed="${S.lbTab === 'season'}">Season</button></div>`);
  if (S.lbTab === 'season') return out.join('') + seasonBoard(t);
  const hasPrev = Object.keys(S.players).some(u => S.weeks[u] && S.weeks[u][pw]);
  const w = S.lbWeek === pw && hasPrev ? pw : cw, uids = uidsFor(w);
  if (hasPrev) out.push(`<div class="row"><button class="chip" data-act="lbw" data-w="" aria-pressed="${w === cw}">${w === cw ? '● ' : ''}This week</button><button class="chip" data-act="lbw" data-w="${pw}" aria-pressed="${w === pw}">${w === pw ? '● ' : ''}Last week</button></div>`);
  const st = board(w, t), phase = t >= weekFinal(w) ? 'final' : t >= weekShow(w) ? 'prov' : 'live';
  if (phase !== 'live') out.push(showCard(w, st, phase, t));
  if (!uids.length) out.push(`<section class="card"><h2>No one has joined yet</h2><p class="mute">Join from Today, then share this page with the flat.</p></section>`);
  const today = gameDay(t), wins = weekWins(t);
  out.push('<div class="table">' + st.rows.map(r => {
    const open = S.open === r.u, dots = weekDays(w).map(d => { const k = r.daily[d] || 0; return `<i class="dot ${r.nd && k >= r.nd ? 'f' : k ? 'h' : ''}${d === today ? ' today' : ''}"></i>`; }).join('');
    const sub = !r.locked ? 'No goals yet' : !r.valid ? 'Needs ' + MIN_CATS + ' categories' : `D${Math.round(r.d)} W${Math.round(r.w)} S${Math.round(r.s)}`;
    return `<div class="lrow${r.rank === 1 && r.pts > 0 ? ' first' : ''}${r.u === S.me ? ' me' : ''}"><button data-act="open" data-u="${esc(r.u)}" aria-expanded="${open}"><span class="rk">${r.rank}</span><span class="nm"><span class="n1">${avatar(r.u)}<span>${esc(name(r.u))}</span>${r.u === S.me ? '<span class="you">You</span>' : ''}${wins[r.u] ? `<span class="wins">${wins[r.u]} ${wins[r.u] === 1 ? 'win' : 'wins'}</span>` : ''}</span><span class="dots" aria-label="${r.days.size} days with a check-in">${dots}<span class="wkm">${sub}</span></span></span><span class="pts">${r.pts}<small>of 100</small></span></button>${open ? detail(r.u, w) : ''}</div>`;
  }).join('') + '</div>');
  out.push(`<p class="small mute">Each square is a day: full when every daily is done. D, W and S are the daily (50), weekly (30) and season (20) parts of the score. Ties break on days checked in, then reviews done.</p>`);
  if (uids.length) out.push(`<button class="btn ghost" data-act="copy" data-w="${w}">Copy standings for the group chat</button>`);
  return out.join('');
}
function detail(u, w) {
  const goals = eff(u, w), wk = (S.weeks[u] && S.weeks[u][w]) || {}, cs = wk.checkins || {}, t = now();
  if (!goals.length) return `<div class="detail"><p class="small mute">No goals set yet.</p></div>`;
  const shots = Object.keys(wk.days || {}).sort().map(d => { const st = dayOf(u, w, d, t); return st.rec ? photo(u, w + '_day_' + d + '_' + st.rec.n, st.rec, 'thumb') : ''; }).concat(Object.keys(cs).sort().map(k => { const g = goalOf(goals, k); return g && g.type !== 'd' ? photo(u, w + '_' + k + '_' + cs[k].n, cs[k], 'thumb') : ''; })).join('');
  return `<div class="detail"><ul class="track">${goals.map(g => g.type === 'd' ? stepLine(u, g, w, t) : `<li><span>${esc(g.title)}</span><span class="wkm">${TYPE[g.type]}${cs[g.id + '_w'] ? ' · logged' : ''}</span></li>`).join('')}</ul>${shots ? `<div class="thumbs">${shots}</div>` : ''}</div>`;
}
function showCard(w, st, phase, t) {
  const win = st.rows.filter(r => r.rank === 1 && r.pts > 0).map(r => name(r.u));
  const lines = [win.length ? `<b>${esc(list(win))}</b> ${win.length > 1 ? 'share' : win[0] === 'You' ? 'take' : 'takes'} the week.` : 'Nobody scored this week.'];
  const end = Math.min(t, weekEnd(w) - 1), pw = addDays(w, -7); let best = null, rev = null, climb = null;
  const prev = {}; if (Object.keys(S.players).some(u => S.weeks[u] && S.weeks[u][pw])) board(pw, t).rows.forEach(r => { prev[r.u] = r.rank; });
  for (const r of st.rows) {
    for (const g of eff(r.u, w)) if (g.type === 'd') { const k = streak(S.weeks, r.u, g.id, end); if (k > 1 && (!best || k > best.k)) best = { k, u: r.u }; }
    if (r.reviews && (!rev || r.reviews > rev.n)) rev = { n: r.reviews, u: r.u };
    const up = (prev[r.u] || 0) - r.rank; if (prev[r.u] && up > 0 && (!climb || up > climb.up)) climb = { up, u: r.u };
  }
  if (climb) lines.push(`Biggest climber: ${esc(name(climb.u))}, up ${climb.up} ${climb.up === 1 ? 'place' : 'places'}.`);
  if (best) lines.push(`Longest streak: ${esc(name(best.u))}, ${best.k} days.`);
  if (rev) lines.push(`Ref of the week: ${esc(name(rev.u))}, ${rev.n} reviews.`);
  return `<section class="card show"><p class="eyebrow">${phase === 'prov' ? 'The Sunday show · provisional' : 'Final result'}</p><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>${phase === 'prov' ? `<p class="small mute">Final at Monday 12:00. Check-ins before 03:00 still count.</p>` : ''}</section>`;
}
function seasonBoard(t) {
  const se = seasonInfo(), w = curWeek();
  const rows = Object.keys(S.players).map(u => { const gs = eff(u, w).filter(g => g.type === 's' && g.sid === se.id).map(g => ({ g, v: seasonValue(S.weeks, u, g, w, se.id, t) })); return { u, gs, avg: gs.length ? gs.reduce((a, x) => a + x.v.frac, 0) / gs.length : -1 }; }).sort((a, b) => b.avg - a.avg);
  let h = `<section class="card"><p class="eyebrow">${se.week === SEASON_WEEKS ? 'Season recap' : 'Season'} · week ${se.week} of ${SEASON_WEEKS}</p><h2>How far each of you has moved</h2><p class="small mute">Ranked by share of the gap closed between start and target. On pace this week is ${Math.round(se.week / SEASON_WEEKS * 100)}%.</p></section>`;
  for (const r of rows) h += `<section class="card"><div class="who">${avatar(r.u)}<b>${esc(name(r.u))}</b>${r.gs.length ? `<span class="kind">${Math.round(r.avg * 100)}% of the way</span>` : ''}</div>${r.gs.length ? r.gs.map(x => `<h3>${esc(x.g.title)}</h3>${seasonBar(x.g, x.v)}${track(r.u, eff(r.u, w), x.g, w, t)}`).join('') : `<p class="small mute">No seasonal goal set yet.</p>`}</section>`;
  return h;
}

/* ---------- Rules ---------- */
function viewRules() {
  const sec = (title, items) => `<section class="card"><h3>${title}</h3><ul class="rules">${items.map(i => `<li>${i}</li>`).join('')}</ul></section>`;
  return `<section class="card"><p class="eyebrow">Earn your rank.</p><h2>The rules</h2><p class="mute">Short enough to read once. The app applies all of them for you.</p></section>` +
    sec('The score', ['Every week is scored out of <b>100</b>: 50 for daily habits, 30 for weekly outcomes, 20 for seasonal goals.', 'Each part is the share you hit. Six dailies all done earns the same 50 as two dailies all done, so extra goals add work, not points.', `Nothing scores until your goals span <b>${MIN_CATS} categories</b>.`, 'Highest score takes the week. Ties break on days checked in, then reviews done.']) +
    sec('Goals', ['<b>Daily:</b> something you do every day.', '<b>Weekly:</b> something you finish this week. If you set a Stretch target, Standard earns 80% and Stretch earns 100%.', `<b>Seasonal:</b> a number you move over ${SEASON_WEEKS} weeks, from where you are now to a target.`, 'Any daily or weekly goal can be a step toward a seasonal goal, and shows on its track.', 'A goal can carry a number you type, such as protein. Miss the target and it does not count.', 'Goals carry over each week. You can edit or remove one until it has been ticked or logged that week.', 'Your ref signs off each new or changed goal. A goal that is pushed back scores nothing until you change it or two flatmates sign it off.']) +
    sec('Proving a day', ['Tick each daily as you do it, then <b>close out the day</b>.', 'One of your ticked goals is drawn as the <b>spot check</b>. You upload one image for that goal, and it proves the whole day.', 'You cannot know which goal will be drawn, so keep proof of everything you tick.', 'The draw is fixed by the app from your name, the date and your ticks. Nobody chooses it.', 'The image is due before the day closes at 03:00. No image, no points for that day.', 'Once closed out, the day\'s ticks cannot change.']) +
    sec('Proving weekly and seasonal goals', ['Each weekly outcome needs one image when you finish it.', 'Each seasonal goal needs its latest number and one image, once a week.', 'Logging a seasonal number earns 40% of its share. Being on pace for the week earns the rest.']) +
    sec('Refs and reviews', ['Each week you are assigned one flatmate to ref, and one flatmate refs you. Pairings rotate every Monday.', 'Proof counts as soon as it is uploaded. One approval verifies it.', 'Proof nobody reviews verifies itself after 24 hours, or at Monday 12:00.', 'A rejection zeroes the day or goal. Two other flatmates approving overturns it.', 'After a rejection you can replace the image once, within 12 hours.', 'Anyone can challenge any proof in the feed while it is awaiting review.']) +
    sec('The feed', ['Today\'s proof from the flat stays hidden until you have closed out your own day.', 'Everything older is open to everyone.']) +
    sec('The clock', ['A day runs 03:00 to 03:00.', 'A week runs Monday 03:00 to Monday 03:00.', 'Sunday 20:00: provisional result. Monday 12:00: final.', `A season is ${SEASON_WEEKS} weeks. Weeks won show beside your name.`]);
}

/* ---------- render ---------- */
const draft = {};
function capture() { document.querySelectorAll('#view input[id],#view select[id]').forEach(el => { draft[el.id] = el.type === 'checkbox' ? el.checked : el.value; }); }
function restore() { for (const id in draft) { const el = $(id); if (!el) continue; if (el.type === 'checkbox') el.checked = !!draft[id]; else el.value = draft[id]; } }
function clearDraft(pre) { for (const id in draft) if (id.startsWith(pre)) delete draft[id]; }
function render(force) {
  const a = document.activeElement;
  if (!force && a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && $('view').contains(a)) { S.dirty = true; return; }
  if (S.mode === 'loading') return;
  if (S.mode === 'auth' || S.mode === 'down') {
    capture(); $('wk').innerHTML = ''; document.body.classList.add('noside');
    $('view').innerHTML = S.mode === 'auth' ? authView() : `<section class="card"><h2>Can't reach Yuzu</h2><p class="mute">Check your connection and try again.</p><button class="btn" data-act="retry">Try again</button></section>`;
    restore(); return;
  }
  capture();
  const t = now(), si = seasonInfo(), n = inboxItems(t).length;
  $('wk').innerHTML = `Week ${si.week} of ${SEASON_WEEKS}<small>closes in ${dur(weekEnd(curWeek()) - t)}</small>`;
  document.body.classList.remove('noside');
  const order = ['today', 'feed', 'board', 'rules'];
  document.querySelectorAll('#rail button').forEach(b => { if (b.dataset.v === S.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  $('ind').style.setProperty('--i', order.indexOf(S.tab)); $('feedBadge').textContent = n || '';
  document.title = n ? 'Yuzu (' + n + ')' : 'Yuzu';
  $('view').innerHTML = S.tab === 'feed' ? viewFeed() : S.tab === 'board' ? viewBoard() : S.tab === 'rules' ? viewRules() : viewToday();
  restore(); hydrate();
  const v = $('view'); v.classList.remove('enter'); if (S.enter) { S.enter = false; void v.offsetWidth; v.classList.add('enter'); }
}
document.addEventListener('focusout', () => setTimeout(() => { if (S.dirty) { S.dirty = false; render(); } }, 60));
setInterval(() => render(), 60000);

/* ---------- actions ---------- */
function openEdit(i, g) { clearDraft('e_'); S.edit = { i, g }; S.tab = 'today'; render(true); window.scrollTo(0, 0); }
const saveGoals = goals => saveWeek(curWeek(), { goals, lockedAt: now() });
/* the first thing you save in a new week pins that week's goal list, so later edits never rewrite history */
function pinned(w, patch) { if (!hasGoals(myWeek(w))) { patch.goals = clone(eff(S.me, w)); patch.lockedAt = now(); } return patch; }
const acts = {
  tab(d) { S.tab = d.v; S.rejecting = null; S.edit = null; S.enter = true; render(true); window.scrollTo(0, 0); },
  lb(d) { S.lbTab = d.v; render(true); },
  lbw(d) { S.lbWeek = d.w || null; S.open = null; render(true); },
  open(d) { S.open = S.open === d.u ? null : d.u; render(true); },
  rename(d) { S.rename = !!d.v; clearDraft('nick'); render(true); },
  add(d) { openEdit(-1, { type: d.t, up: d.up || null }); },
  tpl(d) { const x = TPL[+d.i]; openEdit(-1, { type: 'd', title: x.t, cat: x.c, proof: x.p, ml: x.ml, mu: x.mu, mo: x.mo, mt: x.mt }); },
  editGoal(d) { const goals = eff(S.me, curWeek()), i = goals.findIndex(g => g.id === d.g); if (i < 0) return; const g = goals[i], m = g.m || {}, fresh = g.type === 's' && g.sid !== seasonInfo().id; openEdit(i, { type: g.type, title: g.title, cat: g.cat, proof: g.proof, std: g.std, str: g.str, ml: m.l, mu: m.u, mo: m.op, mt: m.t, up: g.up, base: fresh ? '' : g.base, target: fresh ? '' : g.target, unit: g.unit }); },
  cancelEdit() { S.edit = null; clearDraft('e_'); render(true); },
  rmGoal() { const goals = clone(eff(S.me, curWeek())); goals.splice(S.edit.i, 1); S.edit = null; clearDraft('e_'); saveGoals(goals); toast('Goal removed.'); },
  tick(d) {
    const w = curWeek(), day = gameDay(now()), g = eff(S.me, w).find(x => x.id === d.g); if (!g) return;
    let v = true;
    if (g.m) { v = parseFloat(($('v_' + g.id) || {}).value); if (isNaN(v)) return toast('Type your ' + g.m.l.toLowerCase() + ' number first.'); }
    clearDraft('v_' + g.id); saveWeek(w, pinned(w, { days: { [day]: { ticks: { [g.id]: v } } } }));
    if (!metV(g, v)) toast('Logged, but below target, so it does not count today.');
  },
  untick(d) { saveWeek(curWeek(), { days: { [gameDay(now())]: { ticks: { [d.g]: null } } } }); },
  close() {
    const w = curWeek(), t = now(), day = gameDay(t), st = dayOf(S.me, w, day, t); if (st.s !== 'open') return;
    const audit = auditPick(S.me, day, st.hits), g = eff(S.me, w).find(x => x.id === audit);
    saveWeek(w, { days: { [day]: { closed: t, audit } } }); toast('Spot check: ' + (g ? g.title : '') + '. Upload one image.');
    const spot = $('spot'); if (spot) spot.scrollIntoView({ block: 'start' });
  },
  auth(d) { S.auth = d.v; render(true); },
  signout() { signOut(false); },
  retry() { S.mode = 'loading'; sync(); },
  preview() { sample(); toast('Preview only. Nothing is saved.'); },
  signin() {
    S.me = null; S.players = {}; S.weeks = {}; S.photos = {}; S.edit = null; S.rename = false; S.tab = 'today'; S.mode = 'auth'; S.auth = 'login';
    render(true);
  },
  rej(d) { S.rejecting = d.id || null; render(true); },
  rv(d) { S.rejecting = null; saveWeek(d.key.startsWith('g_') ? curWeek() : d.w, { reviews: { [d.u + '__' + d.key]: { v: +d.v, r: d.r || null, n: +d.n, t: now() } } }); toast(+d.v ? 'Approved.' : 'Rejected. Two approvals from others can overturn it.'); },
  copy(d) {
    const w = d.w, t = now(), st = board(w, t);
    const text = ['YUZU · Week ' + seasonOf(w, startW()).week + (t >= weekFinal(w) ? ' final' : t >= weekShow(w) ? ' (provisional)' : ' so far')].concat(st.rows.map(r => r.rank + '. ' + name(r.u) + ' ' + r.pts)).join('\n');
    try { navigator.clipboard.writeText(text).then(() => toast('Standings copied. Paste them in the flat chat.'), () => toast('Copy was blocked on this device.')); } catch (e) { toast('Copy was blocked on this device.'); }
  }
};
const AUTH_ERR = { BAD_CODE: "That invite code isn't right.", BAD_PHONE: 'Check the phone number.', BAD_PIN: 'The PIN must be exactly 6 digits.', BAD_NAME: 'Add a name of 2 to 20 characters.', PHONE_TAKEN: 'That number has already joined. Use Sign in.', NAME_TAKEN: 'That name is already in the league. Add an initial.', FULL: 'This league is full.', BAD_LOGIN: "That number and PIN don't match.", LOCKED: 'Too many wrong PINs. Try again in 15 minutes.', offline: "You're offline. Check your connection." };
const forms = {
  async auth() {
    const join = S.auth === 'join', err = m => { $('authErr').textContent = m; }, phone = normPhone($('a_phone').value), pin = $('a_pin').value.trim();
    if (!phone) return err('Enter your mobile number, for example 07700 900123.');
    if (!/^[0-9]{6}$/.test(pin)) return err('The PIN must be exactly 6 digits.');
    const btn = $('authGo'); btn.disabled = true; err('');
    try {
      const j = join ? await rpc('yz_join', { p_phone: phone, p_pin: pin, p_name: $('a_name').value, p_code: $('a_code').value, p_week: curWeek() }) : await rpc('yz_login', { p_phone: phone, p_pin: pin });
      token = j.token; try { localStorage.setItem('yuzu_token', token); } catch (e) {}
      const nick = join ? $('a_name').value.trim().replace(/\s+/g, ' ') : '';
      clearDraft('a_'); S.me = j.uid; S.mode = 'loading'; $('view').innerHTML = joinCard(); await sync();
      S.enter = true; render(true);
      if (join) celebrate("You're locked in to Yuzu, " + nick + '.');
    } catch (e) { if ($('authGo')) $('authGo').disabled = false; if ($('authErr')) err(AUTH_ERR[e.code] || "Couldn't reach Yuzu. Try again in a moment."); }
  },
  join() { const nick = nickOk(); if (!nick) return; clearDraft('nick'); saveProfile({ joined: now(), nick }); if (!S.config.seasonStart) saveConfig({ seasonStart: curWeek() }); },
  rename() { const nick = nickOk(); if (!nick) return; S.rename = false; clearDraft('nick'); saveProfile({ nick }); toast('Name saved.'); },
  goal() {
    const v = id => { const el = $(id); return el ? el.value.trim() : ''; }, e = S.edit, t = now(), goals = clone(eff(S.me, curWeek())), p = e.i >= 0 ? goals[e.i] : null, type = e.g.type;
    const err = m => { $('goalErr').textContent = m; };
    const title = v('e_t'), proof = v('e_p'), ml = v('e_ml'), mt = parseFloat(v('e_mt'));
    if (!title || !proof) return err('Add the goal and how you will prove it.');
    const g = { id: p ? p.id : rid(), type, title, cat: v('e_c'), proof, m: null, n: 1, at: t };
    if (type === 'w') { g.std = v('e_s'); g.str = v('e_x'); if (!g.std) return err('Add a Standard target.'); }
    if (type === 's') {
      g.base = parseFloat(v('e_b')); g.target = parseFloat(v('e_g')); g.unit = v('e_u'); g.sid = seasonInfo().id;
      if (isNaN(g.base) || isNaN(g.target) || g.base === g.target) return err('Add where you are now and a different target, both as numbers.');
    } else {
      if ((ml && isNaN(mt)) || (!ml && v('e_mt'))) return err('A typed number needs both a name and a target, or leave both empty.');
      if (ml) g.m = { l: ml, u: v('e_mu'), t: mt, op: v('e_mo') === 'max' ? 'max' : 'min' };
      g.up = v('e_up') || null;
    }
    if (p) { const same = ['title', 'cat', 'proof', 'std', 'str', 'base', 'target', 'unit', 'sid', 'up'].every(k => String(p[k] == null ? '' : p[k]) === String(g[k] == null ? '' : g[k])) && JSON.stringify(p.m || null) === JSON.stringify(g.m); g.n = same ? p.n || 1 : (p.n || 1) + 1; g.at = same ? p.at || t : t; goals[e.i] = g; } else goals.push(g);
    S.edit = null; clearDraft('e_');
    saveGoals(goals); toast('Goal saved. Your ref will sign it off.');
  }
};
document.addEventListener('click', e => {
  const z = e.target.closest('img[data-zoom]');
  if (z) { $('zoomImg').src = z.src; $('zoom').classList.add('on'); return; }
  const lab = e.target.closest('label[data-up]');
  if (lab) { const g = eff(S.me, curWeek()).find(x => x.id === lab.dataset.up); if (g && (g.m || g.type === 's') && isNaN(parseFloat(($('v_' + g.id) || {}).value))) { e.preventDefault(); toast(g.type === 's' ? "Type this week's result first." : 'Type your ' + g.m.l.toLowerCase() + ' number first.'); } return; }
  const b = e.target.closest('[data-act]'); if (b && acts[b.dataset.act]) acts[b.dataset.act](b.dataset, b);
});
$('zoom').addEventListener('click', () => $('zoom').classList.remove('on'));
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('zoom').classList.remove('on'); });
document.addEventListener('input', e => { if (e.target && e.target.id === 'a_pin') e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
document.addEventListener('submit', e => { e.preventDefault(); const f = forms[e.target.dataset.form]; if (f) f(e.target); });
document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.dataset.zoom !== undefined) { const d = document.createElement('div'); d.className = t.className + ' ph'; d.textContent = 'Photo unavailable'; t.replaceWith(d); } }, true);
document.addEventListener('change', async e => {
  const el = e.target; if (el.type !== 'file' || !(el.dataset.key || el.dataset.day)) return;
  const file = el.files && el.files[0]; if (!file) return;
  if (!/^image\//.test(file.type)) return toast('That file is not an image. Choose a photo or a screenshot.');
  if (el.dataset.day) {
    const w = curWeek(), day = el.dataset.day, rec = ((myWeek(w) || {}).days || {})[day]; if (!rec || !rec.closed) return;
    const n = (rec.n || 0) + 1, before = myRow(w, now());
    S.busy = 'day'; render(true);
    try {
      const ref = await storePhoto(file, w + '_day_' + day + '_' + n);
      S.busy = null;
      const ok = await saveWeek(w, { days: { [day]: { n, t: now(), a: ref.a, ph: ref.ph, re: el.dataset.re || rec.re ? 1 : null } } });
      if (ok) { const after = myRow(w, now()); celebrate('Day counted. You\'re on ' + after.pts + '.' + (after.rank && after.rank < before.rank ? ' Up to ' + ord(after.rank) + '.' : '')); }
    } catch (err) { S.busy = null; render(true); toast(err && err.code ? "Couldn't save the image. You may have view-only access." : "Couldn't read that image. Try a screenshot or a JPEG."); }
    return;
  }
  const d = el.dataset, gg = eff(S.me, curWeek()).find(x => x.id === d.g); if (!gg) return;
  const p = { key: d.key, gid: gg.id, lvl: d.lvl || null, re: !!d.re, w: curWeek(), keep: !!d.keep, v: null };
  if ((gg.m || gg.type === 's') && !p.keep) { p.v = parseFloat(($('v_' + gg.id) || {}).value); if (isNaN(p.v)) return toast('Type the number first, then choose the image.'); }
  const w = p.w, wk = myWeek(w) || {}, g = eff(S.me, w).find(x => x.id === p.gid), old = (wk.checkins || {})[p.key], n = (old ? old.n : 0) + 1, before = myRow(w, now());
  S.busy = p.key; render(true);
  try {
    const ref = await storePhoto(file, w + '_' + p.key + '_' + n);
    const c = { t: now(), n, a: ref.a, ph: ref.ph, lvl: p.lvl, re: p.re || (old && old.re) ? 1 : null, v: p.keep ? (old && typeof old.v === 'number' ? old.v : null) : p.v };
    S.busy = null; clearDraft('v_' + p.gid);
    const ok = await saveWeek(w, pinned(w, { checkins: { [p.key]: c } }));
    if (!ok) return;
    const after = myRow(w, now());
    toast(!met(g, c) ? 'Logged. Below target, so it scores nothing.' : 'Counted. You\'re on ' + after.pts + '.' + (after.rank && after.rank < before.rank ? ' Up to ' + ord(after.rank) + '.' : ''));
  } catch (err) { S.busy = null; render(true); toast(err && err.code ? "Couldn't save the photo. You may have view-only access." : "Couldn't read that image. Try a screenshot or a JPEG."); }
});

/* ---------- sample data: shown in previews and when the league can't be reached ---------- */
function sample(why) {
  S.mode = 'sample'; S.why = why || ''; db = null; S.me = 'you';
  const t = now(), cw = curWeek(), pw = addDays(cw, -7), today = gameDay(t);
  const ppl = [['maya', 'Maya', .97, 'Hit my protein', 'Athletic', 'Read 20 pages', 'Life', 'Sketch one page', 'Creative', '5k time', 'Athletic', 'min', 27.5, 25, 26.9], ['sam', 'Sam', .4, '10,000 steps', 'Athletic', '1 hour on the business', 'Business', 'Cook for the flat', 'Flat', 'Monthly revenue', 'Business', '£', 400, 1000, 430], ['priya', 'Priya', .8, '2 hours of focused study', 'Academic', '10,000 steps', 'Athletic', 'Finish a timed past paper', 'Academic', 'Past paper score', 'Academic', '%', 54, 65, 57], ['tom', 'Tom', .65, '30 minutes of practice', 'Creative', 'Hit my protein', 'Athletic', 'Record one full take', 'Creative', 'Songs finished', 'Creative', '', 0, 4, 1], ['leila', 'Leila', .85, 'Read 20 pages', 'Life', '2 hours of focused study', 'Academic', 'Finish the lab report', 'Academic', 'Bench press', 'Athletic', 'kg', 50, 60, 52.5], ['you', 'You', .75, 'Hit my protein', 'Athletic', '2 hours of focused study', 'Academic', 'Write 500 words', 'Creative', 'Past paper score', 'Academic', '%', 58, 70, 61]];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pm = title => title === 'Hit my protein' ? { l: 'Protein', u: 'g', t: 150, op: 'min' } : null;
  S.config = { seasonStart: pw };
  for (const [u, nm, f, a, ac, b, bc, wkT, wc, sT, sc, unit, base, target, cur] of ppl) {
    S.profiles[u] = { name: nm }; S.players[u] = { joined: at(pw, 9) }; S.weeks[u] = {};
    const goals = [{ id: 'a', type: 'd', title: a, cat: ac, proof: 'Screenshot', m: pm(a), n: 1, at: at(pw, 9) }, { id: 'b', type: 'd', title: b, cat: bc, proof: 'Photo', m: pm(b), n: 1, at: at(pw, 9) }, { id: 'c', type: 'w', title: wkT, cat: wc, proof: 'Photo of the result', std: 'Done once', str: 'Done with a personal best', m: null, n: 1, at: at(pw, 9) }, { id: 's', type: 's', title: sT, cat: sc, proof: 'Photo of the result', base, target, unit, sid: pw, m: null, n: 1, at: at(pw, 9) }];
    goals.slice(0, 3).forEach(g => { if (g.cat === sc) g.up = 's'; });
    for (const w of [pw, cw]) {
      const cs = {};
      const ds = {};
      for (const d of weekDays(w)) {
        if (d > today || (d === today && u === 'you')) continue;
        const ticks = {}; for (const g of goals.slice(0, 2)) if (rnd() < f) ticks[g.id] = g.m ? 150 + Math.round(rnd() * 24) : true;
        const ids = Object.keys(ticks), tt = d === today ? t - 20 * 60000 : at(d, 21);
        if (ids.length && tt <= t) ds[d] = { ticks, closed: tt, audit: auditPick(u, d, ids), n: 1, t: tt, ph: 1 };
      }
      if (w === pw) { if (f > .5) cs.c_w = { n: 1, t: at(addDays(w, 5), 15), lvl: f > .8 ? 's' : 'n', ph: 1 }; cs.s_w = { n: 1, t: at(addDays(w, 6), 11), v: cur, ph: 1 }; }
      S.weeks[u][w] = w === pw ? { goals, lockedAt: at(pw, 9), days: ds, checkins: cs, reviews: {} } : { days: ds, checkins: cs, reviews: {} };
    }
  }
  S.weeks.priya[cw].reviews = { maya__a_x: { v: 1, n: 1, t }, tom__a_x: { v: 1, n: 1, t }, sam__a_x: { v: 1, n: 1, t } };
  S.photos = {};
  for (const u in S.weeks) {
    for (const w in S.weeks[u]) {
      const wk = S.weeks[u][w], goals = goalsFor(S.weeks, u, w);
      for (const d in wk.days || {}) {
        const rec = wk.days[d];
        if (rec && rec.ph) S.photos[u + '|' + w + '_day_' + d + '_' + (rec.n || 1)] = fakeShot(name(u) + ' · ' + wd(d));
      }
      for (const key in wk.checkins || {}) {
        const c = wk.checkins[key], g = goalOf(goals, key);
        if (c && g) S.photos[u + '|' + w + '_' + key + '_' + (c.n || 1)] = fakeShot(g.title);
      }
    }
  }
  render(true);
}

function fakeShot(label) {
  const c = document.createElement('canvas');
  c.width = 960; c.height = 720;
  const x = c.getContext('2d');
  x.fillStyle = '#161719'; x.fillRect(0, 0, 960, 720);
  x.strokeStyle = '#3A3D43'; x.lineWidth = 2; x.strokeRect(24, 24, 912, 672);
  x.fillStyle = '#F5E447';
  x.save(); x.translate(480, 330); x.scale(0.72, 0.72); x.translate(-339, -272);
  x.beginPath(); x.moveTo(140, 92); x.lineTo(275, 123); x.lineTo(333, 238); x.lineTo(203, 205); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(538, 92); x.lineTo(407, 123); x.lineTo(345, 238); x.lineTo(473, 205); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(340, 245); x.lineTo(388, 312); x.lineTo(340, 452); x.lineTo(290, 312); x.closePath(); x.fill();
  x.restore();
  x.fillStyle = '#F5F5F0';
  x.font = '600 28px Barlow, system-ui, sans-serif';
  x.fillText(String(label || 'Proof').slice(0, 42), 48, 640);
  x.fillStyle = '#8A8C87';
  x.font = '600 14px Barlow, system-ui, sans-serif';
  x.fillText('SAMPLE PROOF', 48, 674);
  return c.toDataURL('image/jpeg', .72);
}


function init() {
  if (!configured()) return sample();
  if (!token) { S.mode = 'auth'; return render(true); }
  sync();
}
init();
</script>
</body>
</html>
