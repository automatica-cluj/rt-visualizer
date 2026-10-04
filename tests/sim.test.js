// Rulare: npm test (sau node --test tests/*.test.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/sim.js');

const P = (name, C, T, D = T, extra = {}) =>
  ({ name, type: 'periodic', C, T, D, offset: 0, prio: 1, ...extra });

test('hiperperioada și factorul de utilizare (exemplul din 3.2)', () => {
  const set = [P('senzor', 2, 10), P('comandă', 4, 20), P('jurnal', 8, 40)];
  assert.equal(S.hyperperiod(set), 40);
  const a = S.analyse(set, 'RM');
  assert.ok(Math.abs(a.U - 0.6) < 1e-9);
  const r = S.simulate(set, { policy: 'RM', horizon: 40 });
  assert.equal(r.busy, 24);
  assert.equal(r.stats.reduce((s, x) => s + x.missed, 0), 0);
});

test('instantul critic: R2 = 8 cu eliberări simultane, 6 cu decalaj (3.2)', () => {
  const sync = S.simulate([P('t1', 2, 5), P('t2', 4, 10)], { policy: 'RM', horizon: 10 });
  assert.equal(sync.jobs.find(j => j.task === 1).finish, 8);
  const off = S.simulate([P('t1', 2, 5, 5, { offset: 3 }), P('t2', 4, 10)], { policy: 'RM', horizon: 10 });
  assert.equal(off.jobs.find(j => j.task === 1).finish, 6);
});

test('RM ratează, EDF nu, pentru (2,5) și (4,7)', () => {
  const set = [P('a', 2, 5), P('b', 4, 7)];
  const rm = S.simulate(set, { policy: 'RM', horizon: 35 });
  const edf = S.simulate(set, { policy: 'EDF', horizon: 35 });
  assert.ok(rm.stats[1].missed > 0);
  assert.equal(edf.stats[0].missed + edf.stats[1].missed, 0);
  const rta = S.analyse(set, 'RM').rta;
  assert.equal(rta[1].ok, false);
});

test('DM salvează setul cu D < T pe care RM îl ratează', () => {
  const set = [P('a', 2, 5, 5), P('b', 2, 10, 3)];
  assert.ok(S.simulate(set, { policy: 'RM', horizon: 10 }).stats[1].missed > 0);
  const dm = S.simulate(set, { policy: 'DM', horizon: 10 });
  assert.equal(dm.stats[0].missed + dm.stats[1].missed, 0);
  assert.ok(S.analyse(set, 'DM').rta.every(x => x.ok));
});

test('RTA dă aceleași valori ca simularea la instantul critic', () => {
  const set = [P('a', 1, 4), P('b', 2, 6), P('c', 3, 13)];
  const rta = S.analyse(set, 'RM').rta;
  const sim = S.simulate(set, { policy: 'RM', horizon: 13 });
  rta.forEach(x => assert.equal(sim.jobs.find(j => j.task === x.task && j.k === 0).finish, x.R));
});

test('sporadic: niciodată două eliberări mai apropiate decât T', () => {
  const rand = S.rng(7);
  const t = { type: 'sporadic', T: 10, offset: 0 };
  const rs = S.releases(t, 2000, rand);
  for (let i = 1; i < rs.length; i++) assert.ok(rs[i] - rs[i - 1] >= 10);
  assert.equal(S.densestWindow(rs, 10), 1);
});

test('laxitatea: exemplul din 3.2, secțiunea 7', () => {
  // task (3, 10, 8) preemptat 2 ms de un task mai prioritar eliberat la 2
  const set = [P('hp', 2, 100, 100, { offset: 2, prio: 2 }), P('t', 3, 10, 8)];
  const r = S.simulate(set, { policy: 'FP', horizon: 10 });
  const job = r.jobs.find(j => j.task === 1 && j.k === 0);
  assert.equal(job.finish, 5);
  const X = Object.fromEntries(S.laxitySeries(job, 10));
  assert.deepEqual([X[0], X[2], X[4], X[5]], [5, 5, 3, 3]);
  const st = S.stateAt(r, 3)[1];
  assert.equal(st.state, 'ready');
  assert.equal(st.rem, 1);
});

test('nepreemptiv: jobul început nu este întrerupt', () => {
  const set = [P('a', 1, 4, 4, { offset: 1 }), P('b', 4, 20)];
  const r = S.simulate(set, { policy: 'RM', preemptive: false, horizon: 20 });
  assert.equal(r.jobs.find(j => j.task === 1).segments.length, 1);
  assert.equal(r.preemptions, 0);
});

test('RTA nu dă garanții sub un task aperiodic mai prioritar', () => {
  const set = [P('diag', 3, 12, 30, { type: 'aperiodic', prio: 5 }), P('senzor', 2, 10, 10, { prio: 3 })];
  const rta = S.analyse(set, 'FP').rta;
  assert.equal(rta.length, 1);
  assert.equal(rta[0].ok, false);
  assert.deepEqual(rta[0].aperiodicAbove, [0]);
});

test('la aceeași prioritate câștigă taskul aflat mai sus în tabel', () => {
  // b eliberat mai devreme, dar a este primul în tabel și are aceeași perioadă
  const set = [P('a', 2, 10, 10, { offset: 1 }), P('b', 4, 10)];
  const r = S.simulate(set, { policy: 'RM', horizon: 10 });
  assert.equal(r.schedule[1], r.jobs.find(j => j.task === 0).id);
});

test('bifarea „C variabil” nu schimbă eliberările sporadice', () => {
  const set = [P('s', 1, 10, 10, { type: 'sporadic' })];
  const a = S.simulate(set, { horizon: 300, seed: 4 }).jobs.map(j => j.r);
  const b = S.simulate(set, { horizon: 300, seed: 4, variableC: true }).jobs.map(j => j.r);
  assert.deepEqual(a, b);
});
