// Per-frame summary of a video at low res: non-black fraction and dominant colour.
// usage: node tools/motion-reel-map.mjs <video>
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
const W = 192, H = 108;
const ff = spawn(ffmpegPath, ['-v', 'error', '-i', process.argv[2], '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
let buf = Buffer.alloc(0), f = 0; const FR = W * H * 3;
for await (const ch of ff.stdout) {
  buf = Buffer.concat([buf, ch]);
  while (buf.length >= FR) {
    const fr = buf.subarray(0, FR); buf = buf.subarray(FR);
    const m = new Map(); let nb = 0;
    for (let i = 0; i < FR; i += 3) { const r = fr[i], g = fr[i + 1], b = fr[i + 2]; if (Math.max(r, g, b) < 50) continue; nb++;
      const k = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5); m.set(k, (m.get(k) || 0) + 1); }
    const [k, n] = [...m].sort((a, b) => b[1] - a[1])[0] || [0, 0];
    const hex = '#' + [(k >> 6) & 7, (k >> 3) & 7, k & 7].map(v => (v * 32 + 16).toString(16).padStart(2, '0')).join('');
    console.log(`${f}\t${(f / 30).toFixed(2)}\t${(nb / (W * H)).toFixed(3)}\t${hex}\t${(n / (W * H)).toFixed(3)}`);
    f++;
  }
}
