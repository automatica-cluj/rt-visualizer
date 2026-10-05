/* Legătura dintre controale, simulare și desene. */
(function () {
  'use strict';
  const S = window.RTSim, R = window.RTRender, Tip = window.RTTip, I = window.RTI18N;
  const L = I.L, tr = I.tr;
  const $ = id => document.getElementById(id);
  const fmt2 = v => I.num(v, 2);
  const fmt3 = v => I.num(v, 3);
  const pct = v => Math.round(v * 100) + ' %';
  const color = R.color;
  const TYPE = { periodic: 'periodic', sporadic: 'sporadic', aperiodic: 'aperiodic' };

  /* ---------- formule scurte în text: $C_i$ -> C<sub>i</sub> ---------- */
  function tex(s) {
    return '<span class="m">' + s
      .replace(/\\varepsilon/g, 'ε').replace(/\\le/g, '≤').replace(/\\sum/g, 'Σ').replace(/\\tau/g, 'τ')
      .replace(/\\bar T/g, 'T̄').replace(/\\cdot/g, '·').replace(/\{,\}/g, ',')
      .replace(/_\{([^}]*)\}/g, '<sub>$1</sub>').replace(/_(\w)/g, '<sub>$1</sub>')
      .replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>') + '</span>';
  }
  const texify = html => html.replace(/\$([^$]+)\$/g, (m, g) => tex(g));

  /* ---------- textul fix al paginii, în limba aleasă ---------- */
  const staticEls = [...document.querySelectorAll('[data-i18n]')];
  staticEls.forEach(n => { n._ro = n.innerHTML; });
  const attrEls = [...document.querySelectorAll('[data-i18n-title], [data-i18n-aria]')];
  attrEls.forEach(n => { n._roTitle = n.getAttribute('title'); n._roAria = n.getAttribute('aria-label'); });
  function applyStatic() {
    const en = I.lang === 'en';
    document.documentElement.lang = I.lang;
    staticEls.forEach(n => {
      const k = n.dataset.i18n;
      let html = n._ro;
      if (en) {
        if (I.EN[k] === undefined) console.warn('i18n: lipsește', k);
        else html = I.EN[k];
      }
      n.innerHTML = n.tagName === 'OPTION' || n.tagName === 'TITLE' ? html : texify(html);
    });
    attrEls.forEach(n => {
      const kt = n.dataset.i18nTitle, ka = n.dataset.i18nAria;
      if (kt) n.setAttribute('title', en && I.EN[kt] ? I.EN[kt] : n._roTitle);
      if (ka) n.setAttribute('aria-label', en && I.EN[ka] ? I.EN[ka] : n._roAria);
    });
    $('lang').textContent = en ? 'RO' : 'EN';
    $('lang').title = en ? 'Afișează pagina în română' : 'Show the page in English';
  }
  applyStatic();

  /* ---------- cheia de sub fiecare diagramă ---------- */
  const KEY = () => ({
    exec: [L('jobul rulează', 'job runs'), '<rect x="1" y="3" width="20" height="10" rx="2" style="fill:var(--s1)"/>'],
    ready: [L('eliberat, așteaptă în Ready', 'released, waits in Ready'), '<pattern id="P" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" style="fill:var(--s1);opacity:.1"/><line x1="0" y1="0" x2="0" y2="5" style="stroke:var(--s1);stroke-width:2;opacity:.55"/></pattern><rect x="1" y="4" width="20" height="8" style="fill:url(#P)"/>'],
    rel: [L('eliberare r', 'release r'), '<line x1="11" y1="15" x2="11" y2="4" class="rel"/><path d="M7,6 L11,0 L15,6 z" class="mk-rel"/>'],
    dl: [L('termen-limită d', 'deadline d'), '<line x1="11" y1="1" x2="11" y2="10" class="dl" style="stroke:var(--s1)"/><path d="M7,9 L11,15 L15,9 z" class="mk-dl"/>'],
    miss: [L('termen ratat', 'missed deadline'), '<line x1="11" y1="1" x2="11" y2="10" class="dl dl-miss"/><path d="M7,9 L11,15 L15,9 z" class="mk-miss"/>'],
    dim: [L('cotă: T, D, C, R', 'dimension: T, D, C, R'), '<line x1="2" y1="8" x2="20" y2="8" class="dimline"/><line x1="2" y1="4" x2="2" y2="12" class="dimtick"/><line x1="20" y1="4" x2="20" y2="12" class="dimtick"/>'],
    idle: [L('procesor liber', 'idle processor'), '<rect x="1" y="11" width="20" height="3" class="idle"/>'],
    event: [L('eveniment', 'event'), '<line x1="11" y1="15" x2="11" y2="6" class="ev-stem"/><circle cx="11" cy="5" r="4" class="ev-dot"/>'],
    deferred: [L('eliberare amânată', 'postponed release'), '<line x1="4" y1="11" x2="20" y2="11" class="defer-line"/><circle cx="5" cy="5" r="4" class="ev-dot ev-def"/>'],
    rejected: [L('eveniment ignorat', 'ignored event'), '<text x="11" y="13" class="ev-x" text-anchor="middle">✕</text>'],
    grid: [L('grila ideală kT', 'ideal grid kT'), '<line x1="11" y1="0" x2="11" y2="16" class="grid-ideal"/>'],
    cs: [L('în secțiunea critică (eticheta: zăvorul)', 'in the critical section (label: the lock)'), '<rect x="1" y="3" width="20" height="11" rx="2" style="fill:var(--s3)"/><rect x="1" y="3" width="20" height="3" class="cs-bar"/>'],
    boost: [L('rulează cu prioritate ridicată (culoarea taskului de la care vine)', 'runs with a raised priority (color of the task it comes from)'), '<rect x="1" y="7" width="20" height="8" rx="2" style="fill:var(--s3)"/><rect x="1" y="1" width="20" height="4" rx="1" style="fill:var(--s1)"/>'],
    lockwait: [L('blocat: așteaptă un zăvor', 'blocked: waits for a lock'), '<pattern id="P" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" class="blk-bg"/><path d="M0,0 L5,5 M5,0 L0,5" class="blk-x"/></pattern><rect x="1" y="4" width="20" height="8" class="blk-box" style="fill:url(#P)"/>'],
    lock: [L('zăvor ținut (culoarea proprietarului)', 'lock held (color of the owner)'), '<rect x="1" y="5" width="20" height="7" rx="2" class="lock-held" style="fill:var(--s3)"/>'],
    cursor: ['cursor', '<line x1="11" y1="0" x2="11" y2="16" class="cursor"/>']
  });
  // variante ale simbolurilor de mai sus, cu alt text
  const KEY_ALIAS = () => ({
    readyPrev: ['ready', L('eliberat, așteaptă jobul precedent', 'released, waits for the previous job')],
    readyEps: ['ready', L('întârzierea ε până la pornire', 'delay ε until the start')],
    relWake: ['rel', L('trezire', 'wake-up')],
    relArrival: ['rel', L('eliberare sau sosire', 'release or arrival')]
  });
  function buildKeys() {
    const K = KEY(), A = KEY_ALIAS();
    document.querySelectorAll('.key').forEach((k, ki) => {
      k.innerHTML = k.dataset.key.split('|').map(item => {
        const [name, label] = A[item] || [item, null];
        const [txt, svg] = K[name];
        return `<span><svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true">${svg.replace(/id="P"/, `id="kp${ki}"`).replace('url(#P)', `url(#kp${ki})`)}</svg>${label || txt}</span>`;
      }).join('');
    });
  }
  buildKeys();

  /* ---------- tema ---------- */
  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* fără stocare */ } }
  };
  const saved = storage.get('rtv-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  $('theme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    storage.set('rtv-theme', next);
  });

  /* ---------- glisoare: afișează valoarea lângă ele ---------- */
  function bindRange(id, fn) {
    const inp = $(id), out = inp.parentNode.querySelector('output');
    const upd = () => { if (out) out.textContent = inp.value; };
    upd();
    inp.addEventListener('input', () => { upd(); fn(); });
    return () => +inp.value;
  }

  /* ---------- tooltip pentru joburi ---------- */
  function jobTip(result, svg) {
    svg.onmousemove = ev => {
      const tipId = ev.target.getAttribute && ev.target.getAttribute('data-tip');
      if (tipId !== null && tipId !== undefined && svg._tips) { Tip.show(ev, svg._tips[+tipId]); return; }
      const id = ev.target.getAttribute && ev.target.getAttribute('data-job');
      if (id === null || id === undefined) { Tip.hide(); return; }
      const j = result.jobs[+id], t = result.tasks[j.task];
      if (j.tip) { Tip.show(ev, j.tip); return; }
      const rows = [
        `<span class="sw" style="background:${color(j.task)}"></span><b>${esc(t.name)}</b>, ${L('jobul', 'job')} ${j.k} (${TYPE[t.type]})`,
        isFinite(j.d) ? L(`eliberare r = ${j.r}, termen d = ${j.d}`, `release r = ${j.r}, deadline d = ${j.d}`)
          : L(`sosire r = ${j.r}, fără termen-limită`, `arrival r = ${j.r}, no deadline`),
        `${L('timp de calcul', 'computation time')}: ${j.exec}${j.exec !== t.C ? ` (C = ${t.C})` : ''}`,
        j.start !== null ? L(`început la ${j.start}, întârziere ${j.start - j.r}`, `started at ${j.start}, start latency ${j.start - j.r}`) : L('nu a început', 'not started'),
        j.finish !== null ? L(`terminat la ${j.finish}, R = ${j.finish - j.r}`, `finished at ${j.finish}, R = ${j.finish - j.r}`)
          : (j.aborted ? L('abandonat la termen', 'aborted at the deadline') : L('neterminat până la sfârșitul simulării', 'not finished by the end of the simulation')),
        L(`preemptat de ${j.preempted} ori`, `preempted ${j.preempted} times`)
      ];
      if (j.missed) rows.push(`<b class="bad">✕ ${L('termen ratat', 'deadline missed')}</b>`);
      Tip.show(ev, rows.join('<br>'));
    };
    svg.onmouseleave = () => Tip.hide();
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function card(label, value, extra) {
    return `<div class="card"><div class="card-label">${label}</div><div class="card-value">${value}</div>${extra ? `<div class="card-extra">${extra}</div>` : ''}</div>`;
  }
  function verdict(kind, label) {
    const icon = { ok: '✓', bad: '✕', maybe: '?' }[kind];
    return `<span class="verdict ${kind}"><span class="vi">${icon}</span>${label}</span>`;
  }

  /* ===================== 1. Modelul de task ===================== */
  const m = {};
  ['C', 'T', 'D', 'r', 'hC', 'hT', 'hr'].forEach(k => { m[k] = bindRange('m-' + k, renderModel); });
  // în curs D ≤ T; glisorul lui D nu trece de perioadă
  function clampD() {
    const d = $('m-D');
    d.max = m.T();
    if (+d.value > m.T()) d.value = m.T();
    d.parentNode.querySelector('output').textContent = d.value;
  }
  $('m-hp').addEventListener('change', renderModel);

  function renderModel() {
    clampD();
    const C = m.C(), T = m.T(), D = m.D(), r0 = m.r();
    const tasks = [];
    if ($('m-hp').checked) {
      tasks.push({ name: L('τh mai prioritar', 'τh higher priority'), type: 'periodic', C: m.hC(), T: m.hT(), D: m.hT(), offset: m.hr(), prio: 2 });
    }
    tasks.push({ name: L('τ analizat', 'τ analyzed'), type: 'periodic', C, T, D, offset: r0, prio: 1 });
    const mi = tasks.length - 1;
    const horizon = Math.min(90, Math.max(30, r0 + 3 * T));
    const res = S.simulate(tasks, { policy: 'FP', horizon });
    R.gantt($('m-gantt'), res, { annotate: { task: mi, k: 0 }, cpuRow: true });
    jobTip(res, $('m-gantt'));

    const mine = res.jobs.filter(j => j.task === mi);
    const st = res.stats[mi];
    const j0 = mine[0];
    const U = tasks.reduce((s, t) => s + t.C / t.T, 0);
    $('m-cards').innerHTML = [
      card(L('Utilizarea taskului u = C/T', 'Task utilization u = C/T'), fmt2(C / T), L(`${C} ms din fiecare ${T} ms`, `${C} ms out of every ${T} ms`)),
      card(L('Laxitatea nominală X = D − C', 'Nominal laxity X = D − C'), `${D - C} ms`,
        D - C < 0 ? verdict('bad', L('C > D: imposibil', 'C > D: impossible')) : L('cât poate aștepta un job', 'how long a job can wait')),
      card(L('Timpul de răspuns al jobului 0', 'Response time of job 0'), j0 && j0.finish !== null ? `R₀ = ${j0.finish - j0.r} ms` : '—',
        j0 && j0.finish !== null ? L(`${j0.exec} ms calcul + ${j0.finish - j0.r - j0.exec} ms așteptare`, `${j0.exec} ms computing + ${j0.finish - j0.r - j0.exec} ms waiting`) : ''),
      card(L('Cel mai mare R observat', 'Largest observed R'), st.maxR !== null ? `${st.maxR} ms` : '—', L(`termenul este D = ${D} ms`, `the deadline is D = ${D} ms`)),
      card(L('Termene ratate', 'Missed deadlines'), L(`${st.missed} din ${st.jobs}`, `${st.missed} of ${st.jobs}`),
        st.missed ? verdict('bad', 'R > D') : verdict('ok', L('toate la timp', 'all on time'))),
      card(L('U pentru tot procesorul', 'U for the whole processor'), fmt2(U),
        U > 1 ? verdict('bad', L('supraîncărcare', 'overload')) : (tasks.length > 1 ? L('ambele taskuri', 'both tasks') : L('un singur task', 'a single task')))
    ].join('');

    const series = mine.map(j => ({ name: `X(t), J${j.k}`, color: color(mi), points: S.laxitySeries(j, horizon) }));
    let lo = -2, hi = 2;
    series.forEach(s => s.points.forEach(p => { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }));
    hi = Math.ceil(hi + 1); lo = Math.floor(lo);
    R.lineChart($('m-lax'), {
      series, xMax: horizon, yMin: lo, yMax: hi, height: 190,
      yTicks: [lo, 0, hi], xLabel: 't (ms)', yLabel: 'X(t) (ms)',
      refLines: [{ y: 0, label: L('sub 0: termen ratat', 'below 0: deadline missed') }]
    });
  }

  /* ===================== 2. Periodic, sporadic, aperiodic ===================== */
  let aSeed = 11;
  const a = {};
  ['C', 'T', 'H'].forEach(k => { a[k] = bindRange('a-' + k, renderArrivals); });
  $('a-seed').addEventListener('click', () => { aSeed++; renderArrivals(); });

  function renderArrivals() {
    const C = a.C(), T = a.T(), H = a.H();
    const defs = [
      { name: 'periodic', type: 'periodic' },
      { name: 'sporadic', type: 'sporadic' },
      { name: 'aperiodic', type: 'aperiodic' }
    ].map(d => ({ ...d, C, T, D: Infinity, offset: 0, prio: 1 }));
    const merged = { tasks: defs, jobs: [], horizon: H, schedule: [], busy: 0 };
    const rel = [];
    defs.forEach((t, i) => {
      const r = S.simulate([t], { policy: 'FIFO', horizon: H, seed: aSeed * 31 + i });
      r.jobs.forEach(j => { merged.jobs.push({ ...j, task: i, id: merged.jobs.length }); });
      rel.push(r.jobs.map(j => j.r));
    });
    R.gantt($('a-gantt'), merged, {
      cpuRow: false,
      rowSubs: [`T = ${T}`, `Tmin = ${T}`, `T̄ = ${T}`]
    });
    jobTip(merged, $('a-gantt'));

    const series = defs.map((t, i) => {
      const pts = [[0, 0]];
      let cum = 0;
      rel[i].forEach(r => { pts.push([r, cum]); cum += C; pts.push([r, cum]); });
      pts.push([H, cum]);
      return { name: t.name, color: color(i), points: pts };
    });
    const top = Math.max(...series.map(s => s.points[s.points.length - 1][1]), C);
    const yMax = Math.ceil(top * 1.05 / 10) * 10;
    R.lineChart($('a-demand'), {
      series, xMax: H, yMin: 0, yMax, yTicks: [0, yMax / 2, yMax], height: 220,
      xLabel: 't (ms)', yLabel: L('ms de calcul cerute', 'ms of computation requested')
    });
    $('a-legend').innerHTML = series.map(s => `<span><span class="sw" style="background:${s.color}"></span>${s.name}</span>`).join('');

    const rows = defs.map((t, i) => {
      const rs = rel[i];
      const gaps = rs.slice(1).map((r, k) => r - rs[k]);
      const dense = S.densestWindow(rs, T);
      return `<tr><td><span class="sw" style="background:${color(i)}"></span>${t.name}</td>
        <td class="num">${rs.length}</td>
        <td class="num">${gaps.length ? Math.min(...gaps) : '—'}</td>
        <td class="num">${gaps.length ? Math.max(...gaps) : '—'}</td>
        <td class="num">${dense}${dense > 1 ? ' ' + verdict('bad', L('rafală', 'burst')) : ''}</td>
        <td>${t.type === 'aperiodic' ? L('nu există margine', 'no bound') : fmt2(C / T) + (t.type === 'sporadic' ? L(' (dacă vine cât de des are voie)', ' (if it comes as often as allowed)') : '')}</td></tr>`;
    });
    $('a-table').innerHTML = `<thead><tr><th>${L('Tip', 'Type')}</th><th>${L('Eliberări', 'Releases')}</th><th>${L('Interval minim observat', 'Smallest observed interval')}</th>
      <th>${L('Interval maxim observat', 'Largest observed interval')}</th><th>${L('Eliberări în cea mai densă fereastră de lungime T', 'Releases in the densest window of length T')}</th>
      <th>${L('Utilizare maximă C/T', 'Maximum utilization C/T')}</th></tr></thead><tbody>${rows.join('')}</tbody>`;
  }

  /* ===================== 4. Planificare și încărcare ===================== */
  const sched = { tasks: [], seed: 1, cursor: 0, timer: null, result: null };
  const presets = window.RTPresets;
  const POLICY_NAMES = () => ({
    RM: 'Rate Monotonic (RM)',
    DM: 'Deadline Monotonic (DM)',
    FP: L('Priorități fixe alese manual', 'Fixed priorities set by hand'),
    EDF: 'Earliest Deadline First (EDF)',
    LLF: 'Least Laxity First (LLF)',
    FIFO: L('Primul venit, primul servit (FIFO)', 'First come, first served (FIFO)')
  });
  function fillSchedSelects() {
    const pv = $('s-preset').value, pol = $('s-policy').value;
    $('s-preset').innerHTML = presets.map(p => `<option value="${p.id}">${esc(tr(p.title))}</option>`).join('') +
      `<option value="custom">${L('(setul meu)', '(my set)')}</option>`;
    $('s-policy').innerHTML = Object.entries(POLICY_NAMES()).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    if (pv) $('s-preset').value = pv;
    if (pol) $('s-policy').value = pol;
  }
  fillSchedSelects();

  function loadPreset(id) {
    const p = presets.find(x => x.id === id) || presets[0];
    $('s-preset').value = p.id;
    sched.tasks = p.tasks.map(t => ({ ...t, name: tr(t.name) }));
    $('s-policy').value = p.policy;
    $('s-H').value = p.horizon;
    $('s-preempt').checked = true;
    $('s-abort').checked = false;
    $('s-varC').checked = false;
    $('s-preset-note').textContent = tr(p.note);
    sched.cursor = 0;
    buildEditor();
    runSched();
  }

  function buildEditor() {
    const fp = $('s-policy').value === 'FP';
    const head = `<thead><tr><th></th><th>${L('Nume', 'Name')}</th><th>${L('Tip', 'Type')}</th><th>C</th><th title="${L('perioadă / interval minim / interval mediu', 'period / minimum interval / mean interval')}">T</th>
      <th>D</th><th title="${L('momentul primei eliberări', 'time of the first release')}">${L('Prima eliberare', 'First release')}</th><th title="${L('doar pentru priorități fixe alese manual; număr mai mare = prioritate mai mare', 'only for fixed priorities set by hand; larger number = higher priority')}">${L('Prioritate', 'Priority')}</th><th></th></tr></thead>`;
    const rows = sched.tasks.map((t, i) => `<tr data-i="${i}">
      <td><span class="sw big" style="background:${color(i)}"></span></td>
      <td><input data-f="name" value="${esc(t.name)}" size="9"></td>
      <td><select data-f="type">${Object.keys(TYPE).map(k => `<option ${k === t.type ? 'selected' : ''}>${k}</option>`).join('')}</select></td>
      <td><input data-f="C" type="number" min="1" max="200" value="${t.C}"></td>
      <td><input data-f="T" type="number" min="1" max="500" value="${t.T}"></td>
      <td><input data-f="D" type="number" min="1" max="500" value="${t.D}"></td>
      <td><input data-f="offset" type="number" min="0" max="500" value="${t.offset}"></td>
      <td><input data-f="prio" type="number" min="1" max="99" value="${t.prio}" ${fp ? '' : 'disabled'}></td>
      <td><button type="button" class="ghost del" title="${L('Șterge taskul', 'Delete the task')}" ${sched.tasks.length < 2 ? 'disabled' : ''}>✕</button></td></tr>`);
    $('s-tasks').innerHTML = head + '<tbody>' + rows.join('') + '</tbody>';
    $('s-add').disabled = sched.tasks.length >= 8;
  }

  $('s-tasks').addEventListener('change', ev => {
    const tr = ev.target.closest('tr'); if (!tr) return;
    const t = sched.tasks[+tr.dataset.i], f = ev.target.dataset.f;
    if (!f) return;
    if (f === 'name' || f === 'type') t[f] = ev.target.value;
    else {
      const min = f === 'offset' ? 0 : 1;
      t[f] = Math.max(min, Math.round(+ev.target.value || min));
      ev.target.value = t[f];
    }
    $('s-preset').value = 'custom';
    runSched();
  });
  $('s-tasks').addEventListener('click', ev => {
    if (!ev.target.classList.contains('del')) return;
    sched.tasks.splice(+ev.target.closest('tr').dataset.i, 1);
    $('s-preset').value = 'custom';
    buildEditor(); runSched();
  });
  $('s-add').addEventListener('click', () => {
    const n = sched.tasks.length + 1;
    sched.tasks.push({ name: `τ${n}`, type: 'periodic', C: 1, T: 10, D: 10, offset: 0, prio: 1 });
    $('s-preset').value = 'custom';
    buildEditor(); runSched();
  });
  $('s-preset').addEventListener('change', ev => {
    if (ev.target.value === 'custom') return;
    loadPreset(ev.target.value);
    history.replaceState(null, '', '#sched/' + ev.target.value);
  });
  $('s-policy').addEventListener('change', () => { buildEditor(); runSched(); });
  ['s-preempt', 's-varC', 's-abort'].forEach(id => $(id).addEventListener('change', runSched));
  $('s-H').addEventListener('change', () => {
    $('s-H').value = Math.min(600, Math.max(5, Math.round(+$('s-H').value || 40)));
    runSched();
  });
  $('s-seed').addEventListener('click', () => { sched.seed++; runSched(); });
  const win = bindRange('s-win', () => drawLoad());

  $('s-gantt').addEventListener('click', ev => {
    if (!sched.axis) return;
    const svg = $('s-gantt'), r = svg.getBoundingClientRect();
    const px = (ev.clientX - r.left) * (svg.viewBox.baseVal.width / r.width);
    if (px < sched.axis.left) return;
    setCursor(Math.floor(sched.axis.toTime(px)));
  });
  $('s-back').addEventListener('click', () => setCursor(sched.cursor - 1));
  $('s-fwd').addEventListener('click', () => setCursor(sched.cursor + 1));
  $('s-play').addEventListener('click', () => {
    if (sched.timer) { stopPlay(); return; }
    if (sched.cursor >= sched.result.horizon - 1) sched.cursor = -1;
    $('s-play').textContent = L('Oprește', 'Stop');
    sched.timer = setInterval(() => {
      if (sched.cursor >= sched.result.horizon - 1) { stopPlay(); return; }
      setCursor(sched.cursor + 1);
    }, 280);
  });
  function stopPlay() { clearInterval(sched.timer); sched.timer = null; $('s-play').textContent = L('Pornește', 'Play'); }

  function setCursor(t) {
    sched.cursor = Math.max(0, Math.min(sched.result.horizon - 1, t));
    drawGantt(); drawState(); drawLoad();
  }

  function runSched() {
    const policy = $('s-policy').value;
    const H = +$('s-H').value;
    sched.result = S.simulate(sched.tasks, {
      policy, horizon: H, seed: sched.seed,
      preemptive: $('s-preempt').checked, variableC: $('s-varC').checked, abortOnMiss: $('s-abort').checked
    });
    sched.cursor = Math.min(sched.cursor, H - 1);
    const an = S.analyse(sched.tasks, policy);
    const hp = an.H;
    $('s-Hhint').innerHTML = hp ? `${L('hiperperioada', 'hyperperiod')} H = ${hp}${hp !== H && hp <= 600 ? ` <a href="#" id="s-useH">${L('folosește H', 'use H')}</a>` : ''}` : '';
    const useH = $('s-useH');
    if (useH) useH.onclick = e => { e.preventDefault(); $('s-H').value = hp; runSched(); };
    $('s-preempt').disabled = policy === 'FIFO';
    $('s-order').innerHTML = orderText(policy);

    const res = sched.result;
    const missed = res.stats.reduce((s, x) => s + x.missed, 0);
    const total = res.stats.reduce((s, x) => s + x.jobs, 0);
    $('s-cards').innerHTML = [
      card(L('Factorul de utilizare U', 'Utilization U'), an.n ? fmt2(an.U) : '—',
        an.hasAperiodic ? L('fără taskurile aperiodice', 'without the aperiodic tasks') : (an.U > 1 ? verdict('bad', L('supraîncărcare', 'overload')) : L('cerut de set', 'requested by the set'))),
      card(L('Procesor ocupat în simulare', 'Processor busy in the simulation'), pct(res.busy / res.horizon), L(`${res.busy} din ${res.horizon} ms`, `${res.busy} of ${res.horizon} ms`)),
      card(L('Termene ratate', 'Missed deadlines'), L(`${missed} din ${total}`, `${missed} of ${total}`),
        missed ? verdict('bad', L('joburi întârziate', 'late jobs')) : verdict('ok', L('toate la timp', 'all on time'))),
      card(L('Preempțiuni', 'Preemptions'), String(res.preemptions), res.preemptive ? L('un job întrerupt de altul', 'a job interrupted by another') : L('planificare nepreemptivă', 'non-preemptive scheduling')),
      card(L('Hiperperioada H', 'Hyperperiod H'), hp ? `${hp} ms` : '—',
        hp && hp > H ? L('simularea este mai scurtă decât H', 'the simulation is shorter than H') : L('tiparul eliberărilor se repetă', 'the release pattern repeats'))
    ].join('');
    drawGantt(); drawState(); drawLoad(); drawStats(); drawAnalysis(an);
  }

  /** Cum ordonează algoritmul taskurile, în cuvinte. */
  function orderText(policy) {
    const tasks = sched.tasks;
    const byRank = (rank, label) => {
      const idx = tasks.map((t, i) => i).sort((a, b) => rank(tasks[b]) - rank(tasks[a]) || a - b);
      return `<b>${L('Ordinea priorităților', 'Priority order')}</b> (${label}): ` + idx.map(i =>
        `<span class="sw" style="background:${color(i)}"></span>${esc(tasks[i].name)}`).join(' &gt; ') +
        L('. La egalitate, câștigă taskul aflat mai sus în tabel.', '. On a tie, the task higher up in the table wins.');
    };
    switch (policy) {
      case 'RM': return byRank(t => -t.T, L('RM: perioada mai mică înseamnă prioritate mai mare', 'RM: a shorter period means a higher priority'));
      case 'DM': return byRank(t => -t.D, L('DM: termenul relativ mai mic înseamnă prioritate mai mare', 'DM: a shorter relative deadline means a higher priority'));
      case 'FP': return byRank(t => t.prio, L('alese manual în coloana „Prioritate”: număr mai mare înseamnă prioritate mai mare', 'set by hand in the “Priority” column: a larger number means a higher priority'));
      case 'EDF': return L('<b>EDF</b> nu are priorități fixe: la fiecare moment rulează jobul cu termenul absolut <i>d</i> cel mai apropiat.',
        '<b>EDF</b> has no fixed priorities: at every moment the job with the earliest absolute deadline <i>d</i> runs.');
      case 'LLF': return L('<b>LLF</b> nu are priorități fixe: la fiecare moment rulează jobul cu laxitatea <i>X(t)</i> cea mai mică; la egalitate, jobul care rulează deja continuă.',
        '<b>LLF</b> has no fixed priorities: at every moment the job with the smallest laxity <i>X(t)</i> runs; on a tie, the job already running continues.');
      default: return L('<b>FIFO</b>: joburile rulează în ordinea eliberării, fiecare până la capăt, fără să țină cont de termene.',
        '<b>FIFO</b>: jobs run in release order, each to completion, regardless of deadlines.');
    }
  }

  /** De ce rulează jobul ales la momentul t. */
  function whyText(res, t) {
    const st = S.stateAt(res, t);
    const cand = st.map((s, i) => ({ ...s, i })).filter(s => s.state !== 'waiting');
    if (!cand.length) return L(`La t = ${t} niciun job nu este gata, deci procesorul este liber.`, `At t = ${t} no job is ready, so the processor is idle.`);
    const run = cand.find(s => s.state === 'running');
    const nm = s => `<b>${esc(res.tasks[s.i].name)}</b>`;
    const policy = res.policy;
    const key = s => {
      const task = res.tasks[s.i];
      return { RM: task.T, DM: task.D, FP: -task.prio, EDF: s.job.d, LLF: s.laxity, FIFO: s.job.r }[policy];
    };
    const what = s => {
      const task = res.tasks[s.i];
      return {
        RM: L(`are perioada cea mai mică dintre taskurile gata (T = ${task.T})`, `it has the shortest period among the ready tasks (T = ${task.T})`),
        DM: L(`are termenul relativ cel mai mic dintre taskurile gata (D = ${task.D})`, `it has the shortest relative deadline among the ready tasks (D = ${task.D})`),
        FP: L(`are prioritatea cea mai mare dintre taskurile gata (P = ${task.prio})`, `it has the highest priority among the ready tasks (P = ${task.prio})`),
        EDF: L(`are termenul absolut cel mai apropiat (d = ${s.job.d})`, `it has the earliest absolute deadline (d = ${s.job.d})`),
        LLF: L(`are laxitatea cea mai mică (X = ${s.laxity})`, `it has the smallest laxity (X = ${s.laxity})`),
        FIFO: L(`a fost eliberat primul (r = ${s.job.r})`, `it was released first (r = ${s.job.r})`)
      }[policy];
    };
    const others = cand.filter(s => s !== run);
    let txt = L(`La t = ${t} rulează ${nm(run)}, jobul J${run.job.k}`, `At t = ${t}, ${nm(run)} runs, job J${run.job.k}`);
    if (!others.length) return txt + L(': este singurul task cu un job gata.', ': it is the only task with a ready job.');
    const best = Math.min(...cand.map(key));
    if (!res.preemptive && key(run) > best) {
      const better = others.find(s => key(s) === best);
      txt += L(`: planificarea este nepreemptivă, iar jobul a început înainte, deci continuă, deși ${nm(better)} are prioritate mai mare.`,
        `: scheduling is non-preemptive and the job started earlier, so it continues, even though ${nm(better)} has a higher priority.`);
    } else {
      txt += `: ${what(run)}`;
      if (others.some(s => key(s) === key(run))) {
        txt += policy === 'LLF' ? L('; la egalitate, jobul care rula deja continuă', '; on a tie, the job already running continues')
          : L('; la egalitate, câștigă taskul aflat mai sus în tabel', '; on a tie, the task higher up in the table wins');
      }
      txt += '.';
    }
    return txt + L(` Așteaptă în Ready: ${others.map(nm).join(', ')}.`, ` Waiting in Ready: ${others.map(nm).join(', ')}.`);
  }

  function drawGantt() {
    sched.axis = R.gantt($('s-gantt'), sched.result, { cpuRow: true, cursor: sched.cursor });
    jobTip(sched.result, $('s-gantt'));
  }

  function drawState() {
    const t = sched.cursor, res = sched.result;
    const st = S.stateAt(res, t);
    $('s-state-title').textContent = L(`Starea taskurilor în intervalul [${t}, ${t + 1})`, `Task states in the interval [${t}, ${t + 1})`);
    $('s-why').innerHTML = whyText(res, t);
    const name = { running: 'Running', ready: 'Ready', waiting: 'Blocked' };
    const rows = st.map((s, i) => {
      const task = res.tasks[i];
      return `<tr class="${s.state}"><td><span class="sw" style="background:${color(i)}"></span>${esc(task.name)}</td>
        <td><span class="state ${s.state}">${name[s.state]}</span></td>
        <td class="num">${s.job ? 'J' + s.job.k : '—'}</td>
        <td class="num">${s.job ? s.rem : '—'}</td>
        <td class="num">${s.job ? s.job.d : (s.nextRelease !== null ? L(`următoarea r = ${s.nextRelease}`, `next r = ${s.nextRelease}`) : '—')}</td>
        <td class="num ${s.job && s.laxity < 0 ? 'bad' : ''}">${s.job ? s.laxity : '—'}</td></tr>`;
    });
    $('s-state').innerHTML = `<caption class="note">${L('Blocked: jobul curent a terminat, taskul așteaptă următoarea eliberare.', 'Blocked: the current job has finished, the task waits for its next release.')}</caption><thead><tr><th>Task</th><th>${L('Stare', 'State')}</th><th>Job</th><th>${L('Calcul rămas c(t)', 'Remaining computation c(t)')}</th><th>${L('Termen d', 'Deadline d')}</th><th>${L('Laxitate X(t)', 'Laxity X(t)')}</th></tr></thead><tbody>${rows.join('')}</tbody>`;
  }

  function drawLoad() {
    const res = sched.result, w = win();
    const busyAt = res.schedule.map(x => (x === null ? 0 : 1));
    const winPts = [], cumPts = [];
    let acc = 0;
    for (let t = 1; t <= res.horizon; t++) {
      acc += busyAt[t - 1];
      cumPts.push([t, acc / t]);
      const s = Math.max(0, t - w);
      let b = 0; for (let k = s; k < t; k++) b += busyAt[k];
      winPts.push([t, b / (t - s)]);
    }
    const an = S.analyse(sched.tasks, res.policy);
    const refs = [{ y: 1, label: '100 %' }];
    if (!an.hasAperiodic && an.U <= 1.5) refs.push({ y: an.U, label: `${L('U teoretic', 'theoretical U')} = ${pct(an.U)}`, side: 'left' });
    const yMax = Math.max(1.1, Math.min(1.6, an.U + 0.1));
    R.lineChart($('s-load'), {
      series: [
        { name: L(`ocupare pe ultimele ${w} ms`, `load over the last ${w} ms`), color: 'var(--s1)', points: winPts },
        { name: L('ocupare medie de la 0', 'mean load since 0'), color: 'var(--s2)', points: cumPts, dash: '6 4' }
      ],
      xMax: res.horizon, yMin: 0, yMax, yTicks: [0, 0.5, 1], yFmt: v => pct(v), height: 210,
      refLines: refs, cursor: sched.cursor, xLabel: 't (ms)', yLabel: L('ocupare', 'load')
    });
    $('s-load-legend').innerHTML =
      `<span><span class="sw" style="background:var(--s1)"></span>${L(`ocupare pe ultimele ${w} ms`, `load over the last ${w} ms`)}</span>` +
      `<span><span class="sw dashed" style="border-color:var(--s2)"></span>${L('ocupare medie de la 0', 'mean load since 0')}</span>`;
  }

  function drawStats() {
    const res = sched.result;
    const f = v => (v === null ? '—' : (Number.isInteger(v) ? v : fmt2(v)));
    const rows = res.stats.map((s, i) => `<tr><td><span class="sw" style="background:${color(i)}"></span>${esc(res.tasks[i].name)}</td>
      <td class="num">${s.jobs}</td><td class="num">${s.finished}</td>
      <td class="num ${s.missed ? 'bad' : ''}">${s.missed}</td>
      <td class="num">${f(s.minR)}</td><td class="num">${f(s.maxR)}</td><td class="num">${f(s.avgR)}</td>
      <td class="num">${f(s.maxLatency)}</td><td class="num">${f(s.startJitter)}</td></tr>`);
    $('s-stats').innerHTML = `<thead><tr><th>Task</th><th>${L('Joburi', 'Jobs')}</th><th>${L('Terminate', 'Finished')}</th><th>${L('Ratate', 'Missed')}</th>
      <th>R min</th><th>R max</th><th>${L('R mediu', 'R mean')}</th><th title="${L('cel mai mare s − r', 'largest s − r')}">${L('Întârziere max. la start', 'Max. start latency')}</th>
      <th title="max(s − r) − min(s − r)">${L('Jitter de start', 'Start jitter')}</th></tr></thead><tbody>${rows.join('')}</tbody>`;
  }

  function drawUBar(an) {
    const tasks = sched.tasks;
    const max = Math.max(1.25, an.U + 0.05);
    const segs = tasks.map((t, i) => t.type === 'aperiodic' ? '' :
      `<div class="useg" style="width:${100 * (t.C / t.T) / max}%;background:${color(i)}" title="${esc(t.name)}: ${fmt3(t.C / t.T)}"></div>`).join('');
    const mark = (v, label, cls) => `<div class="umark ${cls || ''}" style="left:${100 * v / max}%"><span>${label}</span></div>`;
    const marks = [mark(1, '1 (100 %)', 'one')];
    if (['RM', 'DM', 'FP'].includes($('s-policy').value) && an.n) marks.push(mark(an.llBound, `Liu & Layland ${fmt3(an.llBound)}`, 'll'));
    const legend = tasks.map((t, i) => t.type === 'aperiodic'
      ? `<span><span class="sw" style="background:${color(i)}"></span>${esc(t.name)}: ${L('aperiodic, fără u', 'aperiodic, no u')}</span>`
      : `<span><span class="sw" style="background:${color(i)}"></span>${esc(t.name)}: ${fmt3(t.C / t.T)}</span>`).join('');
    $('s-ubar').innerHTML = `<div class="ubar"><div class="utrack">${segs}</div>${marks.join('')}</div>
      <div class="legend">${legend}</div>
      <p class="note">${L('Fiecare segment este utilizarea unui task, u = C/T. Pentru taskurile sporadice, T este intervalul minim.', 'Each segment is the utilization of one task, u = C/T. For sporadic tasks, T is the minimum interval.')}</p>`;
  }

  function drawAnalysis(an) {
    drawUBar(an);
    const policy = $('s-policy').value;
    const out = [];
    const OK = L('planificabil', 'schedulable'), MAYBE = L('nedecis', 'undecided');
    if (!an.n) { $('s-analysis').innerHTML = `<p class="note">${L('Nu există taskuri periodice sau sporadice.', 'There are no periodic or sporadic tasks.')}</p>`; return; }
    out.push(`<p>${an.U <= 1 ? verdict('ok', `U = ${fmt3(an.U)} ≤ 1`) : verdict('bad', `U = ${fmt3(an.U)} > 1`)}
      ${L('condiția necesară pe un nucleu', 'the necessary condition on one core')}${an.U > 1 ? L(': niciun algoritm nu poate respecta toate termenele', ': no algorithm can meet all deadlines') : ''}.</p>`);
    if (policy === 'RM' || policy === 'DM' || policy === 'FP') {
      if (an.implicit && policy !== 'FP') {
        out.push(`<p>${an.U <= an.llBound ? verdict('ok', OK) : verdict('maybe', MAYBE)}
          ${L('limita Liu & Layland', 'Liu & Layland bound')}: U ≤ n(2<sup>1/n</sup> − 1) = ${fmt3(an.llBound)} (${L('condiție suficientă', 'sufficient condition')}).</p>`);
        out.push(`<p>${an.hyperbolic <= 2 ? verdict('ok', OK) : verdict('maybe', MAYBE)}
          ${L('limita hiperbolică', 'hyperbolic bound')}: Π(u<sub>i</sub> + 1) = ${fmt3(an.hyperbolic)} ≤ 2 (${L('condiție suficientă', 'sufficient condition')}).</p>`);
      }
      const rows = an.rta.map(x => {
        const t = sched.tasks[x.task];
        return `<tr><td><span class="sw" style="background:${color(x.task)}"></span>${esc(t.name)}</td>
          <td>${x.hp.length ? x.hp.map(j => esc(sched.tasks[j].name)).join(', ') : '—'}</td>
          <td class="iter">${x.aperiodicAbove ? L('aperiodic mai prioritar: ', 'higher-priority aperiodic: ') + x.aperiodicAbove.map(j => esc(sched.tasks[j].name)).join(', ') : x.steps.join(' → ')}</td>
          <td class="num">${x.R === null ? '—' : x.R}</td><td class="num">${t.D}</td>
          <td>${x.aperiodicAbove ? verdict('maybe', L('fără garanție', 'no guarantee')) : (x.ok ? verdict('ok', 'R ≤ D') : verdict('bad', 'R > D'))}</td></tr>`;
      });
      out.push(`<p>${L('Analiza timpului de răspuns (RTA), test exact pentru priorități fixe', 'Response time analysis (RTA), an exact test for fixed priorities')}:
        R = C<sub>i</sub> + Σ<sub>j∈hp(i)</sub> ⌈R / T<sub>j</sub>⌉ C<sub>j</sub>, ${L('iterat până nu se mai schimbă', 'iterated until it no longer changes')}.</p>
        <div class="table-wrap"><table><thead><tr><th>${L('Task, în ordinea priorității', 'Task, in priority order')}</th><th>hp(i)</th><th>${L('Iterații', 'Iterations')}</th><th>R</th><th>D</th><th></th></tr></thead>
        <tbody>${rows.join('')}</tbody></table></div>`);
      if (!$('s-preempt').checked) out.push(`<p class="note">${L('RTA de mai sus presupune preempțiune; la planificare nepreemptivă trebuie adăugat timpul de blocare B<sub>i</sub>.', 'The RTA above assumes preemption; for non-preemptive scheduling the blocking time B<sub>i</sub> must be added.')}</p>`);
    } else if (policy === 'EDF' || policy === 'LLF') {
      if (an.implicit) {
        out.push(`<p>${an.U <= 1 ? verdict('ok', OK) : verdict('bad', L('neplanificabil', 'not schedulable'))}
          ${L(`cu D = T, ${policy} este optim: setul este planificabil dacă și numai dacă U ≤ 1.`, `with D = T, ${policy} is optimal: the set is schedulable if and only if U ≤ 1.`)}</p>`);
      } else {
        out.push(`<p>${an.density <= 1 ? verdict('ok', OK) : verdict('maybe', MAYBE)}
          ${L('cu D &lt; T, testul de densitate', 'with D &lt; T, the density test')} Σ C<sub>i</sub>/min(D<sub>i</sub>, T<sub>i</sub>) = ${fmt3(an.density)} ≤ 1 ${L('este doar suficient; testul exact folosește cererea de procesor h(t).', 'is only sufficient; the exact test uses the processor demand h(t).')}</p>`);
      }
      if (!$('s-preempt').checked) out.push(`<p class="note">${L('Rezultatele pentru EDF și LLF presupun preempțiune.', 'The results for EDF and LLF assume preemption.')}</p>`);
    } else {
      out.push('<p>' + verdict('maybe', L('fără garanții', 'no guarantees')) + L(' FIFO nu ține cont de termene: un job lung întârzie tot ce vine după el.', ' FIFO ignores deadlines: a long job delays everything that comes after it.') + '</p>');
    }
    if (an.hasAperiodic) out.push(`<p class="note">${L('Taskurile aperiodice nu intră în teste: nu au o margine a cererii de procesor. Un task periodic sau sporadic mai puțin prioritar decât unul aperiodic nu poate primi nicio garanție.', 'Aperiodic tasks are left out of the tests: their processor demand has no bound. A periodic or sporadic task with lower priority than an aperiodic one cannot get any guarantee.')}</p>`);
    if (sched.tasks.some(t => t.type === 'sporadic') || $('s-varC').checked) {
      out.push(`<p class="note">${L('Simularea arată un singur scenariu; testele de mai sus acoperă cazul cel mai defavorabil (sporadic la intervalul minim, fiecare job cu C complet).', 'The simulation shows a single scenario; the tests above cover the worst case (sporadic tasks at the minimum interval, every job with its full C).')}</p>`);
    }
    $('s-analysis').innerHTML = out.join('');
  }


  /* ===================== 3. Fiecare tip în detaliu ===================== */
  const TY_H = 200;
  let tyType = 'periodic';

  /** Înregistrare „în timp real”: timpul curge 20 ms simulate pe secundă. */
  function Recorder(onChange, clockId, label) {
    const r = { events: [], now: TY_H, running: false, timer: null };
    r.start = () => {
      r.stop(); r.events = []; r.now = 0; r.running = true;
      r.timer = setInterval(() => {
        r.now++;
        if (r.now >= TY_H) r.stop();
        onChange();
      }, 50);
    };
    r.stop = () => {
      clearInterval(r.timer); r.timer = null;
      if (r.running) { r.running = false; r.now = TY_H; }
      updateClock();
    };
    r.add = times => {
      if (!r.running) r.start();
      times.forEach(t => { if (t < TY_H) r.events.push(t); });
      onChange();
    };
    r.set = times => { r.stop(); r.events = times.slice(); r.now = TY_H; onChange(); };
    function updateClock() {
      $(clockId).textContent = r.running
        ? L(`Înregistrare în curs: t = ${r.now} din ${TY_H} ms. ${label()}`, `Recording: t = ${r.now} of ${TY_H} ms. ${label()}`)
        : L(`Primul clic pe „${btn()}” pornește o înregistrare nouă de ${TY_H} ms.`, `The first click on “${btn()}” starts a new ${TY_H} ms recording.`);
    }
    const btn = () => $(clockId === 'sp-clock' ? 'sp-press' : 'ap-press').textContent;
    r.tick = updateClock;
    return r;
  }

  /* ---------- periodic ---------- */
  let pSeed = 5;
  const pv = {};
  ['T', 'C', 'Cmin', 'eps', 'n'].forEach(k => { pv[k] = bindRange('p-' + k, renderPeriodic); });
  $('p-seed').addEventListener('click', () => { pSeed++; renderPeriodic(); });

  function renderPeriodic() {
    // timpul de calcul minim nu poate depăși maximul
    const cm = $('p-Cmin');
    if (+cm.value > pv.C()) { cm.value = pv.C(); cm.parentNode.querySelector('output').textContent = cm.value; }
    const T = pv.T(), C = pv.C(), Cmin = pv.Cmin(), n = pv.n();
    const res = S.periodicRelease({ T, C, Cmin, epsMax: pv.eps(), n, seed: pSeed });
    const mk = (list, ti) => list.map(j => ({
      id: 0, task: ti, k: j.k, r: j.wake, d: Infinity, exec: j.C, start: j.s, finish: j.f,
      segments: [[j.s, j.f]], missed: false, aborted: false, preempted: 0,
      tip: `<span class="sw" style="background:${color(ti)}"></span><b>${ti ? L('așteptare relativă', 'relative delay') : L('așteptare absolută', 'absolute delay')}</b>, ${L('jobul', 'job')} ${j.k}<br>` +
        L(`punct pe grilă r = ${j.grid}<br>trezire la ${j.wake}${ti ? ` (terminarea precedentă + T)` : ''}<br>`,
          `grid point r = ${j.grid}<br>wake-up at ${j.wake}${ti ? ` (previous completion + T)` : ''}<br>`) +
        L(`ε = ${j.eps}, pornire s = ${j.s}, C = ${j.C}<br><b>L = s − r = ${j.L}</b>`, `ε = ${j.eps}, start s = ${j.s}, C = ${j.C}<br><b>L = s − r = ${j.L}</b>`)
    }));
    const jobs = mk(res.abs, 0).concat(mk(res.rel, 1));
    jobs.forEach((j, i) => { j.id = i; });
    const horizon = Math.max(...jobs.map(j => j.finish)) + 2;
    const tasks = [
      { name: L('absolută', 'absolute'), type: 'periodic', C, T, D: Infinity },
      { name: L('relativă', 'relative'), type: 'periodic', C, T, D: Infinity }
    ];
    const result = { tasks, jobs, horizon, schedule: [], busy: 0 };
    R.gantt($('p-gantt'), result, {
      gridEvery: T, jobLabels: true,
      rowSubs: [L('trezire la rₖ = kT', 'wakes at rₖ = kT'), L('trezire la fₖ + T', 'wakes at fₖ + T')]
    });
    jobTip(result, $('p-gantt'));

    const a = res.absStats, r = res.relStats;
    const eps = pv.eps();
    const absOk = a.maxL <= eps;
    $('p-cards').innerHTML = [
      card(L('Absolut: jitter J', 'Absolute: jitter J'), `${a.J} ms`, L(`cea mai mare L = ${a.maxL} ms, cea mai mică = ${a.maxL - a.J} ms`, `largest L = ${a.maxL} ms, smallest = ${a.maxL - a.J} ms`)),
      card(L('Absolut: jitter relativ', 'Absolute: cycle-to-cycle jitter'), `${a.Jrel} ms`, L('cel mai mare salt între două joburi', 'largest jump between two jobs')),
      card(L(`Absolut: întârzierea jobului ${n - 1}`, `Absolute: latency of job ${n - 1}`), `${a.last} ms`,
        absOk ? verdict('ok', L('nu se acumulează', 'does not accumulate')) : verdict('bad', L('joburile nu încap în T', 'the jobs do not fit in T'))),
      card(L(`Relativ: întârzierea jobului ${n - 1}`, `Relative: latency of job ${n - 1}`), `${r.last} ms`,
        r.last > eps ? verdict('bad', L('deriva crește la fiecare job', 'the drift grows with every job')) : L('fără calcul, fără derivă', 'no computation, no drift')),
      card(L('Relativ: perioada reală medie', 'Relative: actual mean period'), `${fmt2(r.period)} ms`, L(`în loc de T = ${T} ms`, `instead of T = ${T} ms`)),
      card(L('Relativ: frecvența reală', 'Relative: actual frequency'), `${fmt2(1000 / r.period)} Hz`, L(`în loc de ${fmt2(1000 / T)} Hz`, `instead of ${fmt2(1000 / T)} Hz`))
    ].join('');

    R.lineChart($('p-lat'), {
      series: [
        { name: L('absolut', 'absolute'), color: color(0), points: res.abs.map(j => [j.k, j.L]) },
        { name: L('relativ', 'relative'), color: color(1), points: res.rel.map(j => [j.k, j.L]) }
      ],
      xMax: n - 1, yMin: 0, yMax: Math.max(4, r.maxL, a.maxL), height: 220, xName: L('jobul k', 'job k'), yFmt: v => `${v} ms`,
      yTicks: [0, Math.round(Math.max(4, r.maxL, a.maxL) / 2), Math.max(4, r.maxL, a.maxL)],
      xLabel: L('jobul k', 'job k'), yLabel: 'L (ms)'
    });
    $('p-lat-legend').innerHTML = [L('absolut', 'absolute'), L('relativ', 'relative')].map((nm, i) =>
      `<span><span class="sw" style="background:${color(i)}"></span>${nm}</span>`).join('');
    const counts = [];
    for (let v = 0; v <= a.maxL; v++) counts.push(res.abs.filter(j => j.L === v).length);
    R.barChart($('p-hist'), {
      bins: counts.map((c, v) => ({ label: String(v), value: c, tip: `L = ${v} ms: <b>${c}</b> ${L('joburi', 'jobs')}` })),
      color: color(0), height: 220, xLabel: 'L (ms)', yLabel: L('joburi', 'jobs')
    });
  }

  /* ---------- sporadic ---------- */
  const SP_DEMO = [12, 13, 14, 15, 16, 48, 70, 75, 118, 160, 163];
  const sv = {};
  ['C', 'T', 'D', 'pC', 'pT'].forEach(k => { sv[k] = bindRange('sp-' + k, renderSporadic); });
  $('sp-policy').addEventListener('change', renderSporadic);
  const spRec = Recorder(renderSporadic, 'sp-clock', () => L('Apăsați butonul sau tasta spațiu.', 'Press the button or the space bar.'));
  spRec.events = SP_DEMO.slice(); // se desenează când fila devine vizibilă
  $('sp-press').addEventListener('click', () => spRec.add([spRec.running ? spRec.now : 0]));
  $('sp-burst').addEventListener('click', () => {
    const t0 = spRec.running ? spRec.now : 0;
    spRec.add([0, 1, 2, 3, 4].map(d => t0 + d));
  });
  $('sp-random').addEventListener('click', () => {
    const rand = S.rng(Date.now() & 0xffff), out = [];
    let t = Math.floor(rand() * 10);
    while (t < TY_H) {
      out.push(t);
      if (rand() < 0.2) { for (let d = 1; d <= 3; d++) out.push(t + d); t += 3; }
      t += Math.max(1, Math.round(-Math.log(1 - rand()) * sv.T()));
    }
    spRec.set(out.filter(x => x < TY_H));
  });
  $('sp-demo').addEventListener('click', () => spRec.set(SP_DEMO));

  const SP_NOTES = () => ({
    none: L('Fiecare eveniment eliberează un job, oricât de aproape ar fi de precedentul. Ipoteza analizei, cel puțin Tmin între eliberări, nu este impusă de nimic.',
      'Every event releases a job, however close it is to the previous one. The assumption of the analysis, at least Tmin between releases, is not enforced by anything.'),
    ignore: L('Un eveniment venit la mai puțin de Tmin după ultimul acceptat este ignorat, ca la filtrarea vibrațiilor din 5.4. Intervalul minim este garantat, dar o apăsare reală prea apropiată se pierde.',
      'An event that comes less than Tmin after the last accepted one is ignored, like the debouncing in 5.4. The minimum interval is guaranteed, but a real press that comes too early is lost.'),
    defer: L('Un eveniment prea apropiat nu se pierde: eliberarea lui se amână până la Tmin după eliberarea precedentă. Intervalul minim este garantat, dar răspunsul întârzie; termenul D se socotește de la eliberarea amânată, nu de la apăsare.',
      'An event that comes too early is not lost: its release is postponed to Tmin after the previous release. The minimum interval is guaranteed, but the response is delayed; the deadline D counts from the postponed release, not from the press.')
  });

  function renderSporadic() {
    spRec.tick();
    const C = sv.C(), Tmin = sv.T(), D = sv.D(), pol = $('sp-policy').value;
    $('sp-policy-note').textContent = SP_NOTES()[pol];
    const filt = S.sporadicFilter(spRec.events, Tmin, pol);
    const rels = filt.filter(f => f.release !== null && f.release < TY_H);
    const tasks = [
      { name: L('buton', 'button'), type: 'sporadic', C, T: Tmin, D, offset: 0, prio: 2, releaseTimes: rels.map(f => f.release) },
      { name: L('reglaj', 'control'), type: 'periodic', C: sv.pC(), T: sv.pT(), D: sv.pT(), offset: 0, prio: 1 }
    ];
    const res = S.simulate(tasks, { policy: 'FP', horizon: TY_H });
    const btnJobs = res.jobs.filter(j => j.task === 0).sort((x, y) => x.k - y.k);
    btnJobs.forEach((j, i) => {
      const ev = rels[i].event;
      j.tip = `<span class="sw" style="background:${color(0)}"></span><b>${esc(tasks[0].name)}</b>, ${L('jobul', 'job')} ${j.k}<br>` +
        L(`eveniment la ${ev}${j.r > ev ? `, eliberare amânată la ${j.r}` : ''}<br>termen d = ${j.d}<br>`,
          `event at ${ev}${j.r > ev ? `, release postponed to ${j.r}` : ''}<br>deadline d = ${j.d}<br>`) +
        (j.finish !== null ? L(`terminat la ${j.finish}: ${j.finish - ev} ms de la eveniment`, `finished at ${j.finish}: ${j.finish - ev} ms after the event`) : L('neterminat', 'not finished')) +
        (j.missed ? `<br><b class="bad">✕ ${L('termen ratat', 'deadline missed')}</b>` : '');
    });
    const kindTxt = { ok: L('a eliberat un job', 'released a job'), rejected: L('ignorat: prea aproape de precedentul', 'ignored: too close to the previous one'), deferred: L('eliberare amânată', 'release postponed') };
    const marks = filt.map(f => ({
      t: f.event, kind: f.kind, to: f.kind === 'deferred' ? Math.min(f.release, TY_H) : undefined,
      tip: `${L('eveniment la', 'event at')} ${f.event}: <b>${kindTxt[f.kind]}</b>${f.kind === 'deferred' ? ` ${L('până la', 'to')} ${f.release}` : ''}`
    }));
    R.gantt($('sp-gantt'), res, {
      eventRows: [{ label: L('evenimente', 'events'), sub: L(`${spRec.events.length} apăsări`, `${spRec.events.length} presses`), marks }],
      cpuRow: true, cursor: spRec.running ? spRec.now : null
    });
    jobTip(res, $('sp-gantt'));

    const relT = rels.map(f => f.release);
    let minGap = Infinity;
    for (let i = 1; i < relT.length; i++) minGap = Math.min(minGap, relT[i] - relT[i - 1]);
    const rejected = filt.filter(f => f.kind === 'rejected').length;
    const deferred = filt.filter(f => f.kind === 'deferred').length;
    const lat = btnJobs.filter(j => j.finish !== null).map((j, i) => j.finish - rels[i].event);
    const okGap = minGap >= Tmin;
    $('sp-cards').innerHTML = [
      card(L('Evenimente', 'Events'), String(spRec.events.length), L(`${relT.length} joburi eliberate`, `${relT.length} jobs released`)),
      card(L('Ignorate / amânate', 'Ignored / postponed'), `${rejected} / ${deferred}`, pol === 'none' ? L('nu se impune nimic', 'nothing is enforced') : L('impus de cod', 'enforced by the code')),
      card(L('Cel mai mic interval între eliberări', 'Smallest interval between releases'), isFinite(minGap) ? `${minGap} ms` : '—',
        isFinite(minGap) ? (okGap ? verdict('ok', `≥ Tmin = ${Tmin}`) : verdict('bad', `< Tmin = ${Tmin}`)) : ''),
      card(L(`Termene ratate „${tasks[1].name}”`, `Missed deadlines “${tasks[1].name}”`), L(`${res.stats[1].missed} din ${res.stats[1].jobs}`, `${res.stats[1].missed} of ${res.stats[1].jobs}`),
        res.stats[1].missed ? verdict('bad', L('reglajul plătește', 'the control loop pays')) : verdict('ok', L('toate la timp', 'all on time'))),
      card(L(`Termene ratate „${tasks[0].name}”`, `Missed deadlines “${tasks[0].name}”`), L(`${res.stats[0].missed} din ${res.stats[0].jobs}`, `${res.stats[0].missed} of ${res.stats[0].jobs}`), ''),
      card(L('Cel mai lung timp de la eveniment la terminare', 'Longest time from event to completion'), lat.length ? `${Math.max(...lat)} ms` : '—',
        deferred ? L('include amânarea', 'includes the postponement') : L(`termenul este D = ${D} ms`, `the deadline is D = ${D} ms`))
    ].join('');

    const an = S.analyse(tasks.map(t => ({ ...t, releaseTimes: undefined })), 'FP');
    const rows = an.rta.map(x => `<tr><td><span class="sw" style="background:${color(x.task)}"></span>${esc(tasks[x.task].name)}</td>
      <td class="iter">${x.steps.join(' → ')}</td><td class="num">${x.R}</td><td class="num">${tasks[x.task].D}</td>
      <td>${x.ok ? verdict('ok', 'R ≤ D') : verdict('bad', 'R > D')}</td></tr>`).join('');
    const allOk = an.rta.every(x => x.ok);
    let concl;
    if (!allOk) concl = verdict('bad', L('setul nu este planificabil', 'the set is not schedulable')) + L(' nici dacă intervalul minim ar fi respectat: micșorați C sau măriți Tmin.', ' even if the minimum interval were respected: reduce C or increase Tmin.');
    else if (!isFinite(minGap) || okGap) concl = verdict('ok', L('garanția este valabilă', 'the guarantee holds')) + L(' în înregistrarea de mai sus: eliberările respectă intervalul minim.', ' in the recording above: the releases respect the minimum interval.');
    else concl = verdict('bad', L('garanția nu mai este valabilă', 'the guarantee no longer holds')) +
      L(` în înregistrarea de mai sus: două eliberări la doar ${minGap} ms una de alta, mai puțin decât Tmin = ${Tmin}. Analiza a fost corectă, dar ipoteza ei nu a fost impusă.`,
        ` in the recording above: two releases only ${minGap} ms apart, less than Tmin = ${Tmin}. The analysis was right, but its assumption was not enforced.`);
    $('sp-analysis').innerHTML = texify(`<p>${L('Analiza tratează butonul ca pe un task periodic cu perioada $T_{min}$ și prioritate mai mare decât reglajul.', 'The analysis treats the button as a periodic task with period $T_{min}$ and a higher priority than the control loop.')}
      U = ${fmt3(an.U)}.</p>
      <div class="table-wrap"><table><thead><tr><th>Task</th><th>${L('Iterații RTA', 'RTA iterations')}</th><th>R</th><th>D</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p>${concl}</p>`);
  }

  /* ---------- aperiodic ---------- */
  // cereri izolate și o rafală; jurnalul are un job lung, mai puțin urgent
  const AP_DEMO = [10, 55, 56, 57, 58, 110, 150, 185];
  const apTasks = () => [
    { name: L('senzor', 'sensor'), type: 'periodic', C: 2, T: 8, D: 8, offset: 0, prio: 2 },
    { name: L('jurnal', 'logger'), type: 'periodic', C: av.jC(), T: 25, D: 25, offset: 0, prio: 1 }
  ];
  const av = {};
  ['C', 'Q', 'Ts', 'jC'].forEach(k => { av[k] = bindRange('ap-' + k, renderAperiodic); });
  $('ap-mode').addEventListener('change', renderAperiodic);
  const apRec = Recorder(renderAperiodic, 'ap-clock', () => L('Trimiteți cereri.', 'Send requests.'));
  apRec.events = AP_DEMO.slice();
  $('ap-press').addEventListener('click', () => apRec.add([apRec.running ? apRec.now : 0]));
  $('ap-burst').addEventListener('click', () => {
    const t0 = apRec.running ? apRec.now : 0;
    apRec.add([0, 1, 2, 3].map(d => t0 + d));
  });
  $('ap-random').addEventListener('click', () => {
    const rand = S.rng(Date.now() & 0xffff), out = [];
    let t = Math.floor(rand() * 10);
    while (t < TY_H) { out.push(t); t += Math.max(1, Math.round(-Math.log(1 - rand()) * 14)); }
    apRec.set(out);
  });
  $('ap-demo').addEventListener('click', () => apRec.set(AP_DEMO));

  const AP_NOTES = () => ({
    high: L('Cererile trec înaintea tuturor taskurilor periodice. Răspund cel mai repede, dar o rafală ține procesorul ocupat oricât de mult, iar periodicele își pot rata termenele. Nicio analiză nu poate da garanții, pentru că nu se știe cât de dese vor fi cererile.',
      'The requests run before all periodic tasks. They respond fastest, but a burst keeps the processor busy for as long as it lasts, and the periodic tasks can miss their deadlines. No analysis can give guarantees, because nobody knows how often the requests will come.'),
    background: L('Cererile rulează doar când niciun task periodic nu are de lucru. Periodicele sunt protejate complet, dar o cerere poate aștepta mult, de exemplu după un job lung al jurnalului: cu cât procesorul este mai încărcat, cu atât așteaptă mai mult.',
      'The requests run only when no periodic task has work to do. The periodic tasks are fully protected, but a request may wait a long time, for example behind a long logger job: the busier the processor, the longer it waits.'),
    server: L('Cererile sunt servite de un server cu bugetul Q, cu prioritatea dată de Ts, ca la RM. Cât timp servește, serverul consumă din buget; fiecare porțiune consumată revine după Ts. Astfel, în orice interval de Ts ms, cererile primesc cel mult Q ms: pentru analiză, serverul este un task periodic (Q, Ts). O cerere izolată răspunde imediat, o rafală este încetinită la acest ritm. În literatură, regula se numește server sporadic (sporadic server).',
      'The requests are served by a server with budget Q and a priority given by Ts, as under RM. While serving, the server consumes its budget; each consumed portion comes back after Ts. So in any interval of Ts ms the requests get at most Q ms: for the analysis, the server is a periodic task (Q, Ts). An isolated request responds immediately, a burst is slowed down to this rate. In the literature this rule is called a sporadic server.')
  });

  function renderAperiodic() {
    apRec.tick();
    const mode = $('ap-mode').value, Ca = av.C(), Ts = av.Ts(), Q = Math.min(av.Q(), Ts);
    const AP_TASKS = apTasks();
    ['ap-Q', 'ap-Ts'].forEach(id => { $(id).disabled = mode !== 'server'; });
    $('ap-mode-note').textContent = AP_NOTES()[mode];
    const res = S.simulateAperiodic({
      tasks: AP_TASKS, requests: apRec.events.map(t => ({ t, C: Ca })), Ca, mode, Q, Ts, horizon: TY_H
    });
    const ai = AP_TASKS.length;
    const reqs = res.jobs.filter(j => j.task === ai);
    reqs.forEach(j => {
      j.tip = `<span class="sw" style="background:${color(ai)}"></span><b>${L('cererea', 'request')} ${j.k}</b><br>${L('sosire la', 'arrival at')} ${j.r}, C = ${j.exec}<br>` +
        (j.start !== null ? L(`început la ${j.start} (după ${j.start - j.r} ms)<br>`, `started at ${j.start} (after ${j.start - j.r} ms)<br>`) : '') +
        (j.finish !== null ? `<b>${L('terminată la', 'finished at')} ${j.finish}: R = ${j.finish - j.r}</b>` : L('neterminată până la sfârșitul simulării', 'not finished by the end of the simulation'));
    });
    R.gantt($('ap-gantt'), res, {
      cpuRow: true, cursor: apRec.running ? apRec.now : null,
      rowSubs: AP_TASKS.map(t => `C=${t.C}, T=${t.T}`).concat([L(`C=${Ca}, ${reqs.length} cereri`, `C=${Ca}, ${reqs.length} requests`)])
    });
    jobTip(res, $('ap-gantt'));

    $('ap-budget-fig').hidden = mode !== 'server';
    if (mode === 'server') {
      R.lineChart($('ap-budget'), {
        series: [{ name: L('buget rămas', 'remaining budget'), color: color(ai), points: res.budget, step: true }],
        xMax: TY_H, yMin: 0, yMax: Q, yTicks: Q > 1 ? [0, Q] : [0, 1], height: 150,
        cursor: apRec.running ? apRec.now : null, xLabel: 't (ms)', yLabel: L('buget', 'budget')
      });
    }
    const R_ = reqs.filter(j => j.finish !== null).map(j => j.finish - j.r);
    const pm = res.stats.slice(0, ai).reduce((a, x) => a + x.missed, 0);
    const pj = res.stats.slice(0, ai).reduce((a, x) => a + x.jobs, 0);
    const Up = AP_TASKS.reduce((a, t) => a + t.C / t.T, 0);
    drawApAnalysis(AP_TASKS, mode, Q, Ts, pm);
    $('ap-cards').innerHTML = [
      card(L('Termene ratate, taskuri periodice', 'Missed deadlines, periodic tasks'), L(`${pm} din ${pj}`, `${pm} of ${pj}`),
        pm ? verdict('bad', L('periodicele plătesc', 'the periodic tasks pay')) : verdict('ok', L('toate la timp', 'all on time'))),
      card(L('Timp de răspuns mediu al cererilor', 'Mean response time of the requests'), R_.length ? `${fmt2(R_.reduce((a, b) => a + b, 0) / R_.length)} ms` : '—',
        L(`${R_.length} din ${reqs.length} terminate`, `${R_.length} of ${reqs.length} finished`)),
      card(L('Cel mai lung timp de răspuns', 'Longest response time'), R_.length ? `${Math.max(...R_)} ms` : '—', L(`C = ${Ca} ms pe cerere`, `C = ${Ca} ms per request`)),
      card(L('Utilizarea periodicelor', 'Utilization of the periodic tasks'), fmt2(Up), AP_TASKS.map(t => t.name).join(' + ')),
      card(L('Rezervat pentru cereri', 'Reserved for requests'), mode === 'server' ? fmt2(Q / Ts) : (mode === 'high' ? L('nelimitat', 'unlimited') : L('doar timpul liber', 'only idle time')),
        mode === 'server' ? `Q/Ts; total ${fmt2(Up + Q / Ts)}` : '')
    ].join('');
  }

  /** RTA pentru periodice: în fundal fără cereri, cu serverul ca task (Q, Ts), cu prioritate maximă imposibil. */
  function drawApAnalysis(tasks, mode, Q, Ts, missed) {
    if (mode === 'high') {
      $('ap-analysis').innerHTML = `<p>${verdict('maybe', L('fără garanție', 'no guarantee'))} ${L('Cererile au prioritatea cea mai mare și nu au o margine a cererii de procesor, deci nicio analiză nu poate garanta termenele periodicelor.', 'The requests have the highest priority and their processor demand has no bound, so no analysis can guarantee the deadlines of the periodic tasks.')}${missed ? L(` În simularea de mai sus, ${missed} termen${missed > 1 ? 'e' : ''} ratat${missed > 1 ? 'e' : ''}.`, ` In the simulation above, ${missed} deadline${missed > 1 ? 's' : ''} missed.`) : ''}</p>`;
      return;
    }
    const set = mode === 'server' ? [{ name: 'server', type: 'periodic', C: Q, T: Ts, D: Ts }, ...tasks] : tasks;
    const rta = S.analyse(set, 'RM').rta;
    const sw = i => mode === 'server' ? (i === 0 ? `var(--s${tasks.length + 1})` : color(i - 1)) : color(i);
    const rows = rta.map(x => `<tr><td><span class="sw" style="background:${sw(x.task)}"></span>${esc(set[x.task].name)}${mode === 'server' && x.task === 0 ? ` (Q = ${Q}, Ts = ${Ts})` : ''}</td>
      <td class="iter">${x.steps.join(' → ')}</td><td class="num">${x.R}</td><td class="num">${set[x.task].D}</td>
      <td>${x.ok ? verdict('ok', 'R ≤ D') : verdict('bad', 'R > D')}</td></tr>`).join('');
    const ok = rta.every(x => x.ok);
    const intro = mode === 'server'
      ? L('Serverul intră în analiză ca un task periodic (Q, Ts), cu prioritatea dată de Ts.', 'The server enters the analysis as a periodic task (Q, Ts), with the priority given by Ts.')
      : L('În fundal, cererile nu întârzie niciodată periodicele, deci analiza le ignoră.', 'In the background, the requests never delay the periodic tasks, so the analysis ignores them.');
    const concl = ok
      ? verdict('ok', L('garantat', 'guaranteed')) + L(' Termenele periodicelor sunt respectate oricât de dese ar fi cererile.', ' The deadlines of the periodic tasks are met however often the requests come.')
      : verdict('bad', L('negarantat', 'not guaranteed')) + L(' Analiza nu mai poate garanta periodicele: micșorați bugetul Q sau încărcarea jurnalului.', ' The analysis can no longer guarantee the periodic tasks: reduce the budget Q or the load of the logger.') +
        (missed ? '' : L(' Simularea de mai sus nu a nimerit cazul cel mai defavorabil, dar acesta poate apărea.', ' The simulation above did not hit the worst case, but it can occur.'));
    $('ap-analysis').innerHTML = `<p>${intro}</p><div class="table-wrap"><table><thead><tr><th>Task</th><th>${L('Iterații RTA', 'RTA iterations')}</th><th>R</th><th>D</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><p>${concl}</p>`;
  }

  function showType(type) {
    if (!['periodic', 'sporadic', 'aperiodic'].includes(type)) type = 'periodic';
    tyType = type;
    document.querySelectorAll('#tab-types .seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.type === type));
    ['periodic', 'sporadic', 'aperiodic'].forEach(t => { $('ty-' + t).hidden = t !== type; });
    if (type !== 'sporadic') spRec.stop();
    if (type !== 'aperiodic') apRec.stop();
    ({ periodic: renderPeriodic, sporadic: renderSporadic, aperiodic: renderAperiodic })[type]();
  }
  document.querySelectorAll('#tab-types .seg button').forEach(b => b.addEventListener('click', () => {
    history.replaceState(null, '', '#types/' + b.dataset.type);
    showType(b.dataset.type);
  }));
  document.addEventListener('keydown', ev => {
    if (ev.code !== 'Space' || current !== 'types' || tyType !== 'sporadic') return;
    if (/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) return;
    ev.preventDefault();
    $('sp-press').click();
  });


  /* ===================== 5. Inversiunea de prioritate ===================== */
  const rpresets = window.RTResPresets;
  const rs = { tasks: [], proto: 'none', cursor: 0, timer: null, result: null, axis: null };
  function fillResSelect() {
    const v = $('r-preset').value;
    $('r-preset').innerHTML = rpresets.map(p => `<option value="${p.id}">${esc(tr(p.title))}</option>`).join('') +
      `<option value="custom">${L('(scenariul meu)', '(my scenario)')}</option>`;
    if (v) $('r-preset').value = v;
  }
  fillResSelect();
  const PROTO_NOTES = () => ({
    none: L('Zăvor simplu: cine găsește zăvorul ocupat se blochează până când proprietarul îl eliberează. Proprietarul rulează cu prioritatea lui obișnuită, deci poate fi preemptat de orice task mai prioritar decât el, chiar dacă acesta nu folosește zăvorul.',
      'Plain lock: a task that finds the lock taken blocks until the owner releases it. The owner runs with its normal priority, so it can be preempted by any task with a higher priority, even one that does not use the lock.'),
    pip: L('Moștenirea priorității: când un task se blochează la un zăvor, proprietarul primește temporar prioritatea lui, până eliberează zăvorul. Regula se aplică și pe lanțuri: dacă proprietarul așteaptă la rândul lui alt zăvor, prioritatea trece mai departe.',
      'Priority inheritance: when a task blocks on a lock, the owner temporarily gets its priority until it releases the lock. The rule is transitive: if the owner in turn waits for another lock, the priority is passed on.'),
    icpp: L('Plafonul imediat: cine ia un zăvor primește imediat prioritatea egală cu plafonul zăvorului, adică prioritatea celui mai prioritar task care îl folosește, și revine la prioritatea lui când îl eliberează.',
      'Immediate ceiling: a task that takes a lock immediately gets a priority equal to the ceiling of the lock, the priority of the highest-priority task that uses it, and returns to its own priority when it releases the lock.'),
    pcp: L('Protocolul plafonului: moștenire, plus o regulă la cerere. Un task ia un zăvor liber doar dacă prioritatea lui este strict mai mare decât plafoanele zăvoarelor ținute de alte taskuri; altfel se blochează (blocare de plafon).',
      'Priority ceiling protocol: inheritance, plus a rule at each request. A task takes a free lock only if its priority is strictly higher than the ceilings of the locks held by other tasks; otherwise it blocks (ceiling blocking).')
  });
  /** Mesajul unei greșeli din programul unui task. */
  function progError(pr) {
    return {
      close: L('o paranteză „]” nu are pereche', 'a “]” has no matching “[”'),
      token: L(`nu înțeleg „${pr.arg}”; folosiți numere și [S n]`, `cannot read “${pr.arg}”; use numbers and [S n]`),
      open: L(`secțiunea critică pe ${pr.arg} nu este închisă cu „]”`, `the critical section on ${pr.arg} is not closed with “]”`),
      empty: L('programul nu are niciun calcul', 'the program has no computation')
    }[pr.error];
  }

  function loadResPreset(id) {
    const p = rpresets.find(x => x.id === id) || rpresets[1];
    $('r-preset').value = p.id;
    rs.tasks = p.tasks.map(t => ({ ...t, name: tr(t.name) }));
    rs.proto = p.protocol;
    $('r-preset-note').textContent = tr(p.note);
    rs.cursor = 0;
    buildResEditor();
  }
  function buildResEditor() {
    const rows = rs.tasks.map((t, i) => {
      const pr = S.parseProgram(t.prog);
      return `<tr data-i="${i}"><td><span class="sw big" style="background:${color(i)}"></span></td>
        <td><input data-f="name" value="${esc(t.name)}" size="5"></td>
        <td><input data-f="prio" type="number" min="1" max="20" value="${t.prio}"></td>
        <td><input data-f="r" type="number" min="0" max="60" value="${t.r}"></td>
        <td><input data-f="prog" value="${esc(t.prog)}" size="22" class="prog ${pr.error ? 'bad-input' : ''}"></td>
        <td class="bad">${pr.error ? esc(progError(pr)) : ''}</td>
        <td><button type="button" class="ghost del" title="${L('Șterge taskul', 'Delete the task')}" ${rs.tasks.length < 2 ? 'disabled' : ''}>✕</button></td></tr>`;
    });
    $('r-tasks').innerHTML = `<thead><tr><th></th><th>${L('Nume', 'Name')}</th><th>${L('Prioritate P', 'Priority P')}</th><th>${L('Eliberare r', 'Release r')}</th><th>${L('Program', 'Program')}</th><th></th><th></th></tr></thead><tbody>${rows.join('')}</tbody>`;
    $('r-add').disabled = rs.tasks.length >= 6;
  }
  $('r-tasks').addEventListener('change', ev => {
    const tr = ev.target.closest('tr'); if (!tr) return;
    const t = rs.tasks[+tr.dataset.i], f = ev.target.dataset.f;
    if (!f) return;
    if (f === 'name' || f === 'prog') t[f] = ev.target.value;
    else { t[f] = Math.max(f === 'r' ? 0 : 1, Math.round(+ev.target.value || 0)); ev.target.value = t[f]; }
    $('r-preset').value = 'custom';
    buildResEditor(); runRes();
  });
  $('r-tasks').addEventListener('click', ev => {
    if (!ev.target.classList.contains('del')) return;
    rs.tasks.splice(+ev.target.closest('tr').dataset.i, 1);
    $('r-preset').value = 'custom';
    buildResEditor(); runRes();
  });
  $('r-add').addEventListener('click', () => {
    rs.tasks.push({ name: `τ${rs.tasks.length + 1}`, prio: 1, r: 0, prog: '2' });
    $('r-preset').value = 'custom';
    buildResEditor(); runRes();
  });
  $('r-preset').addEventListener('change', ev => {
    if (ev.target.value === 'custom') return;
    loadResPreset(ev.target.value);
    history.replaceState(null, '', '#res/' + ev.target.value);
    runRes();
  });
  document.querySelectorAll('#r-proto button').forEach(b => b.addEventListener('click', () => { rs.proto = b.dataset.p; runRes(); }));
  $('r-gantt').addEventListener('click', ev => {
    if (!rs.axis) return;
    const svg = $('r-gantt'), r = svg.getBoundingClientRect();
    const px = (ev.clientX - r.left) * (svg.viewBox.baseVal.width / r.width);
    if (px < rs.axis.left) return;
    setResCursor(Math.floor(rs.axis.toTime(px)));
  });
  $('r-back').addEventListener('click', () => setResCursor(rs.cursor - 1));
  $('r-fwd').addEventListener('click', () => setResCursor(rs.cursor + 1));
  $('r-play').addEventListener('click', () => {
    if (rs.timer) { stopResPlay(); return; }
    if (!rs.result) return;
    if (rs.cursor >= rs.result.horizon - 1) rs.cursor = -1;
    $('r-play').textContent = L('Oprește', 'Stop');
    rs.timer = setInterval(() => {
      if (rs.cursor >= rs.result.horizon - 1) { stopResPlay(); return; }
      setResCursor(rs.cursor + 1);
    }, 450);
  });
  function stopResPlay() { clearInterval(rs.timer); rs.timer = null; $('r-play').textContent = L('Pornește', 'Play'); }
  function setResCursor(t) {
    if (!rs.result) return;
    rs.cursor = Math.max(0, Math.min(rs.result.horizon - 1, t));
    drawResGantt(); drawResState();
  }

  function runRes() {
    document.querySelectorAll('#r-proto button').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === rs.proto));
    $('r-proto-note').textContent = PROTO_NOTES()[rs.proto];
    const parsed = rs.tasks.map(t => ({ name: t.name, prio: t.prio, r: t.r, ...S.parseProgram(t.prog) }));
    const bad = parsed.find(t => t.error);
    if (bad) {
      rs.result = null;
      $('r-why').textContent = L(`Programul lui ${bad.name} are o greșeală: ${progError(bad)}.`, `The program of ${bad.name} has a mistake: ${progError(bad)}.`);
      ['r-cards', 'r-state', 'r-bounds'].forEach(id => { $(id).innerHTML = ''; });
      while ($('r-gantt').firstChild) $('r-gantt').removeChild($('r-gantt').firstChild);
      return;
    }
    rs.result = S.simulateResources(parsed, rs.proto);
    rs.cursor = Math.min(rs.cursor, rs.result.horizon - 1);
    drawResGantt(); drawResState(); drawResCards(); drawResBounds(parsed);
  }
  function drawResGantt() {
    rs.axis = R.resGantt($('r-gantt'), rs.result, { cursor: rs.cursor });
    jobTip({ jobs: [], tasks: [] }, $('r-gantt'));
  }

  /** Explicația momentului t: cine rulează, cine așteaptă și ce fel de inversiune este. */
  function resWhy(res, t) {
    const T = res.tasks, st = T.map((_, i) => res.timeline[i][t]);
    const nm = i => `<b>${esc(T[i].name)}</b>`;
    const parts = [];
    if (res.deadlock && t >= res.deadlock.t) {
      const [a, b] = res.deadlock.tasks;
      return L(`La t = ${t}: <b class="bad">deadlock</b>. ${nm(a)} așteaptă un zăvor ținut de ${nm(b)}, iar ${nm(b)} așteaptă un zăvor ținut de ${nm(a)}. Niciunul nu mai poate continua, oricât ar aștepta.`,
        `At t = ${t}: <b class="bad">deadlock</b>. ${nm(a)} waits for a lock held by ${nm(b)}, and ${nm(b)} waits for a lock held by ${nm(a)}. Neither can continue, however long they wait.`);
    }
    const run = st.findIndex(x => x.s === 'run');
    if (run < 0) {
      parts.push(L(`La t = ${t} procesorul este liber.`, `At t = ${t} the processor is idle.`));
    } else {
      const x = st[run];
      let txt = L(`La t = ${t} rulează ${nm(run)}`, `At t = ${t}, ${nm(run)} runs`);
      if (x.held.length) txt += L(`, în secțiunea critică pe ${x.held.join(', ')}`, `, in the critical section on ${x.held.join(', ')}`);
      if (x.donor !== undefined && x.prio > T[run].prio) {
        txt += res.protocol === 'icpp'
          ? L(`, cu prioritatea ${x.prio}, plafonul zăvorului ${x.held[x.held.length - 1]} (prioritatea lui proprie este ${T[run].prio})`,
            `, with priority ${x.prio}, the ceiling of lock ${x.held[x.held.length - 1]} (its own priority is ${T[run].prio})`)
          : L(`, cu prioritatea ${x.prio}, moștenită de la ${nm(x.donor)} (prioritatea lui proprie este ${T[run].prio})`,
            `, with priority ${x.prio}, inherited from ${nm(x.donor)} (its own priority is ${T[run].prio})`);
      }
      parts.push(txt + '.');
    }
    // lanțul de blocare: cine îl blochează, direct sau mai departe
    const chain = i => { const out = []; let c = i; while (c !== null && c !== undefined && st[c] && st[c].s === 'blocked' && !out.includes(st[c].by)) { out.push(st[c].by); c = st[c].by; } return out; };
    st.forEach((x, i) => {
      if (x.s === 'blocked') {
        parts.push(x.ceiling
          ? L(`${nm(i)} cere zăvorul ${x.S}, care este liber, dar plafonul unui zăvor ținut de ${nm(x.by)} nu este mai mic decât prioritatea lui: blocare de plafon.`,
            `${nm(i)} requests lock ${x.S}, which is free, but the ceiling of a lock held by ${nm(x.by)} is not lower than its priority: ceiling blocking.`)
          : L(`${nm(i)} așteaptă zăvorul ${x.S}, ținut de ${nm(x.by)}.`, `${nm(i)} waits for lock ${x.S}, held by ${nm(x.by)}.`));
      }
    });
    if (run >= 0) {
      st.forEach((x, i) => {
        if ((x.s !== 'blocked' && x.s !== 'ready') || T[i].prio <= T[run].prio) return;
        if (x.s === 'blocked') {
          parts.push(chain(i).includes(run)
            ? L(`Inversiune mărginită: ${nm(run)}, mai puțin prioritar, rulează ca să elibereze zăvorul care îl blochează pe ${nm(i)}.`,
              `Bounded inversion: ${nm(run)}, with a lower priority, runs to release the lock that blocks ${nm(i)}.`)
            : L(`<b class="bad">Inversiune nemărginită</b>: ${nm(run)} nu ține zăvorul pe care îl așteaptă ${nm(i)}, dar îl împiedică pe proprietar să ruleze și să îl elibereze.`,
              `<b class="bad">Unbounded inversion</b>: ${nm(run)} does not hold the lock that ${nm(i)} waits for, but it keeps the owner from running and releasing it.`));
        } else if (st[run].prio > T[run].prio) {
          parts.push(L(`Blocare prin împingere: ${nm(i)} este gata, dar ${nm(run)} rulează cu o prioritate ridicată, mai mare decât a lui ${nm(i)}.`,
            `Push-through blocking: ${nm(i)} is ready, but ${nm(run)} runs with a raised priority, higher than that of ${nm(i)}.`));
        }
      });
    }
    return parts.join(' ');
  }

  function drawResState() {
    const res = rs.result, t = rs.cursor;
    $('r-state-title').textContent = L(`Ce se întâmplă în intervalul [${t}, ${t + 1})`, `What happens in the interval [${t}, ${t + 1})`);
    $('r-why').innerHTML = resWhy(res, t);
    const name = { run: 'Running', ready: 'Ready', blocked: 'Blocked', idle: L('neeliberat', 'not released'), done: L('terminat', 'finished') };
    const rows = res.tasks.map((task, i) => {
      const x = res.timeline[i][t];
      const active = x.prio !== undefined ? x.prio : task.prio;
      const st = { run: 'running', ready: 'ready', blocked: 'blocked', idle: 'waiting', done: 'waiting' }[x.s];
      return `<tr class="${st}"><td><span class="sw" style="background:${color(i)}"></span>${esc(task.name)}</td>
        <td class="num">${task.prio}</td>
        <td class="num ${active > task.prio ? 'boosted' : ''}">${active}</td>
        <td><span class="state ${st}">${name[x.s]}</span>${x.s === 'blocked' ? ` ${L('pe', 'on')} ${x.S}` : ''}</td>
        <td>${x.held.length ? x.held.join(', ') : '—'}</td></tr>`;
    }).join('');
    $('r-state').innerHTML = `<thead><tr><th>Task</th><th>${L('Prioritate proprie', 'Own priority')}</th><th>${L('Prioritate activă', 'Active priority')}</th><th>${L('Stare', 'State')}</th><th>${L('Zăvoare ținute', 'Locks held')}</th></tr></thead><tbody>${rows}</tbody>`;
  }

  function drawResCards() {
    const res = rs.result;
    const cards = res.tasks.map((task, i) => {
      const s = res.stats[i];
      return card(`${esc(task.name)} (P = ${task.prio})`, s.R !== null ? `R = ${s.R} ms` : L('neterminat', 'not finished'),
        s.inversion ? L(`a așteptat ${s.inversion} ms după taskuri mai puțin prioritare`, `waited ${s.inversion} ms for lower-priority tasks`)
          : L('nu a așteptat după taskuri mai puțin prioritare', 'did not wait for lower-priority tasks'));
    });
    if (res.deadlock) cards.unshift(card('Deadlock', L(`la t = ${res.deadlock.t}`, `at t = ${res.deadlock.t}`), verdict('bad', L('blocate definitiv', 'stuck for good'))));
    $('r-cards').innerHTML = cards.join('');
  }

  function drawResBounds(parsed) {
    const res = rs.result;
    const b = S.blockingBounds(parsed);
    const cyc = S.lockOrderCycle(parsed);
    const order = parsed.map((t, i) => i).sort((a, c) => parsed[c].prio - parsed[a].prio);
    const cell = (v, proto) => {
      if (cyc && (proto === 'none' || proto === 'pip')) return `<span class="bad">${L('deadlock posibil', 'deadlock possible')}</span>`;
      if (v === null) return `<span class="bad">${L('nemărginit', 'unbounded')}</span>`;
      return `${v} ms`;
    };
    const cur = rs.proto;
    const rows = order.map(i => {
      const x = b[i], obs = res.stats[i].inversion;
      const bound = cur === 'none' ? x.none : (cur === 'pip' ? x.pip : x.ceiling);
      const ok = !(cyc && (cur === 'none' || cur === 'pip')) && bound !== null && obs <= bound;
      return `<tr><td><span class="sw" style="background:${color(i)}"></span>${esc(parsed[i].name)}</td>
        <td>${x.matter.length ? x.matter.join(', ') : '—'}</td>
        <td class="num ${cur === 'none' ? 'cur' : ''}">${cell(x.none, 'none')}</td>
        <td class="num ${cur === 'pip' ? 'cur' : ''}">${cell(x.pip, 'pip')}</td>
        <td class="num ${cur === 'icpp' || cur === 'pcp' ? 'cur' : ''}">${cell(x.ceiling, 'ceil')}</td>
        <td class="num">${res.deadlock && res.stats[i].R === null ? '—' : obs + ' ms'}</td>
        <td>${res.deadlock && res.stats[i].R === null ? verdict('bad', L('blocat definitiv', 'stuck for good')) : (ok ? verdict('ok', L('în margine', 'within the bound')) : verdict('maybe', L('fără margine', 'no bound')))}</td></tr>`;
    }).join('');
    const ceilTxt = res.lockNames.map(S => `${S}: ${res.ceil[S]}`).join(', ');
    $('r-bounds').innerHTML = `<p>${L('Plafoanele zăvoarelor (prioritatea celui mai prioritar task care le folosește)', 'Lock ceilings (the priority of the highest-priority task that uses each lock)')}: ${ceilTxt || '—'}.
      ${L('Un zăvor contează pentru un task dacă îl folosește un task mai puțin prioritar și dacă plafonul lui este cel puțin egal cu prioritatea taskului.', 'A lock matters for a task if a lower-priority task uses it and its ceiling is at least the priority of the task.')}</p>
      <div class="table-wrap"><table><thead><tr><th>${L('Task, în ordinea priorității', 'Task, in priority order')}</th><th>${L('Zăvoare care contează', 'Locks that matter')}</th>
      <th>${L('B fără protocol', 'B with no protocol')}</th><th>${L('B cu moștenire', 'B with inheritance')}</th><th>${L('B cu plafon', 'B with a ceiling')}</th><th>${L('Așteptare observată (protocolul ales)', 'Observed waiting (chosen protocol)')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">${L(`Cu plafon, un job este blocat de cel mult o secțiune critică: B este cea mai lungă dintre ele. Cu moștenire,
      cel mult una pentru fiecare task mai puțin prioritar și pentru fiecare zăvor: B este cea mai mică dintre cele două sume.
      Fără protocol, blocarea devine nemărginită când un task de prioritate intermediară poate rula cât timp taskul așteaptă.
      Așteptarea observată numără momentele în care taskul era gata sau blocat, iar procesorul rula un task mai puțin prioritar.`,
      `With a ceiling, a job is blocked by at most one critical section: B is the longest of them. With inheritance,
      at most one for each lower-priority task and for each lock: B is the smaller of the two sums.
      With no protocol, blocking becomes unbounded when a medium-priority task can run while the task waits.
      The observed waiting counts the moments when the task was ready or blocked while the processor ran a lower-priority task.`)}</p>
      ${cyc ? `<p>${verdict('bad', L('Atenție', 'Warning'))} ${L(`Zăvoarele sunt luate imbricat în ordini contrare (${cyc.join(' → ')}): fără plafon este posibil deadlockul, iar marginile nu mai au sens.`, `The locks are nested in opposite orders (${cyc.join(' → ')}): without a ceiling a deadlock is possible, and the bounds no longer make sense.`)}</p>` : ''}`;
  }

  /* ===================== Legendă: exemplu adnotat ===================== */
  function renderHelp() {
    const res = S.simulate([
      { name: 'motor', type: 'periodic', C: 2, T: 5, D: 5, offset: 0, prio: 2 },
      { name: L('afișaj', 'display'), type: 'periodic', C: 4, T: 7, D: 7, offset: 0, prio: 1 }
    ], { policy: 'RM', horizon: 15 });
    R.gantt($('h-gantt'), res, { cpuRow: true, annotate: { task: 1, k: 0 } });
    jobTip(res, $('h-gantt'));
  }

  /* ===================== file și adresă ===================== */
  const renderers = { model: renderModel, arrivals: renderArrivals, types: () => showType(tyType), sched: () => runSched(), res: () => runRes(), help: renderHelp };
  let current = 'model';
  function show(tab) {
    if (!renderers[tab]) tab = 'model';
    current = tab;
    document.querySelectorAll('[role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
    document.querySelectorAll('.tab').forEach(s => { s.hidden = s.id !== 'tab-' + tab; });
    if (tab !== 'sched') stopPlay();
    if (tab !== 'types') { spRec.stop(); apRec.stop(); }
    if (tab !== 'res') stopResPlay();
    renderers[tab]();
  }
  document.querySelectorAll('[role=tab]').forEach(b => b.addEventListener('click', () => {
    const tab = b.dataset.tab;
    const sub = tab === 'sched' && $('s-preset').value !== 'custom' ? '/' + $('s-preset').value
      : tab === 'types' ? '/' + tyType
      : tab === 'res' && $('r-preset').value !== 'custom' ? '/' + $('r-preset').value : '';
    history.replaceState(null, '', '#' + tab + sub);
    show(tab);
  }));
  function fromHash() {
    const [tab, preset] = location.hash.replace('#', '').split('/');
    if (tab === 'types' && preset) tyType = preset;
    if (tab === 'res' || !rs.tasks.length) loadResPreset(tab === 'res' ? preset : null);
    loadPresetSilently(tab === 'sched' ? preset : null);
    show(tab || 'model');
  }
  function loadPresetSilently(id) {
    const p = presets.find(x => x.id === id) || presets[0];
    $('s-preset').value = p.id;
    sched.tasks = p.tasks.map(t => ({ ...t, name: tr(t.name) }));
    $('s-policy').value = p.policy;
    $('s-H').value = p.horizon;
    $('s-preset-note').textContent = tr(p.note);
    sched.cursor = 0;
    buildEditor();
  }
  window.addEventListener('hashchange', fromHash);

  /* ---------- schimbarea limbii ---------- */
  // exemplele încărcate își schimbă numele taskurilor și nota; setările alese rămân
  function retitlePresets() {
    const sp = presets.find(x => x.id === $('s-preset').value);
    if (sp) {
      sp.tasks.forEach((t, i) => { if (sched.tasks[i]) sched.tasks[i].name = tr(t.name); });
      $('s-preset-note').textContent = tr(sp.note);
    }
    const rp = rpresets.find(x => x.id === $('r-preset').value);
    if (rp) {
      rp.tasks.forEach((t, i) => { if (rs.tasks[i]) rs.tasks[i].name = tr(t.name); });
      $('r-preset-note').textContent = tr(rp.note);
    }
  }
  $('lang').addEventListener('click', () => {
    I.set(I.lang === 'en' ? 'ro' : 'en');
    stopPlay(); stopResPlay();
    applyStatic(); buildKeys(); fillSchedSelects(); fillResSelect();
    retitlePresets();
    buildEditor(); buildResEditor();
    renderers[current]();
  });
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => renderers[current](), 120); });
  fromHash();
})();
