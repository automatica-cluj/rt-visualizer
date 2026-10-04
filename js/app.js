/* Legătura dintre controale, simulare și desene. */
(function () {
  'use strict';
  const S = window.RTSim, R = window.RTRender, Tip = window.RTTip;
  const $ = id => document.getElementById(id);
  const fmt2 = v => v.toFixed(2).replace('.', ',');
  const fmt3 = v => v.toFixed(3).replace('.', ',');
  const pct = v => Math.round(v * 100) + ' %';
  const color = R.color;
  const TYPE = { periodic: 'periodic', sporadic: 'sporadic', aperiodic: 'aperiodic' };

  /* ---------- formule scurte în text: $C_i$ -> C<sub>i</sub> ---------- */
  function tex(s) {
    return '<span class="m">' + s
      .replace(/\\varepsilon/g, 'ε').replace(/\\le/g, '≤').replace(/\\sum/g, 'Σ').replace(/\\tau/g, 'τ')
      .replace(/\\bar T/g, 'T̄').replace(/\\cdot/g, '·')
      .replace(/_\{([^}]*)\}/g, '<sub>$1</sub>').replace(/_(\w)/g, '<sub>$1</sub>')
      .replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>') + '</span>';
  }
  document.querySelectorAll('label, legend, p, .fig-title, dt, dd').forEach(n => {
    if (n.innerHTML.includes('$') && !n.querySelector('input, select')) {
      n.innerHTML = n.innerHTML.replace(/\$([^$]+)\$/g, (m, g) => tex(g));
    } else if (n.tagName === 'LABEL') {
      n.childNodes.forEach(c => {
        if (c.nodeType === 3 && c.textContent.includes('$')) {
          const span = document.createElement('span');
          span.innerHTML = c.textContent.replace(/\$([^$]+)\$/g, (m, g) => tex(g));
          n.replaceChild(span, c);
        }
      });
    }
  });

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
        `<span class="sw" style="background:${color(j.task)}"></span><b>${esc(t.name)}</b>, jobul ${j.k} (${TYPE[t.type]})`,
        isFinite(j.d) ? `eliberare r = ${j.r}, termen d = ${j.d}` : `sosire r = ${j.r}, fără termen-limită`,
        `timp de calcul: ${j.exec}${j.exec !== t.C ? ` (C = ${t.C})` : ''}`,
        j.start !== null ? `început la ${j.start}, întârziere ${j.start - j.r}` : 'nu a început',
        j.finish !== null ? `terminat la ${j.finish}, R = ${j.finish - j.r}` : (j.aborted ? 'abandonat la termen' : 'neterminat în orizont'),
        `preemptat de ${j.preempted} ori`
      ];
      if (j.missed) rows.push('<b class="bad">✕ termen ratat</b>');
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
  $('m-hp').addEventListener('change', renderModel);

  function renderModel() {
    const C = m.C(), T = m.T(), D = m.D(), r0 = m.r();
    const tasks = [];
    if ($('m-hp').checked) {
      tasks.push({ name: 'τh mai prioritar', type: 'periodic', C: m.hC(), T: m.hT(), D: m.hT(), offset: m.hr(), prio: 2 });
    }
    tasks.push({ name: 'τ analizat', type: 'periodic', C, T, D, offset: r0, prio: 1 });
    const mi = tasks.length - 1;
    const horizon = Math.min(90, Math.max(30, r0 + 3 * T + Math.max(D - T, 0)));
    const res = S.simulate(tasks, { policy: 'FP', horizon });
    R.gantt($('m-gantt'), res, { annotate: { task: mi, k: 0 }, cpuRow: true });
    jobTip(res, $('m-gantt'));

    const mine = res.jobs.filter(j => j.task === mi);
    const st = res.stats[mi];
    const j0 = mine[0];
    const U = tasks.reduce((s, t) => s + t.C / t.T, 0);
    $('m-cards').innerHTML = [
      card('Utilizarea taskului u = C/T', fmt2(C / T), `${C} din fiecare ${T} ms`),
      card('Laxitatea nominală X = D − C', String(D - C), D - C < 0 ? verdict('bad', 'C > D: imposibil') : 'cât poate aștepta un job'),
      card('Timpul de răspuns al jobului 0', j0 && j0.finish !== null ? `R₀ = ${j0.finish - j0.r}` : '—',
        j0 && j0.finish !== null ? `${j0.exec} calcul + ${j0.finish - j0.r - j0.exec} așteptare` : ''),
      card('Cel mai mare R observat', st.maxR !== null ? String(st.maxR) : '—', `D = ${D}`),
      card('Termene ratate', `${st.missed} din ${st.jobs}`, st.missed ? verdict('bad', 'R > D') : verdict('ok', 'toate la timp')),
      card('U pentru tot procesorul', fmt2(U), U > 1 ? verdict('bad', 'supraîncărcare') : '')
    ].join('');

    const series = mine.map(j => ({ name: `X(t), J${j.k}`, color: color(mi), points: S.laxitySeries(j, horizon) }));
    let lo = -2, hi = 2;
    series.forEach(s => s.points.forEach(p => { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }));
    hi = Math.ceil(hi + 1); lo = Math.floor(lo);
    R.lineChart($('m-lax'), {
      series, xMax: horizon, yMin: lo, yMax: hi, height: 190,
      yTicks: [lo, 0, hi], xLabel: 't (ms)', yLabel: 'X(t)',
      refLines: [{ y: 0, label: 'sub 0: termen ratat' }]
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
    ].map(d => ({ ...d, C, T, D: T, offset: 0, prio: 1 }));
    const merged = { tasks: defs, jobs: [], horizon: H, schedule: [], busy: 0 };
    const rel = [];
    defs.forEach((t, i) => {
      const r = S.simulate([t], { policy: 'FIFO', horizon: H, seed: aSeed * 31 + i });
      r.jobs.forEach(j => { merged.jobs.push({ ...j, task: i, id: merged.jobs.length }); });
      rel.push(r.jobs.map(j => j.r));
    });
    R.gantt($('a-gantt'), merged, { cpuRow: false, jobLabels: C * 1 > 0 });
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
      xLabel: 't (ms)', yLabel: 'ms de calcul cerute'
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
        <td class="num">${dense}${dense > 1 ? ' ' + verdict('bad', 'rafală') : ''}</td>
        <td>${t.type === 'aperiodic' ? 'nu există margine' : fmt2(C / T)}</td></tr>`;
    });
    $('a-table').innerHTML = `<thead><tr><th>Tip</th><th>Eliberări</th><th>Interval minim observat</th>
      <th>Interval maxim observat</th><th>Eliberări în cea mai densă fereastră de lungime T</th>
      <th>Utilizare garantată C/T</th></tr></thead><tbody>${rows.join('')}</tbody>`;
  }

  /* ===================== 4. Planificare și încărcare ===================== */
  const sched = { tasks: [], seed: 1, cursor: 0, timer: null, result: null };
  const presets = window.RTPresets;
  $('s-preset').innerHTML = presets.map(p => `<option value="${p.id}">${esc(p.title)}</option>`).join('') +
    '<option value="custom">(setul meu)</option>';
  $('s-policy').innerHTML = Object.entries(S.POLICIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

  function loadPreset(id) {
    const p = presets.find(x => x.id === id) || presets[0];
    $('s-preset').value = p.id;
    sched.tasks = p.tasks.map(t => ({ ...t }));
    $('s-policy').value = p.policy;
    $('s-H').value = p.horizon;
    $('s-preempt').checked = true;
    $('s-abort').checked = false;
    $('s-varC').checked = false;
    $('s-preset-note').textContent = p.note;
    sched.cursor = 0;
    buildEditor();
    runSched();
  }

  function buildEditor() {
    const fp = $('s-policy').value === 'FP';
    const head = `<thead><tr><th></th><th>Nume</th><th>Tip</th><th>C</th><th title="perioadă / interval minim / interval mediu">T</th>
      <th>D</th><th title="momentul primei eliberări">Prima eliberare</th><th title="doar pentru priorități fixe alese manual; număr mai mare = prioritate mai mare">Prioritate</th><th></th></tr></thead>`;
    const rows = sched.tasks.map((t, i) => `<tr data-i="${i}">
      <td><span class="sw big" style="background:${color(i)}"></span></td>
      <td><input data-f="name" value="${esc(t.name)}" size="9"></td>
      <td><select data-f="type">${Object.keys(TYPE).map(k => `<option ${k === t.type ? 'selected' : ''}>${k}</option>`).join('')}</select></td>
      <td><input data-f="C" type="number" min="1" max="200" value="${t.C}"></td>
      <td><input data-f="T" type="number" min="1" max="500" value="${t.T}"></td>
      <td><input data-f="D" type="number" min="1" max="500" value="${t.D}"></td>
      <td><input data-f="offset" type="number" min="0" max="500" value="${t.offset}"></td>
      <td><input data-f="prio" type="number" min="1" max="99" value="${t.prio}" ${fp ? '' : 'disabled'}></td>
      <td><button type="button" class="ghost del" title="Șterge taskul" ${sched.tasks.length < 2 ? 'disabled' : ''}>✕</button></td></tr>`);
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
    $('s-play').textContent = 'Oprește';
    sched.timer = setInterval(() => {
      if (sched.cursor >= sched.result.horizon - 1) { stopPlay(); return; }
      setCursor(sched.cursor + 1);
    }, 280);
  });
  function stopPlay() { clearInterval(sched.timer); sched.timer = null; $('s-play').textContent = 'Pornește'; }

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
    $('s-Hhint').innerHTML = hp ? `hiperperioada H = ${hp}${hp !== H && hp <= 600 ? ` <a href="#" id="s-useH">folosește H</a>` : ''}` : '';
    const useH = $('s-useH');
    if (useH) useH.onclick = e => { e.preventDefault(); $('s-H').value = hp; runSched(); };
    $('s-preempt').disabled = policy === 'FIFO';

    const res = sched.result;
    const missed = res.stats.reduce((s, x) => s + x.missed, 0);
    const total = res.stats.reduce((s, x) => s + x.jobs, 0);
    $('s-cards').innerHTML = [
      card('Factorul de utilizare U', an.n ? fmt2(an.U) : '—', an.hasAperiodic ? 'fără taskurile aperiodice' : (an.U > 1 ? verdict('bad', 'supraîncărcare') : 'cerut de set')),
      card('Procesor ocupat în simulare', pct(res.busy / res.horizon), `${res.busy} din ${res.horizon} ms`),
      card('Termene ratate', `${missed} din ${total}`, missed ? verdict('bad', 'joburi întârziate') : verdict('ok', 'toate la timp')),
      card('Preempțiuni', String(res.preemptions), res.preemptive ? 'un job întrerupt de altul' : 'planificare nepreemptivă'),
      card('Hiperperioada H', hp ? String(hp) : '—', hp && hp > H ? 'orizontul este mai scurt decât H' : '')
    ].join('');
    drawGantt(); drawState(); drawLoad(); drawStats(); drawAnalysis(an);
  }

  function drawGantt() {
    sched.axis = R.gantt($('s-gantt'), sched.result, { cpuRow: true, cursor: sched.cursor });
    jobTip(sched.result, $('s-gantt'));
  }

  function drawState() {
    const t = sched.cursor, res = sched.result;
    const st = S.stateAt(res, t);
    $('s-state-title').textContent = `Starea taskurilor în intervalul [${t}, ${t + 1})`;
    const name = { running: 'Running', ready: 'Ready', waiting: 'Blocked' };
    const rows = st.map((s, i) => {
      const task = res.tasks[i];
      return `<tr class="${s.state}"><td><span class="sw" style="background:${color(i)}"></span>${esc(task.name)}</td>
        <td><span class="state ${s.state}">${name[s.state]}</span></td>
        <td class="num">${s.job ? 'J' + s.job.k : '—'}</td>
        <td class="num">${s.job ? s.rem : '—'}</td>
        <td class="num">${s.job ? s.job.d : (s.nextRelease !== null ? `următoarea r = ${s.nextRelease}` : '—')}</td>
        <td class="num ${s.job && s.laxity < 0 ? 'bad' : ''}">${s.job ? s.laxity : '—'}</td></tr>`;
    });
    $('s-state').innerHTML = `<caption class="note">Blocked: jobul curent a terminat, taskul așteaptă următoarea eliberare.</caption><thead><tr><th>Task</th><th>Stare</th><th>Job</th><th>c(t) rămas</th><th>d (termen)</th><th>X(t)</th></tr></thead><tbody>${rows.join('')}</tbody>`;
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
    if (!an.hasAperiodic && an.U <= 1.5) refs.push({ y: an.U, label: `U teoretic = ${pct(an.U)}`, side: 'left' });
    const yMax = Math.max(1.1, Math.min(1.6, an.U + 0.1));
    R.lineChart($('s-load'), {
      series: [
        { name: `ocupare pe ultimele ${w} ms`, color: 'var(--s1)', points: winPts },
        { name: 'ocupare medie de la 0', color: 'var(--s2)', points: cumPts, dash: '6 4' }
      ],
      xMax: res.horizon, yMin: 0, yMax, yTicks: [0, 0.5, 1], yFmt: v => pct(v), height: 210,
      refLines: refs, cursor: sched.cursor, xLabel: 't (ms)', yLabel: 'ocupare'
    });
    $('s-load-legend').innerHTML =
      `<span><span class="sw" style="background:var(--s1)"></span>ocupare pe ultimele ${w} ms</span>` +
      `<span><span class="sw dashed" style="border-color:var(--s2)"></span>ocupare medie de la 0</span>`;
  }

  function drawStats() {
    const res = sched.result;
    const f = v => (v === null ? '—' : (Number.isInteger(v) ? v : fmt2(v)));
    const rows = res.stats.map((s, i) => `<tr><td><span class="sw" style="background:${color(i)}"></span>${esc(res.tasks[i].name)}</td>
      <td class="num">${s.jobs}</td><td class="num">${s.finished}</td>
      <td class="num ${s.missed ? 'bad' : ''}">${s.missed}</td>
      <td class="num">${f(s.minR)}</td><td class="num">${f(s.maxR)}</td><td class="num">${f(s.avgR)}</td>
      <td class="num">${f(s.maxLatency)}</td><td class="num">${f(s.startJitter)}</td></tr>`);
    $('s-stats').innerHTML = `<thead><tr><th>Task</th><th>Joburi</th><th>Terminate</th><th>Ratate</th>
      <th>R min</th><th>R max</th><th>R mediu</th><th title="cel mai mare s − r">Întârziere max. la start</th>
      <th title="max(s − r) − min(s − r)">Jitter de start</th></tr></thead><tbody>${rows.join('')}</tbody>`;
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
      ? `<span><span class="sw" style="background:${color(i)}"></span>${esc(t.name)}: aperiodic, fără u</span>`
      : `<span><span class="sw" style="background:${color(i)}"></span>${esc(t.name)}: ${fmt3(t.C / t.T)}</span>`).join('');
    $('s-ubar').innerHTML = `<div class="ubar"><div class="utrack">${segs}</div>${marks.join('')}</div>
      <div class="legend">${legend}</div>
      <p class="note">Fiecare segment este utilizarea unui task, u = C/T. Pentru taskurile sporadice, T este intervalul minim.</p>`;
  }

  function drawAnalysis(an) {
    drawUBar(an);
    const policy = $('s-policy').value;
    const out = [];
    if (!an.n) { $('s-analysis').innerHTML = '<p class="note">Nu există taskuri periodice sau sporadice.</p>'; return; }
    out.push(`<p>${an.U <= 1 ? verdict('ok', `U = ${fmt3(an.U)} ≤ 1`) : verdict('bad', `U = ${fmt3(an.U)} > 1`)}
      condiția necesară pe un nucleu${an.U > 1 ? ': niciun algoritm nu poate respecta toate termenele' : ''}.</p>`);
    if (policy === 'RM' || policy === 'DM' || policy === 'FP') {
      if (an.implicit && policy !== 'FP') {
        out.push(`<p>${an.U <= an.llBound ? verdict('ok', 'planificabil') : verdict('maybe', 'nedecis')}
          limita Liu & Layland: U ≤ n(2<sup>1/n</sup> − 1) = ${fmt3(an.llBound)} (condiție suficientă).</p>`);
        out.push(`<p>${an.hyperbolic <= 2 ? verdict('ok', 'planificabil') : verdict('maybe', 'nedecis')}
          limita hiperbolică: Π(u<sub>i</sub> + 1) = ${fmt3(an.hyperbolic)} ≤ 2 (condiție suficientă).</p>`);
      }
      const rows = an.rta.map(x => {
        const t = sched.tasks[x.task];
        return `<tr><td><span class="sw" style="background:${color(x.task)}"></span>${esc(t.name)}</td>
          <td>${x.hp.length ? x.hp.map(j => esc(sched.tasks[j].name)).join(', ') : '—'}</td>
          <td class="iter">${x.aperiodicAbove ? 'aperiodic mai prioritar: ' + x.aperiodicAbove.map(j => esc(sched.tasks[j].name)).join(', ') : x.steps.join(' → ')}</td>
          <td class="num">${x.R === null ? '—' : x.R}</td><td class="num">${t.D}</td>
          <td>${x.aperiodicAbove ? verdict('maybe', 'fără garanție') : (x.ok ? verdict('ok', 'R ≤ D') : verdict('bad', 'R > D'))}</td></tr>`;
      });
      out.push(`<p>Analiza timpului de răspuns (RTA), test exact pentru priorități fixe:
        R = C<sub>i</sub> + Σ<sub>j∈hp(i)</sub> ⌈R / T<sub>j</sub>⌉ C<sub>j</sub>, iterat până nu se mai schimbă.</p>
        <div class="table-wrap"><table><thead><tr><th>Task, în ordinea priorității</th><th>hp(i)</th><th>Iterații</th><th>R</th><th>D</th><th></th></tr></thead>
        <tbody>${rows.join('')}</tbody></table></div>`);
      if (!$('s-preempt').checked) out.push('<p class="note">RTA de mai sus presupune preempțiune; la planificare nepreemptivă trebuie adăugat timpul de blocare B<sub>i</sub>.</p>');
    } else if (policy === 'EDF' || policy === 'LLF') {
      if (an.implicit) {
        out.push(`<p>${an.U <= 1 ? verdict('ok', 'planificabil') : verdict('bad', 'neplanificabil')}
          cu D = T, ${policy} este optim: setul este planificabil dacă și numai dacă U ≤ 1.</p>`);
      } else {
        out.push(`<p>${an.density <= 1 ? verdict('ok', 'planificabil') : verdict('maybe', 'nedecis')}
          cu D &lt; T, testul de densitate Σ C<sub>i</sub>/min(D<sub>i</sub>, T<sub>i</sub>) = ${fmt3(an.density)} ≤ 1 este doar suficient;
          testul exact folosește cererea de procesor h(t).</p>`);
      }
      if (!$('s-preempt').checked) out.push('<p class="note">Rezultatele pentru EDF și LLF presupun preempțiune.</p>');
    } else {
      out.push('<p>' + verdict('maybe', 'fără garanții') + ' FIFO nu ține cont de termene: un job lung întârzie tot ce vine după el.</p>');
    }
    if (an.hasAperiodic) out.push('<p class="note">Taskurile aperiodice nu intră în teste: nu au o margine a cererii de procesor. Un task periodic sau sporadic mai puțin prioritar decât unul aperiodic nu poate primi nicio garanție.</p>');
    if (sched.tasks.some(t => t.type === 'sporadic') || $('s-varC').checked) {
      out.push('<p class="note">Simularea arată o singură realizare; testele de mai sus acoperă cazul cel mai defavorabil (sporadic la intervalul minim, fiecare job cu C complet).</p>');
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
        ? `Înregistrare în curs: t = ${r.now} din ${TY_H} ms. ${label}`
        : `Primul clic pe „${$(clockId).dataset.btn}” pornește o înregistrare nouă de ${TY_H} ms.`;
    }
    r.tick = updateClock;
    return r;
  }
  $('sp-clock').dataset.btn = 'Apasă butonul';
  $('ap-clock').dataset.btn = 'Trimite o cerere';

  /* ---------- periodic ---------- */
  let pSeed = 5;
  const pv = {};
  ['T', 'C', 'Cmin', 'eps', 'n'].forEach(k => { pv[k] = bindRange('p-' + k, renderPeriodic); });
  $('p-seed').addEventListener('click', () => { pSeed++; renderPeriodic(); });

  function renderPeriodic() {
    const T = pv.T(), C = pv.C(), Cmin = Math.min(pv.Cmin(), C), n = pv.n();
    const res = S.periodicRelease({ T, C, Cmin, epsMax: pv.eps(), n, seed: pSeed });
    const mk = (list, ti) => list.map(j => ({
      id: 0, task: ti, k: j.k, r: j.wake, d: Infinity, exec: j.C, start: j.s, finish: j.f,
      segments: [[j.s, j.f]], missed: false, aborted: false, preempted: 0,
      tip: `<span class="sw" style="background:${color(ti)}"></span><b>${ti ? 'așteptare relativă' : 'așteptare absolută'}</b>, jobul ${j.k}<br>` +
        `punct pe grilă r = ${j.grid}<br>trezire la ${j.wake}${ti ? ` (terminarea precedentă + T)` : ''}<br>` +
        `ε = ${j.eps}, pornire s = ${j.s}, C = ${j.C}<br><b>L = s − r = ${j.L}</b>`
    }));
    const jobs = mk(res.abs, 0).concat(mk(res.rel, 1));
    jobs.forEach((j, i) => { j.id = i; });
    const horizon = Math.max(...jobs.map(j => j.finish)) + 2;
    const tasks = [
      { name: 'absolută', type: 'periodic', C, T, D: Infinity },
      { name: 'relativă', type: 'periodic', C, T, D: Infinity }
    ];
    const result = { tasks, jobs, horizon, schedule: [], busy: 0 };
    R.gantt($('p-gantt'), result, {
      gridEvery: T, jobLabels: true,
      rowSubs: ['trezire la rₖ = kT', 'trezire la fₖ + T']
    });
    jobTip(result, $('p-gantt'));

    const a = res.absStats, r = res.relStats;
    $('p-cards').innerHTML = [
      card('Absolut: jitter J', String(a.J), `max L = ${a.maxL}, min L = ${a.maxL - a.J}`),
      card('Absolut: jitter relativ', String(a.Jrel), 'cel mai mare salt între joburi'),
      card('Absolut: deriva', '0', verdict('ok', 'grila rămâne pe loc')),
      card(`Relativ: deriva după ${n} joburi`, String(r.last), r.last > 0 ? verdict('bad', 'crește la fiecare job') : 'fără calcul, fără derivă'),
      card('Relativ: perioada reală medie', fmt2(r.period), `în loc de T = ${T}`),
      card('Frecvența', `${fmt2(1000 / r.period)} Hz`, `în loc de ${fmt2(1000 / T)} Hz`)
    ].join('');

    R.lineChart($('p-lat'), {
      series: [
        { name: 'absolut', color: color(0), points: res.abs.map(j => [j.k, j.L]) },
        { name: 'relativ', color: color(1), points: res.rel.map(j => [j.k, j.L]) }
      ],
      xMax: n - 1, yMin: 0, yMax: Math.max(4, r.maxL, a.maxL), height: 220,
      yTicks: [0, Math.round(Math.max(4, r.maxL, a.maxL) / 2), Math.max(4, r.maxL, a.maxL)],
      xLabel: 'jobul k', yLabel: 'L (ms)'
    });
    $('p-lat-legend').innerHTML = ['absolut', 'relativ'].map((nm, i) =>
      `<span><span class="sw" style="background:${color(i)}"></span>${nm}</span>`).join('');
    const counts = [];
    for (let v = 0; v <= a.maxL; v++) counts.push(res.abs.filter(j => j.L === v).length);
    R.barChart($('p-hist'), {
      bins: counts.map((c, v) => ({ label: String(v), value: c, tip: `L = ${v} ms: <b>${c}</b> joburi` })),
      color: color(0), height: 220, xLabel: 'L (ms)', yLabel: 'joburi'
    });
  }

  /* ---------- sporadic ---------- */
  const SP_DEMO = [12, 13, 14, 15, 16, 48, 70, 75, 118, 160, 163];
  const sv = {};
  ['C', 'T', 'D', 'pC', 'pT'].forEach(k => { sv[k] = bindRange('sp-' + k, renderSporadic); });
  $('sp-policy').addEventListener('change', renderSporadic);
  const spRec = Recorder(renderSporadic, 'sp-clock', 'Apăsați butonul sau tasta spațiu.');
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

  function renderSporadic() {
    spRec.tick();
    const C = sv.C(), Tmin = sv.T(), D = sv.D(), pol = $('sp-policy').value;
    const filt = S.sporadicFilter(spRec.events, Tmin, pol);
    const rels = filt.filter(f => f.release !== null && f.release < TY_H);
    const tasks = [
      { name: 'buton', type: 'sporadic', C, T: Tmin, D, offset: 0, prio: 2, releaseTimes: rels.map(f => f.release) },
      { name: 'reglaj', type: 'periodic', C: sv.pC(), T: sv.pT(), D: sv.pT(), offset: 0, prio: 1 }
    ];
    const res = S.simulate(tasks, { policy: 'FP', horizon: TY_H });
    const btnJobs = res.jobs.filter(j => j.task === 0).sort((x, y) => x.k - y.k);
    btnJobs.forEach((j, i) => {
      const ev = rels[i].event;
      j.tip = `<span class="sw" style="background:${color(0)}"></span><b>buton</b>, jobul ${j.k}<br>` +
        `eveniment la ${ev}${j.r > ev ? `, eliberare amânată la ${j.r}` : ''}<br>termen d = ${j.d}<br>` +
        (j.finish !== null ? `terminat la ${j.finish}: ${j.finish - ev} ms de la eveniment` : 'neterminat') +
        (j.missed ? '<br><b class="bad">✕ termen ratat</b>' : '');
    });
    const kindTxt = { ok: 'a eliberat un job', rejected: 'ignorat: prea aproape de precedentul', deferred: 'eliberare amânată' };
    const marks = filt.map(f => ({
      t: f.event, kind: f.kind, to: f.kind === 'deferred' ? Math.min(f.release, TY_H) : undefined,
      tip: `eveniment la ${f.event}: <b>${kindTxt[f.kind]}</b>${f.kind === 'deferred' ? ` până la ${f.release}` : ''}`
    }));
    R.gantt($('sp-gantt'), res, {
      eventRows: [{ label: 'evenimente', sub: `${spRec.events.length} apăsări`, marks }],
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
      card('Evenimente', String(spRec.events.length), `${relT.length} joburi eliberate`),
      card('Ignorate / amânate', `${rejected} / ${deferred}`, pol === 'none' ? 'nu se impune nimic' : 'impus de cod'),
      card('Cel mai mic interval între eliberări', isFinite(minGap) ? String(minGap) : '—',
        isFinite(minGap) ? (okGap ? verdict('ok', `≥ Tmin = ${Tmin}`) : verdict('bad', `< Tmin = ${Tmin}`)) : ''),
      card('Termene ratate „reglaj”', `${res.stats[1].missed} din ${res.stats[1].jobs}`,
        res.stats[1].missed ? verdict('bad', 'reglajul plătește') : verdict('ok', 'toate la timp')),
      card('Termene ratate „buton”', `${res.stats[0].missed} din ${res.stats[0].jobs}`, ''),
      card('Cel mai lung timp de la eveniment la terminare', lat.length ? String(Math.max(...lat)) : '—',
        deferred ? 'include amânarea' : `D = ${D}`)
    ].join('');

    const an = S.analyse(tasks.map(t => ({ ...t, releaseTimes: undefined })), 'FP');
    const rows = an.rta.map(x => `<tr><td><span class="sw" style="background:${color(x.task)}"></span>${esc(tasks[x.task].name)}</td>
      <td class="iter">${x.steps.join(' → ')}</td><td class="num">${x.R}</td><td class="num">${tasks[x.task].D}</td>
      <td>${x.ok ? verdict('ok', 'R ≤ D') : verdict('bad', 'R > D')}</td></tr>`).join('');
    const allOk = an.rta.every(x => x.ok);
    let concl;
    if (!allOk) concl = verdict('bad', 'setul nu este planificabil') + ' nici dacă intervalul minim ar fi respectat: micșorați C sau măriți Tmin.';
    else if (!isFinite(minGap) || okGap) concl = verdict('ok', 'garanția este valabilă') + ' în înregistrarea de mai sus: eliberările respectă intervalul minim.';
    else concl = verdict('bad', 'garanția nu mai este valabilă') +
      ` în înregistrarea de mai sus: două eliberări la doar ${minGap} ms una de alta, mai puțin decât Tmin = ${Tmin}. ` +
      'Analiza a fost corectă, dar ipoteza ei nu a fost impusă.';
    $('sp-analysis').innerHTML = `<p>Analiza tratează butonul ca pe un task periodic cu perioada $T_{min}$ și prioritate mai mare decât reglajul.
      U = ${fmt3(an.U)}.</p>
      <div class="table-wrap"><table><thead><tr><th>Task</th><th>Iterații RTA</th><th>R</th><th>D</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p>${concl}</p>`.replace(/\$([^$]+)\$/g, (m, g) => tex(g));
  }

  /* ---------- aperiodic ---------- */
  const AP_DEMO = [20, 21, 22, 23, 70, 120, 121, 160];
  const AP_TASKS = [
    { name: 'senzor', type: 'periodic', C: 2, T: 8, D: 8, offset: 0, prio: 2 },
    { name: 'comandă', type: 'periodic', C: 3, T: 12, D: 12, offset: 0, prio: 1 }
  ];
  const av = {};
  ['C', 'Q', 'Ts'].forEach(k => { av[k] = bindRange('ap-' + k, renderAperiodic); });
  $('ap-mode').addEventListener('change', renderAperiodic);
  const apRec = Recorder(renderAperiodic, 'ap-clock', 'Trimiteți cereri.');
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

  const AP_NOTES = {
    high: 'Cererile trec înaintea tuturor: răspund repede, dar o rafală ține procesorul ocupat oricât de mult, iar taskurile periodice își ratează termenele. Niciun test nu poate da garanții.',
    background: 'Cererile rulează doar când niciun task periodic nu are de lucru: taskurile periodice sunt protejate complet, dar cererile așteaptă mult, mai ales când procesorul este încărcat.',
    server: 'Cererile primesc un buget Q la fiecare Ts, cu prioritatea dată de Ts (ca la RM). Cât timp bugetul nu e epuizat, cererile răspund repede; apoi așteaptă reîncărcarea. Pentru analiză, serverul se comportă aproximativ ca un task periodic (Q, Ts), deci cererea lui de procesor are o margine.'
  };

  function renderAperiodic() {
    apRec.tick();
    const mode = $('ap-mode').value, Ca = av.C(), Ts = av.Ts(), Q = Math.min(av.Q(), Ts);
    ['ap-Q', 'ap-Ts'].forEach(id => { $(id).disabled = mode !== 'server'; });
    $('ap-mode-note').textContent = AP_NOTES[mode];
    const res = S.simulateAperiodic({
      tasks: AP_TASKS, requests: apRec.events.map(t => ({ t, C: Ca })), Ca, mode, Q, Ts, horizon: TY_H
    });
    const ai = AP_TASKS.length;
    const reqs = res.jobs.filter(j => j.task === ai);
    reqs.forEach(j => {
      j.tip = `<span class="sw" style="background:${color(ai)}"></span><b>cererea ${j.k}</b><br>sosire la ${j.r}, C = ${j.exec}<br>` +
        (j.start !== null ? `început la ${j.start} (după ${j.start - j.r} ms)<br>` : '') +
        (j.finish !== null ? `<b>terminată la ${j.finish}: R = ${j.finish - j.r}</b>` : 'neterminată în orizont');
    });
    R.gantt($('ap-gantt'), res, {
      cpuRow: true, cursor: apRec.running ? apRec.now : null,
      rowSubs: AP_TASKS.map(t => `C=${t.C}, T=${t.T}`).concat([`C=${Ca}, ${reqs.length} cereri`])
    });
    jobTip(res, $('ap-gantt'));

    $('ap-budget-fig').hidden = mode !== 'server';
    if (mode === 'server') {
      R.lineChart($('ap-budget'), {
        series: [{ name: 'buget rămas', color: color(ai), points: res.budget, step: true }],
        xMax: TY_H, yMin: 0, yMax: Q, yTicks: Q > 1 ? [0, Q] : [0, 1], height: 150,
        cursor: apRec.running ? apRec.now : null, xLabel: 't (ms)', yLabel: 'buget'
      });
    }
    const R_ = reqs.filter(j => j.finish !== null).map(j => j.finish - j.r);
    const pm = res.stats.slice(0, ai).reduce((a, x) => a + x.missed, 0);
    const pj = res.stats.slice(0, ai).reduce((a, x) => a + x.jobs, 0);
    const Up = AP_TASKS.reduce((a, t) => a + t.C / t.T, 0);
    $('ap-cards').innerHTML = [
      card('Termene ratate, taskuri periodice', `${pm} din ${pj}`, pm ? verdict('bad', 'periodicele plătesc') : verdict('ok', 'toate la timp')),
      card('Timp de răspuns mediu al cererilor', R_.length ? fmt2(R_.reduce((a, b) => a + b, 0) / R_.length) : '—', `${R_.length} din ${reqs.length} terminate`),
      card('Cel mai lung timp de răspuns', R_.length ? String(Math.max(...R_)) : '—', `C = ${Ca} pe cerere`),
      card('Utilizarea periodicelor', fmt2(Up), 'senzor + comandă'),
      card('Rezervat pentru cereri', mode === 'server' ? fmt2(Q / Ts) : (mode === 'high' ? 'nelimitat' : 'doar timpul liber'),
        mode === 'server' ? `Q/Ts; total ${fmt2(Up + Q / Ts)}` : '')
    ].join('');
  }

  function showType(type) {
    if (!['periodic', 'sporadic', 'aperiodic'].includes(type)) type = 'periodic';
    tyType = type;
    document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.type === type));
    ['periodic', 'sporadic', 'aperiodic'].forEach(t => { $('ty-' + t).hidden = t !== type; });
    if (type !== 'sporadic') spRec.stop();
    if (type !== 'aperiodic') apRec.stop();
    ({ periodic: renderPeriodic, sporadic: renderSporadic, aperiodic: renderAperiodic })[type]();
  }
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
    history.replaceState(null, '', '#types/' + b.dataset.type);
    showType(b.dataset.type);
  }));
  document.addEventListener('keydown', ev => {
    if (ev.code !== 'Space' || current !== 'types' || tyType !== 'sporadic') return;
    if (/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) return;
    ev.preventDefault();
    $('sp-press').click();
  });

  /* ===================== Legendă: exemplu adnotat ===================== */
  function renderHelp() {
    const res = S.simulate([
      { name: 'motor', type: 'periodic', C: 2, T: 5, D: 5, offset: 0, prio: 2 },
      { name: 'afișaj', type: 'periodic', C: 4, T: 7, D: 7, offset: 0, prio: 1 }
    ], { policy: 'RM', horizon: 15 });
    R.gantt($('h-gantt'), res, { cpuRow: true, annotate: { task: 1, k: 0 } });
    jobTip(res, $('h-gantt'));
  }

  /* ===================== file și adresă ===================== */
  const renderers = { model: renderModel, arrivals: renderArrivals, types: () => showType(tyType), sched: () => runSched(), help: renderHelp };
  let current = 'model';
  function show(tab) {
    if (!renderers[tab]) tab = 'model';
    current = tab;
    document.querySelectorAll('[role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
    document.querySelectorAll('.tab').forEach(s => { s.hidden = s.id !== 'tab-' + tab; });
    if (tab !== 'sched') stopPlay();
    if (tab !== 'types') { spRec.stop(); apRec.stop(); }
    renderers[tab]();
  }
  document.querySelectorAll('[role=tab]').forEach(b => b.addEventListener('click', () => {
    const tab = b.dataset.tab;
    const sub = tab === 'sched' && $('s-preset').value !== 'custom' ? '/' + $('s-preset').value : (tab === 'types' ? '/' + tyType : '');
    history.replaceState(null, '', '#' + tab + sub);
    show(tab);
  }));
  function fromHash() {
    const [tab, preset] = location.hash.replace('#', '').split('/');
    if (tab === 'types' && preset) tyType = preset;
    loadPresetSilently(tab === 'sched' ? preset : null);
    show(tab || 'model');
  }
  function loadPresetSilently(id) {
    const p = presets.find(x => x.id === id) || presets[0];
    $('s-preset').value = p.id;
    sched.tasks = p.tasks.map(t => ({ ...t }));
    $('s-policy').value = p.policy;
    $('s-H').value = p.horizon;
    $('s-preset-note').textContent = p.note;
    sched.cursor = 0;
    buildEditor();
  }
  window.addEventListener('hashchange', fromHash);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => renderers[current](), 120); });
  fromHash();
})();
