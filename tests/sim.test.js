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

test('periodic: așteptarea relativă derivă cu C pe perioadă, cea absolută nu (2.3)', () => {
  const r = S.periodicRelease({ C: 3, Cmin: 3, T: 10, epsMax: 0, n: 301, seed: 1 });
  assert.equal(r.rel[300].s, 3900);
  assert.equal(r.relStats.last, 900);
  assert.equal(r.abs[300].s, 3000);
  assert.equal(r.absStats.J, 0);
});

test('periodic: cu așteptare absolută o întârziere nu se propagă', () => {
  const r = S.periodicRelease({ C: 3, Cmin: 1, T: 10, epsMax: 4, n: 50, seed: 3 });
  r.abs.forEach(j => assert.ok(j.L <= 4));
  assert.ok(r.absStats.Jrel <= r.absStats.J);
});

test('sporadic: ignorare și amânare impun intervalul minim', () => {
  const ev = [0, 2, 3, 15, 16, 40];
  const ign = S.sporadicFilter(ev, 10, 'ignore');
  assert.deepEqual(ign.filter(x => x.kind === 'ok').map(x => x.release), [0, 15, 40]);
  const def = S.sporadicFilter(ev, 10, 'defer');
  assert.deepEqual(def.map(x => x.release), [0, 10, 20, 30, 40, 50]);
  assert.equal(S.sporadicFilter(ev, 10, 'none').length, 6);
});

test('aperiodic: în fundal nu afectează periodicele, cu prioritate maximă le poate face să rateze', () => {
  const tasks = [{ name: 'p', type: 'periodic', C: 3, T: 10, D: 10, offset: 0 }];
  const requests = [0, 1, 2, 3].map(t => ({ t, C: 3 }));
  const base = { tasks, requests, Ca: 3, Ts: 10, Q: 3, horizon: 40 };
  const bg = S.simulateAperiodic({ ...base, mode: 'background' });
  assert.equal(bg.stats[0].missed, 0);
  const hi = S.simulateAperiodic({ ...base, mode: 'high' });
  assert.ok(hi.stats[0].missed > 0);
  const srv = S.simulateAperiodic({ ...base, mode: 'server' });
  assert.equal(srv.stats[0].missed, 0);
  // serverul nu consumă mai mult de Q în nicio perioadă Ts
  for (let k = 0; k < 4; k++) {
    const used = srv.schedule.slice(k * 10, k * 10 + 10).filter(id => id !== null && srv.jobs[id].task === 1).length;
    assert.ok(used <= 3);
  }
});

test('server: cel mult Q în orice fereastră Ts; dacă RTA trece, periodicele nu ratează', () => {
  const rand = S.rng(99);
  const sets = [
    [{ name: 'a', type: 'periodic', C: 2, T: 8, D: 8 }, { name: 'b', type: 'periodic', C: 4, T: 12, D: 12 }],
    [{ name: 'a', type: 'periodic', C: 3, T: 10, D: 10 }, { name: 'b', type: 'periodic', C: 6, T: 15, D: 15 }],
    [{ name: 'a', type: 'periodic', C: 1, T: 5, D: 5 }, { name: 'b', type: 'periodic', C: 5, T: 20, D: 20 }]
  ];
  let checked = 0;
  for (let it = 0; it < 300; it++) {
    const tasks = sets[it % sets.length];
    const Ts = 4 + Math.floor(rand() * 20), Q = 1 + Math.floor(rand() * Math.min(6, Ts));
    const reqs = [];
    for (let t = Math.floor(rand() * 5); t < 200; t += 1 + Math.floor(-Math.log(1 - rand()) * 10)) reqs.push({ t, C: 1 + Math.floor(rand() * 5) });
    const r = S.simulateAperiodic({ tasks, requests: reqs, Ca: 3, mode: 'server', Q, Ts, horizon: 200 });
    const ai = tasks.length;
    const used = r.schedule.map(id => (id !== null && r.jobs[id].task === ai ? 1 : 0));
    for (let s = 0; s + Ts <= 200; s++) {
      assert.ok(used.slice(s, s + Ts).reduce((a, b) => a + b, 0) <= Q, `fereastra ${s}, Q=${Q}, Ts=${Ts}`);
    }
    const server = { name: 'server', type: 'periodic', C: Q, T: Ts, D: Ts };
    const rta = S.analyse([server, ...tasks], 'RM').rta;
    if (rta.every(x => x.ok)) {
      checked++;
      assert.equal(r.stats.slice(0, ai).reduce((a, x) => a + x.missed, 0), 0, `Q=${Q}, Ts=${Ts}`);
    }
  }
  assert.ok(checked > 50);
});

/* ---------- inversiunea de prioritate (6.3) ---------- */
const task = (name, prio, r, prog) => ({ name, prio, r, ops: S.parseProgram(prog).ops });
const drawing = (res, i) => res.timeline[i].slice(0, res.horizon)
  .map(st => (st.s === 'run' ? (st.held.length ? 'Z' : '#') : { ready: '-', blocked: 'x' }[st.s] || '.')).join('');
const drone = () => [task('H', 3, 1, '1 [S 2]'), task('M', 2, 3, '8'), task('L', 1, 0, '[S 4] 1')];

