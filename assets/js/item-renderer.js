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

function sanitizeSVG(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const errorNode = doc.querySelector("parsererror");
  if (errorNode) return null;
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") return null;
  sanitizeNode(root);
  return root;
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
  if (item.stimulus_type === "svg") {
    const svg = sanitizeSVG(item.stimulus);
    if (svg) {
      svg.setAttribute("class", "item-svg");
      container.appendChild(document.importNode(svg, true));
      return;
    }
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
      const svg = sanitizeSVG(String(opt));
      if (svg) content.appendChild(document.importNode(svg, true));
      else content.textContent = "[Grafik konnte nicht geladen werden]";
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
