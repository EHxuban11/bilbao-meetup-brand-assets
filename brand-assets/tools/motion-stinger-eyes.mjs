// Per-frame eye blobs and body extent for alpha videos (stingers, lower thirds, logo bug).
// Eyes = opaque dark blobs; body = opaque coloured pixels. Prints the two largest eye blobs
// (centroid, bbox, area, whether cut by the frame edge) and the body bbox/area.
// usage: node tools/motion-stinger-eyes.mjs <video.webm> [--ss s --to s] [--json out.json]
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const video = argv[0]; const W = 1920, H = 1080;
const NOALPHA = argv.includes('--noalpha');
const dec = video.endsWith('.webm') ? ['-c:v', 'libvpx-vp9'] : [];
const rng = [...(opt('--ss') ? ['-ss', opt('--ss')] : []), ...(opt('--to') ? ['-to', opt('--to')] : [])];
const ff = spawn(ffmpegPath, ['-v', 'error', ...dec, ...rng, '-i', video, '-vf', 'scale=1920:1080,format=rgba', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
let buf = Buffer.alloc(0), f = 0; const FR = W * H * 4; const rows = [];
for await (const ch of ff.stdout) {
  buf = Buffer.concat([buf, ch]);
  while (buf.length >= FR) {
    const fr = buf.subarray(0, FR); buf = buf.subarray(FR);
    const dark = new Uint8Array(W * H); let bx0 = W, by0 = H, bx1 = -1, by1 = -1, bn = 0;
    for (let k = 0; k < W * H; k++) { const i = k * 4; if (fr[i + 3] < 128) continue; const mx = Math.max(fr[i], fr[i + 1], fr[i + 2]);
      if (mx < 70) dark[k] = 1; else { bn++; const x = k % W, y = (k / W) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; } }
    const lab = new Int32Array(W * H).fill(-1); const blobs = [];
    for (let k = 0; k < W * H; k++) if (dark[k] && lab[k] < 0) {
      const st = [k]; lab[k] = blobs.length; let n = 0, sx = 0, sy = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
      while (st.length) { const q = st.pop(); const x = q % W, y = (q / W) | 0; n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const r of [q - 1, q + 1, q - W, q + W]) if (r >= 0 && r < W * H && dark[r] && lab[r] < 0 && Math.abs((r % W) - x) <= 1) { lab[r] = blobs.length; st.push(r); } }
      blobs.push({ n, cx: sx / n + 0.5, cy: sy / n + 0.5, x0, y0, x1: x1 + 1, y1: y1 + 1, cut: x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1 });
    }
    const eyes = blobs.filter(b => b.n > 30).sort((a, b) => b.n - a.n).slice(0, 2).sort((a, b) => a.cx - b.cx);
    rows.push({ f, body: bn ? [bx0, by0, bx1 + 1, by1 + 1, bn] : null, eyes });
    f++;
  }
}
if (opt('--json')) { (await import('node:fs')).writeFileSync(opt('--json'), JSON.stringify(rows)); }
else for (const r of rows) console.log(`${r.f}\tbody ${r.body ? r.body.join(',') : '-'}\t` + r.eyes.map(e => `(${e.cx.toFixed(1)},${e.cy.toFixed(1)} bb ${e.x0}-${e.x1}x${e.y0}-${e.y1} n${e.n}${e.cut ? ' CUT' : ''})`).join(' '));
