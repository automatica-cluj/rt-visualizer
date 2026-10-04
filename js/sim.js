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

  const POLICIES = {
    RM: 'Rate Monotonic (RM)',
    DM: 'Deadline Monotonic (DM)',
    FP: 'Priorități fixe alese manual',
    EDF: 'Earliest Deadline First (EDF)',
    LLF: 'Least Laxity First (LLF)',
    FIFO: 'Primul venit, primul servit (FIFO)'
  };

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
    const jobs = [];

    tasks.forEach((task, ti) => {
      releases(task, horizon, rand).forEach((r, k) => {
        const exec = opts.variableC
          ? Math.max(1, Math.round(task.C * (0.4 + 0.6 * rand())))
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
        case 'EDF': return [j.d, j.r, j.task];
        case 'LLF': return [(j.d - t) - j.rem, j === running ? 0 : 1, j.d, j.task];
        case 'FIFO': return [j.r, j.task];
        default: return [-ranks[j.task], j.r, j.task];
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

    const stats = tasks.map((task, ti) => {
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
    const busy = schedule.filter(x => x !== null).length;
    return { tasks, jobs, schedule, horizon, stats, busy, preemptions, policy, preemptive };
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
      const idx = tasks.map((t, i) => i).filter(i => tasks[i].type !== 'aperiodic');
      const rank = i => staticRank(policy, tasks[i], i, tasks);
      const order = idx.slice().sort((a, b) => rank(b) - rank(a) || a - b);
      rta = order.map((i, pos) => {
        const t = tasks[i];
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

  return { gcd, lcm, hyperperiod, rng, releases, simulate, stateAt,
    laxitySeries, analyse, densestWindow, POLICIES };
});
