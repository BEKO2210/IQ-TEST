// assets/js/test-engine.js
// Ablauflogik: Items laden, in Domänen-Blöcke strukturieren, Timer verwalten,
// Antworten erfassen, Navigation, Übergabe des Ergebnisses.

"use strict";

import {
  renderStimulus, renderOptions, markSelected, runMemoryDisplay
} from "./item-renderer.js";
import {
  saveSessionProgress, loadSessionProgress, clearSessionProgress
} from "./storage.js";

const DOMAIN_ORDER = ["Gf", "Gv", "Gq", "Gsm", "Gs", "Gc"];

const DOMAIN_INTROS = {
  Gf: {
    title: "Block 1 · Schlussfolgerndes Denken (Gf)",
    text: "Erkennen Sie Regeln in Matrizen, Zahlenfolgen und Analogien. Zeitdruck pro Aufgabe, aber nicht zu hektisch. Wenn Sie unsicher sind, wählen Sie Ihre beste Annahme und gehen weiter."
  },
  Gv: {
    title: "Block 2 · Räumlich-visuelle Verarbeitung (Gv)",
    text: "Drehen, falten, spiegeln Sie Figuren im Kopf. Nehmen Sie sich für jede Aufgabe kurz Zeit, um die Transformation vollständig vorzustellen."
  },
  Gq: {
    title: "Block 3 · Numerisch-mathematisches Denken (Gq)",
    text: "Textaufgaben, Prozente, einfache Gleichungen. Sie dürfen Stift und Papier verwenden. Achten Sie auf Einheiten."
  },
  Gsm: {
    title: "Block 4 · Arbeitsgedächtnis (Gsm)",
    text: "Kurze Ziffern- oder Zeichenfolgen erscheinen für wenige Sekunden. Danach werden Sie nach der Reihenfolge gefragt. Bitte nicht mitschreiben und nicht laut vorsprechen."
  },
  Gs: {
    title: "Block 5 · Verarbeitungsgeschwindigkeit (Gs)",
    text: "Kurze, einfache Aufgaben unter Zeitdruck. Tempo ist wichtiger als Perfektion. Wenn die Zeit abläuft, wird automatisch weitergeschaltet."
  },
  Gc: {
    title: "Block 6 · Verbale Intelligenz / Wissen (Gc)",
    text: "Analogien, Synonyme, Allgemeinwissen, Sprichwörter. Keine Fangfragen, keine Tagespolitik. Lesen Sie in Ruhe."
  }
};

async function loadItems() {
  const domains = ["gf", "gc", "gv", "gs", "gsm", "gq"];
  const all = [];
  for (const d of domains) {
    const res = await fetch(`data/items-${d}.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Items für ${d} konnten nicht geladen werden.`);
    const items = await res.json();
    all.push(...items);
  }
  return all;
}

async function loadNorms() {
  const res = await fetch("data/norms.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Normwerte konnten nicht geladen werden.");
  return res.json();
}

function groupByDomain(items) {
  const map = new Map();
  for (const d of DOMAIN_ORDER) map.set(d, []);
  for (const it of items) {
    if (!map.has(it.domain)) map.set(it.domain, []);
    map.get(it.domain).push(it);
  }
  for (const d of map.keys()) {
    map.get(d).sort((a, b) => a.difficulty_b - b.difficulty_b);
  }
  return map;
}

// --- Options-Shuffle (Fisher-Yates, deterministisch pro Session-Seed) ---

function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function shuffleOptions(item, rng) {
  const opts = Array.isArray(item.options) ? item.options : [];
  // Binäre Optionen (gleich/verschieden u.ä.) behalten ihre Reihenfolge.
  if (opts.length < 3) return item;
  const indices = opts.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const newOpts = indices.map((i) => opts[i]);
  const newCorrect = indices.indexOf(item.correct);
  return { ...item, options: newOpts, correct: newCorrect };
}

function shuffleAllItems(items, seed) {
  const rng = seededRng(seed);
  return items.map((it) => shuffleOptions(it, rng));
}

