// assets/js/scoring.js
// Scoring-Engine für den CHC-basierten IQ-Test.
// Alle Berechnungen erfolgen clientseitig. Keine Server-Kommunikation.
//
// Wissenschaftliche Grundlage:
//  - Cattell-Horn-Carroll-Modell (CHC): 6 erfasste Broad Abilities.
//  - Item-Response-Theorie (Rasch-Ansatz) als Näherung:
//      P(korrekt | theta=0, b) = 1 / (1 + exp(b)).
//  - Transformation in die Wechsler-IQ-Skala (M=100, SD=15).
//  - Reliabilitätsannahme r_xx = 0.85 (theoretisch, transparent dokumentiert).
//  - SEM = 15 * sqrt(1 - r_xx) ~ 5.81, 95%-KI ~ IQ ± 11.
//  - Prozentrang aus der Standardnormalverteilung (Abramowitz-Stegun-erf).

"use strict";

/** g-Ladungs-Gewichte der Domänen für den Gesamtwert. */
export const DOMAIN_WEIGHTS = Object.freeze({
  Gf: 0.30,
  Gc: 0.20,
  Gv: 0.15,
  Gs: 0.10,
  Gsm: 0.10,
  Gq: 0.15
});

export const RELIABILITY = 0.85;
export const SEM = 15 * Math.sqrt(1 - RELIABILITY); // ≈ 5.806
export const IQ_MIN = 55;
export const IQ_MAX = 145;

/**
 * Abramowitz-Stegun-Approximation 7.1.26 der Fehlerfunktion.
 * Maximale absolute Abweichung < 1.5e-7.
 * @param {number} x
 * @returns {number} erf(x)
 */
export function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

/**
 * Standardnormalverteilungs-CDF.
 * @param {number} z
 * @returns {number} Phi(z) in [0,1]
 */
export function normalCDF(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Schwierigkeitsgewichtung eines Items: je schwerer (höheres b),
 * desto höher der Punktwert bei korrekter Antwort.
 * @param {number} b  Schwierigkeitsparameter auf Logit-Skala
 */
export function itemWeight(b) {
  return 1 + 0.3 * b;
}

/**
 * Rohwert pro Domäne aus den Antworten.
 * @param {Array<{domain:string, correct:boolean, difficulty_b:number}>} responses
 * @returns {Record<string, number>}
 */
export function computeRawScores(responses) {
  const raw = { Gf: 0, Gc: 0, Gv: 0, Gs: 0, Gsm: 0, Gq: 0 };
  for (const r of responses) {
    if (!(r.domain in raw)) continue;
    if (r.correct === true) {
      raw[r.domain] += itemWeight(r.difficulty_b);
    }
  }
  return raw;
}

/**
 * Z-Werte pro Domäne gegenüber theoretischer Referenzverteilung.
 * @param {Record<string, number>} raw
 * @param {{domains: Record<string, {mu:number, sigma:number}>}} norms
 * @returns {Record<string, number>}
 */
export function computeDomainZ(raw, norms) {
  const z = {};
  for (const d of Object.keys(raw)) {
    const n = norms.domains?.[d];
    if (!n || n.sigma <= 0) {
      z[d] = 0;
      continue;
    }
    z[d] = (raw[d] - n.mu) / n.sigma;
  }
  return z;
}

/** Begrenzt einen IQ-Wert auf den sinnvoll messbaren Anzeigebereich. */
export function clampIQ(iq) {
  if (!Number.isFinite(iq)) return 100;
  return Math.max(IQ_MIN, Math.min(IQ_MAX, iq));
}

/**
 * Ermittelt die IQ-Band-Interpretation (Kategorie + Text) zu einem Wert.
 * @param {Array<{min:number,max:number,label:string,text:string}>} bands
 * @param {number} iq
 */
export function findBand(bands, iq) {
  for (const band of bands) {
    if (iq >= band.min && iq <= band.max) return band;
  }
  return null;
}

/**
 * Haupt-Scoring-Funktion.
 * @param {Array<object>} responses
 * @param {object} norms
 * @returns {{
 *   totalIQ:number, iqRaw:number, ci95Lower:number, ci95Upper:number,
 *   percentile:number, totalZ:number,
 *   domainScores: Array<{domain:string, raw:number, z:number, iq:number}>,
 *   reliability:number, sem:number
 * }}
 */
export function computeScores(responses, norms) {
  const raw = computeRawScores(responses);
  const z = computeDomainZ(raw, norms);

  // Gesamt-Z als gewichteter Mittelwert der Domänen-Z-Werte.
  let totalZ = 0;
  let weightSum = 0;
  for (const [domain, weight] of Object.entries(DOMAIN_WEIGHTS)) {
    totalZ += weight * z[domain];
    weightSum += weight;
  }
  if (weightSum > 0) totalZ = totalZ / weightSum;

  const iqRaw = 100 + 15 * totalZ;
  const totalIQ = Math.round(clampIQ(iqRaw));
  const ci95Lower = Math.round(clampIQ(iqRaw - 1.96 * SEM));
  const ci95Upper = Math.round(clampIQ(iqRaw + 1.96 * SEM));

  const percentile = Math.max(1, Math.min(99, Math.round(normalCDF(totalZ) * 100)));

  const domainScores = Object.keys(DOMAIN_WEIGHTS).map((d) => ({
    domain: d,
    raw: Number(raw[d].toFixed(2)),
    z: Number(z[d].toFixed(3)),
    iq: Math.round(clampIQ(100 + 15 * z[d]))
  }));

  return {
    totalIQ,
    iqRaw: Number(iqRaw.toFixed(2)),
    ci95Lower,
    ci95Upper,
    percentile,
    totalZ: Number(totalZ.toFixed(3)),
    domainScores,
    reliability: RELIABILITY,
    sem: Number(SEM.toFixed(2))
  };
}

/**
 * Debug-Hilfe: Sanity-Check der Scoring-Funktion.
 * Alle korrekt → IQ nahe Maximum, 50% korrekt → IQ nahe 100, alle falsch → Minimum.
 * Nur in Entwicklungsumgebung aufrufen.
 */
export function runSelfTest(items, norms) {
  const mkResponses = (correctFn) => items.map((it) => ({
    domain: it.domain,
    correct: correctFn(it),
    difficulty_b: it.difficulty_b
  }));

  const allCorrect = computeScores(mkResponses(() => true), norms);
  const halfCorrect = computeScores(
    mkResponses((_, i) => i % 2 === 0),
    norms
  );
  const allWrong = computeScores(mkResponses(() => false), norms);

  return { allCorrect, halfCorrect, allWrong };
}
