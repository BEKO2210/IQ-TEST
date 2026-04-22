// assets/js/chart.js
// Minimaler, abhängigkeitsfreier Radar-Chart in reinem SVG.
// Input: Liste {label, value, max} – rendert sauber skalierte Polygone.

"use strict";

const NS = "http://www.w3.org/2000/svg";

/**
 * Zeichnet ein Radar-Chart in den Container.
 * @param {HTMLElement} container
 * @param {{labels:string[], values:number[], axisMin:number, axisMax:number}} data
 */
export function renderRadar(container, data) {
  container.replaceChildren();
  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 150;
  const n = data.labels.length;

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Radar-Diagramm der Domänenwerte");
  svg.setAttribute("class", "radar");

  const rings = 4;
  for (let i = 1; i <= rings; i++) {
    const r = (radius * i) / rings;
    const pts = [];
    for (let j = 0; j < n; j++) {
      const ang = angle(j, n);
      pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
    }
    const ring = document.createElementNS(NS, "polygon");
    ring.setAttribute("points", pts.join(" "));
    ring.setAttribute("class", "radar-ring");
    svg.appendChild(ring);
  }

  // Axes and labels
  for (let j = 0; j < n; j++) {
    const ang = angle(j, n);
    const x = cx + radius * Math.cos(ang);
    const y = cy + radius * Math.sin(ang);
    const axis = document.createElementNS(NS, "line");
    axis.setAttribute("x1", cx);
    axis.setAttribute("y1", cy);
    axis.setAttribute("x2", x);
    axis.setAttribute("y2", y);
    axis.setAttribute("class", "radar-axis");
    svg.appendChild(axis);

    const lx = cx + (radius + 28) * Math.cos(ang);
    const ly = cy + (radius + 28) * Math.sin(ang);
    const label = document.createElementNS(NS, "text");
    label.setAttribute("x", lx);
    label.setAttribute("y", ly);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dominant-baseline", "middle");
    label.setAttribute("class", "radar-label");
    label.textContent = data.labels[j];
    svg.appendChild(label);
  }

  // Mittellinie bei IQ 100 (klinische Referenz)
  const midVal = 100;
  const midPts = [];
  for (let j = 0; j < n; j++) {
    const ang = angle(j, n);
    const ratio = clamp((midVal - data.axisMin) / (data.axisMax - data.axisMin), 0, 1);
    const r = radius * ratio;
    midPts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
  }
  const midPoly = document.createElementNS(NS, "polygon");
  midPoly.setAttribute("points", midPts.join(" "));
  midPoly.setAttribute("class", "radar-reference");
  svg.appendChild(midPoly);

  // Daten-Polygon
  const dataPts = [];
  data.values.forEach((v, j) => {
    const ang = angle(j, n);
    const ratio = clamp((v - data.axisMin) / (data.axisMax - data.axisMin), 0, 1);
    const r = radius * ratio;
    dataPts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
  });
  const poly = document.createElementNS(NS, "polygon");
  poly.setAttribute("points", dataPts.join(" "));
  poly.setAttribute("class", "radar-data");
  svg.appendChild(poly);

  // Data dots
  data.values.forEach((v, j) => {
    const ang = angle(j, n);
    const ratio = clamp((v - data.axisMin) / (data.axisMax - data.axisMin), 0, 1);
    const r = radius * ratio;
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", cx + r * Math.cos(ang));
    dot.setAttribute("cy", cy + r * Math.sin(ang));
    dot.setAttribute("r", 4);
    dot.setAttribute("class", "radar-dot");
    svg.appendChild(dot);
  });

  container.appendChild(svg);
}

function angle(index, n) {
  return (-Math.PI / 2) + (index * 2 * Math.PI) / n;
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}
