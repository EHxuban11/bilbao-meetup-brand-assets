// Mean brightness (and alpha) of a rectangle per frame, normalised to a reference frame.
// usage: node tools/motion-region-level.mjs <video> x0 y0 x1 y1 [--ref N] [--ss s --to s]
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
const argv = process.argv.slice(2); const opt = (k, dflt) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : dflt);
const [video, a, b, c, d] = argv; const refArg = opt('--ref', undefined);
const rng = [...(opt('--ss') ? ['-ss', opt('--ss')] : []), ...(opt('--to') ? ['-to', opt('--to')] : [])];
const [x0, y0, x1, y1] = [a, b, c, d].map(Number); const W = 1920, H = 1080;
const decoder = video.endsWith('.webm') ? ['-c:v', 'libvpx-vp9'] : [];
const ff = spawn(ffmpegPath, ['-v', 'error', ...decoder, ...rng, '-i', video, '-vf', 'scale=1920:1080,format=rgba', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
let buf = Buffer.alloc(0); const vals = [];
for await (const ch of ff.stdout) { buf = Buffer.concat([buf, ch]); while (buf.length >= W * H * 4) { const fr = buf.subarray(0, W * H * 4); buf = buf.subarray(W * H * 4);
  let s = 0, sa = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4; s += (fr[i] + fr[i + 1] + fr[i + 2]) / 3 * fr[i + 3] / 255; sa += fr[i + 3]; n++; }
  vals.push([s / n, sa / n / 255]); } }
const ref = vals[refArg !== undefined ? +refArg : 0][0] || 1;
console.log(vals.map((v, i) => `${i}:${(v[0] / ref).toFixed(3)}${v[1] < 0.999 ? '/a' + v[1].toFixed(3) : ''}`).join(' '));
