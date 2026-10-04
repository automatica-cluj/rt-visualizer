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
      .replace(/\\le/g, '≤').replace(/\\sum/g, 'Σ').replace(/\\tau/g, 'τ')
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
      const id = ev.target.getAttribute && ev.target.getAttribute('data-job');
      if (id === null || id === undefined) { Tip.hide(); return; }
      const j = result.jobs[+id], t = result.tasks[j.task];
      const rows = [
        `<span class="sw" style="background:${color(j.task)}"></span><b>${esc(t.name)}</b>, jobul ${j.k} (${TYPE[t.type]})`,
        `eliberare r = ${j.r}, termen d = ${j.d}`,
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

  /* ===================== 3. Planificare și încărcare ===================== */
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
          <td class="iter">${x.steps.join(' → ')}</td><td class="num">${x.R}</td><td class="num">${t.D}</td>
          <td>${x.ok ? verdict('ok', 'R ≤ D') : verdict('bad', 'R > D')}</td></tr>`;
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
    if (an.hasAperiodic) out.push('<p class="note">Taskurile aperiodice nu intră în teste: nu au o margine a cererii de procesor.</p>');
    if (sched.tasks.some(t => t.type === 'sporadic') || $('s-varC').checked) {
      out.push('<p class="note">Simularea arată o singură realizare; testele de mai sus acoperă cazul cel mai defavorabil (sporadic la intervalul minim, fiecare job cu C complet).</p>');
    }
    $('s-analysis').innerHTML = out.join('');
  }

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
  const renderers = { model: renderModel, arrivals: renderArrivals, sched: () => runSched(), help: renderHelp };
  let current = 'model';
  function show(tab) {
    if (!renderers[tab]) tab = 'model';
    current = tab;
    document.querySelectorAll('[role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
    document.querySelectorAll('.tab').forEach(s => { s.hidden = s.id !== 'tab-' + tab; });
    if (tab !== 'sched') stopPlay();
    renderers[tab]();
  }
  document.querySelectorAll('[role=tab]').forEach(b => b.addEventListener('click', () => {
    const tab = b.dataset.tab;
    history.replaceState(null, '', '#' + (tab === 'sched' && $('s-preset').value !== 'custom' ? 'sched/' + $('s-preset').value : tab));
    show(tab);
  }));
  function fromHash() {
    const [tab, preset] = location.hash.replace('#', '').split('/');
    loadPresetSilently(preset);
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
