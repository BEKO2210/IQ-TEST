// assets/js/storage.js
// Dünner Wrapper um localStorage/sessionStorage mit Consent-Check.
// Datenminimal: speichert ausschließlich das, was der Nutzer aktiv veranlasst.
// Keine Server-Kommunikation.

"use strict";

const KEY_PREFIX = "iqtest.chc.";
const KEY_RESULT = KEY_PREFIX + "lastResult";
const KEY_CONSENT_STORE = KEY_PREFIX + "consent.localStore";
const KEY_DISCLAIMER = KEY_PREFIX + "disclaimerAccepted"; // sessionStorage
const KEY_SESSION = KEY_PREFIX + "session"; // laufende Testsitzung

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch (_e) { return fallback; }
}

function hasLocalStorage() {
  try {
    const t = KEY_PREFIX + "__probe";
    window.localStorage.setItem(t, "1");
    window.localStorage.removeItem(t);
    return true;
  } catch (_e) { return false; }
}

function hasSessionStorage() {
  try {
    const t = KEY_PREFIX + "__probe";
    window.sessionStorage.setItem(t, "1");
    window.sessionStorage.removeItem(t);
    return true;
  } catch (_e) { return false; }
}

// --- Disclaimer (sessionStorage, technisch notwendig nach § 25 Abs. 2 Nr. 2 TTDSG) ---

export function setDisclaimerAccepted() {
  if (!hasSessionStorage()) return;
  window.sessionStorage.setItem(KEY_DISCLAIMER, String(Date.now()));
}

export function isDisclaimerAccepted() {
  if (!hasSessionStorage()) return false;
  return window.sessionStorage.getItem(KEY_DISCLAIMER) !== null;
}

// --- Laufende Testsitzung (sessionStorage) ---

export function saveSessionProgress(state) {
  if (!hasSessionStorage()) return;
  try { window.sessionStorage.setItem(KEY_SESSION, JSON.stringify(state)); }
  catch (_e) { /* Quota überschritten – ignorieren */ }
}

export function loadSessionProgress() {
  if (!hasSessionStorage()) return null;
  const raw = window.sessionStorage.getItem(KEY_SESSION);
  if (!raw) return null;
  return safeParse(raw, null);
}

export function clearSessionProgress() {
  if (!hasSessionStorage()) return;
  window.sessionStorage.removeItem(KEY_SESSION);
}

// --- Ergebnis-Persistenz (localStorage, nur mit Consent) ---

export function hasLocalStoreConsent() {
  if (!hasLocalStorage()) return false;
  return window.localStorage.getItem(KEY_CONSENT_STORE) === "1";
}

export function grantLocalStoreConsent() {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(KEY_CONSENT_STORE, "1");
}

export function revokeLocalStoreConsent() {
  if (!hasLocalStorage()) return;
  window.localStorage.removeItem(KEY_CONSENT_STORE);
  window.localStorage.removeItem(KEY_RESULT);
}

export function saveResult(result) {
  if (!hasLocalStorage()) return false;
  if (!hasLocalStoreConsent()) return false;
  try {
    window.localStorage.setItem(KEY_RESULT, JSON.stringify({
      savedAt: new Date().toISOString(),
      result
    }));
    return true;
  } catch (_e) {
    return false;
  }
}

export function loadResult() {
  if (!hasLocalStorage()) return null;
  const raw = window.localStorage.getItem(KEY_RESULT);
  if (!raw) return null;
  return safeParse(raw, null);
}

export function clearAllLocalData() {
  if (!hasLocalStorage()) return;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(KEY_PREFIX))
    .forEach((k) => window.localStorage.removeItem(k));
  if (hasSessionStorage()) {
    Object.keys(window.sessionStorage)
      .filter((k) => k.startsWith(KEY_PREFIX))
      .forEach((k) => window.sessionStorage.removeItem(k));
  }
}
