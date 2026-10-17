// Fit an SVG logo onto a reference image region: finds x, y, width (height from aspect)
// maximising soft IoU between the rendered logo and the reference ink (light on dark,
// or dark on light with --dark). Prints the box and IoU.
// usage: node tools/logo-fit.mjs <logo.svg> <ref.png> <x0> <y0> <x1> <y1> [--dark] [--save diff.png]
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
const argv = process.argv.slice(2);
const [logo, ref, ...r] = argv; const [X0, Y0, X1, Y1] = r.slice(0, 4).map(Number);
const dark = argv.includes('--dark'); const save = argv.includes('--save') ? argv[argv.indexOf('--save') + 1] : null;
const svg = readFileSync(logo, 'utf8');
const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/[\s,]+/).map(Number);
const inner = '<g fill="#fff">' + svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/fill="(?!none)[^"]*"/g, 'fill="#fff"') + '</g>';
const RW = X1 - X0, RH = Y1 - Y0;
const { data: rd } = await sharp(ref).extract({ left: X0, top: Y0, width: RW, height: RH }).flatten({ background: dark ? '#fff' : '#000' }).greyscale().raw().toBuffer({ resolveWithObject: true });
let mx = 0, mn = 255; for (const v of rd) { mx = Math.max(mx, v); mn = Math.min(mn, v); }
const refM = Float32Array.from(rd, v => dark ? (mx - v) / (mx - mn) : (v - mn) / (mx - mn));
// initial guess from ink bbox
let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) if (refM[y * RW + x] > 0.5) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
const aspect = vb[2] / vb[3];
async function render([x, y, w]) {
  const h = w / aspect;
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${RW}" height="${RH}"><rect width="100%" height="100%" fill="#000"/><svg x="${x - X0}" y="${y - Y0}" width="${w}" height="${h}" viewBox="${vb.join(' ')}" preserveAspectRatio="none">${inner}</svg></svg>`;
  const { data } = await sharp(Buffer.from(s)).greyscale().raw().toBuffer({ resolveWithObject: true });
  return data;
}
async function iou(p) { const d = await render(p); let i = 0, u = 0; for (let k = 0; k < d.length; k++) { const a = d[k] / 255, b = refM[k]; i += Math.min(a, b); u += Math.max(a, b); } return i / u; }
async function nm(x0, st, it) {
  let P = [x0]; for (let i = 0; i < 3; i++) { const p = x0.slice(); p[i] += st[i]; P.push(p); }
  let V = []; for (const p of P) V.push(-(await iou(p)));
  for (let k = 0; k < it; k++) {
    const o = V.map((v, i) => i).sort((a, b) => V[a] - V[b]); P = o.map(i => P[i]); V = o.map(i => V[i]);
    const c = [0, 1, 2].map(j => (P[0][j] + P[1][j] + P[2][j]) / 3);
    const rp = c.map((v, j) => v + (v - P[3][j])); const fr = -(await iou(rp));
    if (fr < V[0]) { const e = c.map((v, j) => v + 2 * (v - P[3][j])); const fe = -(await iou(e)); if (fe < fr) { P[3] = e; V[3] = fe; } else { P[3] = rp; V[3] = fr; } }
    else if (fr < V[2]) { P[3] = rp; V[3] = fr; }
    else { const cc = c.map((v, j) => v + 0.5 * (P[3][j] - v)); const fc = -(await iou(cc)); if (fc < V[3]) { P[3] = cc; V[3] = fc; } else for (let i = 1; i < 4; i++) { P[i] = P[i].map((v, j) => P[0][j] + 0.5 * (v - P[0][j])); V[i] = -(await iou(P[i])); } }
  }
  return { p: P[0], v: -V[0] };
}
const g = [X0 + bx0, Y0 + by0, bx1 - bx0 + 1];
let best = await nm(g, [2, 2, 3], 60); best = await nm(best.p, [0.4, 0.4, 0.6], 60);
const [x, y, w] = best.p;
console.log(JSON.stringify({ logo: logo.split('/').pop(), ref: ref.split('/').pop(), x: +x.toFixed(2), y: +y.toFixed(2), w: +w.toFixed(2), h: +(w / aspect).toFixed(2), right: +(x + w).toFixed(2), bottom: +(y + w / aspect).toFixed(2), iou: +best.v.toFixed(4), refMax: mx }));
if (save) {
  const d = await render(best.p); const out = Buffer.alloc(RW * RH * 3);
  for (let k = 0; k < d.length; k++) { out[k * 3] = Math.round(refM[k] * 255); out[k * 3 + 1] = d[k]; out[k * 3 + 2] = 0; }
  await sharp(out, { raw: { width: RW, height: RH, channels: 3 } }).resize(RW * 4, RH * 4, { kernel: 'nearest' }).png().toFile(save);
}
