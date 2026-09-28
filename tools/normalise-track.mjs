// Convert a raw mocap capture (tools/mocap.mjs) into normalised motion frames.
//
// Frame format (what the renderer consumes):
//   null                                   bot not visible
//   { b: [dx, dy, rot, s], e: [[x, y, w, h, a], [x, y, w, h, a]] }
// b: body centroid offset from the anchor pose, in canonical-shape px (i.e. divided by the anchor
//    scale), rotation delta in degrees (clockwise), scale ratio vs the anchor.
// e: eyes in the BODY frame (unrotated, unscaled: canonical-shape px, relative to the body
//    centroid); w/h of a fully rounded rect; a = extra rotation vs the body. Left -> right.
//
// CLI: node tools/normalise-track.mjs <raw.json> <out.json> [--from N --to M]
//      [--rot-from-eyes] [--anchor x,y,rot,scale]
// Without --anchor the raw file's anchor image is the anchor (rot 0, scale 1).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const r2 = v => Math.round(v * 100) / 100;
const W = 1920, H = 1080;

// Is an eye cut by the frame edge? (then its size is not trustworthy)
function partial(e) {
  const t = e.a * Math.PI / 180, c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t));
  const hx = (e.w * c + e.h * s) / 2, hy = (e.w * s + e.h * c) / 2;
  return e.x - hx < 2 || e.y - hy < 2 || e.x + hx > W - 2 || e.y + hy > H - 2;
}

export function normalise(raw, { rotFromEyes = false, anchor = null } = {}) {
  const A = anchor || { x: raw.anchor.cx, y: raw.anchor.cy, rot: 0, scale: 1 };
  const out = raw.frames.map(f => {
    if (!f || f.x === undefined) return null;
    let eyes = (f.eyes || []).filter(e => e.w >= 3 && e.h >= 3 && e.w * e.h > 60);
    // keep the two largest blobs, left to right
    eyes = eyes.sort((p, q) => q.w * q.h - p.w * p.h).slice(0, 2).sort((p, q) => p.x - q.x);
    let rot = f.rot;
    if (rotFromEyes) {
      const good = eyes.filter(e => !partial(e) && e.h > e.w); // open eyes give the face angle
      if (good.length) rot = good.reduce((s, e) => s + e.a, 0) / good.length;
      else rot = null; // filled from neighbours below
    }
    return { f, eyes, rot };
  });
  // fill rotation gaps for eye-driven rotation
  if (rotFromEyes) {
    const idx = out.map((o, i) => (o && o.rot !== null ? i : -1)).filter(i => i >= 0);
    out.forEach((o, i) => { if (o && o.rot === null) { const j = idx.reduce((b, k) => Math.abs(k - i) < Math.abs(b - i) ? k : b, idx[0] ?? i); o.rot = j !== undefined && out[j] ? out[j].rot : 0; } });
  }
  const frames = out.map(o => {
    if (!o) return null;
    const { f } = o; const rot = o.rot;
    const t = -rot * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    const e = o.eyes.map(ey => {
      const dx = ey.x - f.x, dy = ey.y - f.y;
      return { v: [r2((c * dx - s * dy) / f.s), r2((s * dx + c * dy) / f.s), r2(ey.w / f.s), r2(ey.h / f.s), r2(ey.a - rot)], partial: partial(ey) };
    }).sort((p, q) => p.v[0] - q.v[0]);
    return {
      b: [r2((f.x - A.x) / A.scale), r2((f.y - A.y) / A.scale), r2(rot - A.rot), Math.round(f.s / A.scale * 10000) / 10000],
      e,
    };
  });
  // eyes: need exactly two trustworthy eyes; otherwise copy (in body frame) from the nearest good frame
  const good = frames.map((fr, i) => (fr && fr.e.length === 2 && !fr.e.some(x => x.partial) ? i : -1)).filter(i => i >= 0);
  return frames.map((fr, i) => {
    if (!fr) return null;
    if (good.includes(i)) return { b: fr.b, e: fr.e.map(x => x.v) };
    if (!good.length) return { b: fr.b, e: fr.e.map(x => x.v) };
    const j = good.reduce((b, k) => (Math.abs(k - i) < Math.abs(b - i) ? k : b), good[0]);
    return { b: fr.b, e: frames[j].e.map(x => x.v), filled: true };
  }).map(fr => (fr ? (delete fr.filled, fr) : fr));
}

// Mirror a clip left <-> right (for Q&A): negate dx, rot, eye x and eye a; swap the eyes.
export function mirror(frames) {
  return frames.map(fr => fr && {
    b: [r2(-fr.b[0]), fr.b[1], r2(-fr.b[2]), fr.b[3]],
    e: fr.e.map(([x, y, w, h, a]) => [r2(-x), y, w, h, r2(-a)]).reverse(),
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [,, inp, outp, ...rest] = process.argv;
  const o = k => (rest.includes(k) ? rest[rest.indexOf(k) + 1] : undefined);
  const raw = JSON.parse(readFileSync(inp, 'utf8'));
  const anc = o('--anchor') ? (([x, y, rot, scale]) => ({ x, y, rot, scale }))(o('--anchor').split(',').map(Number)) : null;
  let frames = normalise(raw, { rotFromEyes: rest.includes('--rot-from-eyes'), anchor: anc });
  if (o('--from') !== undefined) frames = frames.slice(+o('--from'), o('--to') !== undefined ? +o('--to') : undefined);
  writeFileSync(outp, JSON.stringify({ fps: raw.fps, source: raw.video, frames }));
  console.log(`${frames.length} frames -> ${outp}`);
}
