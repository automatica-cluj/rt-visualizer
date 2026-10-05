/*
 * Exemplele din meniul „Exemplu” (fila 4). Fiecare are un identificator
 * folosit în adresă: index.html#sched/rm-edf deschide direct exemplul.
 * Câmpuri task: name, type (periodic | sporadic | aperiodic), C, T, D,
 * offset (prima eliberare), prio (doar pentru FP; număr mai mare = prioritate mai mare).
 * Textele care se traduc sunt perechi { ro, en }.
 */
(function () {
  const t = (ro, en) => ({ ro, en });

  window.RTPresets = [
    {
      id: 'senzor',
      title: t('Senzor, comandă, jurnal (3.2)', 'Sensor, command, logger (3.2)'),
      note: t('Setul din pagina 3.2: U = 0,6, hiperperioada H = 40. Procesorul rămâne liber 16 ms din fiecare 40.',
        'The set from page 3.2: U = 0.6, hyperperiod H = 40. The processor stays idle 16 ms out of every 40.'),
      policy: 'RM', horizon: 40,
      tasks: [
        { name: t('senzor', 'sensor'), type: 'periodic', C: 2, T: 10, D: 10, offset: 0, prio: 3 },
        { name: t('comandă', 'command'), type: 'periodic', C: 4, T: 20, D: 20, offset: 0, prio: 2 },
        { name: t('jurnal', 'logger'), type: 'periodic', C: 8, T: 40, D: 40, offset: 0, prio: 1 }
      ]
    },
    {
      id: 'critic',
      title: t('Instantul critic (3.2)', 'The critical instant (3.2)'),
      note: t('Cu eliberări simultane, R₂ = 8. Mutați prima eliberare a lui τ₁ la 3 și R₂ scade la 6: cel mai rău caz este eliberarea simultană.',
        'With simultaneous releases, R₂ = 8. Move the first release of τ₁ to 3 and R₂ drops to 6: the worst case is the simultaneous release.'),
      policy: 'RM', horizon: 20,
      tasks: [
        { name: 'τ1', type: 'periodic', C: 2, T: 5, D: 5, offset: 0, prio: 2 },
        { name: 'τ2', type: 'periodic', C: 4, T: 10, D: 10, offset: 0, prio: 1 }
      ]
    },
    {
      id: 'rm-edf',
      title: t('RM ratează, EDF reușește (4.2, 4.5)', 'RM fails, EDF succeeds (4.2, 4.5)'),
      note: t('U ≈ 0,97 depășește limita Liu & Layland (0,83). Sub RM, jobul 0 al lui „afișaj” termină la 8 > 7. Comutați pe EDF: niciun termen ratat.',
        'U ≈ 0.97 exceeds the Liu & Layland bound (0.83). Under RM, job 0 of “display” finishes at 8 > 7. Switch to EDF: no deadline is missed.'),
      policy: 'RM', horizon: 35,
      tasks: [
        { name: 'motor', type: 'periodic', C: 2, T: 5, D: 5, offset: 0, prio: 2 },
        { name: t('afișaj', 'display'), type: 'periodic', C: 4, T: 7, D: 7, offset: 0, prio: 1 }
      ]
    },
    {
      id: 'dm',
      title: t('Termen constrâns: RM față de DM (4.3)', 'Constrained deadline: RM versus DM (4.3)'),
      note: t('„alarmă” are D = 3 < T = 10. RM îi dă prioritate mică pentru că perioada e mare și termenul e ratat; DM ordonează după D și setul devine planificabil.',
        '“alarm” has D = 3 < T = 10. RM gives it a low priority because its period is long, and the deadline is missed; DM orders by D and the set becomes schedulable.'),
      policy: 'RM', horizon: 20,
      tasks: [
        { name: t('eșantionare', 'sampling'), type: 'periodic', C: 2, T: 5, D: 5, offset: 0, prio: 1 },
        { name: t('alarmă', 'alarm'), type: 'periodic', C: 2, T: 10, D: 3, offset: 0, prio: 2 }
      ]
    },
    {
      id: 'rta',
      title: t('Analiza timpului de răspuns (4.4)', 'Response time analysis (4.4)'),
      note: t('U ≈ 0,81 < 1, dar peste limita pentru 3 taskuri (0,78): testul de utilizare nu decide. RTA dă R₃ = 10 ≤ 13, iar simularea arată aceeași valoare.',
        'U ≈ 0.81 < 1, but above the bound for 3 tasks (0.78): the utilization test cannot decide. RTA gives R₃ = 10 ≤ 13, and the simulation shows the same value.'),
      policy: 'RM', horizon: 52,
      tasks: [
        { name: 'τ1', type: 'periodic', C: 1, T: 4, D: 4, offset: 0, prio: 3 },
        { name: 'τ2', type: 'periodic', C: 2, T: 6, D: 6, offset: 0, prio: 2 },
        { name: 'τ3', type: 'periodic', C: 3, T: 13, D: 13, offset: 0, prio: 1 }
      ]
    },
    {
      id: 'overload',
      title: t('Supraîncărcare, U > 1 (4.8)', 'Overload, U > 1 (4.8)'),
      note: t('U ≈ 1,23. Sub RM ratează doar taskurile mai puțin prioritare. Sub EDF, ratările se propagă la toate taskurile (efect de domino). Încercați și „abandonează jobul la termenul ratat”.',
        'U ≈ 1.23. Under RM only the lower-priority tasks miss. Under EDF, the misses spread to all tasks (domino effect). Also try “abort the job at a missed deadline”.'),
      policy: 'EDF', horizon: 70,
      tasks: [
        { name: t('reglaj', 'control'), type: 'periodic', C: 3, T: 5, D: 5, offset: 0, prio: 3 },
        { name: t('filtru', 'filter'), type: 'periodic', C: 3, T: 7, D: 7, offset: 0, prio: 2 },
        { name: t('raport', 'report'), type: 'periodic', C: 2, T: 10, D: 10, offset: 0, prio: 1 }
      ]
    },
    {
      id: 'mixed',
      title: t('Periodic, sporadic și aperiodic împreună (3.2)', 'Periodic, sporadic and aperiodic together (3.2)'),
      note: t('Butonul este sporadic (cel mult o apăsare la 15 ms), diagnoza este aperiodică și are prioritatea cea mai mică. Apăsați „Alt scenariu aleator” și urmăriți diagnoza.',
        'The button is sporadic (at most one press every 15 ms); diagnostics is aperiodic and has the lowest priority. Press “New random scenario” and watch the diagnostics task.'),
      policy: 'FP', horizon: 100,
      tasks: [
        { name: t('senzor', 'sensor'), type: 'periodic', C: 2, T: 10, D: 10, offset: 0, prio: 3 },
        { name: t('buton', 'button'), type: 'sporadic', C: 1, T: 15, D: 5, offset: 3, prio: 4 },
        { name: t('diagnoză', 'diagnostics'), type: 'aperiodic', C: 3, T: 20, D: 30, offset: 1, prio: 1 }
      ]
    },
    {
      id: 'nonpreempt',
      title: t('Nepreemptiv: blocare de un task mai puțin prioritar (3.3)', 'Non-preemptive: blocking by a lower-priority task (3.3)'),
      note: t('Debifați „preemptiv”: când „jurnal” a apucat procesorul, „senzor” trebuie să aștepte până termină, deși este mai prioritar, și își ratează termenul.',
        'Uncheck “preemptive”: once “logger” has the processor, “sensor” must wait until it finishes, even though it has a higher priority, and misses its deadline.'),
      policy: 'RM', horizon: 40,
      tasks: [
        { name: t('senzor', 'sensor'), type: 'periodic', C: 1, T: 5, D: 3, offset: 1, prio: 2 },
        { name: t('jurnal', 'logger'), type: 'periodic', C: 6, T: 20, D: 20, offset: 0, prio: 1 }
      ]
    },
    {
      id: 'llf',
      title: t('EDF față de LLF (4.5, 4.6)', 'EDF versus LLF (4.5, 4.6)'),
      note: t('Ambii algoritmi respectă termenele, dar ordinea joburilor diferă. Comparați numărul de preempțiuni din carduri pentru EDF și LLF.',
        'Both algorithms meet the deadlines, but the order of the jobs differs. Compare the number of preemptions in the cards for EDF and LLF.'),
      policy: 'LLF', horizon: 24,
      tasks: [
        { name: 'A', type: 'periodic', C: 2, T: 6, D: 6, offset: 0, prio: 3 },
        { name: 'B', type: 'periodic', C: 2, T: 8, D: 8, offset: 0, prio: 2 },
        { name: 'C', type: 'periodic', C: 4, T: 12, D: 12, offset: 0, prio: 1 }
      ]
    }
  ];

  /*
   * Scenariile din fila 5, după pagina 6.3. Program: un număr = calcul în afara zăvoarelor,
   * [S n] = n ms în secțiunea critică pe zăvorul S; secțiunile se pot imbrica.
   */
  window.RTResPresets = [
    {
      id: 'blocare',
      title: t('Blocare mărginită: H și L (6.3, secțiunea 1)', 'Bounded blocking: H and L (6.3, section 1)'),
      note: t('L ia zăvorul S la 0. H este eliberat la 1 și cere zăvorul la 2: așteaptă 3 ms, cât restul secțiunii critice a lui L. Este o inversiune mărginită, prețul inevitabil al unui zăvor.',
        'L takes lock S at 0. H is released at 1 and requests the lock at 2: it waits 3 ms, the rest of the critical section of L. This is a bounded inversion, the unavoidable price of a lock.'),
      protocol: 'none',
      tasks: [
        { name: 'H', prio: 3, r: 1, prog: '1 [S 2]' },
        { name: 'L', prio: 1, r: 0, prog: '[S 4] 1' }
      ]
    },
    {
      id: 'pathfinder',
      title: t('Inversiune nemărginită: H, M, L (6.3, Mars Pathfinder)', 'Unbounded inversion: H, M, L (6.3, Mars Pathfinder)'),
      note: t('M nu folosește zăvorul, dar îl preemptează pe L cât timp H așteaptă: H este blocat 11 ms, din care 8 ms sunt calculul lui M. Alegeți moștenirea priorității sau un plafon.',
        'M does not use the lock, but it preempts L while H waits: H is blocked for 11 ms, 8 of which are the computation of M. Choose priority inheritance or a ceiling.'),
      protocol: 'none',
      tasks: [
        { name: 'H', prio: 3, r: 1, prog: '1 [S 2]' },
        { name: 'M', prio: 2, r: 3, prog: '8' },
        { name: 'L', prio: 1, r: 0, prog: '[S 4] 1' }
      ]
    },
    {
      id: 'lant',
      title: t('Blocare în lanț: două zăvoare (6.3, secțiunea 3)', 'Chained blocking: two locks (6.3, section 3)'),
      note: t('H folosește pe rând S1 și S2; L1 ține S1, iar L2 ține S2 când este eliberat H. Cu moștenire, H plătește două secțiuni critice. Cu un plafon, cel mult una.',
        'H uses S1 and then S2; L1 holds S1 and L2 holds S2 when H is released. With inheritance, H pays for two critical sections. With a ceiling, for at most one.'),
      protocol: 'pip',
      tasks: [
        { name: 'H', prio: 3, r: 2, prog: '[S1 1] [S2 1] 1' },
        { name: 'L1', prio: 2, r: 1, prog: '[S1 3] 1' },
        { name: 'L2', prio: 1, r: 0, prog: '[S2 4] 1' }
      ]
    },
    {
      id: 'deadlock',
      title: t('Deadlock: zăvoare luate în ordine inversă (6.3, secțiunea 3)', 'Deadlock: locks taken in opposite order (6.3, section 3)'),
      note: t('τ2 ia A, apoi B; τ1, mai prioritar, ia B, apoi A. Fără protocol sau cu moștenire, la 3 ms fiecare așteaptă zăvorul celuilalt. Protocoalele cu plafon nu lasă ciclul să se formeze.',
        'τ2 takes A, then B; τ1, with a higher priority, takes B, then A. With no protocol or with inheritance, at 3 ms each waits for the lock of the other. The ceiling protocols do not let the cycle form.'),
      protocol: 'pip',
      tasks: [
        { name: 'τ1', prio: 2, r: 1, prog: '[B 1 [A 1]]' },
        { name: 'τ2', prio: 1, r: 0, prog: '[A 2 [B 1]]' }
      ]
    },
    {
      id: 'icpp',
      title: t('Prețul plafonului imediat: M amânat fără ca H să aștepte (6.3, secțiunea 4)', 'The price of the immediate ceiling: M delayed while H is not waiting (6.3, section 4)'),
      note: t('Cu plafon imediat, L rulează cu prioritatea lui H cât timp ține S, chiar dacă H nu este încă eliberat: M așteaptă 3 ms. Cu moștenire, M rulează imediat. Marginea în cel mai rău caz este aceeași, dar blocarea prin împingere apare mai des.',
        'With the immediate ceiling, L runs with the priority of H while it holds S, even though H has not been released yet: M waits 3 ms. With inheritance, M runs immediately. The worst-case bound is the same, but push-through blocking happens more often.'),
      protocol: 'icpp',
      tasks: [
        { name: 'H', prio: 3, r: 9, prog: '1 [S 1]' },
        { name: 'M', prio: 2, r: 1, prog: '3' },
        { name: 'L', prio: 1, r: 0, prog: '[S 4] 1' }
      ]
    }
  ];
})();