test('programul unui task: secțiuni critice imbricate și erori', () => {
  assert.deepEqual(S.parseProgram('1 [A 2 [B 1]] 1').ops.map(o => o.op + (o.S || o.n)),
    ['calc1', 'lockA', 'calc2', 'lockB', 'calc1', 'unlockB', 'unlockA', 'calc1']);
  assert.deepEqual(S.criticalSections(S.parseProgram('[A 2 [B 1]]').ops), [{ S: 'A', len: 3 }, { S: 'B', len: 1 }]);
  assert.ok(S.parseProgram('1 [S 2').error);
  assert.ok(S.parseProgram('1 ] 2').error);
  assert.ok(S.parseProgram('abc').error);
});

test('drona din 6.3: diagramele fără protocol, cu moștenire și cu plafon imediat', () => {
  const none = S.simulateResources(drone(), 'none');
  assert.equal(drawing(none, 0), '.#xxxxxxxxxxxZZ.');
  assert.equal(drawing(none, 1), '...########.....');
  assert.equal(drawing(none, 2), 'Z-Z--------ZZ--#');
  const pip = S.simulateResources(drone(), 'pip');
  assert.equal(drawing(pip, 0), '.#xxxZZ.........');
  assert.equal(drawing(pip, 1), '...----########.');
  assert.equal(drawing(pip, 2), 'Z-ZZZ----------#');
  assert.equal(pip.timeline[2][2].prio, 3);            // L rulează cu prioritatea lui H
  const icpp = S.simulateResources(drone(), 'icpp');
  assert.equal(drawing(icpp, 0), '.---#ZZ.........');   // H pornește abia după ce L eliberează zăvorul
  assert.equal(icpp.stats[0].R, 6);
});

test('deadlock cu zăvoare în ordine inversă: doar protocoalele cu plafon îl previn', () => {
  const set = () => [task('τ1', 2, 1, '[B 1 [A 1]]'), task('τ2', 1, 0, '[A 2 [B 1]]')];
  assert.equal(S.simulateResources(set(), 'none').deadlock.t, 3);
  assert.equal(S.simulateResources(set(), 'pip').deadlock.t, 3);
  assert.equal(S.simulateResources(set(), 'icpp').deadlock, null);
  const pcp = S.simulateResources(set(), 'pcp');
  assert.equal(pcp.deadlock, null);
  assert.ok(pcp.events.some(e => e.kind === 'ceiling' && e.task === 0));   // blocare de plafon
  assert.deepEqual(S.lockOrderCycle(set()), ['B', 'A', 'B']);
});

test('blocare în lanț: sub moștenire H plătește două secțiuni critice, sub plafon una', () => {
  const set = () => [task('H', 3, 2, '[S1 1] [S2 1] 1'), task('L1', 2, 1, '[S1 3] 1'), task('L2', 1, 0, '[S2 4] 1')];
  const pip = S.simulateResources(set(), 'pip');
  assert.equal(pip.stats[0].blocked, 5);
  assert.equal(pip.events.filter(e => e.kind === 'block' && e.task === 0).length, 2);
  for (const p of ['icpp', 'pcp']) assert.equal(S.simulateResources(set(), p).stats[0].R, 5);
});

test('marginile blocării B_i (6.3, secțiunea 6)', () => {
  const b = S.blockingBounds(drone());
  assert.deepEqual([b[0].pip, b[0].ceiling, b[0].none], [4, 4, null]);   // H: nemărginită fără protocol, din cauza lui M
  assert.deepEqual([b[1].pip, b[1].ceiling, b[1].none], [4, 4, 0]);      // M: prin împingere
  assert.deepEqual([b[2].pip, b[2].ceiling], [0, 0]);
  const ch = S.blockingBounds([task('H', 3, 2, '[S1 1] [S2 1] 1'), task('L1', 2, 1, '[S1 3] 1'), task('L2', 1, 0, '[S2 4] 1')]);
  assert.deepEqual([ch[0].pip, ch[0].ceiling], [7, 4]);
  // în simulare, blocarea observată nu depășește niciodată marginea
  for (const p of ['pip', 'icpp', 'pcp']) {
    const r = S.simulateResources(drone(), p);
    r.stats.forEach((st, i) => assert.ok(st.inversion <= b[i][p === 'pip' ? 'pip' : 'ceiling']));
  }
});

test('cu decalaje (prima eliberare ≠ 0), R simulat nu depășește niciodată R din RTA', () => {
  const rand = S.rng(2024);
  let compared = 0;
  for (let it = 0; it < 400; it++) {
    const n = 2 + Math.floor(rand() * 2);
    const set = [];
    for (let i = 0; i < n; i++) {
      const T = [4, 5, 6, 8, 10, 12, 15, 20][Math.floor(rand() * 8)];
      set.push(P('t' + i, 1 + Math.floor(rand() * Math.max(1, T / 3)), T, T, { offset: Math.floor(rand() * T) }));
    }
    const rta = S.analyse(set, 'RM').rta;
    if (!rta.every(x => x.ok)) continue;
    const H = Math.min(600, S.hyperperiod(set) * 2 + 20);
    const sim = S.simulate(set, { policy: 'RM', horizon: H });
    rta.forEach(x => {
      const maxR = sim.stats[x.task].maxR;
      if (maxR !== null) { assert.ok(maxR <= x.R, `${JSON.stringify(set)}: ${maxR} > ${x.R}`); compared++; }
    });
  }
  assert.ok(compared > 300);
});
