// Loading shared assets: bot shapes, motion tracks, logos, fonts.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const p = (...a) => resolve(ROOT, ...a);
const cache = new Map();
const once = (k, f) => (cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k)));

// ---------- bots ----------
export function shape(name) {
  return once(`shape:${name}`, () => {
    const f = p('assets/bots', `${name}.json`);
    if (!existsSync(f)) throw new Error(`Missing bot shape assets/bots/${name}.json`);
    return JSON.parse(readFileSync(f, 'utf8'));
  });
}

// Place a bot so its neutral pose fits a box (contain), aligned like CSS object-position.
// Returns the anchor {x, y, rot, scale} for the body centroid.
export function fitBox(shapeName, box, { align = 'right bottom', scale } = {}) {
  const s = shape(shapeName);
  const [bx0, by0, bx1, by1] = s.layoutBbox || s.bbox, bw = bx1 - bx0, bh = by1 - by0;
  const [x0, y0, x1, y1] = box;
  const k = scale ?? Math.min((x1 - x0) / bw, (y1 - y0) / bh);
  const [ax, ay] = align.split(' ');
  const x = ax === 'left' ? x0 - bx0 * k : ax === 'center' ? (x0 + x1) / 2 - ((bx0 + bx1) / 2) * k : x1 - bx1 * k;
  const y = ay === 'top' ? y0 - by0 * k : ay === 'center' ? (y0 + y1) / 2 - ((by0 + by1) / 2) * k : y1 - by1 * k;
  return { x, y, rot: 0, scale: k };
}

// ---------- motion ----------
// Track frame: null | { b: [dx, dy, rot, s], e: [[x, y, w, h, a], ...] } (see docs/motion-spec.md)
function fillEyes(frames) {
  const good = frames.map(f => f && f.e && f.e.length === 2);
  return frames.map((f, i) => {
    if (!f || good[i]) return f;
    for (let d = 1; d < frames.length; d++) {
      if (good[i - d]) return { ...f, e: frames[i - d].e };
      if (good[i + d]) return { ...f, e: frames[i + d].e };
    }
    return f;
  });
}

// Mirror a motion left/right in the bot's own frame (the body shape itself is not flipped).
export function mirrorTrack(frames) {
  return frames.map(f => f && {
    b: [-f.b[0], f.b[1], -f.b[2], f.b[3]],
    e: (f.e || []).map(([x, y, w, h, a]) => [-x, y, w, h, -a]).reverse(),
  });
}
export const shiftLoop = (frames, n) => frames.slice(n).concat(frames.slice(0, n));

export function motion(preset) {
  return once(`motion:${preset}`, () => {
    const f = p('assets/motion', `${preset}.json`);
    if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
    return null;
  });
}

// Speaker-style motion for a given shape: {in, loop, out} normalised tracks.
// Uses the per-shape capture when it exists, otherwise the square (Hugo) capture
// retargeted onto the shape's own neutral face.
export function speakerTracks(shapeName) {
  return once(`speaker:${shapeName}`, () => {
    const m = motion('speaker');
    let src, srcShape;
    if (m && m.shapes) {
      srcShape = m.shapes[shapeName] ? shapeName : 'square';
      src = m.shapes[srcShape].clips;
    } else { // fallback: raw captures from tools/scratch (development only)
      const L = n => JSON.parse(readFileSync(p('tools/scratch/mocap', `${n}.norm.json`), 'utf8')).frames;
      src = { in: L('speaker-in'), loop: L('speaker-loop'), out: L('speaker-out') };
      srcShape = 'square';
    }
    const clips = Object.fromEntries(Object.entries(src).map(([k, v]) => [k, fillEyes(v)]));
    if (srcShape === shapeName) return clips;
    return Object.fromEntries(Object.entries(clips).map(([k, v]) => [k, retarget(v, srcShape, shapeName)]));
  });
}

// Move eyes from one shape's neutral face onto another's (position, size and tilt), and scale
// body motion by size.
export function retarget(frames, from, to) {
  const A = shape(from), B = shape(to);
  const fa = faceOf(A), fb = faceOf(B);
  const k = fb.h / fa.h;                              // eye size ratio
  const size = Math.sqrt(B.area / A.area);           // body size ratio
  const da = fb.a - fa.a, r = da * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return frames.map(f => f && {
    b: [f.b[0] * size, f.b[1] * size, f.b[2], f.b[3]],
    e: (f.e || []).map(([x, y, w, h, a]) => {
      const dx = (x - fa.x) * k, dy = (y - fa.y) * k;
      return [fb.x + c * dx - s * dy, fb.y + s * dx + c * dy, w * k, h * k, a + da];
    }),
  });
}
function faceOf(s) {
  const [l, r] = s.face;
  return { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2, h: (l.h + r.h) / 2, a: ((l.a || 0) + (r.a || 0)) / 2 };
}

// ---------- logos ----------
export function logo(file) {
  return once(`logo:${file}`, () => {
    const f = p('assets/logos', file);
    if (!existsSync(f)) return null;
    const svg = readFileSync(f, 'utf8');
    const vb = svg.match(/viewBox="([^"]+)"/)?.[1] ?? `0 0 ${svg.match(/width="([\d.]+)/)[1]} ${svg.match(/height="([\d.]+)/)[1]}`;
    const rootTag = svg.match(/<svg[^>]*>/)[0];
    const fill = rootTag.match(/\sfill="([^"]+)"/)?.[1] ?? 'currentColor';
    const inner = `<g fill="${fill}">${svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</g>`;
    const [, , w, h] = vb.split(/[\s,]+/).map(Number);
    return { viewBox: vb, markup: inner, aspect: w / h };
  });
}

// ---------- fonts ----------
// The licensed Universal Sans Display file, if present, otherwise the free stand-in.
export function brandFont() {
  const candidates = ['UniversalSansDisplay-Regular.woff2', 'UniversalSansDisplay-Regular.woff', 'UniversalSansDisplay-Regular.otf', 'UniversalSansDisplay-Regular.ttf'];
  for (const c of candidates) if (existsSync(p('fonts', c))) return { file: `fonts/${c}`, licensed: true };
  return { file: 'fonts/stand-in/InterDisplay-Regular.woff2', licensed: false };
}

// ---------- fitted poses ----------
// Bot poses fitted on the designer's stills (tools/fit-stills.mjs -> assets/poses/stills.json).
export function pose(id) {
  const all = once('poses', () => JSON.parse(readFileSync(p('assets/poses/stills.json'), 'utf8')));
  return all[id] || null;
}

// The anchor that puts track frame `f` exactly on a fitted pose `P` (inverse of the engine's
// bot transform), so a screen's still and its video can never disagree.
export function anchorFromPose(P, f) {
  const fx = P.flip ? -1 : 1, [dx, dy, rot, s] = f.b;
  const scale = P.scale / s;
  return { x: P.x - fx * dx * scale, y: P.y - dy * scale, rot: P.rot - fx * rot, scale };
}

// A pose as a one-frame "track" (for screens whose motion isn't captured yet).
export const poseFrame = P => ({ b: [0, 0, 0, 1], e: P.eyes });
