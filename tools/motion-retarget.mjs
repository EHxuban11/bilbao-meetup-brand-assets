// Retarget the speaker program (captured on the square bot) to another shape and anchor.
//
// What the captures show (docs/motion-spec.md):
//  - rotation is the same for every shape;
//  - the body rocks about the bottom-centre of its bounding box: offset = (I - R(rot)) * P,
//    P = (0, bbox bottom) in canonical px; on top there is a small bob that scales with height;
//  - the in clip = loop frames 390..479 + a vertical rise, the out clip = a vertical sink; both
//    rise and sink scale with the gap between the bot's top and the bottom of the screen;
//  - eyes move the same way around each shape's own neutral face; the look offsets scale with
//    the body's bbox width (x) and height (y), eye sizes with the neutral eye size.
//
// export retargetClip(frames, clipName, src, tgt)
//   src/tgt: { shape: {bbox, face}, anchor: {cx, cy, scale} }   (face = two neutral eyes)
import { readFileSync } from 'node:fs';

const r2 = v => Math.round(v * 100) / 100;
const piv = (P, deg) => { const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); return [(1 - c) * P[0] + s * P[1], -s * P[0] + (1 - c) * P[1]]; };
export const faceOf = shape => {
  const [a, b] = [...shape.face].sort((p, q) => p.x - q.x);
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, spacing: Math.hypot(b.x - a.x, b.y - a.y), w: (a.w + b.w) / 2, h: (a.h + b.h) / 2, a: a.a || 0, eyes: [a, b] };
};
// gap between the bot's top and the screen bottom, in canonical px of that shape
export const gapOf = (shape, anchor, H = 1080) => (H - (anchor.cy + anchor.scale * shape.bbox[1])) / anchor.scale;

export function retargetClip(frames, clip, src, tgt, { loop } = {}) {
  const PS = [0, src.shape.bbox[3]], PT = [0, tgt.shape.bbox[3]];
  const kH = (tgt.shape.bbox[3] - tgt.shape.bbox[1]) / (src.shape.bbox[3] - src.shape.bbox[1]);
  const kG = gapOf(tgt.shape, tgt.anchor) / gapOf(src.shape, src.anchor);
  const FS = faceOf(src.shape), FT = faceOf(tgt.shape);
  const kW = FT.w / FS.w, kHe = FT.h / FS.h;
  // eye look offsets scale with the body's width (x) and height (y)
  const kX = (tgt.shape.bbox[2] - tgt.shape.bbox[0]) / (src.shape.bbox[2] - src.shape.bbox[0]);
  return frames.map((f, i) => {
    if (!f) return null;
    const [dx, dy, rot, s] = f.b;
    const pS = piv(PS, rot), pT = piv(PT, rot);
    let rx = dx - pS[0], ry = dy - pS[1];
    // split vertical residual into rise/sink (scales with gap) and bob (scales with height)
    let rise = 0;
    if (clip === 'in' && loop) { const L = loop[390 + i]; if (L) { const lr = L.b[1] - piv(PS, L.b[2])[1]; rise = ry - lr; ry = lr; } }
    if (clip === 'out') { rise = ry; ry = 0; }
    const bx = pT[0] + rx * kH, by = pT[1] + ry * kH + rise * kG;
    const e = f.e.map((ey, k) => {
      const nS = FS.eyes[k], nT = FT.eyes[k];
      return [r2(nT.x + (ey[0] - nS.x) * kX), r2(nT.y + (ey[1] - nS.y) * kH), r2(ey[2] * kW), r2(ey[3] * kHe), r2(ey[4] + (FT.a || 0))];
    });
    return { b: [r2(bx), r2(by), rot, s], e };
  });
}

// CLI validation: retarget the square track to another captured shape and compare in screen px.
if (process.argv[1] && process.argv[1].endsWith('motion-retarget.mjs')) {
  const S = JSON.parse(readFileSync('assets/motion/speaker.json', 'utf8'));
  const shp = n => JSON.parse(readFileSync(`assets/bots/${n}.json`, 'utf8'));
  const src = { shape: shp('square'), anchor: { cx: S.shapes.square.anchor.cx, cy: S.shapes.square.anchor.cy, scale: 1 } };
  for (const t of ['cloud', 'round']) {
    const tgt = { shape: shp(t), anchor: { cx: S.shapes[t].anchor.cx, cy: S.shapes[t].anchor.cy, scale: 1 } };
    for (const clip of ['in', 'loop', 'out']) {
      const pred = retargetClip(S.shapes.square.clips[clip], clip, src, tgt, { loop: S.shapes.square.clips.loop });
      const real = S.shapes[t].clips[clip];
      let eb = 0, ee = 0, n = 0, mb = 0, me = 0;
      pred.forEach((p, i) => { const q = real[i]; if (!p || !q || i < 12 && clip === 'in') return;
        const db = Math.hypot(p.b[0] - q.b[0], p.b[1] - q.b[1]);
        // eye positions in screen space (rotate by body rot)
        const scr = (fr, e) => { const t = fr.b[2] * Math.PI / 180; return [fr.b[0] + Math.cos(t) * e[0] - Math.sin(t) * e[1], fr.b[1] + Math.sin(t) * e[0] + Math.cos(t) * e[1]]; };
        const de = Math.max(...[0, 1].map(k => { const a = scr(p, p.e[k]), b = scr(q, q.e[k]); return Math.hypot(a[0] - b[0], a[1] - b[1]); }));
        eb += db * db; ee += de * de; n++; mb = Math.max(mb, db); me = Math.max(me, de); });
      console.log(`square -> ${t} ${clip.padEnd(4)} body rms ${Math.sqrt(eb / n).toFixed(2)} max ${mb.toFixed(1)} | eyes rms ${Math.sqrt(ee / n).toFixed(2)} max ${me.toFixed(1)} px (n=${n})`);
    }
  }
}
