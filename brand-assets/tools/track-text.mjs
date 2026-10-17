// Track text lines through a video: for each line band, ink top/bottom and ink amount per frame.
// usage: node tools/track-text.mjs <video> <x0> <x1> <y0:y1,...> [--every n]
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
const [,, video, xa, xb, bands, , every = '1'] = process.argv;
const W = 1920, H = 1080, X0 = +xa, X1 = +xb;
const B = bands.split(',').map(s => s.split(':').map(Number));
const ff = spawn(ffmpegPath, ['-v', 'error', '-i', video, '-vf', 'scale=1920:1080', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
let buf = Buffer.alloc(0), f = 0;
console.log('frame\t' + B.map(b => `[${b}] top/bot/ink`).join('\t'));
for await (const ch of ff.stdout) {
  buf = Buffer.concat([buf, ch]);
  while (buf.length >= W * H) {
    const fr = buf.subarray(0, W * H); buf = buf.subarray(W * H);
    if (f % +every === 0) {
      const cols = B.map(([y0, y1]) => { let top = -1, bot = -1, ink = 0;
        for (let y = y0; y <= y1; y++) { let n = 0; for (let x = X0; x < X1; x++) if (fr[y * W + x] > 60) n++; if (n) { if (top < 0) top = y; bot = y; ink += n; } }
        return `${top}/${bot}/${ink}`; });
      console.log(`${f}\t${cols.join('\t')}`);
    }
    f++;
  }
}
