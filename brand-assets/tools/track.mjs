// Track a bot through a reference video, frame by frame.
// Prints: frame, body area / centroid / rotation (vs the first unclipped frame or a
// reference still), and each eye's centre, length, width and angle.
// usage: node tools/track.mjs <video> <hex colour> [--x0 900] [--every 1] [--ref still.png]
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const [video, hex] = argv;
const X0 = +opt('--x0', 0), EVERY = +opt('--every', 1), REF = opt('--ref', null);
const W = 1920, H = 1080, C = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const CC = C[0] ** 2 + C[1] ** 2 + C[2] ** 2;

function analyse(rgb, stride = 3) {
  const body = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = X0; x < W; x++) {
    const i = (y * W + x) * stride; const p = [rgb[i], rgb[i + 1], rgb[i + 2]];
    const al = (p[0] * C[0] + p[1] * C[1] + p[2] * C[2]) / CC;
    if (al >= 0.5 && Math.hypot(p[0] - al * C[0], p[1] - al * C[1], p[2] - al * C[2]) < 45) body[y * W + x] = 1;
  }
  // silhouette = body plus enclosed holes (row-wise fill between first and last body pixel,
  // then keep only hole pixels enclosed vertically too)
  const out = new Uint8Array(W * H); const st = [];
  for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) { const q = st.pop(); if (out[q] || body[q]) continue; out[q] = 1; const x = q % W;
    if (x > 0) st.push(q - 1); if (x < W - 1) st.push(q + 1); if (q >= W) st.push(q - W); if (q < W * (H - 1)) st.push(q + W); }
  let n = 0, sx = 0, sy = 0, clipped = false;
  const hole = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) if (!out[k]) { n++; sx += k % W; sy += (k / W) | 0; if (!body[k]) hole[k] = 1;
    const x = k % W, y = (k / W) | 0; if (x === 0 || y === 0 || x === W - 1 || y === H - 1) clipped = true; }
  if (!n) return null;
  const cx = sx / n + 0.5, cy = sy / n + 0.5;
  // radial signature for rotation estimate
  const sig = new Float32Array(360);
  for (let k = 0; k < W * H; k++) if (!out[k]) { const x = k % W + 0.5 - cx, y = ((k / W) | 0) + 0.5 - cy;
    const a = Math.round(Math.atan2(y, x) * 180 / Math.PI + 360) % 360; const r = Math.hypot(x, y); if (r > sig[a]) sig[a] = r; }
  // eyes
  const lab = new Int32Array(W * H).fill(-1); const eyes = [];
  for (let k = 0; k < W * H; k++) if (hole[k] && lab[k] < 0) {
    const s2 = [k]; lab[k] = eyes.length; let m = 0, ex = 0, ey = 0, exx = 0, eyy = 0, exy = 0;
    while (s2.length) { const q = s2.pop(); const x = q % W, y = (q / W) | 0; m++; ex += x; ey += y; exx += x * x; eyy += y * y; exy += x * y;
      for (const r of [q - 1, q + 1, q - W, q + W]) if (r >= 0 && r < W * H && hole[r] && lab[r] < 0 && Math.abs((r % W) - x) <= 1) { lab[r] = eyes.length; s2.push(r); } }
    const mx = ex / m, my = ey / m, vxx = exx / m - mx * mx, vyy = eyy / m - my * my, vxy = exy / m - mx * my;
    const th = 0.5 * Math.atan2(2 * vxy, vxx - vyy), d = Math.sqrt(((vxx - vyy) / 2) ** 2 + vxy ** 2);
    const l1 = (vxx + vyy) / 2 + d, l2 = Math.max(0, (vxx + vyy) / 2 - d);
    // stadium of width w, length L: var_minor = w^2/16 (approx), use pixel count for length
    const w = 4 * Math.sqrt(l2); const L = (m - Math.PI * w * w / 4) / w + w;
    eyes.push({ m, x: mx + 0.5, y: my + 0.5, w, L, a: th * 180 / Math.PI });
  }
  return { n, cx, cy, clipped, sig, eyes: eyes.filter(e => e.m > 30).sort((a, b) => a.x - b.x) };
}

function rotationBetween(sigA, sigB) { // degrees to rotate A to match B (clockwise, screen coords)
  let best = 0, bestE = Infinity;
  for (let s = -90; s <= 90; s++) { let e = 0; for (let a = 0; a < 360; a++) { const d = sigA[a] - sigB[(a + s + 360) % 360]; e += d * d; } if (e < bestE) { bestE = e; best = s; } }
  // parabolic refinement
  const E = s => { let e = 0; for (let a = 0; a < 360; a++) { const d = sigA[a] - sigB[(((a + s) % 360) + 360) % 360]; e += d * d; } return e; };
  const e0 = E(best - 1), e1 = E(best), e2 = E(best + 1); const den = e0 - 2 * e1 + e2;
  return best + (den > 0 ? 0.5 * (e0 - e2) / den : 0);
}

let refSig = null, refArea = null;
if (REF) { const { data } = await sharp(REF).removeAlpha().raw().toBuffer({ resolveWithObject: true }); const r = analyse(data); refSig = r.sig; refArea = r.n; }

const ff = spawn(ffmpegPath, ['-v', 'error', '-i', video, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
let buf = Buffer.alloc(0), f = 0; const FR = W * H * 3;
console.log('frame\tarea\tscale\tcx\tcy\trot\tclip\teyes(x,y,L,w,angle)');
for await (const chunk of ff.stdout) {
  buf = Buffer.concat([buf, chunk]);
  while (buf.length >= FR) {
    const frame = buf.subarray(0, FR); buf = buf.subarray(FR);
    if (f % EVERY === 0) {
      const r = analyse(frame);
      if (!r) console.log(`${f}\t-`);
      else {
        if (!refSig && !r.clipped) { refSig = r.sig; refArea = r.n; }
        const rot = refSig && !r.clipped ? rotationBetween(refSig, r.sig).toFixed(2) : '';
        const sc = refArea ? Math.sqrt(r.n / refArea).toFixed(4) : '';
        console.log(`${f}\t${r.n}\t${sc}\t${r.cx.toFixed(1)}\t${r.cy.toFixed(1)}\t${rot}\t${r.clipped ? 'C' : ''}\t` +
          r.eyes.map(e => `(${e.x.toFixed(1)},${e.y.toFixed(1)},${e.L.toFixed(0)},${e.w.toFixed(1)},${e.a.toFixed(1)})`).join(' '));
      }
    }
    f++;
  }
}
