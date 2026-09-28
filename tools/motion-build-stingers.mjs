// Build assets/motion/stingers.json: five stinger transitions (48 frames, 1.6 s, cut at 800 ms).
//
// Stingers 1 (round, rise) and 4 (triangle, pulse) are reconstructed frame by frame from the alpha
// .webm files (tools/scratch/motion/stinger-*.eyes.json): while the bot fills the screen only the
// eyes are visible, so scale comes from the eye spacing, the face centre from the eyes (or from the
// uncut eye edge + eye height when an eye is cut), and the body from the neutral face offset. Frames
// without eyes use the body's visible edge.
// Stingers 2, 3, 5 exist only on the preview reel. They follow the same program along another axis:
// the face path v(t) of stinger 1 (entry ease-out, slow drift, blink, exit ease-in), with the entry
// and exit legs scaled per stinger (fitted on the reel eyes, see docs/motion-spec.md).
import { readFileSync, writeFileSync } from 'node:fs';
const M = 'tools/scratch/motion';
const r2 = v => Math.round(v * 100) / 100;
const shape = n => JSON.parse(readFileSync(`assets/bots/${n}.json`, 'utf8'));
const faceOf = s => { const [a, b] = [...s.face].sort((p, q) => p.x - q.x); return { ox: (a.x + b.x) / 2, oy: (a.y + b.y) / 2, sp: b.x - a.x, w: (a.w + b.w) / 2, h: (a.h + b.h) / 2, ex: [a.x, b.x] }; };
const N = 48, W = 1920, H = 1080;

// ---- stinger 1: exact reconstruction ------------------------------------------------------------
const R = shape('round'), FR = faceOf(R), s1 = 720 / FR.sp; // eye spacing is 720 px throughout
const e1 = JSON.parse(readFileSync(`${M}/stinger-1.eyes.json`, 'utf8'));
const hOpen1 = FR.h * s1;
const openness = new Array(N).fill(1);
const faceY1 = e1.map(r => {
  const [a, b] = r.eyes; const body = r.body;
  if (a && b && !a.cut && !b.cut) { openness[r.f] = ((a.y1 - a.y0) + (b.y1 - b.y0)) / 2 / hOpen1; return (a.cy + b.cy) / 2; }
  if (a && b && a.y0 === 0 && a.y1 < H) return (a.y1 + b.y1) / 2 - hOpen1 / 2;      // cut at the top
  if (a && b && a.y1 === H && a.y0 > 0) return (a.y0 + b.y0) / 2 + hOpen1 / 2;      // cut at the bottom
  if (body && body[1] > 0) return body[1] - R.bbox[1] * s1 + FR.oy * s1;             // body top visible
  if (body && body[3] < H) return body[3] - R.bbox[3] * s1 + FR.oy * s1;             // body bottom visible
  return null;
});
for (const k of [22, 23, 24, 25, 26]) if (openness[k] === 1) openness[k] = openness[k]; // measured above
// travel coordinate for stinger 1 (upward = positive), relative to the screen centre
const v1 = faceY1.map(y => (y === null ? null : 540 - y));

// ---- stinger 4: exact reconstruction ------------------------------------------------------------
const T = shape('triangle'), UP = 5.16;           // triangle upright = canonical + 5.16 deg
const T_FACE = { oy: 90.98, sp: 212.0, w: 114.3, h: 294.5 }; // neutral, measured on this stinger
const e4 = JSON.parse(readFileSync(`${M}/stinger-4.eyes.json`, 'utf8'));
const s4 = e4.map(r => (r.eyes.length === 2 ? (r.eyes[1].cx - r.eyes[0].cx) / T_FACE.sp : null));
const open4 = e4.map(r => { const [a, b] = r.eyes; return a && b && !a.cut && !b.cut && s4[r.f] ? ((a.y1 - a.y0) + (b.y1 - b.y0)) / 2 / (T_FACE.h * s4[r.f]) : 1; });

// ---- generic frame builder ----------------------------------------------------------------------
function frame({ fx, fy, s, rot, open, shp, face, upright = 0 }) {
  // body centre from the face centre: face offset is (ox, oy) in the upright body frame
  const t = (rot + 0) * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t);
  const ox = face.ox || 0, oy = face.oy;
  const bx = fx - (c * ox - sn * oy) * s, by = fy - (sn * ox + c * oy) * s;
  // visibility: rough bbox test (upright bbox scaled)
  const bb = shp.bbox, ext = Math.max(...bb.map(Math.abs)) * s;
  if (bx + ext < 0 || bx - ext > W || by + ext < 0 || by - ext > H) return null;
  // eyes in canonical body-local coords (upright local rotated by -upright)
  const u = -upright * Math.PI / 180, cu = Math.cos(u), su = Math.sin(u);
  const eyes = [-face.sp / 2, face.sp / 2].map(dx => { const x = (face.ox || 0) + dx, y = face.oy; return [r2(cu * x - su * y), r2(su * x + cu * y), r2(face.w), r2(face.h * open), r2(-upright)]; });
  return { b: [r2(bx - 960), r2(by - 540), r2(rot + upright), Math.round(s * 10000) / 10000], e: eyes };
}

// stinger 1 frames
const st1 = v1.map((v, i) => (v === null ? null : frame({ fx: 960, fy: 540 - v, s: s1, rot: 0, open: openness[i], shp: R, face: { ox: FR.ox, oy: FR.oy, sp: FR.sp, w: FR.w, h: FR.h } })));
// stinger 4 frames (fill scale gaps by interpolation)
const sFill = s4.map((v, i) => { if (v !== null) return v; let a = i - 1; while (a >= 0 && s4[a] === null) a--; let b = i + 1; while (b < N && s4[b] === null) b++;
  if (a < 0 || b >= N) return null; return s4[a] + (s4[b] - s4[a]) * (i - a) / (b - a); });