function buildSequence(grouped) {
  const seq = [];
  for (const d of DOMAIN_ORDER) {
    const items = grouped.get(d) ?? [];
    if (items.length === 0) continue;
    seq.push({ kind: "intro", domain: d });
    for (const it of items) seq.push({ kind: "item", item: it });
  }
  seq.push({ kind: "done" });
  return seq;
}

class Timer {
  constructor(onTick, onExpire) {
    this.onTick = onTick;
    this.onExpire = onExpire;
    this.intervalId = null;
    this.remaining = 0;
    this.paused = false;
  }
  start(seconds) {
    this.stop();
    this.remaining = Math.max(0, Math.floor(seconds));
    this.onTick(this.remaining);
    this.intervalId = window.setInterval(() => {
      if (this.paused) return;
      this.remaining -= 1;
      this.onTick(this.remaining);
      if (this.remaining <= 0) {
        this.stop();
        this.onExpire();
      }
    }, 1000);
  }
  stop() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  pause() { this.paused = true; }
  resume() { this.paused = false; }
}

export class TestEngine {
  constructor(dom) {
    this.dom = dom;
    this.state = {
      index: 0,
      responses: [],
      startedAt: null,
      demographics: null
    };
    this.sequence = [];
    this.items = [];
    this.timer = new Timer(
      (sec) => this._onTimerTick(sec),
      () => this._onTimerExpire()
    );
    this.selectedOption = null;
    this.memoryPhase = "none"; // "display" | "recall" | "none"
    this.memoryCancel = null;
  }

