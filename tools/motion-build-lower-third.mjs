// Build assets/motion/lower-third.json (icon bot track + pill/text timing) from lower-leire captures.
// The icon is ~90 px wide, too small for silhouette registration, so the body is fixed at the pill
// cap centre, its scale follows the fitted in/out curves, and the eyes come from the capture.
import { readFileSync, writeFileSync } from 'node:fs';
const M = 'tools/scratch/motion';
const r2 = v => Math.round(v * 100) / 100;
const backOut = (p, c1) => { const c3 = c1 + 1; return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2; };
const backIn = (p, c1) => { const c3 = c1 + 1; return c3 * p ** 3 - c1 * p * p; };
const clamp = p => Math.min(1, Math.max(0, p));

// icon body (canonical cloud): bbox centre measured (142, 925.5); cloud bbox centre sits
// (0.21, -12.89) canonical px from the centroid -> centroid (142.0, 926.9); scale 0.1135.
const A = { x: 143.94, y: 926.72, scale: 0.1102 }; // refined so the neutral eyes (loop 120) match the canonical cloud face
const sIn = f => backOut(clamp((f - 3.1) / 20), 1.1);          // icon in
const sOut = f => 1 - backIn(clamp((f + 3.15) / 32.5), 1.5);     // icon out

function track(file, sfn) {
  const raw = JSON.parse(readFileSync(`${M}/${file}`, 'utf8')).frames;
  const frames = raw.map((f, i) => {
    const s = sfn(i); if (s <= 0.002) return null;
    const S = A.scale * s;
    const eyes = (f?.eyes || []).filter(e => e.w > 2 && e.h > 2).slice(0, 2).sort((a, b) => a.x - b.x)
      .map(e => [r2((e.x - A.x) / S), r2((e.y - A.y) / S), r2(e.w / S), r2(e.h / S), r2(e.a)]);
    return { b: [0, 0, 0, Math.round(s * 10000) / 10000], e: eyes };
  });
  // fill frames without two eyes from the nearest good frame (in body units)
  const good = frames.map((f, i) => (f && f.e.length === 2 ? i : -1)).filter(i => i >= 0);
  return frames.map((f, i) => {
    if (!f || f.e.length === 2 || !good.length) return f;
    const j = good.reduce((b, k) => (Math.abs(k - i) < Math.abs(b - i) ? k : b), good[0]);
    return { b: f.b, e: frames[j].e };
  });
}

const out = {
  preset: 'lower-third', fps: 30,
  shapes: { cloud: {
    anchor: { video: 'reference/live-screens/video/lower-leire_2-loop.webm', cx: A.x, cy: A.y, rot: 0, scale: A.scale },
    clips: { in: track('lower-leire-1-in.raw.json', sIn), loop: track('lower-leire-2-loop.raw.json', () => 1), out: track('lower-leire-3-out.raw.json', sOut) },
  } },
  stills: { lower: { clip: 'loop', frame: 0 } },
  timing: {
    clips: { in: 48, loop: 480, out: 36 },
    pill: {
      rect: { x: 80, y: 862, h: 128, rx: 64, note: '2-line pill (name + detail); the 3-line xuban pill is taller, same x and bottom 990' },
      in: { prop: 'width', from: 0, to: 924, ease: 'expoOut', t0: 4.55, dur: 26.5, unit: 'frames', note: 'width to = text width + padding; for Leire 924' },
      out: { prop: 'width', from: 924, to: 0, ease: 'quartInOut', t0: 12.5, dur: 23 },
    },
    icon: {
      center: [142, 926], note: 'centre of the pill cap (x = 80 + 62, y = pill middle); body scales about its centroid',
      in: { prop: 'scale', from: 0, to: 1, ease: 'backOut', overshoot: 1.1, t0: 3.1, dur: 20 },
      out: { prop: 'scale', from: 1, to: 0, ease: 'backIn', overshoot: 1.5, t0: -3.15, dur: 32.5, note: 'swells ~10% before shrinking; reaches 0 at frame 29.4' },
    },
    text: {
      x: 213, lines: [{ role: 'name', size: 40, color: 'white', baseline: 921 }, { role: 'detail', size: 32, color: 'grey', baseline: 961 }],
      in: { ease: 'expoOut', travel: 'line height (40 / 38)', starts: { name: 13.0, detail: 14.75 }, dur: 29 },
      out: { ease: 'cubicInOut', travel: '-line height', starts: { name: 0, detail: 1.75 }, dur: 14.5 },
    },
  },
  notes: 'Lower third (13-15). Icon = speaker lowerThirdBot at 0.1102 canonical scale, body centroid (143.94, 926.72) (captured on Leire: cloud). Eyes are in canonical cloud body units; for other shapes retarget via the neutral faces in docs/motion-spec.md. Body rotation is not measurable at this size (0). Loop (16 s) keeps the pill and text static; only the icon eyes move (look around, blink ~ loop frame 160).',
};
writeFileSync('assets/motion/lower-third.json', JSON.stringify(out));
const c = out.shapes.cloud.clips;
console.log('lower-third.json', Object.entries(c).map(([k, v]) => `${k} ${v.length} fr (${v.filter(f => !f).length} empty)`).join(', '));
console.log('in 10', JSON.stringify(c.in[10]), '\nloop 120', JSON.stringify(c.loop[120]), '\nloop 160', JSON.stringify(c.loop[160]));
