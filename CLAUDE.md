# CLAUDE.md — Projektgedächtnis IQ-TEST

Dieses Dokument ist das persistente Gedächtnis für alle Claude-Code-Sessions
am Repository `BEKO2210/IQ-TEST`. Es beschreibt Zweck, rechtlichen Rahmen,
Architektur, Konventionen und offene Aufgaben.

## 1. Projektzweck

Eine statisch deploybare Web-Applikation (GitHub Pages kompatibel), die einen
seriös konstruierten, wissenschaftlich fundierten Selbsteinschätzungs-
Intelligenztest in deutscher Sprache anbietet. Grundlage ist die
**Cattell-Horn-Carroll-Theorie (CHC)**.

Das Projekt ist ausdrücklich **kein klinisches, diagnostisches oder
zertifiziertes Verfahren**. Ziel sind Bildung, Selbstreflexion und
Unterhaltung.

## 2. Betreiber / Autor

- Name: Belkis Aslani (männlich, Jahrgang 1988)
- Anschrift: Vogelsangstraße 32, 71691 Freiberg am Neckar, Deutschland
- E-Mail: belkis.aslani@gmail.com
- Rolle: Autodidaktischer Entwickler mit Interesse an Psychometrie.
  **Kein approbierter Psychologe, kein klinischer Diagnostiker.**

Verbotene Selbstbezeichnungen im gesamten Projekt: „Dr.“, „Prof.“,
„Psychologe“, „klinisch validiert“, „diagnostisch“, „zertifiziert“,
„Mensa-Niveau“, „Hochbegabungsdiagnostik“, „psychologisches Gutachten“.

Erlaubt: „auf Basis der Forschungsliteratur umgesetzt von Belkis Aslani“.

## 3. Rechtlicher Rahmen (Deutschland)

- **TMG § 5** — vollständiges Impressum (`impressum.html`).
- **MStV § 18 Abs. 2** — Verantwortlicher für redaktionelle Inhalte.
- **DSGVO** — Datenschutzerklärung (`datenschutz.html`). Keine Verarbeitung
  personenbezogener Daten durch die Anwendung selbst. `localStorage` bleibt
  ausschließlich lokal auf dem Endgerät. Keine Cookies (nur rein technisch
  notwendige, sofern überhaupt). Kein Google Fonts CDN, kein Analytics,
  kein Meta Pixel, keine CDN-Skripte.
- **UrhG** — Alle Testitems sind eigenständige Neukonstruktionen. Keine
  Übernahme aus geschützten Verfahren (Raven, WAIS/WISC, IST, CFT, BOMAT,
  Mensa-Tests usw.). Lizenz in `ITEMS_LICENSE.md`.
- **Barrierefreiheit** — WCAG 2.1 AA-Niveau anstreben.

## 4. Architektur

Statisches Frontend, Vanilla-JavaScript (ES2022+, native ES-Module), ohne
Build-Step, kompatibel mit GitHub Pages.

```
/
├── index.html              Landing
├── test.html               Testdurchführung
├── result.html             Ergebnisseite
├── impressum.html          § 5 TMG
├── datenschutz.html        DSGVO
├── haftung.html            Haftungsausschluss
├── nutzungsbedingungen.html
├── ueber.html              Autorprofil
├── methodik.html           Transparenz zur Testlogik
├── assets/
│   ├── css/{reset,main,print}.css
│   ├── js/{app,test-engine,scoring,item-renderer,storage,chart}.js
│   ├── fonts/              selbst gehostete Web-Fonts
│   └── img/                SVG-Logos/Icons
├── data/
│   ├── items.json          alle Items
│   ├── norms.json          theoretische μ, σ pro Domäne
│   └── interpretations.json Textbausteine
├── manifest.json           PWA
├── service-worker.js       Offline-Cache
├── robots.txt
├── sitemap.xml
├── README.md
├── CLAUDE.md               (diese Datei)
├── LICENSE                 Code-Lizenz (MIT)
└── ITEMS_LICENSE.md        Items-Lizenz
```

## 5. Wissenschaftliche Grundlagen

### 5.1 CHC-Modell — erfasste Broad Abilities

