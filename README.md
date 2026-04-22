# IQ-Test · CHC

Ein freier, wissenschaftlich fundierter Selbsteinschätzungs-IQ-Test als
statische Web-Anwendung. Grundlage ist die **Cattell-Horn-Carroll-Theorie (CHC)**
der kognitiven Fähigkeiten. Die Anwendung ist bewusst als reines
Browser-Frontend konzipiert: keine Server, keine Tracker, keine Cookies,
keine externen CDN-Skripte.

> **Wichtig:** Dieser Test ist ein Bildungs- und Selbsteinschätzungsinstrument.
> Er ersetzt **keine** klinische Diagnostik, **keine** standardisierten
> Intelligenzverfahren (WAIS-IV, IST-2000-R, CFT 20-R …) und liefert
> **keine** medizinisch oder juristisch verwertbaren Ergebnisse. Siehe
> [`haftung.html`](haftung.html).

## Features

- Sechs CHC-Broad-Abilities (Gf, Gc, Gv, Gs, Gsm, Gq) mit 70+ Items
- Scoring nach Item-Response-Theorie (Rasch-Ansatz) → Wechsler-IQ-Skala
- 95 %-Konfidenzintervall und Prozentrang
- Radar-Chart der Domänen (reines SVG, abhängigkeitsfrei)
- PWA-fähig (offlinefähig nach erstem Besuch)
- Deutsch, DSGVO- und TMG-konforme Rechtsseiten
- Hell-/Dunkelmodus über `prefers-color-scheme`
- WCAG-2.1-orientiert (Tastaturbedienung, ARIA, kontraststarkes Design)

## Technischer Stack

- **Frontend:** HTML5, natives CSS (Custom Properties), Vanilla-ES-Module (ES2022+)
- **Keine Build-Pipeline** nötig — direkt auf GitHub Pages deploybar
- **Keine externen Abhängigkeiten** zur Laufzeit

## Projektstruktur

```
/
├── index.html              Landing
├── test.html               Testdurchführung
├── result.html             Ergebnisseite mit Radar + Interpretation
├── impressum.html          § 5 TMG
├── datenschutz.html        DSGVO
├── haftung.html            Disclaimer
├── nutzungsbedingungen.html
├── ueber.html              Autorprofil
├── methodik.html           Transparenz: Modell + Formeln
├── manifest.json           PWA
├── service-worker.js       Offline-Cache
├── robots.txt
├── sitemap.xml
├── assets/
│   ├── css/                reset.css, main.css, print.css
│   ├── js/                 app.js, test-engine.js, scoring.js,
│   │                       item-renderer.js, storage.js, chart.js
│   └── img/                Favicons, PWA-Icons (SVG)
├── data/
│   ├── items-gf.json       12 Items  · Fluid Reasoning
│   ├── items-gc.json       10 Items  · Crystallized
│   ├── items-gv.json       10 Items  · Visual Processing
│   ├── items-gs.json       20 Items  · Processing Speed
│   ├── items-gsm.json       8 Items  · Short-term Memory
│   ├── items-gq.json       10 Items  · Quantitative
│   ├── norms.json          theoretische μ, σ pro Domäne
│   └── interpretations.json Textbausteine zur Ergebnisseite
├── LICENSE                 MIT (Code)
├── ITEMS_LICENSE.md        Lizenz der Testitems
├── CLAUDE.md               Projektgedächtnis (Folge-Sessions)
└── README.md
```

## Lokales Ausprobieren

```bash
# Mit Python:
python3 -m http.server 8080

# Mit Node (z. B. http-server):
npx http-server . -p 8080 -c-1
```

Dann im Browser: <http://localhost:8080/index.html>.

Ein Service Worker greift nur unter HTTPS oder `localhost`.

## Deployment auf GitHub Pages

1. Repository-Einstellungen öffnen: *Settings → Pages*.
2. Source: *Deploy from a branch*, Branch: `main` (oder der gewünschte Branch),
   Folder: `/ (root)`.
3. Pages speichern. Nach einigen Minuten ist die Seite unter
   `https://<user>.github.io/<repo>/` erreichbar.
4. Die Einträge in `sitemap.xml` und `robots.txt` auf die tatsächliche Domäne
   anpassen (derzeit Platzhalter `example.github.io/IQ-TEST`).

Falls eine Custom-Domain genutzt wird, eine `CNAME`-Datei im Repo-Root anlegen.

## Scoring in Kürze

1. Rohwert pro Domäne: `Σ korrekt_i · (1 + 0,3 · b_i)`.
2. z-Wert pro Domäne: `(raw − μ) / σ` gegen theoretische Normwerte aus
   `data/norms.json`.
3. Gesamt-z: gewichtetes Mittel
   `0,30·Gf + 0,20·Gc + 0,15·Gv + 0,10·Gs + 0,10·Gsm + 0,15·Gq`.
4. `IQ = 100 + 15 · z`, auf [55, 145] begrenzt.
5. `SEM = 15 · √(1 − 0,85) ≈ 5,81`, 95 %-KI ≈ IQ ± 11.
6. Prozentrang: Φ(z) via Abramowitz-Stegun-erf.

Details siehe [`methodik.html`](methodik.html).

## Roadmap

- **v1.0** (aktuell) – statischer Test mit theoretischer Normierung, PWA-Basis.
- **v1.1** – lokale Langzeit-Auswertung mehrerer Versuche pro Gerät.
- **v2.0** – Opt-In-Datenspende für anonyme empirische Kalibrierung
  (DSGVO-konform, explizite Einwilligung).
- **v2.1** – adaptive Testung (CAT) mit Live-IRT-Schätzung.

## Rechtliches

- Betreiber: Belkis Aslani, Vogelsangstraße 32, 71691 Freiberg am Neckar,
  Deutschland. E-Mail: <belkis.aslani@gmail.com>. Vollständiges Impressum:
  [`impressum.html`](impressum.html).
- Datenschutzerklärung: [`datenschutz.html`](datenschutz.html).
- Haftungsausschluss: [`haftung.html`](haftung.html).
- Nutzungsbedingungen: [`nutzungsbedingungen.html`](nutzungsbedingungen.html).
- Items-Lizenz: [`ITEMS_LICENSE.md`](ITEMS_LICENSE.md).
- Code-Lizenz: [`LICENSE`](LICENSE) (MIT).

## Mitwirken

Pull Requests sind willkommen, insbesondere für:
- zusätzliche Items je Domäne (bitte mit Lösungsregel im Feld `rationale`),
- Verbesserungen der Barrierefreiheit,
- Übersetzungen in weitere Sprachen.

Bitte keine Items aus urheberrechtlich geschützten Testverfahren (WAIS, WISC,
IST, CFT, Raven, BOMAT, Mensa-Tests usw.) übernehmen.
