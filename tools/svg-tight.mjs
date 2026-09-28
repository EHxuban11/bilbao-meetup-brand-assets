// Compute the ink bounding box of an SVG (in its own user units) by rasterizing at high
// resolution, and optionally rewrite its viewBox/width/height to that box.
// usage: node tools/svg-tight.mjs <in.svg> [out.svg] [--pad 0]
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
const [,, inp, out] = process.argv;
let svg = readFileSync(inp, 'utf8');
const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/[\s,]+/).map(Number);
const S = 4000 / vb[2]; // px per unit
const W = Math.round(vb[2] * S), H = Math.round(vb[3] * S);
const probe = svg.replace(/<svg[^>]*>/, m => m.replace(/\s(width|height)="[^"]*"/g, '').replace('<svg', `<svg width="${W}" height="${H}"`))
  .replace(/fill="(?!none)[^"]*"/g, 'fill="#fff"');
const { data, info } = await sharp(Buffer.from(probe), { density: 72 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
const box = [vb[0] + x0 / S, vb[1] + y0 / S, (x1 + 1 - x0) / S, (y1 + 1 - y0) / S].map(v => Math.round(v * 1000) / 1000);
console.log(JSON.stringify({ viewBox: vb, ink: box, aspect: +(box[2] / box[3]).toFixed(4) }));
if (out) {
  let s = svg.replace(/viewBox="[^"]+"/, `viewBox="${box.join(' ')}"`)
    .replace(/<svg([^>]*)\swidth="[^"]*"/, '<svg$1').replace(/<svg([^>]*)\sheight="[^"]*"/, '<svg$1');
  s = s.replace('<svg', `<svg width="${box[2]}" height="${box[3]}"`);
  writeFileSync(out, s);
}
