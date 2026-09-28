// Build assets/motion/networking.json: six bots, each running the speaker program at its own phase,
// entering with a back-out scale pop (no rise).
//
// Findings (docs/motion-spec.md): after the pop each bot's face matches the speaker loop at a fixed
// phase P (networking frame t -> program loop frame (P + t) mod 480); phases were estimated on the
// 1080p clip and the reel (moderate confidence); the final phases are chosen so that networking loop
// frame 36 reproduces the still exactly (ties broken towards the video estimate). Pop: scale 0 -> 1 with
// back.out(1.2) over 26.5 frames, bot i starts at 9.1 + 3 i frames (bottom row first).
import { readFileSync, writeFileSync } from 'node:fs';
const M = 'tools/scratch/motion';
const r2 = v => Math.round(v * 100) / 100;
const SPK = JSON.parse(readFileSync('assets/motion/speaker.json', 'utf8'));
const backOut = (p, c1) => { const c3 = c1 + 1; return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2; };
const clamp = p => Math.min(1, Math.max(0, p));

const BOTS = [ // pop order
  { name: 'round-blue', shape: 'round', color: '#1084FE', P: 150 },
  { name: 'square-green', shape: 'square', color: '#00C972', P: 459 },
  { name: 'triangle-red', shape: 'triangle', color: '#EE3342', P: 254 },
  { name: 'round-orange', shape: 'round', color: '#FF6700', P: 22 },
  { name: 'cloud-pink', shape: 'cloud', color: '#FF309B', P: 366 },
  { name: 'drop-yellow', shape: 'drop', color: '#FFCC00', P: 195 },
];
const POP = { c1: 1.2, dur: 26.5, first: 9.1, stagger: 3 };

// screen-space eyes of a program frame for a given anchor
function eyesOf(f, A) { const S = A.scale * f.b[3], t = (A.rot + f.b[2]) * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  const x = A.cx + f.b[0] * A.scale, y = A.cy + f.b[1] * A.scale; return f.e.map(e => [x + (c * e[0] - s * e[1]) * S, y + (s * e[0] + c * e[1]) * S]); }

const report = [];
const med = a => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
const bots = BOTS.map((B, i) => {
  const prog = SPK.shapes[B.shape].clips.loop;
  // still registration (canonical shape on 10-networking.png) and still eyes
  const reg = JSON.parse(readFileSync(`${M}/stills/net-${B.name}.raw.json`, 'utf8')).frames[0];
  const se = reg.eyes.filter(e => e.w > 3 && e.h > 20).sort((a, b) => a.x - b.x);
  const rotStill = B.shape === 'round' ? se.reduce((a, e) => a + e.a, 0) / se.length : reg.rot;
  // choose the program frame F that reproduces the still; ties -> closest to the video phase
  const cand = prog.map((f, F) => {
    const scale = reg.s / f.b[3], A = { cx: reg.x - f.b[0] * scale, cy: reg.y - f.b[1] * scale, scale, rot: rotStill - f.b[2] };
    const q = eyesOf(f, A); const err = Math.max(...[0, 1].map(k => Math.hypot(q[k][0] - se[k].x, q[k][1] - se[k].y)));
    return { F, A, err };
  });
  const bestErr = Math.min(...cand.map(c => c.err));
  const prior = (B.P + 126) % 480, dist = F => Math.min(Math.abs(F - prior), 480 - Math.abs(F - prior));
  const pick = cand.filter(c => c.err <= bestErr + 0.5).sort((a, b) => dist(a.F) - dist(b.F))[0];
  const P = ((pick.F - 126) % 480 + 480) % 480;
  const A = { cx: r2(pick.A.cx), cy: r2(pick.A.cy), scale: Math.round(pick.A.scale * 10000) / 10000, rot: r2(pick.A.rot) };
  report.push(`${B.name}: still = program frame ${pick.F} (eye err ${pick.err.toFixed(2)} px) -> phase ${P} (video estimate ${B.P}); anchor (${A.cx}, ${A.cy}) s ${A.scale} rot ${A.rot}`);
  const t0 = POP.first + POP.stagger * i;
  const at = t => prog[((P + t) % 480 + 480) % 480];
  const inn = Array.from({ length: 90 }, (_, t) => { const p = clamp((t - t0) / POP.dur); const k = p <= 0 ? 0 : backOut(p, POP.c1); if (k <= 0.001) return null; const f = at(t); return { b: [f.b[0], f.b[1], f.b[2], r2(f.b[3] * k * 10000) / 10000], e: f.e }; });
  const loop = Array.from({ length: 480 }, (_, j) => at(90 + j));
  // out (not visible on any reference): shrink with back.in(1.2), reverse order, 0.1 s stagger
  const backIn = (p, c1) => { const c3 = c1 + 1; return c3 * p ** 3 - c1 * p * p; };
  const o0 = POP.stagger * (BOTS.length - 1 - i);
  const out = Array.from({ length: 42 }, (_, j) => { const p = clamp((j - o0) / 18); const k = 1 - backIn(p, 1.2); if (k <= 0.001) return null; const f = at(90 + 480 + j); return { b: [f.b[0], f.b[1], f.b[2], r2(f.b[3] * k * 10000) / 10000], e: f.e }; });
  return { shape: B.shape, color: B.color, phase: P, phaseVideoEstimate: B.P, pop: { t0: r2(t0), dur: POP.dur, ease: 'backOut', overshoot: POP.c1 }, anchor: { ...A, how: 'from still 10-networking.png (canonical registered) at program frame phase+126' }, clips: { in: inn, loop, out } };
});