  async init() {
    const [rawItems, norms] = await Promise.all([loadItems(), loadNorms()]);
    this.norms = norms;

    // Seed pro Session → Reihenfolge bleibt stabil, falls Tab neu geladen wird.
    const resumed = loadSessionProgress();
    const seed = resumed?.state?.seed ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff));
    this.items = shuffleAllItems(rawItems, seed);

    const grouped = groupByDomain(this.items);
    this.sequence = buildSequence(grouped);

    if (resumed && resumed.sequenceSize === this.sequence.length) {
      this.state = resumed.state;
    } else {
      this.state.startedAt = new Date().toISOString();
      this.state.seed = seed;
    }
    this._render();
  }

  setDemographics(demo) {
    this.state.demographics = demo ?? null;
    this._persist();
  }

  _persist() {
    saveSessionProgress({
      sequenceSize: this.sequence.length,
      state: this.state
    });
  }

  _render() {
    const step = this.sequence[this.state.index];
    if (!step) return;
    this._updateProgress();
    if (step.kind === "intro") return this._renderIntro(step.domain);
    if (step.kind === "done") return this._renderDone();
    return this._renderItem(step.item);
  }

  _updateProgress() {
    const totalItems = this.sequence.filter((s) => s.kind === "item").length;
    const doneItems = this.state.responses.length;
    const pct = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);
    if (this.dom.progressBar) this.dom.progressBar.style.width = pct + "%";
    if (this.dom.progressLabel) {
      this.dom.progressLabel.textContent = `Aufgabe ${Math.min(doneItems + 1, totalItems)} von ${totalItems}`;
    }
  }

  _renderIntro(domain) {
    this.timer.stop();
    const intro = DOMAIN_INTROS[domain];
    this.dom.stimulus.replaceChildren();
    this.dom.options.replaceChildren();
    this.dom.question.textContent = "";
    this.dom.timer.textContent = "";

    const wrap = document.createElement("div");
    wrap.className = "block-intro";
    const h = document.createElement("h2");
    h.textContent = intro?.title ?? `Block: ${domain}`;
    const p = document.createElement("p");
    p.textContent = intro?.text ?? "";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-primary";
    btn.textContent = "Block starten";
    btn.addEventListener("click", () => {
      this.state.index += 1;
      this._persist();
      this._render();
    });
    wrap.append(h, p, btn);
    this.dom.stimulus.appendChild(wrap);
    this.dom.nextButton.disabled = true;
    this.dom.nextButton.hidden = true;
  }

  _renderItem(item) {
    this.selectedOption = null;
    this.dom.nextButton.hidden = false;
    this.dom.nextButton.disabled = true;
    this.dom.nextButton.textContent = "Antwort bestätigen";

    this.dom.question.textContent = "";

    // Memory-Items: zuerst Display-Phase, dann Recall.
    if (item.stimulus_type === "memory") {
      this.memoryPhase = "display";
      this.dom.stimulus.replaceChildren();
      this.dom.options.replaceChildren();
      const intro = document.createElement("p");
      intro.className = "item-text";
      intro.textContent = item.stimulus ?? "";
      this.dom.stimulus.appendChild(intro);

      this.memoryCancel = runMemoryDisplay(
        this.dom.stimulus,
        item.display_sequence,
        item.display_time_ms ?? 5000,
        () => {
          this.memoryPhase = "recall";
          this.dom.question.textContent = item.question ?? "";
          renderOptions(this.dom.options, item, (idx) => this._onSelect(idx));
          this._startItemTimer(item);
        }
      );
      return;
    }

    renderStimulus(this.dom.stimulus, item);
    this.dom.question.textContent = item.question ?? "";
    renderOptions(this.dom.options, item, (idx) => this._onSelect(idx));
    this._startItemTimer(item);
  }

  _startItemTimer(item) {
    const seconds = Math.max(5, Number(item.time_limit_sec) || 60);
    this.timer.start(seconds);
  }

  _onTimerTick(sec) {
    if (!this.dom.timer) return;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    this.dom.timer.textContent = `${m}:${String(s).padStart(2, "0")}`;
    this.dom.timer.classList.toggle("warning", sec <= 5);
  }

  _onTimerExpire() {
    const step = this.sequence[this.state.index];
    if (!step || step.kind !== "item") return;
    this._recordAnswer(step.item, this.selectedOption);
    this._advance();
  }

  _onSelect(idx) {
    this.selectedOption = idx;
    markSelected(this.dom.options, idx);
    this.dom.nextButton.disabled = false;
  }

  confirm() {
    const step = this.sequence[this.state.index];
    if (!step || step.kind !== "item") return;
    if (this.selectedOption === null) return;
    this._recordAnswer(step.item, this.selectedOption);
    this._advance();
  }

  _recordAnswer(item, selectedIndex) {
    const correct = selectedIndex !== null && selectedIndex === item.correct;
    this.state.responses.push({
      itemId: item.id,
      domain: item.domain,
      correct,
      difficulty_b: item.difficulty_b,
      selected: selectedIndex,
      timeTaken: null
    });
    this._persist();
  }

  _advance() {
    this.timer.stop();
    if (this.memoryCancel) { this.memoryCancel(); this.memoryCancel = null; }
    this.memoryPhase = "none";
    this.state.index += 1;
    this._persist();
    this._render();
  }

  _renderDone() {
    this.timer.stop();
    this.dom.stimulus.replaceChildren();
    this.dom.options.replaceChildren();
    this.dom.question.textContent = "";
    this.dom.timer.textContent = "";
    this.dom.nextButton.hidden = true;

    const wrap = document.createElement("div");
    wrap.className = "block-intro";
    const h = document.createElement("h2");
    h.textContent = "Test abgeschlossen";
    const p = document.createElement("p");
    p.textContent = "Ihre Antworten werden gleich ausgewertet. Die Auswertung erfolgt vollständig im Browser.";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-primary";
    btn.textContent = "Ergebnis anzeigen";
    btn.addEventListener("click", () => {
      clearSessionProgress();
      // Ergebnis in sessionStorage für result.html
      try {
        window.sessionStorage.setItem(
          "iqtest.chc.finalResponses",
          JSON.stringify({
            responses: this.state.responses,
            demographics: this.state.demographics,
            startedAt: this.state.startedAt,
            finishedAt: new Date().toISOString()
          })
        );
      } catch (_e) { /* ignore */ }
      window.location.href = "result.html";
    });
    wrap.append(h, p, btn);
    this.dom.stimulus.appendChild(wrap);
  }
}
