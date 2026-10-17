// Lower-third analysis (alpha video): per frame the pill (opaque dark area) bbox, the icon bot
// (colour) bbox and the text rows (white / grey ink inside the pill).
// usage: node tools/motion-lower-third.mjs <video.webm> <icon hex>
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
const [,, video, hex] = process.argv; const W = 1920, H = 1080;
const C = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const ff = spawn(ffmpegPath, ['-v', 'error', '-c:v', 'libvpx-vp9', '-i', video, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
let buf = Buffer.alloc(0), f = 0; const FR = W * H * 4;
for await (const ch of ff.stdout) {
  buf = Buffer.concat([buf, ch]);
  while (buf.length >= FR) {
    const fr = buf.subarray(0, FR); buf = buf.subarray(FR);
    let p = [W, H, -1, -1, 0], ic = [W, H, -1, -1, 0], tw = [W, H, -1, -1, 0], tg = [W, H, -1, -1, 0], alphaSum = 0, alphaN = 0;
    const grow = (b, x, y) => { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; b[4]++; };
    for (let y = 700; y < H; y++) for (let x = 0; x < 1300; x++) {
      const i = (y * W + x) * 4, a = fr[i + 3]; if (a < 16) continue;
      alphaSum += a; alphaN++;
      if (a < 128) continue;
      grow(p, x, y);
      const r = fr[i], g = fr[i + 1], b = fr[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn > 60 && Math.abs(r - C[0]) + Math.abs(g - C[1]) + Math.abs(b - C[2]) < 120) grow(ic, x, y);
      else if (mx - mn < 20 && mx > 200) grow(tw, x, y);
      else if (mx - mn < 20 && mx > 90 && mx < 150) grow(tg, x, y);
    }
    const s = b => (b[4] ? `${b[0]}-${b[2] + 1}x${b[1]}-${b[3] + 1}(${b[4]})` : '-');
    console.log(`${f}\tpill ${s(p)}\ticon ${s(ic)}\twhite ${s(tw)}\tgrey ${s(tg)}\tmeanA ${(alphaN ? alphaSum / alphaN : 0).toFixed(0)}`);
    f++;
  }
}
