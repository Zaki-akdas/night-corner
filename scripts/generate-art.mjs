import fs from "node:fs";
import path from "node:path";

const PUB = path.join(process.cwd(), "public");
const IMG = path.join(PUB, "images", "products");
const CAT = path.join(PUB, "images", "categories");
fs.mkdirSync(IMG, { recursive: true });
fs.mkdirSync(CAT, { recursive: true });

// ----- read products/categories from the prisma seed-data ts (strip types) -----
const src = fs.readFileSync(
  path.join(process.cwd(), "prisma", "products.ts"),
  "utf8"
);
function evalArray(name) {
  const start = src.indexOf("export const " + name);
  const eq = src.indexOf("=", start);
  // find matching array bracket
  let i = src.indexOf("[", eq);
  let depth = 0,
    end = i;
  for (; end < src.length; end++) {
    if (src[end] === "[") depth++;
    else if (src[end] === "]") {
      depth--;
      if (depth === 0) break;
    }
  }
  // String-aware transform: quote keys and convert single-quoted strings to
  // double-quoted strings while preserving apostrophes *inside* strings.
  let out = "";
  let inStr = false,
    strCh = "";
  for (let k = 0; k < src.slice(i, end + 1).length; k++) {
    const ch = src[i + k];
    const prev = src[i + k - 1];
    if (inStr) {
      if (ch === strCh && prev !== "\\") inStr = false;
      out += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = true;
      strCh = ch;
      out += '"';
    } else {
      out += ch;
    }
  }
  // unquoted object keys
  out = out.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
  return Function('"use strict";return (' + out + ")")();
}
const CATEGORIES = evalArray("CATEGORIES");
const PRODUCTS = evalArray("PRODUCTS");

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/—.*$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Escape text for safe embedding in SVG/XML (raw `&` would break the file).
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// ---------------- LOGO ----------------
function logoSvg({ icon = false } = {}) {
  if (icon) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1f2560"/><stop offset="100%" stop-color="#05060f"/>
    </radialGradient>
    <linearGradient id="moon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fde68a"/><stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bg)"/>
  <g filter="url(#glow)">
    <path d="M88 30a34 34 0 1 0 10 44 27 27 0 0 1-10-44z" fill="url(#moon)" stroke="#38bdf8" stroke-width="2"/>
    <path d="M30 96h68l-6 14H36z" fill="#a855f7" opacity="0.85"/>
    <path d="M26 96h76v6H26z" fill="#38bdf8"/>
    <path d="M40 96V70a6 6 0 0 1 6-6h36a6 6 0 0 1 6 6v26z" fill="none" stroke="#a855f7" stroke-width="3"/>
    <text x="64" y="88" text-anchor="middle" font-family="Arial Black,Arial" font-size="26" fill="#fff">N</text>
  </g>
</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 110" width="420" height="110">
  <defs>
    <linearGradient id="txt" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#c084fc"/><stop offset="50%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#fbbf24"/>
    </linearGradient>
    <linearGradient id="moon2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fde68a"/><stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
    <filter id="g2" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g filter="url(#g2)">
    <circle cx="54" cy="55" r="30" fill="#0a0c1e" stroke="#a855f7" stroke-width="2"/>
    <path d="M64 34a22 22 0 1 0 6 28 17 17 0 0 1-6-28z" fill="url(#moon2)"/>
    <path d="M30 86h48l-4 10H34z" fill="#a855f7" opacity="0.9"/>
    <text x="54" y="80" text-anchor="middle" font-family="Arial Black" font-size="18" fill="#fff">N</text>
  </g>
  <text x="104" y="58" font-family="Arial Black,Arial" font-size="34" letter-spacing="3" fill="url(#txt)">NIGHT CORNER</text>
  <text x="106" y="84" font-family="Arial" font-size="13" letter-spacing="3" fill="#94a3b8">YOUR NIGHT. YOUR ESSENTIALS.</text>
