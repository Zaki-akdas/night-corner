// Cleans logo1.png (circular badge with baked-in checkerboard background)
// The checkerboard is NEUTRAL GRAY (r~g~b, lum 22-140); the emblem is
// blue-dominant navy / gold / warm colors -> flood fill by the neutral rule.
import sharp from 'sharp';
import fs from 'fs';

const SRC = 'public/logo1.png';
const OUT = 'public/logo.png';
const SIZE = 512;

const img = sharp(SRC);
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const w = info.width, h = info.height;
const at = (x, y) => (y * w + x) * 4;

// background if neutral gray (low chroma) in the checkerboard luminance band
const isBg = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return (mx - mn) <= 26 && mx >= 22 && mx <= 140;
};

const out = Buffer.from(data);
const visited = new Uint8Array(w * h);
const queue = [];
const step = 3;
for (let x = 0; x < w; x += step) {
  for (const y of [0, h - 1]) {
    const i = at(x, y);
    if (!visited[y * w + x] && isBg(out[i], out[i + 1], out[i + 2])) {
      visited[y * w + x] = 1;
      queue.push([x, y]);
    }
  }
}
for (let y = 0; y < h; y += step) {
  for (const x of [0, w - 1]) {
    const i = at(x, y);
    if (!visited[y * w + x] && isBg(out[i], out[i + 1], out[i + 2])) {
      visited[y * w + x] = 1;
      queue.push([x, y]);
    }
  }
}
let filled = 0;
while (queue.length) {
  const [x, y] = queue.pop();
  const i = at(x, y);
  out[i + 3] = 0;
  filled++;
  for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const ni = ny * w + nx;
    if (visited[ni]) continue;
    const j = at(nx, ny);
    if (isBg(out[j], out[j + 1], out[j + 2])) {
      visited[ni] = 1;
      queue.push([nx, ny]);
    }
  }
}
console.log('filled background pixels:', filled);

// Edge cleanup at source resolution: drop neutral-gray pixels touching
// transparency (the flood-fill rim) so no gray halo survives downscaling.
const isNeutral = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx - mn <= 30;
};
for (let pass = 0; pass < 2; pass++) {
  let removed = 0;
  const kill = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = at(x, y);
      if (out[i + 3] < 8) continue;
      const r = out[i], g = out[i + 1], b = out[i + 2];
      if (!isNeutral(r, g, b)) continue;
      let touch = false;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (out[at(nx, ny) + 3] < 8) { touch = true; break; }
      }
      if (touch) kill.push([x, y]);
    }
  }
  for (const [x, y] of kill) { out[at(x, y) + 3] = 0; removed++; }
  console.log(`edge cleanup pass ${pass + 1}: removed ${removed}`);
  if (!removed) break;
}

await sharp(out, { raw: { width: w, height: h, channels: 4 } })
  .png()
  .trim({ background: [0, 0, 0, 0], threshold: 8 })
  .toFile('.freebuff/_logo-trimmed.png');
const meta = await sharp('.freebuff/_logo-trimmed.png').metadata();
console.log('trimmed:', meta.width, 'x', meta.height);

const side = Math.max(meta.width, meta.height);
await sharp('.freebuff/_logo-trimmed.png')
  .resize(side, side, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(OUT);
const fin = await sharp(OUT).metadata();
console.log(`wrote ${OUT}: ${fin.width}x${fin.height}, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
