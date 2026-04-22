// assets/js/app.js
// Entry Point für den Test-Ablauf (test.html) und die Ergebnisseite (result.html).
// Er-kennt anhand der vorhandenen DOM-Elemente, welche Seite aktiv ist.

"use strict";

import { TestEngine } from "./test-engine.js";
import { computeScores } from "./scoring.js";
import { renderRadar } from "./chart.js";
import {
  setDisclaimerAccepted, isDisclaimerAccepted,
  hasLocalStoreConsent, grantLocalStoreConsent,
  revokeLocalStoreConsent, saveResult, clearAllLocalData
} from "./storage.js";

// --- gemeinsame Helfer ---

function $(sel, root = document) { return root.querySelector(sel); }

function setYear() {
  const y = $("#year");
  if (y) y.textContent = String(new Date().getFullYear());
}

// --- test.html ---

async function initTestPage() {
  const engineRoot = $("#test-engine-root");
  if (!engineRoot) return false;

  const disclaimerForm = $("#disclaimer-form");
  const testShell = $("#test-shell");

  // Phase 1: Haftungsausschluss & optionale Demografie
  if (!isDisclaimerAccepted()) {
    disclaimerForm.hidden = false;
    testShell.hidden = true;
  } else {
    disclaimerForm.hidden = true;
    testShell.hidden = false;
  }

  disclaimerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(disclaimerForm);
    if (!data.get("accept")) return;
    setDisclaimerAccepted();
    const demographics = {
      age: data.get("age") || null,
      gender: data.get("gender") || null
    };
    disclaimerForm.hidden = true;
    testShell.hidden = false;
    await startEngine(demographics);
  });

  if (isDisclaimerAccepted()) {
    await startEngine(null);
  }
  return true;
}

async function startEngine(demographics) {
  const dom = {
    stimulus: $("#stimulus"),
    question: $("#question"),
    options: $("#options"),
    timer: $("#timer"),
    progressBar: $("#progress-bar-fill"),
    progressLabel: $("#progress-label"),
    nextButton: $("#next-button")
  };
  const engine = new TestEngine(dom);
  try {
    await engine.init();
    if (demographics) engine.setDemographics(demographics);
  } catch (err) {
    const errBox = $("#test-error");
    if (errBox) {
      errBox.hidden = false;
      errBox.textContent = "Der Test konnte nicht geladen werden: " + err.message;
    }
    return;
  }
  dom.nextButton.addEventListener("click", () => engine.confirm());
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !dom.nextButton.disabled && !dom.nextButton.hidden) {
      engine.confirm();
    }
  });
}

// --- result.html ---

async function initResultPage() {
  const resultRoot = $("#result-root");
  if (!resultRoot) return false;

  let raw = null;
  try { raw = JSON.parse(window.sessionStorage.getItem("iqtest.chc.finalResponses") || "null"); }
  catch (_e) { raw = null; }

  if (!raw || !Array.isArray(raw.responses) || raw.responses.length === 0) {
    $("#result-empty").hidden = false;
    $("#result-content").hidden = true;
    return true;
  }

  const normsResp = await fetch("data/norms.json", { cache: "no-cache" });
  const interpsResp = await fetch("data/interpretations.json", { cache: "no-cache" });
  if (!normsResp.ok || !interpsResp.ok) {
    $("#result-empty").hidden = false;
    $("#result-empty").textContent = "Normdaten konnten nicht geladen werden.";
    return true;
  }
  const norms = await normsResp.json();
  const interpretations = await interpsResp.json();

  const result = computeScores(raw.responses, norms);

  renderResultHeadline(result);
  renderDomainTable(result, interpretations);
  renderRadarChart(result, interpretations);
  renderInterpretation(result, interpretations);
  setupConsentControls(result);

  $("#result-empty").hidden = true;
  $("#result-content").hidden = false;

  $("#retake-button")?.addEventListener("click", () => {
    try { window.sessionStorage.removeItem("iqtest.chc.finalResponses"); } catch (_e) { /**/ }
    window.location.href = "test.html";
  });

  $("#print-button")?.addEventListener("click", () => window.print());

  return true;
}

function renderResultHeadline(result) {
  $("#iq-value").textContent = String(result.totalIQ);
  $("#iq-range").textContent = `${result.ci95Lower} – ${result.ci95Upper}`;
  $("#iq-percentile").textContent = String(result.percentile);
  $("#iq-sem").textContent = String(result.sem.toFixed(1));
}

function renderDomainTable(result, interpretations) {
  const tbody = $("#domain-table tbody");
  if (!tbody) return;
  tbody.replaceChildren();
  for (const d of result.domainScores) {
    const info = interpretations.domains?.[d.domain];
    const tr = document.createElement("tr");
    const n = document.createElement("td");
    n.textContent = info?.name ?? d.domain;
    const s = document.createElement("td");
    s.textContent = info?.short ?? d.domain;
    const iq = document.createElement("td");
    iq.textContent = String(d.iq);
    iq.className = "num";
    const z = document.createElement("td");
    z.textContent = d.z.toFixed(2);
    z.className = "num";
    tr.append(n, s, iq, z);
    tbody.appendChild(tr);
  }
}

function renderRadarChart(result, interpretations) {
  const container = $("#radar-container");
  if (!container) return;
  const labels = result.domainScores.map((d) =>
    interpretations.domains?.[d.domain]?.short ?? d.domain
  );
  const values = result.domainScores.map((d) => d.iq);
  renderRadar(container, { labels, values, axisMin: 55, axisMax: 145 });
}

function renderInterpretation(result, interpretations) {
  const band = (interpretations.iq_bands || []).find(
    (b) => result.totalIQ >= b.min && result.totalIQ <= b.max
  );
  const bandBox = $("#band-text");
  if (bandBox && band) {
    $("#band-label").textContent = band.label;
    bandBox.textContent = band.text;
  }

  const sorted = [...result.domainScores].sort((a, b) => b.iq - a.iq);
  const top = sorted.slice(0, 3);
  const bottom = sorted.slice(-3).reverse();

  function fill(id, list, kind) {
    const ul = document.querySelector(id);
    if (!ul) return;
    ul.replaceChildren();
    for (const d of list) {
      const info = interpretations.domains?.[d.domain];
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = `${info?.name ?? d.domain} (IQ ${d.iq}): `;
      li.appendChild(strong);
      li.appendChild(document.createTextNode(
        kind === "strength" ? info?.strength ?? "" : info?.weakness ?? ""
      ));
      ul.appendChild(li);
    }
  }
  fill("#strengths-list", top, "strength");
  fill("#weaknesses-list", bottom, "weakness");
}

function setupConsentControls(result) {
  const checkbox = $("#local-store-consent");
  if (!checkbox) return;
  checkbox.checked = hasLocalStoreConsent();
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      grantLocalStoreConsent();
      saveResult(result);
      $("#local-store-status").textContent = "Ergebnis lokal gespeichert.";
    } else {
      revokeLocalStoreConsent();
      $("#local-store-status").textContent = "Lokale Speicherung deaktiviert.";
    }
  });
  $("#clear-local-data")?.addEventListener("click", () => {
    clearAllLocalData();
    checkbox.checked = false;
    $("#local-store-status").textContent = "Alle lokalen Daten gelöscht.";
  });
}

// --- Init ---

document.addEventListener("DOMContentLoaded", async () => {
  setYear();
  if (await initTestPage()) return;
  if (await initResultPage()) return;
});
