/*
 * Desenarea în SVG: diagrama de timp (Gantt) și graficele liniare.
 * Culorile vin din variabile CSS (--s1 ... --s8), deci tema luminoasă și cea
 * întunecată se schimbă doar din css/style.css.
 */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const LEFT = 128, RIGHT = 18;

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, attrs) {
    const t = el('text', Object.assign({ x, y }, attrs || {}), parent);
    t.textContent = str;
    return t;
  }
  const color = i => `var(--s${(i % 8) + 1})`;

  function niceStep(pxPerUnit, minPx) {
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
    return steps.find(s => s * pxPerUnit >= minPx) || 1000;
  }

  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }

  function defs(svg, n) {
    const d = el('defs', {}, svg);
    for (let i = 0; i < n; i++) {
      const p = el('pattern', { id: `hatch-${i}`, width: 6, height: 6,
        patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, d);
      el('rect', { width: 6, height: 6, style: `fill:${color(i)};opacity:0.10` }, p);
      el('line', { x1: 0, y1: 0, x2: 0, y2: 6, style: `stroke:${color(i)};stroke-width:2;opacity:0.55` }, p);
    }
    // vârful săgeții este pe direcția liniei (axa x a markerului)
    const mk = (id, cls) => {
      const m = el('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5,
        markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, d);
      el('path', { d: 'M0,0 L10,5 L0,10 z', class: cls }, m);
    };
    mk('arrow-rel', 'mk-rel');
    mk('arrow-dl', 'mk-dl');
    mk('arrow-miss', 'mk-miss');
    mk('dim', 'mk-dim');
    return d;
  }

  /**
   * Diagrama de timp.
   * opts: { cursor, cpuRow, showReady, annotate: {task, k}, from, to, rowLabels }
   * Întoarce funcția x(t), folosită de aplicație pentru cursor și clicuri.
   */
  function gantt(svg, result, opts) {
    opts = opts || {};
    clear(svg);
    const tasks = result.tasks;
    const from = opts.from || 0, to = opts.to || result.horizon;
    const W = Math.max(svg.parentNode.clientWidth || 800, 560);
    const rowH = 50;
    const ann = opts.annotate;
    const annTop = ann ? 58 : 0, annBottom = ann ? 30 : 0;
    const evRows = opts.eventRows || [];
    const rows = evRows.length + tasks.length + (opts.cpuRow ? 1 : 0);
    const top = 12;
    const taskTop = top + evRows.length * rowH;
    const H = top + rows * rowH + annTop + annBottom + 34;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    defs(svg, tasks.length);

    const scale = (W - LEFT - RIGHT) / (to - from);
    const x = t => LEFT + (t - from) * scale;
    const rowY = i => taskTop + i * rowH + (ann && i > ann.task ? annTop + annBottom : 0) +
      (ann && i === ann.task ? annTop : 0);
    const plotBottom = top + rows * rowH + annTop + annBottom;

    // grilă și axă
    const step = niceStep(scale, 34);
    const g = el('g', { class: 'grid' }, svg);
    if (scale >= 7) {
      for (let t = Math.ceil(from); t <= to; t++) {
        el('line', { x1: x(t), x2: x(t), y1: top, y2: plotBottom, class: 'grid-minor' }, g);
      }
    }
    for (let t = Math.ceil(from / step) * step; t <= to; t += step) {
      el('line', { x1: x(t), x2: x(t), y1: top, y2: plotBottom + 4, class: 'grid-major' }, g);
      text(g, x(t), plotBottom + 18, String(t), { class: 'axis-label', 'text-anchor': 'middle' });
    }
    text(g, W - RIGHT, plotBottom + 32, 't (ms)', { class: 'axis-label', 'text-anchor': 'end' });
    // grila ideală a unui task periodic: r_k = kT
    if (opts.gridEvery) {
      for (let t = Math.ceil(from / opts.gridEvery) * opts.gridEvery; t <= to; t += opts.gridEvery) {
        el('line', { x1: x(t), x2: x(t), y1: top, y2: plotBottom, class: 'grid-ideal' }, g);
      }
    }

    const hits = el('g', { class: 'hits' }, svg);
    // desenele nu prind mouse-ul, ca evenimentele să ajungă la dreptunghiurile .hit
    const marks = el('g', { 'pointer-events': 'none' }, svg);
    const tips = [];
    svg._tips = tips;
    const tipHit = (x0, x1, y0, html) => {
      tips.push(html);
      el('rect', { x: x0, y: y0, width: Math.max(x1 - x0, 8), height: rowH - 4, class: 'hit', 'data-tip': tips.length - 1 }, hits);
    };

    // rânduri de evenimente (de exemplu, apăsările unui buton), deasupra taskurilor
    evRows.forEach((row, ri) => {
      const y0 = top + ri * rowH, base = y0 + rowH - 10;
      text(marks, 10, base - 15, row.label, { class: 'row-label' });
      if (row.sub) text(marks, 10, base - 1, row.sub, { class: 'row-sub' });
      el('line', { x1: LEFT, x2: W - RIGHT, y1: base, y2: base, class: 'baseline' }, marks);
      row.marks.forEach(m => {
        if (m.t < from || m.t > to) return;
        const cx = x(m.t);
        if (m.to !== undefined && m.to > m.t) {
          el('line', { x1: cx, x2: x(Math.min(m.to, to)), y1: base - 6, y2: base - 6,
            class: 'defer-line', 'marker-end': 'url(#arrow-rel)' }, marks);
        }
        el('line', { x1: cx, x2: cx, y1: base, y2: base - 22, class: m.kind === 'rejected' ? 'ev-stem ev-rej' : 'ev-stem' }, marks);
        if (m.kind === 'rejected') text(marks, cx, base - 25, '✕', { class: 'ev-x', 'text-anchor': 'middle' });
        else el('circle', { cx, cy: base - 24, r: 4, class: m.kind === 'deferred' ? 'ev-dot ev-def' : 'ev-dot' }, marks);
        if (m.tip) tipHit(cx - 5, (m.to !== undefined ? x(Math.min(m.to, to)) : cx) + 5, y0 + 2, m.tip);
      });
    });

    tasks.forEach((task, ti) => {
      const y0 = rowY(ti), base = y0 + rowH - 10;
      const lbl = opts.rowLabels ? opts.rowLabels[ti] : task.name;
      el('rect', { x: 10, y: base - 24, width: 10, height: 10, rx: 2, style: `fill:${color(ti)}` }, marks);
      text(marks, 26, base - 15, lbl, { class: 'row-label' });
      text(marks, 26, base - 1, opts.rowSubs ? opts.rowSubs[ti] : paramLabel(task), { class: 'row-sub' });
      el('line', { x1: LEFT, x2: W - RIGHT, y1: base, y2: base, class: 'baseline' }, marks);

      result.jobs.filter(j => j.task === ti).forEach(j => {
        const end = j.finish !== null ? j.finish : (j.aborted ? Math.min(j.d, to) : to);
        // timpul petrecut în Ready: de la eliberare la terminare, în afara execuției
        if (opts.showReady !== false && end > j.r) {
          let cur = j.r;
          const gaps = [];
          j.segments.forEach(([s, e]) => { if (s > cur) gaps.push([cur, s]); cur = e; });
          if (end > cur) gaps.push([cur, end]);
          gaps.forEach(([s, e]) => {
            if (e <= from || s >= to) return;
            el('rect', { x: x(Math.max(s, from)), y: base - 16, width: (Math.min(e, to) - Math.max(s, from)) * scale,
              height: 14, style: `fill:url(#hatch-${ti})` }, marks);
          });
        }
        j.segments.forEach(([s, e]) => {
          if (e <= from || s >= to) return;
          const w = (Math.min(e, to) - Math.max(s, from)) * scale;
          el('rect', { x: x(Math.max(s, from)) + 0.5, y: base - 20, width: Math.max(w - 1, 1), height: 20,
            rx: 3, style: `fill:${color(ti)}`, class: j.missed ? 'exec exec-late' : 'exec' }, marks);
          if (w > 22 && opts.jobLabels !== false) {
            text(marks, x(Math.max(s, from)) + w / 2, base - 6, `J${j.k}`, { class: 'exec-label', 'text-anchor': 'middle' });
          }
        });
        if (j.r >= from && j.r <= to) {
          el('line', { x1: x(j.r) - 1.5, x2: x(j.r) - 1.5, y1: base, y2: base - 38,
            class: 'rel', 'marker-end': 'url(#arrow-rel)' }, marks);
        }
        if (j.d >= from && j.d <= to) {
          const miss = j.missed;
          el('line', { x1: x(j.d) + 1.5, x2: x(j.d) + 1.5, y1: base - 38, y2: base - 1,
            class: miss ? 'dl dl-miss' : 'dl', 'marker-end': miss ? 'url(#arrow-miss)' : 'url(#arrow-dl)',
            style: miss ? '' : `stroke:${color(ti)}` }, marks);
          if (miss) {
            const atEnd = x(j.d) + 50 > W - RIGHT;
            text(marks, x(j.d) + (atEnd ? -5 : 5), base - 30, '✕ ratat',
              { class: 'miss-label', 'text-anchor': atEnd ? 'end' : 'start' });
          }
        }
        const hx0 = x(Math.max(j.r, from)), hx1 = x(Math.min(isFinite(j.d) ? Math.max(end, j.d) : end, to));
        if (hx1 > hx0) {
          el('rect', { x: hx0, y: y0 + 2, width: hx1 - hx0, height: rowH - 4,
            class: 'hit', 'data-job': j.id }, hits);
        }
      });

      if (ann && ann.task === ti) annotate(marks, result, ti, ann.k, x, base, scale);
    });

    if (opts.cpuRow) {
      const y0 = rowY(tasks.length), base = y0 + rowH - 10;
      text(marks, 10, base - 15, 'Procesor', { class: 'row-label' });
      const idle = result.horizon - result.busy;
      text(marks, 10, base - 1, `ocupat ${Math.round(100 * result.busy / result.horizon)} %`, { class: 'row-sub' });
      el('line', { x1: LEFT, x2: W - RIGHT, y1: base, y2: base, class: 'baseline' }, marks);
      let s = 0;
      for (let t = 1; t <= result.horizon; t++) {
        if (t === result.horizon || result.schedule[t] !== result.schedule[s]) {
          const id = result.schedule[s];
          if (id !== null && t > from && s < to) {
            const ti = result.jobs[id].task;
            el('rect', { x: x(Math.max(s, from)) + 0.5, y: base - 20,
              width: Math.max((Math.min(t, to) - Math.max(s, from)) * scale - 1, 1), height: 20, rx: 3,
              style: `fill:${color(ti)}` }, marks);
          } else if (id === null && t > from && s < to) {
            el('rect', { x: x(Math.max(s, from)), y: base - 3,
              width: (Math.min(t, to) - Math.max(s, from)) * scale, height: 3, class: 'idle' }, marks);
          }
          s = t;
        }
      }
      void idle;
    }

    if (opts.cursor !== undefined && opts.cursor !== null) {
      const cx = x(opts.cursor);
      el('line', { x1: cx, x2: cx, y1: top - 6, y2: plotBottom, class: 'cursor' }, svg);
      const lab = `t = ${opts.cursor}`;
      el('rect', { x: cx - 22, y: plotBottom + 4, width: 44, height: 18, rx: 4, class: 'cursor-tag' }, svg);
      text(svg, cx, plotBottom + 17, lab, { class: 'cursor-text', 'text-anchor': 'middle' });
    }
    return { x, toTime: px => from + (px - LEFT) / scale, left: LEFT, right: W - RIGHT };
  }

  function paramLabel(task) {
    const kind = { periodic: 'T', sporadic: 'Tmin', aperiodic: 'T̄' }[task.type];
    const d = task.D !== task.T || task.type === 'aperiodic' ? `, D=${task.D}` : '';
    return `C=${task.C}, ${kind}=${task.T}${d}`;
  }

  /** Cote pe primul job: T, D deasupra rândului, R dedesubt, C pe execuție. */
  function annotate(g, result, ti, k, x, base, scale) {
    const jobs = result.jobs.filter(j => j.task === ti);
    const j = jobs[k], nxt = jobs[k + 1];
    if (!j) return;
    const dim = (t0, t1, y, label, cls) => {
      if (t1 <= t0) return;
      el('line', { x1: x(t0), x2: x(t1), y1: y, y2: y, class: `dimline ${cls || ''}`,
        'marker-start': 'url(#dim)', 'marker-end': 'url(#dim)' }, g);
      el('line', { x1: x(t0), x2: x(t0), y1: y - 5, y2: y + 5, class: 'dimtick' }, g);
      el('line', { x1: x(t1), x2: x(t1), y1: y - 5, y2: y + 5, class: 'dimtick' }, g);
      const mid = (x(t0) + x(t1)) / 2;
      const tw = label.length * 6.6 + 8;
      el('rect', { x: mid - tw / 2, y: y - 9, width: tw, height: 16, rx: 3, class: 'dimbg' }, g);
      text(g, mid, y + 3, label, { class: 'dimtext', 'text-anchor': 'middle' });
    };
    const task = result.tasks[ti];
    if (nxt) dim(j.r, nxt.r, base - 88, `T = ${nxt.r - j.r}`);
    dim(j.r, j.d, base - 64, `D = ${task.D}`);
    if (j.finish !== null) dim(j.r, j.finish, base + 18, `R = ${j.finish - j.r}`, 'dim-r');
    text(g, x(j.r) - 5, base - 30, `r${sub(k)}`, { class: 'ann-point', 'text-anchor': 'end' });
    text(g, x(j.d) + 4, base - 42, `d${sub(k)}`, { class: 'ann-point' });
    void scale;
  }
  function sub(k) { return String(k).split('').map(c => '₀₁₂₃₄₅₆₇₈₉'[+c]).join(''); }

  /**
   * Grafic liniar simplu, o singură axă y.
   * cfg: { series: [{name, points:[[x,y]], color, dash, step}], xMax, yMin, yMax,
   *        yFmt, refLines: [{y, label}], cursor, xLabel, height }
   */
  function lineChart(svg, cfg) {
    clear(svg);
    const W = Math.max(svg.parentNode.clientWidth || 800, 420);
    const H = cfg.height || 200;
    const top = 24, bottom = 34;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    const xMin = cfg.xMin || 0;
    const sx = (W - LEFT - RIGHT) / (cfg.xMax - xMin);
    const x = v => LEFT + (v - xMin) * sx;
    const sy = (H - top - bottom) / (cfg.yMax - cfg.yMin);
    const y = v => H - bottom - (v - cfg.yMin) * sy;
    const fmt = cfg.yFmt || (v => String(v));

    const g = el('g', {}, svg);
    const yt = cfg.yTicks || [cfg.yMin, (cfg.yMin + cfg.yMax) / 2, cfg.yMax];
    yt.forEach(v => {
      el('line', { x1: LEFT, x2: W - RIGHT, y1: y(v), y2: y(v), class: v === 0 ? 'baseline' : 'grid-major' }, g);
      text(g, LEFT - 8, y(v) + 4, fmt(v), { class: 'axis-label', 'text-anchor': 'end' });
    });
    const step = niceStep(sx, 34);
    for (let t = Math.ceil(xMin / step) * step; t <= cfg.xMax; t += step) {
      text(g, x(t), H - bottom + 16, String(t), { class: 'axis-label', 'text-anchor': 'middle' });
    }
    if (cfg.xLabel) text(g, W - RIGHT, H - 4, cfg.xLabel, { class: 'axis-label', 'text-anchor': 'end' });
    if (cfg.yLabel) text(g, LEFT, 12, cfg.yLabel, { class: 'row-sub' });

    (cfg.refLines || []).forEach(r => {
      el('line', { x1: LEFT, x2: W - RIGHT, y1: y(r.y), y2: y(r.y), class: 'refline' }, g);
      const left = r.side === 'left';
      text(g, left ? LEFT + 4 : W - RIGHT - 4, y(r.y) - 5, r.label,
        { class: 'ref-label', 'text-anchor': left ? 'start' : 'end' });
    });

    cfg.series.forEach(s => {
      if (!s.points.length) return;
      let d = '';
      s.points.forEach(([px, py], i) => {
        if (i === 0) d += `M${x(px)},${y(py)}`;
        else if (s.step) d += `H${x(px)}V${y(py)}`;
        else d += `L${x(px)},${y(py)}`;
      });
      el('path', { d, class: 'series', style: `stroke:${s.color}`, 'stroke-dasharray': s.dash || '' }, g);
    });

    if (cfg.cursor !== undefined && cfg.cursor !== null) {
      el('line', { x1: x(cfg.cursor), x2: x(cfg.cursor), y1: top, y2: H - bottom, class: 'cursor' }, svg);
    }

    // stratul de hover: linie verticală și valorile seriilor în tooltip
    const hover = el('line', { y1: top, y2: H - bottom, class: 'crosshair', visibility: 'hidden' }, svg);
    const dots = cfg.series.map(s => el('circle', { r: 4, class: 'hover-dot', style: `fill:${s.color}`, visibility: 'hidden' }, svg));
    const hitArea = el('rect', { x: LEFT, y: top, width: W - LEFT - RIGHT, height: H - top - bottom, class: 'hit-area' }, svg);
    const valueAt = (s, t) => {
      const pts = s.points;
      if (!pts.length || t < pts[0][0] || t > pts[pts.length - 1][0]) return null;
      let v = null;
      for (const [px, py] of pts) { if (px <= t) v = py; else break; }
      return v;
    };
    hitArea.addEventListener('mousemove', ev => {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (W / r.width);
      const t = Math.round(xMin + (px - LEFT) / sx);
      hover.setAttribute('x1', x(t)); hover.setAttribute('x2', x(t));
      hover.setAttribute('visibility', 'visible');
      const rows = [`<b>t = ${t}</b>`];
      cfg.series.forEach((s, i) => {
        const v = valueAt(s, t);
        if (v === null) { dots[i].setAttribute('visibility', 'hidden'); return; }
        dots[i].setAttribute('cx', x(t)); dots[i].setAttribute('cy', y(v));
        dots[i].setAttribute('visibility', 'visible');
        rows.push(`<span class="sw" style="background:${s.color}"></span>${s.name}: <b>${fmt(v)}</b>`);
      });
      root.RTTip.show(ev, rows.join('<br>'));
    });
    hitArea.addEventListener('mouseleave', () => {
      hover.setAttribute('visibility', 'hidden');
      dots.forEach(d => d.setAttribute('visibility', 'hidden'));
      root.RTTip.hide();
    });
  }


  /**
   * Histogramă simplă: cfg = { bins: [{ label, value, tip }], color, height, xLabel, yLabel }.
   */
  function barChart(svg, cfg) {
    clear(svg);
    const W = Math.max(svg.parentNode.clientWidth || 600, 320);
    const H = cfg.height || 180, top = 24, bottom = 34, left = 48, right = 12;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    const n = cfg.bins.length;
    const max = Math.max(1, ...cfg.bins.map(b => b.value));
    const bw = (W - left - right) / n;
    const y = v => H - bottom - v * (H - top - bottom) / max;
    const g = el('g', {}, svg);
    [0, Math.ceil(max / 2), max].forEach(v => {
      el('line', { x1: left, x2: W - right, y1: y(v), y2: y(v), class: v === 0 ? 'baseline' : 'grid-major' }, g);
      text(g, left - 6, y(v) + 4, String(v), { class: 'axis-label', 'text-anchor': 'end' });
    });
    if (cfg.yLabel) text(g, left, 12, cfg.yLabel, { class: 'row-sub' });
    if (cfg.xLabel) text(g, W - right, H - 4, cfg.xLabel, { class: 'axis-label', 'text-anchor': 'end' });
    const every = Math.ceil(n / Math.max(1, Math.floor((W - left - right) / 28)));
    cfg.bins.forEach((b, i) => {
      const x0 = left + i * bw;
      if (b.value > 0) {
        const h = H - bottom - y(b.value);
        el('path', { d: roundTop(x0 + 1, y(b.value), Math.max(bw - 2, 1), h, Math.min(4, bw / 3, h)),
          style: `fill:${cfg.color}` }, g);
      }
      if (i % every === 0) text(g, x0 + bw / 2, H - bottom + 16, b.label, { class: 'axis-label', 'text-anchor': 'middle' });
      const hit = el('rect', { x: x0, y: top, width: bw, height: H - top - bottom, class: 'hit-area' }, svg);
      hit.addEventListener('mousemove', ev => root.RTTip.show(ev, b.tip || `${b.label}: <b>${b.value}</b>`));
      hit.addEventListener('mouseleave', () => root.RTTip.hide());
    });
  }
  function roundTop(x, y, w, h, r) {
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  /** Tooltip comun tuturor graficelor. */
  const RTTip = {
    node: null,
    show(ev, html) {
      if (!this.node) {
        this.node = document.createElement('div');
        this.node.className = 'tooltip';
        document.body.appendChild(this.node);
      }
      this.node.innerHTML = html;
      this.node.style.display = 'block';
      const pad = 14, w = this.node.offsetWidth, h = this.node.offsetHeight;
      let left = ev.clientX + pad, topY = ev.clientY + pad;
      if (left + w > window.innerWidth - 8) left = ev.clientX - w - pad;
      if (topY + h > window.innerHeight - 8) topY = ev.clientY - h - pad;
      this.node.style.left = left + 'px';
      this.node.style.top = topY + 'px';
    },
    hide() { if (this.node) this.node.style.display = 'none'; }
  };

  root.RTRender = { gantt, lineChart, barChart, color };
  root.RTTip = RTTip;
})(window);
