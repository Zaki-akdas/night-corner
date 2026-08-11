// Generates a professional multi-image gallery for every product:
// 1.svg — front hero shot (glossy package on neon pedestal)
// 2.svg — 3/4 angle shot with content/food visible
// 3.svg — macro detail / lifestyle shot
// For products that have a real AI photo (bakery), 1.jpg is used as the hero
// and the SVGs provide additional angles.
import fs from "node:fs";
import path from "node:path";

const PUB = path.join(process.cwd(), "public", "images", "products");

// read catalogue from prisma seed data
const src = fs.readFileSync(path.join(process.cwd(), "prisma", "products.ts"), "utf8");
function evalArray(name) {
  const start = src.indexOf("export const " + name);
  const eq = src.indexOf("= [", start) + 2; // skip the "= [" to find array literal
  let depth = 0,
    end = eq;
  for (; end < src.length; end++) {
    if (src[end] === "[") depth++;
    else if (src[end] === "]" && --depth === 0) break;
  }
  let out = "",
    inStr = false,
    ch = "";
  for (let k = eq; k <= end; k++) {
    const c = src[k];
    if (inStr) {
      out += c;
      if (c === ch && src[k - 1] !== "\\") inStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      ch = c;
      out += '"';
    } else out += c;
  }
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

const CATMETA = {
  "bakery-desserts": { from: "#fb7185", to: "#9f1239", accent: "#fda4af", shape: "food", emoji: "🧁" },
  "chips-namkeen": { from: "#fbbf24", to: "#b45309", accent: "#fde68a", shape: "bag", emoji: "🥨" },
  "chocolates-sweets": { from: "#b45309", to: "#451a03", accent: "#fbbf24", shape: "bar", emoji: "🍫" },
  "biscuits-cookies": { from: "#d97706", to: "#78350f", accent: "#fcd34d", shape: "biscuit", emoji: "🍪" },
  "instant-food": { from: "#ef4444", to: "#7f1d1d", accent: "#fca5a5", shape: "pack", emoji: "🍜" },
  "drinks-energy": { from: "#38bdf8", to: "#1e3a8a", accent: "#bae6fd", shape: "bottle", emoji: "🥤" },
};

function svgShell({ w = 600, h = 600, glow, rotate = 0, ty = 0, content, label, sub, showLabel = true }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#1f2560"/>
      <stop offset="55%" stop-color="#0a0c1e"/>
      <stop offset="100%" stop-color="#05060f"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="${glow}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <g opacity="0.5"><circle cx="90" cy="90" r="1.5" fill="#fff"/><circle cx="510" cy="130" r="1.2" fill="#c4b5fd"/><circle cx="150" cy="220" r="1" fill="#fff"/><circle cx="480" cy="260" r="1.6" fill="#bae6fd"/><circle cx="80" cy="430" r="1.2" fill="#fff"/></g>
  <circle cx="300" cy="340" r="230" fill="url(#glow)"/>
  <!-- reflective floor -->
  <ellipse cx="300" cy="${h - 70}" rx="190" ry="30" fill="url(#floor)"/>
  <ellipse cx="300" cy="${h - 68}" rx="120" ry="12" fill="#000" opacity="0.45"/>
  <g transform="translate(0 ${ty}) rotate(${rotate} 300 320)">${content}</g>
  ${showLabel ? `<g text-anchor="middle" font-family="Arial, sans-serif">
    <text x="300" y="${h - 28}" font-size="13" letter-spacing="3" fill="#64748b">NIGHT CORNER</text>
  </g>` : ""}
</svg>`;
}

function packageShape(shape, c, label, sub, idx) {
  const cx = 300,
    cy = 300;
  if (shape === "bag") {
    return `
    <g>
      <path d="M${cx - 110} ${cy - 150} L${cx + 110} ${cy - 150} L${cx + 132} ${cy + 160} Q${cx} ${cy + 200} ${cx - 132} ${cy + 160} Z" fill="url(#pack)" stroke="${c.accent}" stroke-width="2.5"/>
      <path d="M${cx - 110} ${cy - 150} Q${cx} ${cy - 118} ${cx + 110} ${cy - 150} L${cx + 92} ${cy - 178} L${cx - 92} ${cy - 178} Z" fill="${c.to}" opacity="0.9"/>
      <rect x="${cx - 78}" y="${cy - 30}" width="156" height="120" rx="16" fill="#05060f" opacity="0.85"/>
      <text x="${cx}" y="${cy + 20}" text-anchor="middle" font-family="Arial Black" font-size="30" fill="#fff">${label.slice(0, 10)}</text>
      <text x="${cx}" y="${cy + 50}" text-anchor="middle" font-size="14" fill="${c.accent}">${sub.slice(0, 22)}</text>
      <circle cx="${cx - 90}" cy="${cy - 120}" r="10" fill="#fff" opacity="0.25"/>
      <circle cx="${cx + 80}" cy="${cy + 120}" r="14" fill="#fff" opacity="0.12"/>
    </g>`;
  }
  if (shape === "bar") {
    return `
    <g>
      <rect x="${cx - 155}" y="${cy - 95}" width="310" height="190" rx="20" fill="url(#pack)" stroke="${c.accent}" stroke-width="3"/>
      <rect x="${cx - 155}" y="${cy - 95}" width="310" height="40" rx="20" fill="${c.to}" opacity="0.7"/>
      <rect x="${cx - 125}" y="${cy - 40}" width="250" height="120" rx="12" fill="#05060f" opacity="0.82"/>
      <text x="${cx}" y="${cy + 25}" text-anchor="middle" font-family="Arial Black" font-size="32" fill="${c.accent}">${label.slice(0, 12)}</text>
      <path d="M${cx - 90} ${cy + 50} L${cx - 40} ${cy + 10} L${cx} ${cy + 45} L${cx + 50} ${cy - 5} L${cx + 95} ${cy + 45}" fill="none" stroke="${c.accent}" stroke-width="6" stroke-linecap="round" opacity="0.8"/>
    </g>`;
  }
  if (shape === "bottle") {
    return `
    <g>
      <path d="M${cx - 58} ${cy - 180} L${cx + 58} ${cy - 180} L${cx + 64} ${cy - 128} L${cx + 86} ${cy - 86} L${cx + 86} ${cy + 160} Q${cx} ${cy + 200} ${cx - 86} ${cy + 160} L${cx - 86} ${cy - 86} L${cx - 64} ${cy - 128} Z" fill="url(#pack)" stroke="${c.accent}" stroke-width="3"/>
      <rect x="${cx - 58}" y="${cy - 186}" width="116" height="30" rx="7" fill="#0f172a"/>
      <rect x="${cx - 48}" y="${cy - 196}" width="96" height="14" rx="4" fill="#1e293b"/>
      <rect x="${cx - 68}" y="${cy - 36}" width="136" height="132" rx="14" fill="#05060f" opacity="0.82"/>
      <text x="${cx}" y="${cy + 25}" text-anchor="middle" font-family="Arial Black" font-size="26" fill="#fff">${label.slice(0, 10)}</text>
      <text x="${cx}" y="${cy + 56}" text-anchor="middle" font-size="13" fill="${c.accent}">${sub.slice(0, 18)}</text>
      <ellipse cx="${cx - 30}" cy="${cy - 130}" rx="14" ry="40" fill="#fff" opacity="0.2"/>
    </g>`;
  }
  if (shape === "biscuit") {
    return `
    <g>
      <circle cx="${cx}" cy="${cy + 10}" r="150" fill="url(#pack)" stroke="${c.accent}" stroke-width="3"/>
      <circle cx="${cx - 55}" cy="${cy - 40}" r="16" fill="${c.to}" opacity="0.7"/>
      <circle cx="${cx + 45}" cy="${cy - 55}" r="12" fill="${c.to}" opacity="0.6"/>
      <circle cx="${cx + 75}" cy="${cy + 25}" r="14" fill="${c.to}" opacity="0.65"/>
      <circle cx="${cx - 35}" cy="${cy + 65}" r="18" fill="${c.to}" opacity="0.6"/>
      <circle cx="${cx + 15}" cy="${cy}" r="10" fill="${c.to}" opacity="0.5"/>
      <text x="${cx}" y="${cy + 90}" text-anchor="middle" font-family="Arial Black" font-size="26" fill="#fff" opacity="0.9">${label.slice(0, 10)}</text>
    </g>`;
  }
  if (shape === "food") {
    return `
    <g>
      <path d="M${cx - 135} ${cy + 20} Q${cx} ${cy + 190} ${cx + 135} ${cy + 20} L${cx + 112} ${cy - 90} Q${cx} ${cy - 135} ${cx - 112} ${cy - 90} Z" fill="url(#pack)" stroke="${c.accent}" stroke-width="3"/>
      <ellipse cx="${cx}" cy="${cy - 90}" rx="112" ry="36" fill="${c.to}"/>
      <ellipse cx="${cx}" cy="${cy - 96}" rx="90" ry="22" fill="${c.from}" opacity="0.8"/>
      <rect x="${cx - 82}" y="${cy - 20}" width="164" height="100" rx="16" fill="#05060f" opacity="0.82"/>
      <text x="${cx}" y="${cy + 35}" text-anchor="middle" font-family="Arial Black" font-size="26" fill="#fff">${label.slice(0, 10)}</text>
    </g>`;
  }
  // instant pack
  return `
    <g>
      <rect x="${cx - 120}" y="${cy - 130}" width="240" height="280" rx="22" fill="url(#pack)" stroke="${c.accent}" stroke-width="3"/>
      <path d="M${cx - 120} ${cy - 130} L${cx + 120} ${cy - 130} L${cx + 100} ${cy - 160} L${cx - 100} ${cy - 160} Z" fill="${c.to}"/>
      <rect x="${cx - 82}" y="${cy - 30}" width="164" height="130" rx="14" fill="#05060f" opacity="0.82"/>
      <text x="${cx}" y="${cy + 30}" text-anchor="middle" font-family="Arial Black" font-size="28" fill="#fff">${label.slice(0, 10)}</text>
      <text x="${cx}" y="${cy + 60}" text-anchor="middle" font-size="13" fill="${c.accent}">${sub.slice(0, 20)}</text>
      <circle cx="${cx - 80}" cy="${cy - 90}" r="16" fill="#fff" opacity="0.2"/>
    </g>`;
}

function gradDef(c) {
  return `<linearGradient id="pack" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${c.accent}"/>
    <stop offset="50%" stop-color="${c.from}"/>
    <stop offset="100%" stop-color="${c.to}"/>
  </linearGradient>`;
}

function shot1(p, c) {
  // front hero
  const content = `${gradDef(c)}${packageShape(c.shape, c, p.name, p.shortDesc || p.unit, 0)}`;
  return svgShell({ glow: c.from, content, rotate: 0, label: p.name, sub: p.shortDesc });
}

function shot2(p, c) {
  // 3/4 angle with product slightly rotated and "floating"
  const content = `${gradDef(c)}
    <g opacity="0.35" transform="translate(40 80) scale(0.5)">${packageShape(c.shape, c, p.name, "", 1)}</g>
    <g transform="rotate(-8 300 300)">${packageShape(c.shape, c, p.name, p.shortDesc || p.unit, 1)}</g>`;
  return svgShell({ glow: c.from, content, rotate: 0, ty: -10 });
}

function shot3(p, c) {
  // macro / detail with large emoji and glints
  const content = `
    ${gradDef(c)}
    <g transform="translate(0 20) scale(0.85)" opacity="0.35">${packageShape(c.shape, c, p.name, "", 2)}</g>
    <g transform="translate(0 -40)">
      <text x="300" y="330" text-anchor="middle" font-size="160" filter="url(#soft)">${c.emoji}</text>
      <text x="300" y="330" text-anchor="middle" font-size="160">${c.emoji}</text>
    </g>
    <g opacity="0.8">
      <circle cx="160" cy="180" r="6" fill="#fff"/>
      <circle cx="440" cy="220" r="4" fill="${c.accent}"/>
      <circle cx="420" cy="420" r="5" fill="#fff"/>
    </g>`;
  return svgShell({ glow: c.from, content, rotate: 6, ty: 0 });
}

let count = 0;
for (const p of PRODUCTS) {
  const c = CATMETA[p.categorySlug];
  const dir = path.join(PUB, slug(p.name));
  fs.mkdirSync(dir, { recursive: true });
  const hasPhoto = fs.existsSync(path.join(dir, "1.jpg"));
  // 1.svg always present; if a photo exists we still keep svgs for gallery variety
  fs.writeFileSync(path.join(dir, "1.svg"), shot1(p, c));
  fs.writeFileSync(path.join(dir, "2.svg"), shot2(p, c));
  fs.writeFileSync(path.join(dir, "3.svg"), shot3(p, c));
  count++;
}
console.log(`Generated 3 gallery shots × ${count} products = ${count * 3} images.`);
