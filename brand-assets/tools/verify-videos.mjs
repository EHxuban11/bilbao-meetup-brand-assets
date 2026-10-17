// Compare our rendered clips with every full-resolution reference clip we have.
// Prints, per clip, the mean difference (0-255) averaged over frames and the worst frame,
// for the whole frame and for the bot area (right half) separately.
// usage: node tools/verify-videos.mjs [--every 3]
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import ffmpegPath from 'ffmpeg-static';

const every = process.argv.includes('--every') ? +process.argv[process.argv.indexOf('--every') + 1] : 3;
const R = 'reference/live-screens/video/', O = 'out/live-screens/video/';
const PAIRS = [];
for (const s of ['hugo', 'leire', 'xuban']) for (const c of ['1-in', '2-loop', '3-out'])
  PAIRS.push([`${O}0${{ hugo: 4, leire: 6, xuban: 8 }[s]}-speaker-${s}-logo/speaker-${s}-logo_${c}.mp4`, `${R}speaker-${s}-logo_${c}.mp4`]);
for (const c of ['1-in', '2-loop', '3-out']) PAIRS.push([`${O}01-preshow/preshow_${c}.mp4`, `${R}preshow_${c}.mp4`]);
PAIRS.push([`${O}01-preshow-logo/preshow-logo_2-loop.mp4`, `${R}preshow-logo_2-loop.mp4`]);
PAIRS.push([`${O}10-networking/networking_1-in.mp4`, `${R}networking_1-in.mp4`]);
for (const c of ['1-in', '2-loop', '3-out']) PAIRS.push([`${O}14-lower-leire/lower-leire_${c}.webm`, `${R}lower-leire_${c}.webm`]);
for (const n of [1, 4]) PAIRS.push([`${O}1${5 + n}-stinger-${n}/stinger-${n}.webm`, `${R}stinger-${n}.webm`]);
PAIRS.push([`${O}21-logo-bug/logo-bug_full.webm`, `${R}logo-bug_full.webm`]);

const W = 1920, H = 1080, FR = W * H;
function reader(f) {
  const args = f.endsWith('.webm') ? ['-c:v', 'libvpx-vp9'] : [];
  // flatten alpha onto black so transparent areas compare equal
  const ff = spawn(ffmpegPath, ['-v', 'error', ...args, '-i', f, '-filter_complex', 'color=black:s=1920x1080[b];[b][0:v]overlay=shortest=1,format=gray', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
  const it = ff.stdout[Symbol.asyncIterator](); let buf = Buffer.alloc(0);
  return async () => { while (buf.length < FR) { const { value, done } = await it.next(); if (done) return null; buf = Buffer.concat([buf, value]); } const fr = buf.subarray(0, FR); buf = buf.subarray(FR); return fr; };
}
const rows = [];
for (const [a, b] of PAIRS) {
  if (!existsSync(a) || !existsSync(b)) { rows.push({ clip: a.split('/').pop(), note: 'missing' }); continue; }
  const ra = reader(a), rb = reader(b); let n = 0, sAll = 0, sBot = 0, mAll = 0, mBot = 0, f = 0;
  for (;;) { const x = await ra(), y = await rb(); if (!x || !y) break; if (f++ % every) continue;
    let all = 0, bot = 0, na = 0, nb = 0;
    for (let yy = 0; yy < H; yy += 2) for (let xx = 0; xx < W; xx += 2) { const d = Math.abs(x[yy * W + xx] - y[yy * W + xx]); all += d; na++; if (xx >= 960) { bot += d; nb++; } }
    all /= na; bot /= nb; sAll += all; sBot += bot; mAll = Math.max(mAll, all); mBot = Math.max(mBot, bot); n++; }
  rows.push({ clip: a.split('/').pop(), frames: f, 'frame avg': +(sAll / n).toFixed(2), 'frame worst': +mAll.toFixed(2), 'bot avg': +(sBot / n).toFixed(2), 'bot worst': +mBot.toFixed(2) });
}
console.table(rows);
