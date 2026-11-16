const fs = require('fs');
const T = new Function(fs.readFileSync(__dirname + '/../src/core.js', 'utf8') + ';return {itemStatus,goalStatus,score,standings,streak,weekOf,gameDay,weekDays,at,weekFinal,addDays,goalsFor,seasonOf,seasonValue,refOf,dayState,auditPick,ticked,dayEnd};')();
const { itemStatus, goalStatus, score, standings, streak, weekOf, gameDay, weekDays, at, weekFinal, addDays, goalsFor, seasonOf, seasonValue, refOf, dayState, auditPick, ticked, dayEnd } = T;
const assert = require('assert');
const w0 = '2026-11-09', w = '2026-11-16', days = weekDays(w), end = weekFinal(w) + 1;
assert.equal(weekOf('2026-11-22'), w);
assert.equal(gameDay(at('2026-11-17', 2)), '2026-11-16');
assert.deepEqual(seasonOf(w, w0), { id: w0, week: 2, index: 1 });
const G = () => [
  { id: 'a', type: 'd', cat: 'Athletic', n: 1, at: at(w0, 9), m: { l: 'Protein', u: 'g', t: 150, op: 'min' } },
  { id: 'b', type: 'd', cat: 'Academic', n: 1, at: at(w0, 9) },
  { id: 'c', type: 'w', cat: 'Creative', n: 1, at: at(w0, 9), std: 'x', str: 'y' },
  { id: 's', type: 's', cat: 'Academic', n: 1, at: at(w0, 9), base: 50, target: 70, unit: '%', sid: w0 }];
// a closed-out day: ticks, the drawn spot check, one image
const day = (u, d, ticks, o) => { const goals = G(), ids = ticked(goals, { ticks }); return Object.assign({ ticks, closed: at(d, 21), audit: auditPick(u, d, ids), n: 1, t: at(d, 21), ph: 1 }, o || {}); };
const full = u => Object.fromEntries(days.map(d => [d, day(u, d, { a: 160, b: true })]));
const weeks = { sam: { [w0]: { goals: G(), lockedAt: 1, checkins: {}, reviews: {} }, [w]: { days: full('sam'), checkins: { c_w: { n: 1, t: at(days[5], 12), lvl: 's' }, s_w: { n: 1, t: at(days[5], 12), v: 55 } }, reviews: {} } } };
assert.equal(goalsFor(weeks, 'sam', w).length, 4);
let s = score(weeks, 'sam', w, end, w0);
assert.equal(Math.round(s.d), 50); assert.equal(Math.round(s.w), 30); assert.equal(Math.round(s.s), 20); assert.equal(s.pts, 100);
// the spot check is always one of the ticked goals and is stable
for (const d of days) assert.ok(['a', 'b'].includes(weeks.sam[w].days[d].audit));
assert.equal(auditPick('sam', days[0], ['b', 'a']), auditPick('sam', days[0], ['a', 'b']));
// a typed number below target is not a hit and can't be drawn
assert.deepEqual(ticked(G(), { ticks: { a: 120, b: true } }), ['b']);
weeks.sam[w].days[days[0]] = day('sam', days[0], { a: 120, b: true });
assert.equal(Math.round(score(weeks, 'sam', w, end, w0).d * 14 / 50), 13);
// not closed out, no image, or a forged draw: the day scores nothing
weeks.sam[w].days[days[1]] = day('sam', days[1], { a: 160, b: true }, { closed: null });
assert.equal(dayState(weeks, 'sam', w, days[1], end).s, 'void');
assert.equal(dayState(weeks, 'sam', w, days[1], at(days[1], 22)).s, 'open');
weeks.sam[w].days[days[2]] = day('sam', days[2], { a: 160, b: true }, { ph: null });
assert.equal(dayState(weeks, 'sam', w, days[2], at(days[2], 22)).s, 'due');
assert.equal(dayState(weeks, 'sam', w, days[2], end).s, 'void');
const real = weeks.sam[w].days[days[3]].audit;
weeks.sam[w].days[days[3]].audit = real === 'a' ? 'b' : 'a';
assert.equal(dayState(weeks, 'sam', w, days[3], end).s, 'void');
assert.equal(Math.round(score(weeks, 'sam', w, end, w0).d * 14 / 50), 7);       // days 0 (1 hit) + 4,5,6 (2 each)
weeks.sam[w].days = full('sam');
// one review covers the whole day: reject voids it, two approvals overturn
const k = 'sam__day_' + days[0];
weeks.jo = { [w]: { checkins: {}, reviews: { [k]: { v: 0, r: 'Wrong day', n: 1, t: at(days[0], 22) } } } };
assert.equal(dayState(weeks, 'sam', w, days[0], end).s, 'rejected');
assert.equal(Math.round(score(weeks, 'sam', w, end, w0).d * 14 / 50), 12);
weeks.riz = { [w]: { checkins: {}, reviews: { [k]: { v: 1, n: 1, t: at(days[1], 9) } } } };
weeks.x = { [w]: { checkins: {}, reviews: { [k]: { v: 1, n: 1, t: at(days[1], 10) } } } };
assert.equal(dayState(weeks, 'sam', w, days[0], end).s, 'overturned');
assert.equal(dayState(weeks, 'sam', w, days[6], at(days[6], 22)).s, 'counted');
assert.equal(dayState(weeks, 'sam', w, days[5], end).s, 'verified');
// weekly, seasonal, diversity, unlimited goals
weeks.sam[w].checkins.c_w.lvl = 'n'; assert.equal(Math.round(score(weeks, 'sam', w, end, w0).w), 24);
weeks.sam[w].checkins.s_w.v = 52; assert.equal(Math.round(score(weeks, 'sam', w, end, w0).s * 10), 128);
const narrow = { p: { [w]: { goals: G().slice(0, 2), lockedAt: 1, days: full('p'), reviews: {} } } };
assert.equal(score(narrow, 'p', w, end, w0).pts, 0);
const more = G().concat(['x', 'y', 'z'].map(id => ({ id, type: 'd', cat: 'Life', n: 1, at: at(w0, 9) })));
const big = { p: { [w]: { goals: more, lockedAt: 1, days: Object.fromEntries(days.map(d => { const ticks = { a: 160, b: true, x: true, y: true, z: true }; return [d, { ticks, closed: 1, audit: auditPick('p', d, ticked(more, { ticks })), n: 1, t: at(d, 21), ph: 1 }]; })), reviews: {} } } };
assert.equal(Math.round(score(big, 'p', w, end, w0).d), 50);
// pushed-back goal stays pushed back; streaks; refs
weeks.jo[w0] = { checkins: {}, reviews: { sam__g_b: { v: 0, r: 'Too easy', n: 1, t: at(w0, 12) } } };
assert.equal(goalStatus(weeks, 'sam', G()[1], end).s, 'rejected');
assert.equal(score(weeks, 'sam', w, end, w0).daily[days[2]], 1);
delete weeks.jo[w0].reviews.sam__g_b;
assert.equal(streak(weeks, 'sam', 'b', at(days[6], 22)), 7);
const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
for (let i = 0; i < 12; i++) { const refs = ids.map(u => refOf(ids, u, i)); assert.equal(new Set(refs).size, 6); ids.forEach((u, j) => assert.notEqual(refs[j], u)); }
console.log('core ok');
