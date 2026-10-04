# Vizualizator timp real

Demonstrații interactive pentru cursul **Sisteme de Timp Real** (UTCN). Studenții
modifică parametrii unui task sau ai unui set de taskuri și văd imediat, pe axa
timpului, eliberările, termenele-limită, execuția, timpul de răspuns, laxitatea
și încărcarea procesorului.

Aplicația este o pagină statică (HTML, CSS și JavaScript simplu, fără
dependențe și fără pas de compilare). Merge deschisă direct din fișier, de pe
GitHub Pages sau inclusă într-o pagină MkDocs.

![Modelul de task](docs/model.png)

## Ce conține

| Fila | Concepte | Pagini de curs |
|---|---|---|
| **1. Modelul de task** | $r_0$, $C$, $T$, $D$; eliberare $r_k$, termen absolut $d_k$, timp de răspuns $R$, laxitate $X(t)$; interferența unui task mai prioritar | 3.2 |
| **2. Periodic, sporadic, aperiodic** | același $C$ și $T$, trei feluri de eliberări; cererea de procesor cumulată; cea mai densă fereastră | 3.2 |
| **3. Fiecare tip în detaliu** | *Periodic*: așteptare absolută față de relativă pe aceleași $C_k$ și $\varepsilon_k$, deriva, $L_k$, jitter absolut și relativ, histogramă. *Sporadic*: apăsări de buton în timp real (clic sau tasta spațiu), intervalul minim impus (ignorare, amânare) sau doar sperat, efectul asupra unui task periodic mai puțin prioritar și asupra garanției RTA. *Aperiodic*: cereri servite cu prioritate maximă, în fundal sau de un server cu buget $Q$ la fiecare $T_s$, cu graficul bugetului | 2.2, 2.3, 3.2, 4.8, 5.4 |
| **4. Planificare și încărcare** | editor de set de taskuri; RM, DM, priorități fixe manuale, EDF, LLF, FIFO; preemptiv sau nu; cursor pas cu pas cu stările Running / Ready / Blocked; factorul de utilizare, limita Liu & Layland, limita hiperbolică, RTA, testul EDF; încărcarea procesorului în timp | 3.3–3.4, 4.2–4.8 |
| **Legendă** | cum se citește diagrama | — |

Fila 4 are exemple gata pregătite, legate de paginile cursului: setul
„senzor, comandă, jurnal”, instantul critic, „RM ratează, EDF reușește”,
termen constrâns (RM față de DM), RTA, supraîncărcare și efect de domino,
taskuri mixte, planificare nepreemptivă, EDF față de LLF.

![Taskul sporadic](docs/types.png)

![Planificare](docs/sched.png)

## Rulare locală

```bash
python3 -m http.server 8000     # apoi http://localhost:8000
# sau deschideți direct index.html în browser
npm test                        # testele motorului de simulare (Node 18+)
```

## Legături directe și includere în curs

Adresa poate deschide direct o filă sau un exemplu:

```text
index.html#model
index.html#arrivals
index.html#types/periodic      (periodic, sporadic, aperiodic)
index.html#sched/rm-edf        (senzor, critic, rm-edf, dm, rta, overload, mixed, nonpreempt, llf)
```

Într-o pagină MkDocs a cursului, după publicarea pe GitHub Pages:

```html
<iframe src="https://automatica-cluj.github.io/rt-visualizer/#sched/rm-edf"
        width="100%" height="900" style="border:0"></iframe>
```

## Structură

```text
index.html          paginile celor patru file
css/style.css       temă luminoasă și întunecată, paleta taskurilor
js/sim.js           motorul de simulare, fără DOM (eliberări, planificatoare, analiză)
js/render.js        diagrama de timp și graficele, în SVG
js/presets.js       exemplele din fila 4
js/app.js           legătura dintre controale și desene
tests/sim.test.js   verifică motorul pe exemplele din curs
```

Pentru un exemplu nou, adăugați un obiect în `js/presets.js`. Modelul de
simulare: timp discret, un singur nucleu, fără costul comutării de context; la
aceeași prioritate câștigă taskul aflat mai sus în tabel. Taskurile sporadice
sunt eliberate uneori exact la intervalul minim, alteori mai târziu; cele
aperiodice au intervale exponențiale cu media $T$.

## Publicare

Fluxul `.github/workflows/pages.yml` rulează testele și publică site-ul pe
GitHub Pages la fiecare push pe `main`. În setările depozitului, la
*Pages*, sursa trebuie să fie „GitHub Actions”.
