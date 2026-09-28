// Build an assets/motion/<preset>.json from raw mocap captures and a small spec.
// usage: node tools/motion-build.mjs <spec.json>
// spec: {
//   preset, fps: 30, stills: {...}, notes: "...", timing: {...optional non-bot timing...},
//   shapes: { <shape>: ENTRY }            // one bot, variants per shape
//   or bots: [ ENTRY + {shape, color} ]   // several bots on one screen
// }
// ENTRY: { raw: { in: file, loop: file, out: file }, video: "...",
//          anchor: { clip: "loop", frame: 120 } | { x, y, rot, scale },
//          rotFromEyes: bool, smooth: bool (default true),
//          scaleOutlier: 0.02 (snap |s-1| beyond this to a neighbour; null = scale really animates) }
// Raw captures made with --shape (canonical) give absolute scale vs assets/bots/<shape>.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { normalise } from './normalise-track.mjs';
import { smoothClipped } from './motion-clean.mjs';

const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const r2 = v => Math.round(v * 100) / 100;
const report = [];

function eyeRot(f) { const g = (f.eyes || []).filter(e => e.h > e.w && e.w > 3); return g.length ? g.reduce((s, e) => s + e.a, 0) / g.length : 0; }

function buildEntry(E, label) {
  const raws = Object.fromEntries(Object.entries(E.raw).map(([k, f]) => [k, JSON.parse(readFileSync(f, 'utf8'))]));
  let A;
  if (E.anchor.clip) {
    const fr = raws[E.anchor.clip].frames[E.anchor.frame];
    A = { x: fr.x, y: fr.y, rot: E.rotFromEyes ? eyeRot(fr) : fr.rot, scale: fr.s };
  } else A = { ...E.anchor };
  const clips = {};
  for (const [k, raw] of Object.entries(raws)) {
    // frames whose position/rotation is poorly determined: little of the body is visible
    const clippedIdx = raw.frames.map((f, i) => (f && (f.vis !== undefined ? f.vis < 0.4 : f.clipped) ? i : -1)).filter(i => i >= 0);
    let fr = normalise(raw, { rotFromEyes: !!E.rotFromEyes, anchor: A });
    if (E.smooth !== false) fr = smoothClipped(fr, clippedIdx);
    // scale outliers (registration on a sliver of body): snap to the nearest trustworthy frame
    const tol = E.scaleOutlier === undefined ? 0.02 : E.scaleOutlier;
    if (tol !== null) {
      const ok = fr.map((f, i) => (f && Math.abs(f.b[3] - 1) <= tol ? i : -1)).filter(i => i >= 0);
      fr.forEach((f, i) => { if (f && Math.abs(f.b[3] - 1) > tol && ok.length) { const j = ok.reduce((b, q) => (Math.abs(q - i) < Math.abs(b - i) ? q : b), ok[0]); f.b[3] = fr[j].b[3]; } });
    }
    clips[k] = fr;
  }
  const d = (a, b) => (a && b ? Math.max(...a.b.map((v, i) => Math.abs(v - b.b[i]))).toFixed(2) : 'n/a');
  if (clips.in && clips.loop) report.push(`${label}: in[last] vs loop[last] ${d(clips.in.at(-1), clips.loop.at(-1))}`);
  if (clips.out && clips.loop) report.push(`${label}: out[0] vs loop[0] ${d(clips.out[0], clips.loop[0])}`);
  for (const [k, c] of Object.entries(clips)) report.push(`${label}: ${k} ${c.length} fr, ${c.filter(f => !f).length} empty`);
  const anchor = { video: E.video, ...(E.anchor.clip ? { clip: E.anchor.clip, frame: E.anchor.frame } : {}), cx: r2(A.x), cy: r2(A.y), rot: r2(A.rot), scale: Math.round(A.scale * 10000) / 10000 };
  return { anchor, clips };
}

const out = { preset: spec.preset, fps: spec.fps || 30 };
if (spec.shapes) { out.shapes = {}; for (const [sh, E] of Object.entries(spec.shapes)) out.shapes[sh] = buildEntry(E, sh); }
if (spec.bots) out.bots = spec.bots.map((E, i) => ({ shape: E.shape, color: E.color, ...buildEntry(E, `${i}:${E.shape}`) }));
if (spec.stills) out.stills = spec.stills;
if (spec.timing) out.timing = spec.timing;
out.notes = [spec.notes || '', ...report].filter(Boolean).join('\n');
mkdirSync('assets/motion', { recursive: true });
writeFileSync(`assets/motion/${spec.preset}.json`, JSON.stringify(out));
console.log(`assets/motion/${spec.preset}.json\n` + report.join('\n'));
