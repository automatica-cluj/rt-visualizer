/*
 * Exemplele din meniul „Exemplu” (fila 3). Fiecare are un identificator
 * folosit în adresă: index.html#sched/rm-edf deschide direct exemplul.
 * Câmpuri task: name, type (periodic | sporadic | aperiodic), C, T, D,
 * offset (prima eliberare), prio (doar pentru FP; număr mai mare = prioritate mai mare).
 */
window.RTPresets = [
  {
    id: 'senzor',
    title: 'Senzor, comandă, jurnal (3.2)',
    note: 'Setul din pagina 3.2: U = 0,6, hiperperioada H = 40. Procesorul rămâne liber 16 ms din fiecare 40.',
    policy: 'RM', horizon: 40,
    tasks: [
      { name: 'senzor', type: 'periodic', C: 2, T: 10, D: 10, offset: 0, prio: 3 },
      { name: 'comandă', type: 'periodic', C: 4, T: 20, D: 20, offset: 0, prio: 2 },
      { name: 'jurnal', type: 'periodic', C: 8, T: 40, D: 40, offset: 0, prio: 1 }
    ]
  },
  {
    id: 'critic',
    title: 'Instantul critic (3.2)',
    note: 'Cu eliberări simultane, R₂ = 8. Mutați prima eliberare a lui τ₁ la 3 și R₂ scade la 6: cel mai rău caz este eliberarea simultană.',
    policy: 'RM', horizon: 20,
    tasks: [
      { name: 'τ1', type: 'periodic', C: 2, T: 5, D: 5, offset: 0, prio: 2 },
      { name: 'τ2', type: 'periodic', C: 4, T: 10, D: 10, offset: 0, prio: 1 }
    ]
  },
  {
    id: 'rm-edf',
    title: 'RM ratează, EDF reușește (4.2, 4.5)',
    note: 'U ≈ 0,97 depășește limita Liu & Layland (0,83). Sub RM, jobul 0 al lui „afișaj” termină la 8 > 7. Comutați pe EDF: niciun termen ratat.',
    policy: 'RM', horizon: 35,
    tasks: [
      { name: 'motor', type: 'periodic', C: 2, T: 5, D: 5, offset: 0, prio: 2 },
      { name: 'afișaj', type: 'periodic', C: 4, T: 7, D: 7, offset: 0, prio: 1 }
    ]
  },
  {
    id: 'dm',
    title: 'Termen constrâns: RM față de DM (4.3)',
    note: '„alarmă” are D = 3 < T = 10. RM îi dă prioritate mică pentru că perioada e mare și termenul e ratat; DM ordonează după D și setul devine planificabil.',
    policy: 'RM', horizon: 20,
    tasks: [
      { name: 'eșantionare', type: 'periodic', C: 2, T: 5, D: 5, offset: 0, prio: 1 },
      { name: 'alarmă', type: 'periodic', C: 2, T: 10, D: 3, offset: 0, prio: 2 }
    ]
  },
  {
    id: 'rta',
    title: 'Analiza timpului de răspuns (4.4)',
    note: 'U ≈ 0,81 < 1, dar peste limita pentru 3 taskuri (0,78): testul de utilizare nu decide. RTA dă R₃ = 10 ≤ 13, iar simularea arată aceeași valoare.',
    policy: 'RM', horizon: 52,
    tasks: [
      { name: 'τ1', type: 'periodic', C: 1, T: 4, D: 4, offset: 0, prio: 3 },
      { name: 'τ2', type: 'periodic', C: 2, T: 6, D: 6, offset: 0, prio: 2 },
      { name: 'τ3', type: 'periodic', C: 3, T: 13, D: 13, offset: 0, prio: 1 }
    ]
  },
  {
    id: 'overload',
    title: 'Supraîncărcare, U > 1 (4.8)',
    note: 'U ≈ 1,23. Sub RM ratează doar taskurile mai puțin prioritare. Sub EDF, ratările se propagă la toate taskurile (efect de domino). Încercați și „abandonează jobul la termenul ratat”.',
    policy: 'EDF', horizon: 70,
    tasks: [
      { name: 'reglaj', type: 'periodic', C: 3, T: 5, D: 5, offset: 0, prio: 3 },
      { name: 'filtru', type: 'periodic', C: 3, T: 7, D: 7, offset: 0, prio: 2 },
      { name: 'raport', type: 'periodic', C: 2, T: 10, D: 10, offset: 0, prio: 1 }
    ]
  },
  {
    id: 'mixed',
    title: 'Periodic, sporadic și aperiodic împreună (3.2)',
    note: 'Butonul este sporadic (cel mult o apăsare la 15 ms), diagnoza este aperiodică și are prioritatea cea mai mică. Apăsați „Altă realizare aleatoare” și urmăriți diagnoza.',
    policy: 'FP', horizon: 100,
    tasks: [
      { name: 'senzor', type: 'periodic', C: 2, T: 10, D: 10, offset: 0, prio: 3 },
      { name: 'buton', type: 'sporadic', C: 1, T: 15, D: 5, offset: 3, prio: 4 },
      { name: 'diagnoză', type: 'aperiodic', C: 4, T: 12, D: 30, offset: 1, prio: 1 }
    ]
  },
  {
    id: 'nonpreempt',
    title: 'Nepreemptiv: blocare de un task mai puțin prioritar (3.3)',
    note: 'Debifați „preemptiv”: când „jurnal” a apucat procesorul, „senzor” trebuie să aștepte până termină, deși este mai prioritar, și își ratează termenul.',
    policy: 'RM', horizon: 40,
    tasks: [
      { name: 'senzor', type: 'periodic', C: 1, T: 5, D: 3, offset: 1, prio: 2 },
      { name: 'jurnal', type: 'periodic', C: 6, T: 20, D: 20, offset: 0, prio: 1 }
    ]
  },
  {
    id: 'llf',
    title: 'EDF față de LLF (4.5, 4.6)',
    note: 'Ambii algoritmi respectă termenele, dar ordinea joburilor diferă. Comparați numărul de preempțiuni din carduri pentru EDF și LLF.',
    policy: 'LLF', horizon: 24,
    tasks: [
      { name: 'A', type: 'periodic', C: 2, T: 6, D: 6, offset: 0, prio: 3 },
      { name: 'B', type: 'periodic', C: 2, T: 8, D: 8, offset: 0, prio: 2 },
      { name: 'C', type: 'periodic', C: 4, T: 12, D: 12, offset: 0, prio: 1 }
    ]
  }
];