</svg>`;
}
fs.writeFileSync(path.join(PUB, "logo.svg"), logoSvg());
fs.writeFileSync(path.join(PUB, "logo-icon.svg"), logoSvg({ icon: true }));
fs.writeFileSync(path.join(PUB, "favicon.svg"), logoSvg({ icon: true }));

// ---------------- PNG RASTERS (via @resvg/resvg-js) ----------------
// Renders crisp PNG versions of the logo for the places SVG doesn't cut it
// (apple-touch-icon) and a lightweight logo.png for general use. resvg bundles
// font loading so <text> renders even without system fontconfig (Windows).
let Resvg = null;
try {
  ({ Resvg } = await import("@resvg/resvg-js"));
} catch {
  console.log("@resvg/resvg-js not installed — skipping PNG rasterization (npm i -D @resvg/resvg-js)");
}
if (Resvg) {
  const render = (file, out, width) => {
    const svg = fs.readFileSync(file, "utf8");
    const r = new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      font: { loadSystemFonts: true, defaultFontFamily: "Arial" },
    });
    fs.writeFileSync(out, r.render().asPng());
  };
  render(path.join(PUB, "logo.svg"), path.join(PUB, "logo.png"), 840);
  render(path.join(PUB, "logo-icon.svg"), path.join(PUB, "apple-touch-icon.png"), 180);
  render(path.join(PUB, "logo-icon.svg"), path.join(PUB, "icon-192.png"), 192);
  render(path.join(PUB, "logo-icon.svg"), path.join(PUB, "icon-512.png"), 512);
  console.log("Rasterized logo.png + apple-touch-icon.png + PWA icons (192/512).");
}

// ---------------- CATEGORY ART ----------------
const CATMETA = {
  "bakery-desserts": { from: "#fb7185", to: "#be123c", accent: "#fda4af", emoji: "🧁" },
  "chips-namkeen": { from: "#fbbf24", to: "#c2410c", accent: "#fde68a", emoji: "🥨" },
  "chocolates-sweets": { from: "#92400e", to: "#451a03", accent: "#fbbf24", emoji: "🍫" },
  "biscuits-cookies": { from: "#d97706", to: "#78350f", accent: "#fcd34d", emoji: "🍪" },
  "instant-food": { from: "#ef4444", to: "#991b1b", accent: "#fca5a5", emoji: "🍜" },
  "drinks-energy": { from: "#38bdf8", to: "#1e40af", accent: "#bae6fd", emoji: "🥤" },
};

CATEGORIES.forEach((cat) => {
  const c = CATMETA[cat.slug];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="75%">
      <stop offset="0%" stop-color="${c.from}" stop-opacity="0.45"/>
      <stop offset="60%" stop-color="#0a0c1e"/>
      <stop offset="100%" stop-color="#05060f"/>
    </radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c.accent}"/><stop offset="100%" stop-color="${c.to}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="500" fill="url(#bg)"/>
  <g opacity="0.7"><circle cx="120" cy="90" r="2" fill="#fff"/><circle cx="680" cy="120" r="2" fill="#fff"/><circle cx="200" cy="400" r="2" fill="#fff"/></g>
  <circle cx="400" cy="230" r="130" fill="none" stroke="url(#ring)" stroke-width="3" opacity="0.8"/>
  <circle cx="400" cy="230" r="95" fill="#0a0c1e" opacity="0.6"/>
  <text x="400" y="270" text-anchor="middle" font-size="110">${c.emoji}</text>
  <text x="400" y="420" text-anchor="middle" font-family="Arial Black,Arial" font-size="34" letter-spacing="2" fill="#fff">${esc(cat.name)}</text>
  <text x="400" y="458" text-anchor="middle" font-family="Arial" font-size="16" fill="#94a3b8">NIGHT CORNER</text>
</svg>`;
  fs.writeFileSync(path.join(CAT, cat.slug + ".svg"), svg);
});

