// Fit masked line reveals in a reference clip.
// For each line: the ink's top (mode in) or bottom (mode out) is tracked inside the line's band;
// we fit  offset(t) = L * (1 - ease((t - t0) / D))   (in: text rises from +L to 0)
//      or  offset(t) = -L * ease((t - t0) / D)        (out: text rises from 0 to -L)
// over ease families, returning t0 (frames), D (frames), the easing and the fit error.
//
// usage: node tools/motion-text-fit.mjs <video> <in|out> <x0> <x1> <lines.json | inline> [--ss s --to s] [--fam a,b] [--D frames]
// lines: [{"name":"header1","band":[80,160],"final":[102,149],"L":70}, ...]
//   band  = rows to scan (the line's mask box, a little generous)
//   final = [ink top, ink bottom] of the line at rest (from a still)
//   L     = line height (the travel distance)
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import ffmpegPath from 'ffmpeg-static';

const [,, video, mode, xa, xb, spec, ...rest] = process.argv;
const lines = JSON.parse(existsSync(spec) ? readFileSync(spec, 'utf8') : spec);
const opt = (k, d) => (rest.includes(k) ? rest[rest.indexOf(k) + 1] : d);
const THR = +opt('--thr', 60); // grey level counted as ink
const W = 1920, H = 1080, X0 = +xa, X1 = +xb;

const E = {
  linear: p => p,
  sineOut: p => Math.sin(p * Math.PI / 2), sineIn: p => 1 - Math.cos(p * Math.PI / 2),
  quadOut: p => 1 - (1 - p) ** 2, quadIn: p => p * p,
  cubicOut: p => 1 - (1 - p) ** 3, cubicIn: p => p ** 3,
  quartOut: p => 1 - (1 - p) ** 4, quartIn: p => p ** 4,
  quintOut: p => 1 - (1 - p) ** 5, quintIn: p => p ** 5,
  expoOut: p => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)), expoIn: p => (p <= 0 ? 0 : 2 ** (10 * (p - 1))),
  circOut: p => Math.sqrt(1 - (p - 1) ** 2), circIn: p => 1 - Math.sqrt(1 - p * p),
  backOut: p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2; },
  backIn: p => { const c1 = 1.70158, c3 = c1 + 1; return c3 * p ** 3 - c1 * p * p; },
  sineInOut: p => -(Math.cos(Math.PI * p) - 1) / 2,
  quadInOut: p => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2),
  cubicInOut: p => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
  quartInOut: p => (p < 0.5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2),
  quintInOut: p => (p < 0.5 ? 16 * p ** 5 : 1 - (-2 * p + 2) ** 5 / 2),
  expoInOut: p => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? 2 ** (20 * p - 10) / 2 : (2 - 2 ** (-20 * p + 10)) / 2),
};
const FAM = opt('--fam', null);
const fams = FAM ? FAM.split(',') : Object.keys(E).filter(k => mode === 'in' ? !k.endsWith('In') : !k.endsWith('Out') || k.endsWith('InOut'));

const decoder = video.endsWith('.webm') ? ['-c:v', 'libvpx-vp9'] : [];
const rng = [...(opt('--ss', null) !== null ? ['-ss', opt('--ss', null)] : []), ...(opt('--to', null) !== null ? ['-to', opt('--to', null)] : [])];
const ff = spawn(ffmpegPath, ['-v', 'error', ...decoder, ...rng, '-i', video, '-vf', 'scale=1920:1080,format=rgba', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
let buf = Buffer.alloc(0), f = 0; const FR = W * H * 4; const obs = lines.map(() => []);
for await (const ch of ff.stdout) {
  buf = Buffer.concat([buf, ch]);
  while (buf.length >= FR) {
    const fr = buf.subarray(0, FR); buf = buf.subarray(FR);
    lines.forEach((ln, li) => {
      let top = -1, bot = -1;
      for (let y = ln.band[0]; y <= ln.band[1]; y++) {
        let n = 0; for (let x = X0; x < X1; x++) { const i = (y * W + x) * 4; const v = Math.max(fr[i], fr[i + 1], fr[i + 2]) * fr[i + 3] / 255; if (v > THR) n++; }
        if (n > 0) { if (top < 0) top = y; bot = y; }
      }
      obs[li].push([f, top, bot]);
    });
    f++;
  }
}
const nFrames = f;
const results = lines.map((ln, li) => {
  // usable observations: the tracked edge is inside the band (not clipped by the mask)
  const pts = obs[li].filter(([, t, b]) => t >= 0).map(([fi, t, b]) => mode === 'in'
    ? [fi, t - ln.final[0], t > ln.band[0] + 1 && t < ln.band[1] - 2]
    : [fi, b - ln.final[1], b > ln.band[0] + 2 && b < ln.band[1] - 1]).filter(p => p[2] && Math.abs(p[1]) > 0.4 && Math.abs(p[1]) < ln.L - 1);
  const gone = obs[li].filter(([, t]) => t < 0).map(([fi]) => fi);
  let best = null;
  const DF = opt('--D', null);
  if (pts.length >= 3) for (const fam of fams) for (let D = DF ? +DF : 4; D <= (DF ? +DF : 60); D += 0.5) for (let t0 = -30; t0 <= nFrames; t0 += 0.25) {
    let err = 0;
    for (const [fi, o] of pts) {
      const p = Math.min(1, Math.max(0, (fi - t0) / D));
      const m = mode === 'in' ? ln.L * (1 - E[fam](p)) : -ln.L * E[fam](p);
      err += (m - o) ** 2;
    }
    err = Math.sqrt(err / pts.length);
    if (!best || err < best.err) best = { fam, t0, D, err };
  }
  return { name: ln.name, n: pts.length, ...best, firstInk: obs[li].find(o => o[1] >= 0)?.[0], lastInk: [...obs[li]].reverse().find(o => o[1] >= 0)?.[0], goneFrames: gone.length };
});
for (const r of results) console.log(`${r.name.padEnd(12)} n=${String(r.n).padStart(2)} ${r.fam ?? '-'} t0=${r.t0?.toFixed(2)}f (${(r.t0 / 30).toFixed(3)}s) D=${r.D}f (${(r.D / 30).toFixed(3)}s) rms=${r.err?.toFixed(2)}px ink ${r.firstInk}-${r.lastInk}`);
