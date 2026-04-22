// assets/js/item-renderer.js
// Sichere Rendering-Helfer für Test-Items.
// - Text-Items: reine Textausgabe, nl2br fürs Lesen.
// - SVG-Items: strenge Whitelist der zulässigen Elemente/Attribute,
//   keine Skripte, keine event-Handler, keine externen Referenzen.

"use strict";

const ALLOWED_TAGS = new Set([
  "svg", "g", "defs", "clipPath", "rect", "circle", "ellipse", "line",
  "polyline", "polygon", "path", "text", "tspan", "use", "title", "desc"
]);

const ALLOWED_ATTRS = new Set([
  "viewBox", "xmlns", "role", "aria-label", "aria-hidden",
  "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry",
  "width", "height", "d", "points",
  "fill", "stroke", "stroke-width", "stroke-linejoin", "stroke-linecap",
  "stroke-dasharray", "opacity", "fill-opacity", "stroke-opacity",
  "transform", "font-size", "font-family", "text-anchor", "dominant-baseline",
  "clip-path", "id", "class"
]);

function sanitizeSVG(svgString, itemId) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const errorNode = doc.querySelector("parsererror");
    if (errorNode) {
      console.error(`[item-renderer] SVG-Parse-Fehler für ${itemId ?? "?"}`, errorNode.textContent);
      return null;
    }
    const root = doc.documentElement;
    if (!root || root.tagName.toLowerCase() !== "svg") {
      console.error(`[item-renderer] Kein <svg>-Root für ${itemId ?? "?"}, gefunden:`, root?.tagName);
      return null;
    }
    sanitizeNode(root);
    if (root.children.length === 0) {
      console.warn(`[item-renderer] Sanitizer hat alle Kinder entfernt bei ${itemId ?? "?"}`);
    }
    return root;
  } catch (e) {
    console.error(`[item-renderer] sanitizeSVG werfend für ${itemId ?? "?"}:`, e);
    return null;
  }
}

function fallbackPlaceholder(label) {
  const div = document.createElement("div");
  div.className = "svg-fallback";
  div.setAttribute("role", "img");
  div.setAttribute("aria-label", label || "Grafik konnte nicht geladen werden");
  div.textContent = "⚠ Grafik konnte nicht geladen werden";
  return div;
}

// --- Transformations-Icons (inline SVG, 24×24, stroke=currentColor) ---
// Bewusst minimalistisch und Font-unabhängig, damit sie auf allen Geräten
// identisch aussehen (statt Unicode-Pfeile ⟳/⟲/→).
const TRANSFORM_ICONS = {
  "rotate-cw": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3.5-7.1"/><polyline points="21 4 21 10 15 10"/></svg>',
  "rotate-ccw": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3.5-7.1"/><polyline points="3 4 3 10 9 10"/></svg>',
  "rotate-180": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3"/><polyline points="18 2 18 7 13 7"/><path d="M20 12a8 8 0 0 1-14 5.3"/><polyline points="6 22 6 17 11 17"/></svg>',
  "mirror-v": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="3 3"/><polygon points="4 6 10 12 4 18" fill="currentColor" stroke="none"/><polygon points="20 6 14 12 20 18" fill="currentColor" stroke="none"/></svg>',
  "mirror-h": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="3 3"/><polygon points="6 4 12 10 18 4" fill="currentColor" stroke="none"/><polygon points="6 20 12 14 18 20" fill="currentColor" stroke="none"/></svg>',
  "fold": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h10l6 6v8H4z"/><polyline points="14 5 14 11 20 11"/></svg>',
  "search": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="7"/><line x1="15" y1="15" x2="21" y2="21"/></svg>',
  "question": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.5c-0.8 0.5-1 1-1 2"/><circle cx="12" cy="17" r="0.8" fill="currentColor"/></svg>'
};

function renderTransformationBadge(transformation) {
  if (!transformation) return null;
  const wrap = document.createElement("div");
  wrap.className = "transform-badge";
  const iconKey = transformation.icon || "question";
  const iconSvg = TRANSFORM_ICONS[iconKey] || TRANSFORM_ICONS.question;
  const iconBox = document.createElement("span");
  iconBox.className = "transform-badge-icon";
  const parsed = sanitizeSVG(iconSvg, `icon:${iconKey}`);
  if (parsed) iconBox.appendChild(document.importNode(parsed, true));
  wrap.appendChild(iconBox);
  const text = document.createElement("span");
  text.className = "transform-badge-label";
  text.textContent = transformation.label || "";
  wrap.appendChild(text);
  return wrap;
}

