// Build assets/motion/speaker.json from the raw captures in tools/scratch/motion/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { normalise } from './normalise-track.mjs';
import { smoothClipped } from './motion-clean.mjs';
const M = 'tools/scratch/motion';
const shapes = { square: 'hugo', cloud: 'leire', round: 'xuban' };
const out = { preset: 'speaker', fps: 30, shapes: {}, stills: { speaker: { clip: 'loop', frame: 36 }, qa: { clip: 'loop', frame: 276 } }, notes: '' };
const report = [];
for (const [shape, who] of Object.entries(shapes)) {
  const load = c => JSON.parse(readFileSync(`${M}/speaker-${who}-${c}.raw.json`, 'utf8'));
  const loopRaw = load('2-loop');
  const anchor = { video: `reference/live-screens/video/speaker-${who}-logo_2-loop.mp4`, frame: 90, cx: +loopRaw.anchor.cx.toFixed(2), cy: +loopRaw.anchor.cy.toFixed(2), rot: 0, scale: 1 };
  const opts = { rotFromEyes: shape === 'round' };
  const clip = c => { const raw = load(c); const clippedIdx = raw.frames.map((f, i) => (f && f.clipped ? i : -1)).filter(i => i >= 0); return smoothClipped(normalise(raw, opts), clippedIdx); };
  const clips = { in: clip('1-in'), loop: clip('2-loop'), out: clip('3-out') };
  out.shapes[shape] = { anchor, clips };
  const d = (a, b) => a && b ? Math.max(...a.b.map((v, i) => Math.abs(v - b.b[i]))) : NaN;
  report.push(`${shape}: in[last] vs loop[479] max|b| diff ${d(clips.in.at(-1), clips.loop[479]).toFixed(2)}; out[0] vs loop[0] ${d(clips.out[0], clips.loop[0]).toFixed(2)}; in null frames ${clips.in.filter(f => !f).length}, out null ${clips.out.filter(f => !f).length}`);
}
out.notes = [
  'Captured from the 1080p logo clips (bot identical to clean clips). Anchor = neutral pose = loop frame 90 (eyes centred, vertical); the canonical assets/bots/<shape>.json was traced from that exact frame, so anchor rot 0 / scale 1.',
  'Clip lengths: in 90 fr (3.0 s), loop 480 fr (16 s, seamless), out 42 fr (1.4 s). The in clip ends on the pose of loop frame 479 and the next frame is loop frame 0; the out clip starts on loop frame 0.',
  'Stills: speaker screens = loop frame 36 (look right). Q&A screens = loop frame 276 (look left). The loop second half (240-479) is the left/right mirror of the first half in screen space.',
  'Q&A clips: loop = this loop shifted by 240 frames (start at 240). in/out = mirror() of these in/out (negate dx, rot, eye x, eye a; swap eyes), see tools/normalise-track.mjs mirror().',
  'round: silhouette has no usable rotation, rot is taken from the eyes (mean eye angle; neutral eyes are vertical).',
  ...report,
].join('\n');
mkdirSync('assets/motion', { recursive: true });
writeFileSync(`${M}/speaker-captured.json`, JSON.stringify(out)); // source for tools/motion-build-program.mjs
console.log(report.join('\n'));
