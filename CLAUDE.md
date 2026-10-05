# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

An interactive, static web page (HTML + CSS + plain JavaScript, no build step,
no dependencies) that lets students of the UTCN **Real-Time Systems** course
see the concepts on a time axis. It is published on GitHub Pages
(`https://automatica-cluj.github.io/rt-visualizer/`) by
`.github/workflows/pages.yml`, which runs the tests and deploys
`index.html`, `css/` and `js/` on every push to `main`.

The course notes live in the separate repository `automatica-cluj/rt-course`
(MkDocs, Romanian). The page follows their terminology and notation
(`course/docs/annexes/notation.md`, `annexes/glossary.md`) and refers to
course pages by number (3.2, 4.4, 6.3, ...). Examples were checked against
those pages; keep them consistent when editing.

## Tabs

1. **Modelul de task**: r0, C, T, D, R, laxity, one optional higher-priority task.
2. **Periodic, sporadic, aperiodic**: the three release patterns side by side.
3. **Fiecare tip în detaliu**: periodic (absolute vs relative delay, drift,
   jitter), sporadic (live button presses, enforcing Tmin), aperiodic
   (highest priority, background, budget server).
4. **Planificare și încărcare**: task-set editor, RM/DM/FP/EDF/LLF/FIFO,
   cursor with "why does this job run", load chart, LL/hyperbolic/RTA/EDF tests.
5. **Inversiunea de prioritate**: single-job tasks with programs such as
   `1 [S 2]`, protocols none/PIP/ICPP/PCP, lock rows, deadlock, B_i bounds (6.3).
6. **Legendă**.

Deep links: `#model`, `#arrivals`, `#types/periodic|sporadic|aperiodic`,
`#sched/<preset id>`, `#res/<preset id>`; `?lang=en|ro` forces the language.

## Layout

```text
index.html         all tabs; static text in Romanian with data-i18n keys
css/style.css      light/dark tokens, layout, SVG classes
js/i18n.js         language state, L(ro, en), English text for the data-i18n keys
js/sim.js          engine, no DOM (also used by the Node tests)
js/render.js       SVG drawing: gantt, resGantt (locks), lineChart, barChart
js/presets.js      examples for tab 4 (RTPresets) and tab 5 (RTResPresets)
js/app.js          wiring of controls, explanations, cards, tables
tests/*.test.js    node --test; engine checked against course examples
docs/*.png         README screenshots
```

## Commands

```bash
npm test                         # node --test tests/*.test.js (must stay green)
python3 -m http.server 8000      # or open index.html directly
```

Visual checks were done with Playwright (Chromium preinstalled in the cloud
container; run scripts with `NODE_PATH=$(npm root -g)`). After UI changes,
load every tab in both languages, check for console errors, horizontal
overflow at 390 px width, and leftover Romanian text in English mode.

## Conventions

- **Two languages.** Static text stays Romanian in `index.html`; each element
  has `data-i18n="<section>.<n>"` (attributes: `data-i18n-title`,
  `data-i18n-aria`) and its English text goes in `EN` in `js/i18n.js`.
  `tests/i18n.test.js` fails if a key has no English text or an English key is
  unused. Text produced by code is written as `L('română', 'English')`; preset
  titles, notes and task names are `{ ro, en }` pairs. Numbers use a decimal
  comma in Romanian and a point in English (`I.num`).
- **Romanian style** follows `rt-course/CLAUDE.md`: correct diacritics (ș, ț
  with comma below), "mai prioritar / mai puțin prioritar" (no spatial words
  for priority), "taskuri", "termen-limită / termene-limită", "zăvor" for lock.
- **English terms** are the standard ones: release, deadline, response time,
  laxity, start latency, absolute/relative delay, lock, critical section,
  priority inheritance, immediate ceiling, push-through blocking, ceiling blocking.
- Every claim shown to students (preset notes, "De încercat / Try this" boxes)
  must be checked on the simulator before it is written.
- Each diagram has a symbol key (`<div class="key" data-key="...">`, items in
  `KEY` in `app.js`); new visual encodings need a key item and a Legend entry.
- Colors come from CSS variables `--s1..--s8` (validated categorical palette);
  status colors `--good`, `--bad`, `--maybe` always come with an icon and text.

## Engine semantics (js/sim.js)

- Discrete time, one core, no context-switch cost; one tick = "1 ms".
- Fixed-priority ties: the task higher in the table wins; EDF ties likewise;
  LLF keeps the running job on a tie.
- `simulateAperiodic` server: sporadic-server replenishment (each consumed
  portion returns Ts after it started), so at most Q in any window of Ts and
  RTA with the server as a periodic task (Q, Ts) is valid (tested).
- `simulateResources`: a job counts as blocked only after it has actually
  requested the lock; PIP is transitive; PCP uses the system ceiling of locks
  held by other jobs; deadlock is detected as a cycle in the wait-for graph.
- RTA assumes the critical instant; with non-zero offsets the simulation can
  show smaller R (a note in tab 4 explains this; tested as a safe bound).

## Open ideas, not started

- Links or iframes from the course pages (3.2, 4.x, 6.3) to the matching views.
- Periodic tasks with locks (to compare RTA with blocking against simulation,
  e.g. the four-task worked example in 6.3; it needs 0.5 ms steps).
- A native-speaker read of the English "Try this" boxes and cursor explanations.
- Interrupts (part V): ISR entry cost, deferred handler task, disabled interrupts.
