// Turn a potrace SVG + bots.mjs analysis into a bot shape asset (path centred on the body centroid).
// usage: node tools/make-shape.mjs <name> <trace.svg> <analysis.txt> <source description> [--rotate deg] [--face face.json]
// --rotate: rotate the traced outline about its centroid (e.g. to undo the pose it was traced in).
// --face: take the neutral face (eyes) from a JSON file instead of the traced image.
import { readFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2);
const opt = k => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : undefined);
const [name, svgFile, txtFile, source] = argv;
const rotDeg = +(opt('--rotate') || 0), faceFile = opt('--face'), sc = +(opt('--scale') || 1);
const lines = readFileSync(txtFile, 'utf8').trim().split('\n');
const info = JSON.parse(lines[0]);
const eyes = lines.filter(l => l.trim().startsWith('eye')).map(l => JSON.parse(l.trim().slice(4)));
const { cx, cy, bbox } = info.body;
const d = readFileSync(svgFile, 'utf8').match(/ d="([^"]+)"/)[1];
// potrace emits absolute M/C/L with "x y" pairs; shift every pair by (-cx, -cy)
let i = 0;
const th = rotDeg * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
const tf = (x, y) => [sc * (co * x - si * y), sc * (si * x + co * y)];
let bb = [1e9, 1e9, -1e9, -1e9];
const moved = d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => { const [u, v] = tf(+x - cx, +y - cy); return `${u.toFixed(2)} ${v.toFixed(2)}`; });
const r = v => Math.round(v * 100) / 100;
const faceTraced = eyes.sort((a, b) => a.cx - b.cx).map(e => {
  const w = e.bbox[2] - e.bbox[0], h = e.bbox[3] - e.bbox[1];
  return { x: r(e.cx - cx), y: r(e.cy - cy), w: r(Math.min(w, h)), h: r(Math.max(w, h)) };
});
const face = faceFile ? JSON.parse(readFileSync(faceFile, 'utf8')) : faceTraced;
// exact bbox of the (possibly rotated) outline, sampling the Bezier curves
const nums = moved.match(/-?\d+(?:\.\d+)?/g).map(Number); const P = []; for (let k = 0; k < nums.length; k += 2) P.push([nums[k], nums[k + 1]]);
const segs = moved.split(/(?=[MCL])/).map(sgm => ({ c: sgm[0], p: (sgm.slice(1).match(/-?\d+(?:\.\d+)?/g) || []).map(Number) }));
let cur = [0, 0];
for (const { c, p } of segs) {
  if (c === 'M' || c === 'L') { cur = [p[0], p[1]]; bb = [Math.min(bb[0], cur[0]), Math.min(bb[1], cur[1]), Math.max(bb[2], cur[0]), Math.max(bb[3], cur[1])]; }
  if (c === 'C') for (let k = 0; k < p.length; k += 6) { const [x1, y1, x2, y2, x3, y3] = p.slice(k, k + 6);
    for (let t = 0; t <= 1; t += 1 / 64) { const u = 1 - t; const x = u*u*u*cur[0] + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3, y = u*u*u*cur[1] + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3; bb = [Math.min(bb[0], x), Math.min(bb[1], y), Math.max(bb[2], x), Math.max(bb[3], y)]; }
    cur = [x3, y3]; }
}
const out = { name, source, path: moved, bbox: bb.map(r), area: info.body.n, face };
writeFileSync(`assets/bots/${name}.json`, JSON.stringify(out, null, 2));
console.log(name, JSON.stringify({ bbox: out.bbox, face }));
