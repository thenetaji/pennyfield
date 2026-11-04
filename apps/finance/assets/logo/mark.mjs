// Source of the app logo: a brushed-silver receipt with a torn edge and a champagne total line, on a graphite field.
// `render.mjs` writes these SVGs next to this file and renders them to the PNGs app.json points at.

const FIELD = { top: "#2C2C30", mid: "#131315", base: "#050506" };
const PAPER = ["#FAFAFB", "#B4B6BC"];
const GOLD = ["#F3D9A4", "#B98A47"];
const INK = "#1C1C1F";

/** Receipt geometry at scale 1, centred on (512, 512). */
const RECEIPT = { w: 500, h: 650, r: 72, teeth: 5, depth: 48 };
const LINES = [
  { y: 130, w: 236, h: 40, ink: 0.24 },
  { y: 214, w: 336, h: 40, ink: 0.24 },
  { y: 298, w: 280, h: 40, ink: 0.24 },
];
const LABEL = { y: 420, w: 110, h: 40 };
const TOTAL = { y: 410, w: 190, h: 60 };

const fx = (n) => +n.toFixed(2);

function receiptPath(scale) {
  const w = RECEIPT.w * scale;
  const h = RECEIPT.h * scale;
  const r = RECEIPT.r * scale;
  const depth = RECEIPT.depth * scale;
  const x = 512 - w / 2;
  const y = 512 - h / 2 - 6 * scale;
  const tooth = w / RECEIPT.teeth;
  const parts = [
    `M ${fx(x)} ${fx(y + r)}`,
    `A ${fx(r)} ${fx(r)} 0 0 1 ${fx(x + r)} ${fx(y)}`,
    `L ${fx(x + w - r)} ${fx(y)}`,
    `A ${fx(r)} ${fx(r)} 0 0 1 ${fx(x + w)} ${fx(y + r)}`,
    `L ${fx(x + w)} ${fx(y + h)}`,
  ];
  for (let i = RECEIPT.teeth - 1; i >= 0; i--) {
    parts.push(`L ${fx(x + i * tooth + tooth / 2)} ${fx(y + h - depth)}`);
    parts.push(`L ${fx(x + i * tooth)} ${fx(y + h)}`);
  }
  parts.push("Z");
  return { d: parts.join(" "), x, y, w };
}

function pill(x, y, w, h) {
  const r = h / 2;
  return `M ${fx(x + r)} ${fx(y)} L ${fx(x + w - r)} ${fx(y)} A ${fx(r)} ${fx(r)} 0 0 1 ${fx(x + w - r)} ${fx(y + h)} L ${fx(x + r)} ${fx(y + h)} A ${fx(r)} ${fx(r)} 0 0 1 ${fx(x + r)} ${fx(y)} Z`;
}

/** The receipt and its line pills at `scale` (1 = iOS icon). */
function geometry(scale) {
  const paper = receiptPath(scale);
  const inset = 72 * scale;
  const lines = LINES.map((l) =>
    pill(paper.x + inset, paper.y + l.y * scale, l.w * scale, l.h * scale),
  );
  const label = pill(
    paper.x + inset,
    paper.y + LABEL.y * scale,
    LABEL.w * scale,
    LABEL.h * scale,
  );
  const total = pill(
    paper.x + paper.w - inset - TOTAL.w * scale,
    paper.y + TOTAL.y * scale,
    TOTAL.w * scale,
    TOTAL.h * scale,
  );
  return { scale, paper: paper.d, lines: [...lines, label], total };
}

