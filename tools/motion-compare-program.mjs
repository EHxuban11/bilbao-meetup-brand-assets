// Is a captured segment the same choreography as the speaker program?
// Features (screen space, shape independent): eye midpoint minus body centre, divided by eye spacing;
// eye tilt; eye height / eye spacing. Cross-correlates a raw capture against the speaker
// (square) in+loop sequence, plain and mirrored.
// usage: node tools/motion-compare-program.mjs <raw.json> [--fixed-body] [--from N]
//   --fixed-body: use the median body position (when body registration is unreliable, e.g. overlaps)
//   --from N: ignore frames before N (e.g. a pop-in)
import { readFileSync } from 'node:fs';
const [,, file, ...rest] = process.argv;
const feat = (f, round) => {
  if (!f || f.x === undefined || !f.eyes || f.eyes.length < 2) return null;
  const e = f.eyes.filter(x => x.w > 3 && x.h > 3).sort((a, b) => a.x - b.x); if (e.length < 2) return null;
  const sp = Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y); if (sp < 5) return null;
  const mx = (e[0].x + e[1].x) / 2, my = (e[0].y + e[1].y) / 2;
  return [(mx - f.x) / sp, (my - f.y) / sp, (e[0].a + e[1].a) / 2 / 10, (e[0].h + e[1].h) / 2 / sp];
};
const M = 'tools/scratch/motion';
const spIn = JSON.parse(readFileSync(`${M}/speaker-hugo-1-in.raw.json`, 'utf8')).frames;
const spLoop = JSON.parse(readFileSync(`${M}/speaker-hugo-2-loop.raw.json`, 'utf8')).frames;
const ref = [...spIn, ...spLoop].map(f => feat(f));
const FIXED = rest.includes('--fixed-body');
let segRaw = JSON.parse(readFileSync(file, 'utf8')).frames;
if (FIXED) { const ok = segRaw.filter(f => f && f.x !== undefined); const med = k => ok.map(f => f[k]).sort((a, b) => a - b)[Math.floor(ok.length / 2)];
  const mx = med('x'), my = med('y'); segRaw = segRaw.map(f => f && f.x !== undefined ? { ...f, x: mx, y: my } : f); }
const FROM = rest.includes('--from') ? +rest[rest.indexOf('--from') + 1] : 0;
const seg = segRaw.map((f, i) => (i < FROM ? null : feat(f)));
// center features (x offset of the face differs per shape) by subtracting medians of the neutral-ish values
function score(a, b, mirror) {
  let e = 0, c = 0; const da = [], db = [];
  for (let i = 0; i < a.length; i++) { const p = a[i], q = b[i]; if (!p || !q) continue; da.push(p); db.push(q); }
  if (da.length < 20) return null;
  const med = (arr, k) => { const v = arr.map(x => x[k]).sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
  const ma = [0, 1, 2, 3].map(k => med(da, k)), mb = [0, 1, 2, 3].map(k => med(db, k));
  for (let i = 0; i < da.length; i++) {
    const p = da[i], q = db[i];
    const px = p[0] - ma[0], qx = (mirror ? -1 : 1) * (q[0] - mb[0]);
    const pa = p[2] - ma[2], qa = (mirror ? -1 : 1) * (q[2] - mb[2]);
    e += (px - qx) ** 2 + (p[1] - ma[1] - (q[1] - mb[1])) ** 2 + (pa - qa) ** 2 + ((p[3] - ma[3]) - (q[3] - mb[3])) ** 2; c++;
  }
  return { e: e / c, n: c };
}
const out = [];
for (const mirror of [false, true]) for (let off = -30; off < ref.length - 40; off++) {
  const a = seg, b = seg.map((_, i) => ref[i + off] ?? null);
  const s = score(a, b, mirror); if (s && s.n >= Math.min(60, seg.filter(Boolean).length * 0.6)) out.push({ off, mirror, ...s });
}
out.sort((x, y) => x.e - y.e);
console.log(file.split('/').pop(), 'segment frames', seg.length, 'with face', seg.filter(Boolean).length);
for (const o of out.slice(0, 4)) console.log(`  offset ${o.off} (segment frame 0 = speaker ${o.off < 90 ? 'in ' + o.off : 'loop ' + (o.off - 90)}) mirror=${o.mirror} err=${o.e.toFixed(4)} n=${o.n}`);
