// Per-frame difference between two videos, split into regions.
// usage: node tools/compare-video.mjs <ours> <reference> [--every n]
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
const [,, A, B, , every = '6'] = process.argv;
const W = 1920, H = 1080, FR = W * H;
const reader = f => { const ff = spawn(ffmpegPath, ['-v', 'error', '-i', f, '-vf', 'scale=1920:1080', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']); const it = ff.stdout[Symbol.asyncIterator](); let buf = Buffer.alloc(0);
  return async () => { while (buf.length < FR) { const { value, done } = await it.next(); if (done) return null; buf = Buffer.concat([buf, value]); } const fr = buf.subarray(0, FR); buf = buf.subarray(FR); return fr; }; };
const ra = reader(A), rb = reader(B);
const regions = { text: [0, 0, 950, 1080], bot: [950, 150, 1920, 1080], logo: [1560, 60, 1920, 140] };
console.log('frame\t' + Object.keys(regions).join('\t') + '\t(mean abs diff, 0-255)');
for (let f = 0; ; f++) {
  const a = await ra(), b = await rb(); if (!a || !b) break;
  if (f % +every) continue;
  const out = Object.values(regions).map(([x0, y0, x1, y1]) => { let s = 0, n = 0; for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { s += Math.abs(a[y * W + x] - b[y * W + x]); n++; } return (s / n).toFixed(2); });
  console.log(`${f}\t${out.join('\t')}`);
}
