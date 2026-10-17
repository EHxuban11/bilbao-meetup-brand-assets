// Validate a motion preset against a raw capture in screen pixels.
// usage: node tools/motion-validate.mjs <preset.json> <shape> <raw.json> <segStart> [--still]
//   segStart: raw frame index where the preset's `in` clip frame 0 sits (in then loop follow).
//   --still: raw is a single still; compare with loop frame 36.
import { readFileSync } from 'node:fs';
const [,, presetFile, shape, rawFile, segArg, ...rest] = process.argv;
const UNTIL = rest.includes('--until') ? +rest[rest.indexOf('--until') + 1] : Infinity;
const P = JSON.parse(readFileSync(presetFile, 'utf8')).shapes[shape]; const A = P.anchor;
const raw = JSON.parse(readFileSync(rawFile, 'utf8')).frames;
const screen = f => { const S = A.scale * f.b[3], rot = A.rot + f.b[2], t = rot * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  const x = A.cx + f.b[0] * A.scale, y = A.cy + f.b[1] * A.scale;
  return { x, y, rot, eyes: f.e.map(e => [x + (c * e[0] - s * e[1]) * S, y + (s * e[0] + c * e[1]) * S, e[2] * S, e[3] * S]) }; };
const timeline = i => (i < 90 ? P.clips.in[i] : P.clips.loop[(i - 90) % 480]);
const pairs = rest.includes('--still') ? [[raw[0], P.clips.loop[36]]] : raw.map((r, k) => [r, timeline(k - +segArg)]).filter(([r, p], k) => k - +segArg >= 0 && k <= UNTIL && r && p);
let eb = 0, ee = 0, n = 0, ne = 0, mb = 0, me = 0;
for (const [r, p] of pairs) {
  if (!r || !p || r.x === undefined) continue;
  const q = screen(p); const db = Math.hypot(q.x - r.x, q.y - r.y); if ((r.vis ?? 1) > 0.5) { eb += db * db; n++; mb = Math.max(mb, db); }
  const re = (r.eyes || []).filter(e => e.w > 3 && e.h > 3 && e.h > 20).sort((a, b) => a.x - b.x);
  if (re.length === 2) { const d = Math.max(...[0, 1].map(k => Math.hypot(q.eyes[k][0] - re[k].x, q.eyes[k][1] - re[k].y))); ee += d * d; ne++; me = Math.max(me, d); }
}
console.log(`${presetFile.split('/').pop()} ${shape} vs ${rawFile.split('/').pop()}: body rms ${Math.sqrt(eb / Math.max(1, n)).toFixed(2)} max ${mb.toFixed(1)} (n=${n}) | eyes rms ${Math.sqrt(ee / Math.max(1, ne)).toFixed(2)} max ${me.toFixed(1)} px (n=${ne})`);
