/*
 * Motorul de simulare: generează eliberările joburilor și simulează un
 * procesor cu un singur nucleu, pas cu pas (un pas = o unitate de timp).
 * Nu depinde de DOM, deci se poate testa cu Node (vezi tests/).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RTSim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function gcd(a, b) { while (b) { const t = b; b = a % b; a = t; } return a; }
  function lcm(a, b) { return a / gcd(a, b) * b; }

  /** Hiperperioada taskurilor periodice și sporadice (aperiodicele nu au T). */
  function hyperperiod(tasks) {
    const ts = tasks.filter(t => t.type !== 'aperiodic').map(t => t.T);
    if (!ts.length) return 0;
    return ts.reduce(lcm);
  }

  /** Generator pseudoaleator determinist, ca o realizare să poată fi reluată. */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Momentele eliberărilor unui task în [0, horizon).
   *  - periodic: r_k = offset + k T;
   *  - sporadic: între două eliberări trec cel puțin T unități, uneori mai mult;
   *  - aperiodic: intervale exponențiale cu media T, deci și rafale.
   */
  function releases(task, horizon, rand) {
    if (task.releaseTimes) return task.releaseTimes.filter(t => t >= 0 && t < horizon);
    const out = [];
    let t = task.offset || 0;
    while (t < horizon) {
      out.push(t);
      if (task.type === 'periodic') {
        t += task.T;
      } else if (task.type === 'sporadic') {
        // aproximativ o dată din trei exact la intervalul minim, altfel mai târziu
        const u = rand();
        t += u < 0.35 ? task.T : task.T + Math.round(rand() * rand() * 2 * task.T);
      } else {
        const gap = Math.round(-Math.log(1 - rand()) * task.T);
        t += Math.max(1, gap);
      }
    }
    return out;
  }

  const POLICIES = ['RM', 'DM', 'FP', 'EDF', 'LLF', 'FIFO'];

  /** Prioritatea statică a unui task: număr mai mare = prioritate mai mare. */
  function staticRank(policy, task, i, tasks) {
    if (policy === 'RM') return -task.T;
    if (policy === 'DM') return -task.D;
    if (policy === 'FP') return task.prio;
    return 0;
  }

  /**
   * Simulează setul de taskuri.
   * opts: { policy, preemptive, horizon, seed, variableC, abortOnMiss }
   */
  function simulate(tasks, opts) {
    const policy = opts.policy || 'RM';
    const preemptive = opts.preemptive !== false && policy !== 'FIFO';
    const horizon = opts.horizon;
    const rand = rng(opts.seed || 1);
    // generator separat pentru durate, ca bifarea „C variabil” să nu schimbe eliberările
    const randC = rng((opts.seed || 1) * 7919 + 13);
    const jobs = [];

    tasks.forEach((task, ti) => {
      releases(task, horizon, rand).forEach((r, k) => {
        const exec = opts.variableC
          ? Math.max(1, Math.round(task.C * (0.4 + 0.6 * randC())))
          : task.C;
        jobs.push({
          id: jobs.length, task: ti, k, r, d: r + task.D, exec,
          rem: exec, start: null, finish: null, missed: false,
          aborted: false, segments: [], preempted: 0
        });
      });
    });
    jobs.sort((a, b) => a.r - b.r || a.task - b.task);
    jobs.forEach((j, i) => { j.id = i; });

    const ranks = tasks.map((t, i) => staticRank(policy, t, i, tasks));
    const schedule = new Array(horizon).fill(null);
    let next = 0;
    let active = [];
    let running = null;
    let preemptions = 0;

    // cheia de comparare: mai mică = aleasă prima
    function key(j, t) {
      switch (policy) {
        case 'EDF': return [j.d, j.task, j.r];
        case 'LLF': return [(j.d - t) - j.rem, j === running ? 0 : 1, j.d, j.task];
        case 'FIFO': return [j.r, j.task];
        default: return [-ranks[j.task], j.task, j.r];
      }
    }
    function less(a, b) {
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
      return false;
    }

    for (let t = 0; t < horizon; t++) {
      while (next < jobs.length && jobs[next].r === t) active.push(jobs[next++]);

      if (opts.abortOnMiss) {
        active = active.filter(j => {
          if (t >= j.d) { j.missed = true; j.aborted = true; if (j === running) running = null; return false; }
          return true;
        });
      }
      if (!active.length) { running = null; continue; }

      let pick;
      if (!preemptive && running && active.includes(running)) {
        pick = running;
      } else {
        pick = active[0];
        let pk = key(pick, t);
        for (let i = 1; i < active.length; i++) {
          const k = key(active[i], t);
          if (less(k, pk)) { pick = active[i]; pk = k; }
        }
      }
      if (running && running !== pick && active.includes(running)) {
        preemptions++;
        running.preempted++;
      }
      running = pick;
      schedule[t] = pick.id;
      if (pick.start === null) pick.start = t;
      const seg = pick.segments[pick.segments.length - 1];
      if (seg && seg[1] === t) seg[1] = t + 1; else pick.segments.push([t, t + 1]);
      pick.rem--;
      if (pick.rem === 0) {
        pick.finish = t + 1;
        if (pick.finish > pick.d) pick.missed = true;
        active = active.filter(j => j !== pick);
        running = null;
      }
    }
    // joburi neterminate al căror termen a trecut deja
    jobs.forEach(j => { if (j.finish === null && j.d <= horizon) j.missed = true; });

    const stats = summarize(tasks, jobs);
    const busy = schedule.filter(x => x !== null).length;
    return { tasks, jobs, schedule, horizon, stats, busy, preemptions, policy, preemptive };
  }

  /** Statistici pe taskuri: joburi, ratări, timpi de răspuns, întârzieri la start. */
  function summarize(tasks, jobs) {
    return tasks.map((task, ti) => {
      const mine = jobs.filter(j => j.task === ti);
      const done = mine.filter(j => j.finish !== null);
      const R = done.map(j => j.finish - j.r);
      const L = mine.filter(j => j.start !== null).map(j => j.start - j.r);
      return {
        jobs: mine.length,
        finished: done.length,
        missed: mine.filter(j => j.missed).length,
        maxR: R.length ? Math.max(...R) : null,
        avgR: R.length ? R.reduce((a, b) => a + b, 0) / R.length : null,
        minR: R.length ? Math.min(...R) : null,
        maxLatency: L.length ? Math.max(...L) : null,
        startJitter: L.length ? Math.max(...L) - Math.min(...L) : null
      };
    });
  }

  /** Starea fiecărui task la momentul t (pentru panoul de sub diagramă). */
  function stateAt(result, t) {
    return result.tasks.map((task, ti) => {
      const job = result.jobs.find(j => j.task === ti && j.r <= t &&
        (j.finish === null ? !(j.aborted && t >= j.d) : t < j.finish));
      if (!job) {
        const nxt = result.jobs.find(j => j.task === ti && j.r > t);
        return { state: 'waiting', job: null, nextRelease: nxt ? nxt.r : null };
      }
      let done = 0;
      job.segments.forEach(([s, e]) => { done += Math.max(0, Math.min(e, t) - s); });
      const rem = job.exec - done;
      const running = result.schedule[t] === job.id;
      return {
        state: running ? 'running' : 'ready', job, rem,
        laxity: (job.d - t) - rem
      };
    });
  }

  /** Laxitatea X(t) a unui job, pentru t de la eliberare până la terminare. */
  function laxitySeries(job, horizon) {
    const end = job.finish !== null ? job.finish : Math.min(horizon, Math.max(job.d, job.r + 1));
    const pts = [];
    let rem = job.exec;
    for (let t = job.r; t <= end; t++) {
      pts.push([t, (job.d - t) - rem]);
      if (job.segments.some(([s, e]) => t >= s && t < e)) rem--;
    }
    return pts;
  }

  /** Teste de planificabilitate din partea IV a cursului. */
  function analyse(tasks, policy) {
    const hard = tasks.filter(t => t.type !== 'aperiodic');
    const n = hard.length;
    const U = hard.reduce((s, t) => s + t.C / t.T, 0);
    const density = hard.reduce((s, t) => s + t.C / Math.min(t.D, t.T), 0);
    const llBound = n ? n * (Math.pow(2, 1 / n) - 1) : 1;
    const hyperbolic = hard.reduce((p, t) => p * (t.C / t.T + 1), 1);
    const implicit = hard.every(t => t.D === t.T);

    let rta = null;
    if (policy === 'RM' || policy === 'DM' || policy === 'FP') {
      const rank = i => staticRank(policy, tasks[i], i, tasks);
      const all = tasks.map((t, i) => i).sort((a, b) => rank(b) - rank(a) || a - b);
      const order = all.filter(i => tasks[i].type !== 'aperiodic');
      rta = order.map((i, pos) => {
        const t = tasks[i];
        const above = all.slice(0, all.indexOf(i)).filter(j => tasks[j].type === 'aperiodic');
        if (above.length) {
          return { task: i, R: null, steps: [], ok: false, hp: order.slice(0, pos), aperiodicAbove: above };
        }
        const hp = order.slice(0, pos).map(j => tasks[j]);
        const steps = [t.C];
        let R = t.C;
        for (let it = 0; it < 100; it++) {
          const next = t.C + hp.reduce((s, h) => s + Math.ceil(R / h.T) * h.C, 0);
          if (next === R) break;
          R = next;
          steps.push(R);
          if (R > t.D) break;
        }
        return { task: i, R, steps, ok: R <= t.D, hp: order.slice(0, pos) };
      });
    }
    return { n, U, density, llBound, hyperbolic, implicit, rta,
      hasAperiodic: hard.length !== tasks.length, H: hyperperiod(tasks) };
  }

  /** Cea mai mare cerere de eliberări într-o fereastră de lungime w. */
  function densestWindow(times, w) {
    let best = 0, j = 0;
    for (let i = 0; i < times.length; i++) {
      while (times[i] - times[j] >= w) j++;
      best = Math.max(best, i - j + 1);
    }
    return best;
  }


  /* ---------------- vederile pe tipuri de task ---------------- */

  /**
   * Periodic: aceeași secvență de C_k și ε_k, cu așteptare absolută și relativă (2.3).
   * Absolut: r_k = kT, s_k = max(r_k + ε_k, f_{k-1}). Relativ: trezirea w_{k+1} = f_k + T.
   */
  function periodicRelease(o) {
    const rand = rng(o.seed || 1);
    const Cs = [], eps = [];
    for (let k = 0; k < o.n; k++) {
      Cs.push(o.Cmin + Math.floor(rand() * (o.C - o.Cmin + 1)));
      eps.push(Math.floor(rand() * (o.epsMax + 1)));
    }
    const abs = [], rel = [];
    let prevF = -Infinity, wake = 0;
    for (let k = 0; k < o.n; k++) {
      const r = k * o.T;
      const s = Math.max(r + eps[k], prevF);
      const f = s + Cs[k];
      abs.push({ k, grid: r, wake: r, s, f, C: Cs[k], eps: eps[k], L: s - r });
      prevF = f;
      const s2 = wake + eps[k], f2 = s2 + Cs[k];
      rel.push({ k, grid: r, wake, s: s2, f: f2, C: Cs[k], eps: eps[k], L: s2 - r });
      wake = f2 + o.T;
    }
    const jit = list => {
      const L = list.map(x => x.L);
      let relJ = 0;
      for (let k = 1; k < L.length; k++) relJ = Math.max(relJ, Math.abs(L[k] - L[k - 1]));
      return { J: Math.max(...L) - Math.min(...L), Jrel: relJ, maxL: Math.max(...L), last: L[L.length - 1],
        period: L.length > 1 ? (list[list.length - 1].s - list[0].s) / (list.length - 1) : o.T };
    };
    return { abs, rel, absStats: jit(abs), relStats: jit(rel) };
  }

  /**
   * Sporadic: ce se face cu evenimentele venite mai devreme decât intervalul minim (3.2, 5.4).
   *  - none:   fiecare eveniment eliberează un job;
   *  - ignore: evenimentele prea apropiate de ultimul acceptat sunt ignorate;
   *  - defer:  eliberarea se amână până la ultimul job eliberat + Tmin.
   */
  function sporadicFilter(events, Tmin, policy) {
    const out = [];
    let last = -Infinity;
    events.slice().sort((a, b) => a - b).forEach(e => {
      if (policy === 'none') { out.push({ event: e, release: e, kind: 'ok' }); return; }
      if (policy === 'ignore') {
        if (e - last >= Tmin) { out.push({ event: e, release: e, kind: 'ok' }); last = e; }
        else out.push({ event: e, release: null, kind: 'rejected' });
        return;
      }
      const r = Math.max(e, last + Tmin);
      out.push({ event: e, release: r, kind: r > e ? 'deferred' : 'ok' });
      last = r;
    });
    return out;
  }

  /**
   * Aperiodic: cererile sunt servite cu prioritate maximă, în fundal sau de un
   * server cu buget (3.2, 4.8). Serverul pornește cu bugetul Q; fiecare porțiune
   * consumată revine în buget la Ts după momentul în care a început consumul ei
   * (regula serverului sporadic). Astfel, în orice fereastră de lungime Ts, cererile
   * primesc cel mult Q, exact ca un task periodic (Q, Ts), iar RTA rămâne valabilă.
   * Taskurile periodice au priorități RM; serverul are prioritatea dată de Ts.
   * Întoarce un rezultat de forma lui simulate(), plus seria bugetului.
   */
  function simulateAperiodic(o) {
    const { horizon } = o;
    const tasks = o.tasks.map(t => ({ ...t }));
    const jobs = [];
    tasks.forEach((task, ti) => {
      for (let r = task.offset || 0; r < horizon; r += task.T) {
        jobs.push({ task: ti, k: jobs.filter(j => j.task === ti).length, r, d: r + task.D, exec: task.C });
      }
    });
    const ai = tasks.length;
    tasks.push({ name: 'cereri aperiodice', type: 'aperiodic', C: o.Ca, T: o.Ts || 1, D: Infinity, offset: 0, prio: 0 });
    o.requests.slice().sort((a, b) => a.t - b.t).forEach((q, k) => {
      if (q.t < horizon) jobs.push({ task: ai, k, r: q.t, d: Infinity, exec: q.C });
    });
    jobs.sort((a, b) => a.r - b.r || a.task - b.task);
    jobs.forEach((j, i) => Object.assign(j, { id: i, rem: j.exec, start: null, finish: null,
      missed: false, aborted: false, segments: [], preempted: 0 }));

    const schedule = new Array(horizon).fill(null);
    const budget = [];
    let b = o.mode === 'server' ? o.Q : 0;
    let next = 0, active = [], queue = [], running = null, preemptions = 0;
    let chunk = null;          // porțiunea de consum în curs: { start, amount }
    const refills = [];        // reîncărcări programate: { t, amount }
    // rang: număr mai mare = mai prioritar; periodicele după RM
    const rankPeriodic = j => -tasks[j.task].T;
    for (let t = 0; t < horizon; t++) {
      while (next < jobs.length && jobs[next].r === t) {
        const j = jobs[next++];
        (j.task === ai ? queue : active).push(j);
      }
      for (let i = refills.length - 1; i >= 0; i--) {
        if (refills[i].t === t) { b += refills[i].amount; refills.splice(i, 1); }
      }
      let pick = null, best = -Infinity;
      active.forEach(j => {
        const r = rankPeriodic(j);
        if (r > best || (r === best && j.task < pick.task)) { best = r; pick = j; }
      });
      if (queue.length) {
        const head = queue[0];
        let r = null;
        if (o.mode === 'high') r = Infinity;
        else if (o.mode === 'background') r = pick ? null : 0;
        else if (b > 0) r = -o.Ts + 0.5; // la perioade egale, serverul câștigă
        if (r !== null && (pick === null || r > best)) { pick = head; best = r; }
      }
      budget.push([t, b]);
      const serving = pick !== null && pick.task === ai && o.mode === 'server';
      if (chunk && !serving) { refills.push({ t: chunk.start + o.Ts, amount: chunk.amount }); chunk = null; }
      if (!pick) { running = null; continue; }
      if (running && running !== pick && running.rem > 0) { preemptions++; running.preempted++; }
      running = pick;
      schedule[t] = pick.id;
      if (pick.start === null) pick.start = t;
      const seg = pick.segments[pick.segments.length - 1];
      if (seg && seg[1] === t) seg[1] = t + 1; else pick.segments.push([t, t + 1]);
      pick.rem--;
      if (serving) {
        if (!chunk) chunk = { start: t, amount: 0 };
        chunk.amount++;
        b--;
      }
      if (pick.rem === 0) {
        pick.finish = t + 1;
        if (pick.finish > pick.d) pick.missed = true;
        if (pick.task === ai) queue.shift(); else active = active.filter(j => j !== pick);
        running = null;
      }
    }
    budget.push([horizon, b]);
    jobs.forEach(j => { if (j.finish === null && j.d <= horizon) j.missed = true; });
    const busy = schedule.filter(x => x !== null).length;
    return { tasks, jobs, schedule, horizon, stats: summarize(tasks, jobs), busy, preemptions,
      policy: 'RM', preemptive: true, budget };
  }


  /* ---------------- resurse partajate și inversiunea de prioritate (6.3) ---------------- */

  const PROTOCOLS = ['none', 'pip', 'icpp', 'pcp'];

  /**
   * Programul unui task, scris ca în exemplele din 6.3:
   *   „1 [S 2] 1”  = 1 ms de calcul, 2 ms în secțiunea critică pe zăvorul S, 1 ms de calcul;
   *   „[A 2 [B 1]]” = secțiuni critice imbricate (B este luat cât timp A este ținut).
   * Întoarce { ops } sau { error, arg }, cu error unul dintre codurile: 'close' (o „]” fără pereche),
   * 'token' (arg: textul necunoscut), 'open' (arg: zăvorul neînchis), 'empty' (niciun calcul).
   * Operațiile: {op:'calc',n}, {op:'lock',S}, {op:'unlock',S}.
   */
  function parseProgram(text) {
    const ops = [], open = [];
    const re = /\[\s*([^\s\[\]\d][^\s\[\]]*)|\]|\d+|\S+/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const tok = m[0];
      if (m[1]) { ops.push({ op: 'lock', S: m[1] }); open.push(m[1]); }
      else if (tok === ']') {
        if (!open.length) return { error: 'close' };
        ops.push({ op: 'unlock', S: open.pop() });
      } else if (/^\d+$/.test(tok)) { if (+tok > 0) ops.push({ op: 'calc', n: +tok }); }
      else return { error: 'token', arg: tok };
    }
    if (open.length) return { error: 'open', arg: open[open.length - 1] };
    if (!ops.some(o => o.op === 'calc')) return { error: 'empty' };
    return { ops };
  }

  /** Durata calculului dintre o operație lock și perechea ei unlock (secțiunea critică). */
  function criticalSections(ops) {
    const out = [];
    ops.forEach((o, i) => {
      if (o.op !== 'lock') return;
      let depth = 0, len = 0;
      for (let k = i; k < ops.length; k++) {
        if (ops[k].op === 'lock') depth++;
        if (ops[k].op === 'unlock') { depth--; if (depth === 0) break; }
        if (ops[k].op === 'calc') len += ops[k].n;
      }
      out.push({ S: o.S, len });
    });
    return out;
  }

  /** Plafonul fiecărui zăvor: prioritatea celui mai prioritar task care îl folosește. */
  function ceilings(tasks) {
    const c = {};
    tasks.forEach(t => t.ops.forEach(o => {
      if (o.op === 'lock') c[o.S] = Math.max(c[o.S] === undefined ? -Infinity : c[o.S], t.prio);
    }));
    return c;
  }

  /**
   * Simulează câte un job pentru fiecare task (eliberat la r), cu priorități fixe,
   * preemptiv, pe un singur nucleu, sub protocolul ales.
   * tasks: [{ name, prio, r, ops }]; număr mai mare = prioritate mai mare.
   */
  function simulateResources(tasks, protocol) {
    const n = tasks.length;
    const ceil = ceilings(tasks);
    const lockNames = Object.keys(ceil).sort();
    const work = tasks.reduce((a, t) => a + t.ops.reduce((b, o) => b + (o.op === 'calc' ? o.n : 0), 0), 0);
    const cap = Math.max(...tasks.map(t => t.r)) + work + 2;
    // wants: jobul a cerut zăvorul de la pc și nu l-a primit (este blocat până devine posibil)
    const J = tasks.map((t, i) => ({ i, pc: 0, rem: null, held: [], done: false, start: null, finish: null, wants: false }));
    const holder = {};
    lockNames.forEach(S => { holder[S] = null; });
    const timeline = tasks.map(() => []);
    const holders = {};
    lockNames.forEach(S => { holders[S] = []; });
    const events = [];
    let running = null, deadlock = null, end = cap;

    const opAt = j => tasks[j.i].ops[j.pc];
    const curCalc = j => { const o = opAt(j); if (o && o.op === 'calc' && j.rem === null) j.rem = o.n; };
    // după un calcul, eliberează imediat zăvoarele închise și trece peste operațiile fără durată
    function advance(j, t) {
      for (;;) {
        const o = opAt(j);
        if (!o) { j.done = true; j.finish = t; return; }
        if (o.op === 'unlock') {
          holder[o.S] = null;
          j.held = j.held.filter(x => x !== o.S);
          events.push({ t, task: j.i, kind: 'unlock', S: o.S });
          j.pc++;
          continue;
        }
        return;
      }
    }

    for (let t = 0; t < cap; t++) {
      const cand = J.filter(j => !j.done && tasks[j.i].r <= t);
      if (!cand.length && J.every(j => j.done)) { end = t; break; }
      let pick = null, info = null;
      for (let guard = 0; guard < 50; guard++) {
        info = lockState(cand, t);
        const free = cand.filter(j => !info.blocked.has(j));
        if (!free.length) {
          if (cand.length && !deadlock) {
            const cyc = findCycle(info.blockedBy);
            if (cyc) { deadlock = { t, tasks: cyc.map(j => j.i) }; events.push({ t, kind: 'deadlock', tasks: deadlock.tasks }); }
          }
          break;
        }
        pick = free.reduce((a, b) => better(b, a, info.prio) ? b : a);
        const o = opAt(pick);
        if (o.op === 'lock') {
          // jobul ales execută cererea de zăvor: o primește sau se blochează
          if (canTake(pick, o.S, info.prio)) {
            holder[o.S] = pick;
            pick.held.push(o.S);
            pick.wants = false;
            events.push({ t, task: pick.i, kind: 'lock', S: o.S });
            pick.pc++;
          } else {
            pick.wants = true;
            events.push({ t, task: pick.i, kind: holder[o.S] ? 'block' : 'ceiling', S: o.S });
          }
          pick = null;
          continue;     // prioritățile se pot schimba (ICPP, moștenire): se alege din nou
        }
        break;
      }
      // starea fiecărui task la momentul t
      tasks.forEach((task, i) => {
        const j = J[i];
        let st;
        if (j.done) st = { s: 'done' };
        else if (task.r > t) st = { s: 'idle' };
        else if (j === pick) st = { s: 'run' };
        else if (info && info.blocked.has(j)) {
          const o = opAt(j), by = info.blockedBy.get(j);
          st = { s: 'blocked', S: o.S, by: by ? by.i : null, ceiling: holder[o.S] === null };
        } else st = { s: 'ready' };
        if (st.s !== 'done' && st.s !== 'idle' && info) {
          st.prio = info.prio.get(j);
          if (st.prio > task.prio) st.donor = info.donor.get(j);
        }
        st.held = j.held.slice();
        timeline[i].push(st);
      });
      lockNames.forEach(S => holders[S].push(holder[S] ? holder[S].i : null));
      if (pick) {
        curCalc(pick);
        if (pick.start === null) pick.start = t;
        if (running && running !== pick && !running.done) running.preempted = (running.preempted || 0) + 1;
        running = pick;
        pick.rem--;
        if (pick.rem === 0) { pick.rem = null; pick.pc++; advance(pick, t + 1); }
      } else running = null;
      if (deadlock && t >= deadlock.t + 3) { end = t + 1; break; }
    }

    // cine este blocat, de cine, și ce prioritate activă are fiecare
    function lockState(cand, t) {
      const blocked = new Set(), blockedBy = new Map();
      const prio = new Map(), donor = new Map();
      cand.forEach(j => {
        let p = tasks[j.i].prio;
        if (protocol === 'icpp') j.held.forEach(S => { p = Math.max(p, ceil[S]); });
        prio.set(j, p);
        donor.set(j, j.i);
      });
      if (protocol === 'icpp') {
        cand.forEach(j => {
          const p = prio.get(j);
          if (p > tasks[j.i].prio) {
            const d = tasks.map((x, k) => k).filter(k => tasks[k].prio === p && tasks[k].ops.some(o => o.op === 'lock' && j.held.includes(o.S)));
            donor.set(j, d.length ? d[0] : j.i);
          }
        });
      }
      // cererile deja făcute și încă nesatisfăcute
      const evalBlocked = () => {
        blocked.clear(); blockedBy.clear();
        cand.forEach(j => {
          if (!j.wants) return;
          const S = opAt(j).S;
          if (!canTake(j, S, prio)) { blocked.add(j); blockedBy.set(j, blocker(j, S)); }
        });
      };
      evalBlocked();
      if (protocol === 'pip' || protocol === 'pcp') {
        // moștenire tranzitivă; la PCP, prioritatea moștenită poate schimba și cine trece de plafon
        for (let round = 0; round < 20; round++) {
          let changed = false;
          blockedBy.forEach((h, b) => {
            if (h && cand.includes(h) && prio.get(b) > prio.get(h)) {
              prio.set(h, prio.get(b)); donor.set(h, donor.get(b)); changed = true;
            }
          });
          if (!changed) break;
          if (protocol === 'pcp') evalBlocked();
        }
      }
      return { blocked, blockedBy, prio, donor };
    }
    // regula de acordare a zăvorului; la PCP, prioritatea trebuie să depășească plafoanele zăvoarelor ținute de alții
    function systemCeiling(j) {
      let sys = -Infinity, who = null;
      lockNames.forEach(S => { if (holder[S] && holder[S] !== j && ceil[S] > sys) { sys = ceil[S]; who = holder[S]; } });
      return { sys, who };
    }
    function canTake(j, S, prio) {
      if (holder[S] && holder[S] !== j) return false;
      if (protocol === 'pcp') return prio.get(j) > systemCeiling(j).sys;
      return true;
    }
    function blocker(j, S) { return holder[S] || systemCeiling(j).who; }
    // la prioritate egală: jobul care rula continuă, apoi cel eliberat mai devreme, apoi ordinea din tabel
    function better(a, b, prio) {
      if (prio.get(a) !== prio.get(b)) return prio.get(a) > prio.get(b);
      if (a === running) return true;
      if (b === running) return false;
      if (tasks[a.i].r !== tasks[b.i].r) return tasks[a.i].r < tasks[b.i].r;
      return a.i < b.i;
    }
    function findCycle(blockedBy) {
      for (const start of blockedBy.keys()) {
        const seen = [];
        let cur = start;
        while (cur && blockedBy.has(cur)) {
          if (seen.includes(cur)) return seen.slice(seen.indexOf(cur));
          seen.push(cur);
          cur = blockedBy.get(cur);
        }
      }
      return null;
    }

    // statistici: timpul de răspuns și cât a așteptat fiecare după taskuri mai puțin prioritare
    const horizon = Math.min(end, timeline[0].length);
    const stats = tasks.map((task, i) => {
      let blockedT = 0, inversion = 0;
      for (let t = 0; t < horizon; t++) {
        const st = timeline[i][t];
        if (st.s !== 'blocked' && st.s !== 'ready') continue;
        if (st.s === 'blocked') blockedT++;
        const runner = tasks.findIndex((x, k) => timeline[k][t].s === 'run');
        if (runner >= 0 && tasks[runner].prio < task.prio) inversion++;
      }
      const j = J[i];
      return { start: j.start, finish: j.finish, R: j.finish !== null ? j.finish - task.r : null, blocked: blockedT, inversion };
    });
    return { tasks, protocol, timeline, holders, lockNames, ceil, events, deadlock, horizon, stats };
  }

  /**
   * Marginile blocării B_i din 6.3, secțiunea 6, pentru PIP și pentru plafon.
   * Zăvoarele care contează pentru τ_i: folosite de un task mai puțin prioritar și
   * cu plafonul cel puțin egal cu prioritatea lui τ_i.
   */
  function blockingBounds(tasks) {
    const ceil = ceilings(tasks);
    const delta = tasks.map(t => {
      const d = {};
      criticalSections(t.ops).forEach(cs => { d[cs.S] = Math.max(d[cs.S] || 0, cs.len); });
      return d;
    });
    return tasks.map((ti, i) => {
      const lower = tasks.map((t, j) => j).filter(j => tasks[j].prio < ti.prio);
      const matter = Object.keys(ceil).filter(S => ceil[S] >= ti.prio && lower.some(j => delta[j][S] !== undefined));
      const ceilingB = Math.max(0, ...lower.flatMap(j => matter.map(S => delta[j][S] || 0)));
      const byTask = lower.reduce((a, j) => a + Math.max(0, ...matter.map(S => delta[j][S] || 0)), 0);
      const byLock = matter.reduce((a, S) => a + Math.max(0, ...lower.map(j => delta[j][S] || 0)), 0);
      // fără protocol: un task de prioritate intermediară poate prelungi blocarea oricât
      const uses = new Set(ti.ops.filter(o => o.op === 'lock').map(o => o.S));
      const direct = lower.filter(j => Object.keys(delta[j]).some(S => uses.has(S)));
      const medium = direct.length ? tasks.map((t, k) => k).filter(k =>
        direct.some(j => tasks[k].prio < ti.prio && tasks[k].prio > tasks[j].prio)) : [];
      const noneB = medium.length ? null
        : direct.reduce((a, j) => a + Math.max(0, ...[...uses].map(S => delta[j][S] || 0)), 0);
      return { matter, ceiling: ceilingB, pip: Math.min(byTask, byLock), none: noneB, medium };
    });
  }

  /** Deadlock posibil fără plafon: zăvoare luate imbricat în ordini contrare. */
  function lockOrderCycle(tasks) {
    const edges = {};
    tasks.forEach(t => {
      const held = [];
      t.ops.forEach(o => {
        if (o.op === 'lock') { held.forEach(A => { (edges[A] = edges[A] || new Set()).add(o.S); }); held.push(o.S); }
        if (o.op === 'unlock') held.splice(held.lastIndexOf(o.S), 1);
      });
    });
    const visit = (u, path) => {
      if (path.includes(u)) return path.slice(path.indexOf(u)).concat(u);
      for (const v of edges[u] || []) { const c = visit(v, path.concat(u)); if (c) return c; }
      return null;
    };
    for (const A of Object.keys(edges)) { const c = visit(A, []); if (c) return c; }
    return null;
  }

  return { gcd, lcm, hyperperiod, rng, releases, simulate, stateAt,
    laxitySeries, analyse, densestWindow, POLICIES, summarize,
    periodicRelease, sporadicFilter, simulateAperiodic,
    PROTOCOLS, parseProgram, criticalSections, ceilings, simulateResources, blockingBounds, lockOrderCycle };
});