// validate on the still (loop frame 36 = networking frame 126)
const still = { // eyes measured on reference/live-screens/stills/10-networking.png (tools/bots.mjs)
  'round-blue': [[963.78, 823]], 'square-green': [[1254.67, 841.76], [1340.66, 839.83]], 'triangle-red': [[1617.91, 885.43], [1702.37, 883.24]],
  'round-orange': [[1116.31, 535.52], [1186.8, 523.37]], 'cloud-pink': [[1491.01, 558.47], [1562.64, 549.36]], 'drop-yellow': [[1254.62, 314.59], [1331.38, 315.57]] };
bots.forEach((b, i) => { const q = eyesOf(b.clips.loop[36], b.anchor); const m = still[BOTS[i].name];
  const d = m.length === 2 ? Math.max(...[0, 1].map(k => Math.hypot(q[k][0] - m[k][0], q[k][1] - m[k][1]))) : Math.min(...q.map(p => Math.hypot(p[0] - m[0][0], p[1] - m[0][1])));
  report.push(`${BOTS[i].name}: still (loop 36) eye error ${d.toFixed(2)} px`); });

// order = config/event.js networkingBots (drop, round orange, cloud, round blue, square, triangle)
const ORDER = ['drop-yellow', 'round-orange', 'cloud-pink', 'round-blue', 'square-green', 'triangle-red'];
const ordered = ORDER.map(n => { const i = BOTS.findIndex(b => b.name === n); return { ...bots[i], popIndex: i }; });
writeFileSync('assets/motion/networking.json', JSON.stringify({
  preset: 'networking', fps: 30, bots: ordered, stills: { networking: { clip: 'loop', frame: 36 } },
  timing: { clips: { in: 90, loop: 480, out: 42 }, pop: POP, text: 'lines slide up (expo-out 1.0 s, travel 126 px) at 0.517 / 0.625 / 0.742 s', out: 'ASSUMED (no reference): bots shrink with back.in(1.2) over 18 frames in reverse order, 3-frame stagger; text leaves as on every screen' },
  notes: 'Networking (10): six bots in a pyramid. Phases chosen so loop frame 36 = the still (the video estimates `phaseVideoEstimate` are kept for reference). Each bot = speaker program (assets/motion/speaker.json, same shape) at phase `phase` (networking frame t -> program loop frame (phase + t) mod 480), times a scale pop. anchor = neutral pose of that bot. loop length 480 is an assumption (every bot is periodic in 480 so the loop is seamless); the reference loop is not available.\n' + report.join('\n'),
}));
console.log(report.join('\n'));
