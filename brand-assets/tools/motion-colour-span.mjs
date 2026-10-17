// Frames where a colour covers more than a threshold share of the frame (low-res scan).
// usage: node tools/motion-colour-span.mjs <video> <hex,hex,...> [--thr 0.003]
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
const [,, video, hexes, , thrArg] = process.argv; const thr = +(thrArg || 0.003);
const cols = hexes.split(',').map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
const W = 320, H = 180; const ff = spawn(ffmpegPath, ['-v', 'error', '-i', video, '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
let buf = Buffer.alloc(0), f = 0; const on = cols.map(() => []);
for await (const ch of ff.stdout) { buf = Buffer.concat([buf, ch]); while (buf.length >= W * H * 3) { const fr = buf.subarray(0, W * H * 3); buf = buf.subarray(W * H * 3);
  cols.forEach((c, ci) => { let n = 0; for (let i = 0; i < fr.length; i += 3) if (Math.abs(fr[i] - c[0]) + Math.abs(fr[i + 1] - c[1]) + Math.abs(fr[i + 2] - c[2]) < 40) n++; on[ci].push(n / (W * H) > thr); }); f++; } }
cols.forEach((c, ci) => { const runs = []; let s = -1; on[ci].forEach((v, i) => { if (v && s < 0) s = i; if (!v && s >= 0) { runs.push([s, i - 1]); s = -1; } }); if (s >= 0) runs.push([s, on[ci].length - 1]);
  console.log(hexes.split(',')[ci], runs.filter(r => r[1] - r[0] > 5).map(r => `${r[0]}-${r[1]} (${r[1] - r[0] + 1} fr)`).join('  ')); });