// ---------------- PRODUCT ART ----------------
function productSvg(p) {
  const c = CATMETA[p.categorySlug] ?? CATMETA["drinks-energy"];
  const label = p.name.replace(/\s*—.*$/, "");
  const sub = p.shortDesc || p.unit;
  const cx = 300,
    cy = 330;

  let object = "";
  if (p.categorySlug === "chips-namkeen") {
    object = `
      <defs><linearGradient id="pack" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c.accent}"/><stop offset="55%" stop-color="${c.from}"/><stop offset="100%" stop-color="${c.to}"/>
      </linearGradient></defs>
      <ellipse cx="${cx}" cy="500" rx="140" ry="26" fill="#000" opacity="0.45"/>
      <path d="M${cx - 110} ${cy - 150} L${cx + 110} ${cy - 150} L${cx + 130} ${cy + 150} Q${cx} ${cy + 185} ${cx - 130} ${cy + 150} Z" fill="url(#pack)" stroke="${c.accent}" stroke-width="3"/>
      <path d="M${cx - 110} ${cy - 150} Q${cx} ${cy - 120} ${cx + 110} ${cy - 150} L${cx + 95} ${cy - 170} L${cx - 95} ${cy - 170} Z" fill="${c.to}" opacity="0.85"/>
      <rect x="${cx - 70}" y="${cy - 20}" width="140" height="110" rx="14" fill="#0a0c1e" opacity="0.82"/>
      <circle cx="${cx}" cy="${cy + 10}" r="34" fill="${c.accent}" opacity="0.9"/>`;
  } else if (p.categorySlug === "chocolates-sweets") {
    object = `
      <defs><linearGradient id="pack" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#b45309"/><stop offset="60%" stop-color="${c.from}"/><stop offset="100%" stop-color="${c.to}"/>
      </linearGradient></defs>
      <ellipse cx="${cx}" cy="490" rx="170" ry="26" fill="#000" opacity="0.45"/>
      <rect x="${cx - 150}" y="${cy - 90}" width="300" height="180" rx="18" fill="url(#pack)" stroke="${c.accent}" stroke-width="3"/>
      <rect x="${cx - 120}" y="${cy - 60}" width="240" height="120" rx="10" fill="#0a0c1e" opacity="0.78"/>
      <path d="M${cx - 90} ${cy + 30} L${cx - 40} ${cy - 10} L${cx} ${cy + 25} L${cx + 50} ${cy - 25} L${cx + 100} ${cy + 25}" fill="none" stroke="${c.accent}" stroke-width="6" stroke-linecap="round"/>`;
  } else if (p.categorySlug === "drinks-energy") {
    object = `
      <defs><linearGradient id="pack" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${c.accent}"/><stop offset="45%" stop-color="${c.from}"/><stop offset="100%" stop-color="${c.to}"/>
      </linearGradient></defs>
      <ellipse cx="${cx}" cy="495" rx="120" ry="24" fill="#000" opacity="0.45"/>
      <path d="M${cx - 55} ${cy - 170} L${cx + 55} ${cy - 170} L${cx + 60} ${cy - 120} L${cx + 80} ${cy - 80} L${cx + 80} ${cy + 150} Q${cx} ${cy + 185} ${cx - 80} ${cy + 150} L${cx - 80} ${cy - 80} L${cx - 60} ${cy - 120} Z" fill="url(#pack)" stroke="${c.accent}" stroke-width="3"/>
      <rect x="${cx - 55}" y="${cy - 175}" width="110" height="28" rx="6" fill="#0f172a"/>
      <rect x="${cx - 62}" y="${cy - 30}" width="124" height="120" rx="12" fill="#0a0c1e" opacity="0.8"/>
      <circle cx="${cx}" cy="${cy + 30}" r="26" fill="${c.accent}" opacity="0.9"/>`;
  } else if (p.categorySlug === "biscuits-cookies") {
    object = `
      <defs><radialGradient id="pack" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stop-color="${c.accent}"/><stop offset="60%" stop-color="${c.from}"/><stop offset="100%" stop-color="${c.to}"/>
      </radialGradient></defs>
      <ellipse cx="${cx}" cy="495" rx="150" ry="24" fill="#000" opacity="0.45"/>
      <circle cx="${cx}" cy="${cy + 20}" r="150" fill="url(#pack)" stroke="${c.accent}" stroke-width="3"/>
      <g fill="${c.to}" opacity="0.6">
        <circle cx="${cx - 50}" cy="${cy - 30}" r="14"/><circle cx="${cx + 40}" cy="${cy - 40}" r="10"/>
        <circle cx="${cx + 70}" cy="${cy + 30}" r="12"/><circle cx="${cx - 30}" cy="${cy + 60}" r="16"/>
        <circle cx="${cx + 10}" cy="${cy + 5}" r="9"/></g>`;
  } else if (p.categorySlug === "bakery-desserts") {
    object = `
      <defs><linearGradient id="pack" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c.accent}"/><stop offset="60%" stop-color="${c.from}"/><stop offset="100%" stop-color="${c.to}"/>
      </linearGradient></defs>
      <ellipse cx="${cx}" cy="495" rx="140" ry="24" fill="#000" opacity="0.45"/>
      <path d="M${cx - 130} ${cy + 20} Q${cx} ${cy + 180} ${cx + 130} ${cy + 20} L${cx + 110} ${cy - 80} Q${cx} ${cy - 120} ${cx - 110} ${cy - 80} Z" fill="url(#pack)" stroke="${c.accent}" stroke-width="3"/>
      <ellipse cx="${cx}" cy="${cy - 80}" rx="110" ry="34" fill="${c.to}" opacity="0.8"/>
      <rect x="${cx - 80}" y="${cy - 20}" width="160" height="90" rx="14" fill="#0a0c1e" opacity="0.78"/>`;
  } else {
    object = `
      <defs><linearGradient id="pack" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c.accent}"/><stop offset="60%" stop-color="${c.from}"/><stop offset="100%" stop-color="${c.to}"/>
      </linearGradient></defs>
      <ellipse cx="${cx}" cy="495" rx="140" ry="24" fill="#000" opacity="0.45"/>
      <rect x="${cx - 120}" y="${cy - 120}" width="240" height="260" rx="20" fill="url(#pack)" stroke="${c.accent}" stroke-width="3"/>
      <rect x="${cx - 80}" y="${cy - 30}" width="160" height="120" rx="12" fill="#0a0c1e" opacity="0.8"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <defs>
    <radialGradient id="bg" cx="50%" cy="32%" r="75%">
      <stop offset="0%" stop-color="#1f2560"/><stop offset="55%" stop-color="#0a0c1e"/><stop offset="100%" stop-color="#05060f"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="${c.from}" stop-opacity="0.55"/><stop offset="100%" stop-color="${c.from}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg)"/>
  <circle cx="300" cy="320" r="260" fill="url(#glow)"/>
  <g fill="#fff">
    <circle cx="80" cy="80" r="1.6" opacity="0.8"/><circle cx="520" cy="120" r="1.4" opacity="0.7"/>
    <circle cx="150" cy="200" r="1.2" opacity="0.6"/><circle cx="490" cy="260" r="1.8" opacity="0.8"/>
    <circle cx="90" cy="420" r="1.3" opacity="0.5"/><circle cx="520" cy="440" r="1.5" opacity="0.7"/></g>
  ${object}
  <g text-anchor="middle" font-family="Arial, sans-serif">
    <text x="${cx}" y="${cy + 6}" font-size="32" font-weight="bold" fill="#fff" style="letter-spacing:1px">${esc(label.length > 16 ? label.slice(0, 15) : label)}</text>
    <text x="${cx}" y="${cy + 34}" font-size="15" fill="${c.accent}">${esc(sub.length > 28 ? sub.slice(0, 26) : sub)}</text>
  </g>
  <text x="300" y="560" text-anchor="middle" font-family="Arial Black,Arial" font-size="13" letter-spacing="2" fill="#94a3b8" opacity="0.85">NIGHT CORNER</text>
</svg>`;
}

let count = 0;
PRODUCTS.forEach((p) => {
  const s = slug(p.name);
  fs.writeFileSync(path.join(IMG, s + ".svg"), productSvg(p));
  count++;
});
console.log(`Generated logo + ${CATEGORIES.length} category images + ${count} product images.`);