const svg = (body, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs ? `\n  <defs>${defs}\n  </defs>` : ""}${body}\n</svg>\n`;

/** Full-colour receipt: shaded paper with a soft top-edge light, ink lines, a gold total and one shadow beneath. */
function colourMark(g, { shadow = 0.45, highlight = true } = {}) {
  const { scale } = g;
  const defs = `
    <filter id="shadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="${fx(24 * scale)}" stdDeviation="${fx(30 * scale)}" flood-color="#000" flood-opacity="${shadow}"/></filter>
    <filter id="soften" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="${fx(3 * scale)}"/></filter>
    <linearGradient id="paper" x1="0" y1="0" x2="0.55" y2="1">
      <stop offset="0" stop-color="${PAPER[0]}"/><stop offset="1" stop-color="${PAPER[1]}"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GOLD[0]}"/><stop offset="1" stop-color="${GOLD[1]}"/>
    </linearGradient>
    <clipPath id="clip"><path d="${g.paper}"/></clipPath>
    <mask id="edge" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
      <path d="${g.paper}" fill="#fff"/><path d="${g.paper}" fill="#000" transform="translate(0 ${fx(10 * scale)})" filter="url(#soften)"/>
    </mask>`;
  const lines = g.lines
    .map(
      (d, i) =>
        `\n    <path d="${d}" fill="${INK}" fill-opacity="${i < LINES.length ? LINES[i].ink : 0.42}"/>`,
    )
    .join("");
  const body = `
  <g${shadow ? ' filter="url(#shadow)"' : ""}>
    <path d="${g.paper}" fill="url(#paper)"/>
  </g>${highlight ? `\n  <g clip-path="url(#clip)"><rect width="1024" height="1024" fill="#fff" fill-opacity="0.7" mask="url(#edge)"/></g>` : ""}${lines}
    <path d="${g.total}" fill="url(#gold)"/>`;
  return { defs, body };
}

/** Flat silhouette with the lines cut out (Android themed icon), or grays on black (iOS tinted). */
function flatMark(g, { color, tinted = false } = {}) {
  if (tinted) {
    const lines = g.lines
      .map((d) => `\n  <path d="${d}" fill="#5A5A5A"/>`)
      .join("");
    return {
      defs: "",
      body: `\n  <path d="${g.paper}" fill="#C8C8C8"/>${lines}\n  <path d="${g.total}" fill="#FFFFFF"/>`,
    };
  }
  const cut = [...g.lines, g.total]
    .map((d) => `<path d="${d}" fill="#000"/>`)
    .join("");
  const defs = `
    <mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
      <rect width="1024" height="1024" fill="#fff"/>${cut}
    </mask>`;
  return {
    defs,
    body: `\n  <path d="${g.paper}" fill="${color}" mask="url(#cut)"/>`,
  };
}

const fieldDefs = `
    <radialGradient id="field" cx="0.3" cy="0.1" r="1.1">
      <stop offset="0" stop-color="${FIELD.top}"/><stop offset="0.55" stop-color="${FIELD.mid}"/><stop offset="1" stop-color="${FIELD.base}"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.07"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>`;
const field = `\n  <rect width="1024" height="1024" fill="url(#field)"/>`;
const sheen = `\n  <rect width="1024" height="1024" fill="url(#sheen)"/>`;

/** Background colour for app.json's android.adaptiveIcon.backgroundColor (the field's mid tone). */
export const BACKGROUND = FIELD.mid;

/** iOS / default icon: full-bleed graphite field, colour receipt. Opaque. */
export function appIcon() {
  const m = colourMark(geometry(1));
  return svg(field + m.body + sheen, fieldDefs + m.defs);
}

/** iOS dark appearance: the receipt on transparent; the system supplies its dark backdrop. */
export function appIconDark() {
  const m = colourMark(geometry(1), { shadow: 0.3 });
  return svg(m.body, m.defs);
}

/** iOS tinted appearance: grayscale on black; the system maps luminance to the user's tint. */
export function appIconTinted() {
  const m = flatMark(geometry(1), { tinted: true });
  return svg(`\n  <rect width="1024" height="1024" fill="#000"/>${m.body}`);
}

/** Android adaptive foreground: transparent, inside the 66dp safe circle (r ≈ 313px of 1024). */
const ANDROID_SCALE = 0.72;
export function androidForeground() {
  const m = colourMark(geometry(ANDROID_SCALE), { shadow: 0.36 });
  return svg(m.body, m.defs);
}

export function androidMonochrome() {
  const m = flatMark(geometry(ANDROID_SCALE), { color: "#fff" });
  return svg(m.body, m.defs);
}

export function androidBackground() {
  return svg(field + sheen, fieldDefs);
}

/** Web favicon: a little larger and no rim light, so it holds at 16–32px. */
export function favicon() {
  const m = colourMark(geometry(1.12), { shadow: 0.3, highlight: false });
  return svg(field + m.body, fieldDefs + m.defs);
}