function sanitizeNode(node) {
  const toRemove = [];
  for (const child of Array.from(node.children)) {
    const name = child.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) {
      toRemove.push(child);
      continue;
    }
    sanitizeNode(child);
  }
  toRemove.forEach((c) => c.remove());

  for (const attr of Array.from(node.attributes)) {
    const n = attr.name.toLowerCase();
    if (n.startsWith("on")) {
      node.removeAttribute(attr.name);
      continue;
    }
    if (!ALLOWED_ATTRS.has(attr.name) && !ALLOWED_ATTRS.has(n)) {
      node.removeAttribute(attr.name);
      continue;
    }
    const val = attr.value.trim().toLowerCase();
    if (val.startsWith("javascript:") || val.startsWith("data:")) {
      node.removeAttribute(attr.name);
    }
  }
}

/**
 * Rendert den Stimulus eines Items in den übergebenen Container.
 * @param {HTMLElement} container
 * @param {object} item
 */
export function renderStimulus(container, item) {
  container.replaceChildren();
  const badge = renderTransformationBadge(item.transformation);
  if (item.stimulus_type === "svg") {
    const svg = sanitizeSVG(item.stimulus, item.id);
    if (svg) {
      svg.setAttribute("class", "item-svg");
      container.appendChild(document.importNode(svg, true));
      if (badge) container.appendChild(badge);
      return;
    }
    container.appendChild(fallbackPlaceholder(`Grafik zu ${item.id} konnte nicht geladen werden`));
    if (badge) container.appendChild(badge);
    return;
  }
  if (item.stimulus_type === "memory") {
    // Memory-Items werden separat via runMemoryDisplay behandelt.
    const p = document.createElement("p");
    p.className = "item-text";
    p.textContent = item.stimulus || "";
    container.appendChild(p);
    return;
  }
  // Text (default)
  const text = String(item.stimulus ?? "");
  const lines = text.split("\n");
  for (const line of lines) {
    const p = document.createElement("p");
    p.className = "item-text";
    p.textContent = line;
    container.appendChild(p);
  }
  if (badge) container.appendChild(badge);
}

/**
 * Rendert die Optionen und liefert den Index der gewählten Option via Callback.
 * @param {HTMLElement} container
 * @param {object} item
 * @param {(index:number)=>void} onSelect
 */
export function renderOptions(container, item, onSelect) {
  container.replaceChildren();
  const options = Array.isArray(item.options) ? item.options : [];
  container.setAttribute("data-count", String(options.length));
  container.setAttribute("data-mode", item.options_type === "svg" ? "svg" : "text");
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
  options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option";
    btn.setAttribute("data-index", String(idx));
    btn.setAttribute("aria-label", `Option ${letters[idx] ?? idx + 1}`);

    const marker = document.createElement("span");
    marker.className = "option-marker";
    marker.textContent = letters[idx] ?? String(idx + 1);
    btn.appendChild(marker);

    const content = document.createElement("span");
    content.className = "option-content";
    if (item.options_type === "svg") {
      const svg = sanitizeSVG(String(opt), `${item.id}#opt${idx}`);
      if (svg) content.appendChild(document.importNode(svg, true));
      else content.appendChild(fallbackPlaceholder(`Option ${letters[idx] ?? idx + 1}`));
    } else {
      content.textContent = String(opt);
    }
    btn.appendChild(content);

    btn.addEventListener("click", () => onSelect(idx));
    container.appendChild(btn);
  });
}

/**
 * Setzt die Fokus-/Auswahl-Darstellung auf einem Options-Button.
 * @param {HTMLElement} container
 * @param {number} index
 */
export function markSelected(container, index) {
  container.querySelectorAll(".option").forEach((btn) => {
    const idx = Number(btn.getAttribute("data-index"));
    btn.classList.toggle("selected", idx === index);
    btn.setAttribute("aria-pressed", String(idx === index));
  });
}

/**
 * Zeigt eine Memory-Sequenz temporär, ruft danach onDone() auf.
 * @param {HTMLElement} container
 * @param {string} sequence    anzuzeigender Text
 * @param {number} durationMs
 * @param {()=>void} onDone
 * @returns {()=>void} Cancel-Funktion
 */
export function runMemoryDisplay(container, sequence, durationMs, onDone) {
  container.replaceChildren();
  const box = document.createElement("div");
  box.className = "memory-box";
  box.setAttribute("aria-live", "assertive");
  box.textContent = sequence;
  container.appendChild(box);

  const note = document.createElement("p");
  note.className = "memory-note";
  note.textContent = `Einprägen… (${Math.round(durationMs / 1000)} s)`;
  container.appendChild(note);

  const timer = setTimeout(() => {
    box.textContent = "•  •  •  •  •";
    box.setAttribute("aria-label", "Sequenz ausgeblendet");
    note.textContent = "Sequenz ausgeblendet. Bitte antworten Sie unten.";
    onDone();
  }, durationMs);

  return () => clearTimeout(timer);
}