const st4 = sFill.map((s, i) => (!s ? null : frame({ fx: 960.3, fy: 540.4, s, rot: 0, open: open4[i], shp: T, face: { ox: 0, oy: T_FACE.oy, sp: T_FACE.sp, w: T_FACE.w, h: T_FACE.h }, upright: UP })));

// ---- program stingers (2, 3, 5): v(t) = stinger 1 path, entry/exit legs scaled -----------------
const V1 = v1.map((v, i) => v ?? (i < 10 ? -1e4 : 1e4));
function pathV(i, kIn, kOut, drift = 1) {
  const v = V1[i], v28 = V1[28];
  if (i <= 16) return v < 0 ? v * kIn : v;
  if (i <= 28) return V1[16] + (v - V1[16]) * drift;
  return V1[16] + (v28 - V1[16]) * drift + (v - v28) * kOut;
}
function programStinger({ shp, face, s, axis, dir, kIn, kOut, drift, rotPerPx = 0, rotEntryOnly = false }) {
  return Array.from({ length: N }, (_, i) => {
    if (V1[i] <= -1e4 + 1 || V1[i] >= 1e4 - 1) {
      // stinger 1 has no position here (before entry / after exit): extrapolate a little further out
    }
    const v = pathV(i, kIn, kOut, drift);
    if (!isFinite(v) || Math.abs(v) > 6000) return null;
    const rot = rotEntryOnly ? Math.min(0, v) * rotPerPx : v * rotPerPx;
    const fx = axis === 'x' ? 960 + dir * v : 959.75, fy = axis === 'y' ? 540 + dir * v : 540;
    return frame({ fx, fy, s, rot, open: openness[i], shp, face });
  });
}
const C = shape('cloud'), FC = faceOf(C), S = shape('square'), FS = faceOf(S), D = shape('drop'), FD = faceOf(D);
const st2 = programStinger({ shp: C, face: { ox: FC.ox, oy: FC.oy, sp: FC.sp, w: FC.w, h: FC.h }, s: 721 / FC.sp, axis: 'x', dir: +1, kIn: 0.76, kOut: 1.53, drift: 1, rotPerPx: 0.0119, rotEntryOnly: true });
const st3 = programStinger({ shp: D, face: { ox: FD.ox, oy: FD.oy, sp: FD.sp, w: FD.w, h: FD.h }, s: 835.5 / FD.sp, axis: 'y', dir: +1, kIn: 1.0, kOut: 1.81, drift: 1 });
const st5 = programStinger({ shp: S, face: { ox: FS.ox, oy: FS.oy, sp: FS.sp, w: FS.w, h: FS.h }, s: 757 / FS.sp, axis: 'x', dir: -1, kIn: 1.23, kOut: 1.9, drift: 0.84, rotPerPx: -0.0616 });

const out = {
  preset: 'stingers', fps: 30,
  anchor: { cx: 960, cy: 540, rot: 0, scale: 1, note: 'screen centre; b = body centre offset in screen px, b.rot = absolute rotation vs the canonical shape, b.s = absolute scale vs canonical' },
  transitionFrame: 24, frames: 48,
  stingers: [
    { id: 'stinger-1', shape: 'round', color: '#FF6700', move: 'rise', source: 'reference/live-screens/video/stinger-1.webm (exact)', clip: st1 },
    { id: 'stinger-2', shape: 'cloud', color: '#1084FE', move: 'sweep left to right', source: 'preview reel 7.7-9.2 s (program fit, eyes 6-33)', clip: st2 },
    { id: 'stinger-3', shape: 'drop', color: '#FF9800', move: 'drop from the top', source: 'preview reel 12.7-14.3 s (program fit)', clip: st3 },
    { id: 'stinger-4', shape: 'triangle', color: '#FF309B', move: 'grow from the centre, shrink away', source: 'reference/live-screens/video/stinger-4.webm (exact)', clip: st4 },
    { id: 'stinger-5', shape: 'square', color: '#00BCA6', move: 'roll in from the right, out to the left', source: 'preview reel 20.2-21.6 s (program fit)', clip: st5 },
  ],
  notes: 'All five: 48 frames (1.6 s), alpha background, the bot covers the whole screen from about frame 6 to 34 and blinks on frames 22-26 so the cut at frame 24 (800 ms) is hidden. Face path: entry ease-out (frames 1-16), slow drift through the centre (~6 px/frame, frames 16-28), exit ease-in (28-41). Eyes stay in the neutral face; the eye spacing is ~720-835 px (stingers are sized by the face, not the body).',
};
// still frame of each stinger (mask IoU against reference/live-screens/stills/16..20-stinger-*.png)
const STILL = { 'stinger-1': 4, 'stinger-2': 3, 'stinger-3': 3, 'stinger-4': 36, 'stinger-5': 4 };
for (const st of out.stingers) st.still = STILL[st.id];
writeFileSync('assets/motion/stingers.json', JSON.stringify(out));
for (const s of out.stingers) console.log(s.id, s.shape, 'visible frames', s.clip.map((f, i) => (f ? i : -1)).filter(i => i >= 0).join(',').replace(/(\d+)(,\d+)*,(\d+)$/, (m) => { const a = m.split(','); return `${a[0]}-${a.at(-1)}`; }), '| f12', JSON.stringify(s.clip[12]?.b), 'f24', JSON.stringify(s.clip[24]?.b));