| Code | Broad Ability | Deutsch                        | Items |
|------|---------------|--------------------------------|-------|
| Gf   | Fluid Reas.   | Schlussfolgerndes Denken       | ≥12   |
| Gc   | Crystallized  | Verbale Intelligenz / Wissen   | ≥10   |
| Gv   | Visual Proc.  | Räumlich-visuelle Verarbeitung | ≥10   |
| Gs   | Proc. Speed   | Verarbeitungsgeschwindigkeit   | ≥20   |
| Gsm  | Short-term    | Arbeitsgedächtnis              | ≥8    |
| Gq   | Quantitative  | Numerisch-mathematisch         | ≥10   |

Summe ≥ 70 Items. Realistische Testdauer 35–45 Minuten.

### 5.2 Itemparameter

Jedes Item hat im JSON:
`id`, `domain`, `subtype`, `difficulty_b` (Logit −3..+3),
`a_discrimination` (Default 1.0), Prompt (Text oder SVG),
`options`, `correct`, `time_limit_sec`, `rationale`.

Die Schwierigkeiten sind durch Expertenurteil auf einer Rasch-kompatiblen
Logit-Skala geschätzt. Eine empirische Normierung liegt **nicht** vor —
dies wird auf `methodik.html` und im Disclaimer transparent kommuniziert.

### 5.3 Scoring (implementiert in `assets/js/scoring.js`)

1. Rohwert pro Domäne: `Σ correct_i × (1 + 0.3 × b_i)`.
2. z-Wert pro Domäne: `(raw − μ) / σ` gegen theoretische Norm aus
   `data/norms.json` (Rasch-Erwartung: `P(correct|θ=0,b) = 1/(1+e^b)`).
3. Gesamt-z: gewichtetes Mittel der Domänen-z-Werte. Gewichte
   `{Gf:.30, Gc:.20, Gv:.15, Gs:.10, Gsm:.10, Gq:.15}` (Annäherung an
   typische g-Ladungen aus der Literatur).
4. `IQ = 100 + 15 × z`, Anzeigebereich [55, 145], darunter/darüber als
   Randhinweis.
5. Reliabilität (angenommen): `r_xx = 0.85`. Daraus
   `SEM = 15 × √(1 − 0.85) ≈ 5.81`. 95 %-KI ≈ `IQ ± 11`.
6. Prozentrang: `Φ(z) × 100` — Abramowitz-Stegun-Approximation von `erf`.

**Zahlenproben (Selbsttest):**
- Alle Antworten korrekt → IQ-Deckel bei ca. 145.
- 50 % korrekt → IQ ≈ 100.
- Alle falsch → IQ-Untergrenze bei ca. 55.

## 6. Konventionen

- Sprache Benutzerinterface: Deutsch (Sie-Form, neutral).
- Kommentare im Code: vorwiegend Deutsch; englische Fachtermini zulässig.
- Kein `var`, ausschließlich `const`/`let`, strikte `===`-Vergleiche.
- Keine externen CDN-Abhängigkeiten. Alles selbst hosten.
- Dateien in UTF-8, LF-Zeilenenden.
- Kein Framework-Overhead; modulare Vanilla-ES-Module.

## 7. Roadmap

- **v1.0 (MVP, aktueller Stand)**: statischer Test mit theoretischer
  Normierung, rechtskonforme Seiten, PWA-Basis.
- **v1.1**: lokale Langzeit-Auswertung mehrerer Versuche pro Gerät.
- **v2.0**: Opt-In-Datenspende zur späteren empirischen Kalibrierung
  (DSGVO-konform, anonym, explizite Einwilligung).
- **v2.1**: Adaptive Testung (CAT) mit Live-IRT-Schätzung.

## 8. Offene Aufgaben für Folge-Sessions

- [ ] Lighthouse-Score validieren (Ziel ≥ 95 in allen Kategorien).
- [ ] axe-core-Scan für Barrierefreiheit.
- [ ] Weitere Items je Domäne, um pro Schwierigkeitsstufe mehrere Parallel-
      formen zu haben (Ziel: ~120 Items für Teilrandomisierung).
- [ ] Web-Fonts offline einbinden (aktuell System-Font-Stack, da DSGVO-
      freundlich und ohne externes Loading).
- [ ] Service Worker prüfen / Versionierung beim Deploy.

## 9. Kontakt & Branch

- Entwicklungsbranch: `claude/iq-test-webapp-44xr0`.
- Keine Pushes auf `main` ohne explizite Freigabe.
- Kein PR ohne explizite Aufforderung des Nutzers.
