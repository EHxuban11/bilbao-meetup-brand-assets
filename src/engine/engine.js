// Scene engine. Runs inside headless Chromium (see src/render.mjs).
// A scene is plain JSON built by src/scenes/*.mjs; this file turns it into SVG and
// poses it at any frame of any clip ("still", "in", "loop", "out").
//
// Coordinates are canvas pixels. Text is positioned by BASELINE, so the layout is
// identical whatever font is installed.

const NS = 'http://www.w3.org/2000/svg';

const c1 = 1.70158, c3 = c1 + 1;
export const ease = {
  linear: p => p,
  expoOut: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
  expoIn: p => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
  expoInOut: p => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2),
  cubicOut: p => 1 - Math.pow(1 - p, 3),
  cubicIn: p => p * p * p,
  cubicInOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  quartOut: p => 1 - Math.pow(1 - p, 4),
  quadIn: p => p * p,
  sineInOut: p => -(Math.cos(Math.PI * p) - 1) / 2,
  backIn: (p, k = c1) => (k + 1) * p * p * p - k * p * p,
  backOut: (p, k = c1) => 1 + (k + 1) * Math.pow(p - 1, 3) + k * Math.pow(p - 1, 2),
  quartInOut: p => (p < 0.5 ? 8 * p ** 4 : 1 - Math.pow(-2 * p + 2, 4) / 2),
};
const run = (name, p, k) => ease[name || 'linear'](p, k);
const clamp01 = v => Math.max(0, Math.min(1, v));
const progress = (t, start, dur) => clamp01(dur > 0 ? (t - start) / dur : t >= start ? 1 : 0);

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

let scene = null;
let nodes = [];
let uid = 0;

export function mount(sc) {
  scene = sc;
  nodes = [];
  const root = document.getElementById('stage');
  root.innerHTML = '';
  root.setAttribute('viewBox', `0 0 ${sc.w} ${sc.h}`);
  root.setAttribute('width', sc.w);
  root.setAttribute('height', sc.h);
  document.body.style.background = sc.background || 'transparent';
  const defs = el('defs', {}, root);
  if (sc.background && sc.background !== 'transparent') el('rect', { width: sc.w, height: sc.h, fill: sc.background }, root);
  for (const item of sc.elements) nodes.push(build(item, root, defs));
  return document.fonts.ready.then(() => measureAuto());
}

// ---------- builders ----------
function build(item, root, defs) {
  const b = builders[item.type];
  if (!b) throw new Error(`unknown element type ${item.type}`);
  return { item, ...b(item, root, defs) };
}

const builders = {
  // One line of text. spans: [{text, color}] or text + color.
  line(it, root, defs) {
    const id = `clip${uid++}`;
    const L = it.line ?? it.size * 1.1;
    const top = it.y - 0.83 * L, bottom = it.y + Math.max(0.17 * L, 0.22 * it.size);
    const cp = el('clipPath', { id }, defs);
    el('rect', { x: 0, y: top, width: scene.w, height: bottom - top }, cp);
    const g = el('g', {}, root);
    const text = el('text', {
      x: it.x, y: it.y, 'font-size': it.size, fill: it.color || '#fff',
      'font-family': it.font || 'Brand', 'text-anchor': it.anchor || 'start',
      'letter-spacing': it.tracking ? `${it.tracking}` : undefined,
    }, g);
    text.style.fontKerning = 'normal';
    text.style.fontFeatureSettings = it.features || 'normal';
    const spans = it.spans || [{ text: it.text, color: it.color }];
    for (const s of spans) { const ts = el('tspan', { fill: s.color || it.color || '#fff' }, text); ts.textContent = s.text; }
    return { g, text, clipId: id, L };
  },

  bot(it, root) {
    const g = el('g', {}, root);
    const body = el('path', { d: it.path, fill: it.color }, g);
    const eyes = [0, 1].map(() => el('rect', { fill: it.eyeColor || '#000' }, g));
    return { g, body, eyes };
  },

  image(it, root) {
    const g = el('g', {}, root);
    const img = el('image', { href: it.href, x: it.x, y: it.y, width: it.w, height: it.h, preserveAspectRatio: it.fit || 'xMidYMid meet' }, g);
    return { g, img };
  },

  // Inline SVG markup (logos, QR). `svg` is the inner markup; placed in box x,y,w,h via viewBox.
  svg(it, root) {
    const g = el('g', {}, root);
    const s = el('svg', { x: it.x, y: it.y, width: it.w, height: it.h, viewBox: it.viewBox, preserveAspectRatio: it.fit || 'xMidYMid meet', overflow: 'visible', color: it.color }, g);
    s.innerHTML = it.markup;
    if (it.color) s.style.color = it.color;
    return { g, s };
  },

  rect(it, root) {
    const g = el('g', {}, root);
    const r = el('rect', { x: it.x, y: it.y, width: it.w || 0, height: it.h, rx: it.r || 0, fill: it.fill || '#fff', stroke: it.stroke, 'stroke-width': it.strokeWidth }, g);
    return { g, r, width: it.w || 0 };
  },

  // Pre-built SVG markup (e.g. the QR card from src/lib/qr.js).
  raw(it, root) {
    const g = el('g', {}, root);
    g.innerHTML = it.markup;
    return { g };
  },

  // Thin-stroke arrow (↗) in a box, as on the link pills.
  arrow(it, root) {
    const g = el('g', { fill: 'none', stroke: it.color || '#000', 'stroke-width': it.stroke || 3, 'stroke-linecap': 'butt' }, root);
    const { x, y, s } = it; // box top-left and size
    el('path', { d: `M${x + 1} ${y + 1.5}H${x + s}M${x + s - 1.5} ${y}V${y + s - 1}M${x + 1} ${y + s - 2}L${x + s - 2} ${y + 1}` }, g);
    return { g };
  },

  group(it, root, defs) {
    const g = el('g', {}, root);
    const children = it.children.map(c => build(c, g, defs));
    return { g, children };
  },
};

// Elements whose width depends on rendered text (pills) are resolved after fonts load.
function measureAuto() {
  const byId = new Map(nodes.filter(n => n.item.id).map(n => [n.item.id, n]));
  for (const n of nodes) if (n.item.type === 'rect' && n.item.fitText) {
    const { ids, padRight = 0, pad, center, minWidth = 0 } = n.item.fitText;
    if (center !== undefined) { // centred pill: text anchored in the middle, `pad` on both sides
      const len = Math.max(...ids.map(id => byId.get(id).text.getComputedTextLength()));
      n.width = Math.max(minWidth, len + 2 * pad);
      n.r.setAttribute('x', center - n.width / 2);
    } else {
      const right = Math.max(...ids.map(id => { const m = byId.get(id); return m.item.x + m.text.getComputedTextLength(); }));
      n.width = Math.max(minWidth, right + (pad ?? padRight) - n.item.x);
    }
    n.r.setAttribute('width', n.width);
  }
  for (const n of nodes) if (n.item.type === 'group' && n.item.autoWidth) {
    const { autoWidth } = n.item;
    const ref = n.children.find(c => c.item.id === autoWidth.measure);
    const w = ref.text.getComputedTextLength();
    const box = n.children.find(c => c.item.id === autoWidth.box);
    const width = Math.round(ref.item.x + w + autoWidth.padRight - box.item.x);
    box.r.setAttribute('width', width);
    n.width = width;
  }
}

// ---------- posing ----------
export function seek(clip, frame) {
  const fps = scene.fps || 30;
  const t = frame / fps;
  for (const n of nodes) pose(n, clip, frame, t);
}

function pose(n, clip, frame, t) {
  const it = n.item;
  if (it.type === 'group') { for (const c of n.children) pose(c, clip, frame, t); applyFade(n.g, it, clip, t); return; }
  if (it.type === 'line') return poseLine(n, clip, t);
  if (it.type === 'bot') return poseBot(n, clip, frame, t);
  if (it.type === 'rect' && it.grow) poseGrow(n, clip, t);
  applyFade(n.g, it, clip, t);
  applyMove(n.g, it, clip, t);
}

function poseLine(n, clip, t) {
  const it = n.item, a = scene.text || {};
  const travel = it.travel ?? n.L;
  let off = 0, visible = true;
  if (clip === 'in' && it.in !== undefined) {
    const dur = it.inDur ?? a.in?.dur ?? 1.0, e = it.inEase ?? a.in?.ease ?? 'expoOut';
    const p = progress(t, it.in, dur);
    off = travel * (1 - run(e, p));
    if (t < it.in) visible = false;
  } else if (clip === 'out' && it.out !== undefined) {
    const dur = it.outDur ?? a.out?.dur ?? 0.4, e = it.outEase ?? a.out?.ease ?? 'expoIn';
    const p = progress(t, it.out, dur);
    off = -travel * run(e, p);
    if (p >= 1) visible = false;
  }
  n.g.style.display = visible ? '' : 'none';
  if (off) n.g.setAttribute('clip-path', `url(#${n.clipId})`); else n.g.removeAttribute('clip-path');
  n.text.setAttribute('transform', off ? `translate(0 ${off.toFixed(3)})` : '');
}

// Pill grows from / shrinks to its left cap: width animates between `from` and `to` (fractions).
function poseGrow(n, clip, t) {
  const gr = n.item.grow[clip];
  let f = 1;
  if (gr) { const p = progress(t, gr.start, gr.dur); f = gr.from + (gr.to - gr.from) * run(gr.ease, p, gr.k); }
  const w = Math.max(0, n.width * f), r = Math.min(n.item.r || 0, w / 2, n.item.h / 2);
  n.r.setAttribute('width', w.toFixed(3)); n.r.setAttribute('rx', r); n.r.setAttribute('ry', r);
  n.g.style.display = w < 0.5 ? 'none' : '';
}

function applyFade(g, it, clip, t) {
  const f = it.fade && it.fade[clip];
  if (!f) { g.style.opacity = ''; return; }
  const p = progress(t, f.start, f.dur);
  const e = run(f.ease, p, f.k);
  g.style.opacity = String(f.from + (f.to - f.from) * e);
}

function applyMove(g, it, clip, t) {
  const m = it.move && it.move[clip];
  if (!m) return;
  const p = progress(t, m.start, m.dur); const e = run(m.ease, p, m.k);
  const dx = (m.dx || 0) * (m.reverse ? 1 - e : e), dy = (m.dy || 0) * (m.reverse ? 1 - e : e);
  g.setAttribute('transform', `translate(${dx} ${dy})`);
}

function poseBot(n, clip, frame, t) {
  const it = n.item;
  let pop = 1;
  const pp = it.pop?.[clip];
  if (pp) { const p = progress(t, pp.start, pp.dur); pop = pp.from + (pp.to - pp.from) * run(pp.ease, p, pp.k); }
  let fr;
  if (clip === 'still') fr = it.still;
  else { const track = it.track?.[clip]; fr = track ? track[Math.min(frame, track.length - 1)] : it.still; }
  if (!fr) { n.g.style.display = 'none'; return; }
  n.g.style.display = pop <= 0.0005 ? 'none' : '';
  // Same convention as tools/fit-bot.mjs: screen = T(x, y) · R(rot) · S(scale · (flip ? -1 : 1), scale) · p.
  // A flipped bot also plays its motion mirrored (dx and rotation deltas change sign).
  const A = it.anchor; // {x, y, rot, scale}
  const [dx, dy, rot, s] = fr.b;
  const S = A.scale, fx = it.flip ? -1 : 1;
  const x = A.x + fx * dx * S, y = A.y + dy * S, r = A.rot + fx * rot;
  const k = S * s * pop;
  n.g.setAttribute('transform', `translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${r.toFixed(4)}) scale(${(fx * k).toFixed(5)} ${k.toFixed(5)})`);
  const eyes = fr.e || [];
  n.eyes.forEach((e, i) => {
    const q = eyes[i];
    if (!q) { e.style.display = 'none'; return; }
    e.style.display = '';
    const [ex, ey, w, h, a] = q; const rx = Math.min(w, h) / 2;
    e.setAttribute('x', -w / 2); e.setAttribute('y', -h / 2); e.setAttribute('width', w); e.setAttribute('height', h); e.setAttribute('rx', rx); e.setAttribute('ry', rx);
    e.setAttribute('transform', `translate(${ex} ${ey}) rotate(${a})`);
  });
}

// Standalone SVG of the current pose (used for PDF export and editable SVG deliverables).
export function exportSvg() {
  const root = document.getElementById('stage').cloneNode(true);
  root.setAttribute('xmlns', NS);
  root.querySelectorAll('[style]').forEach(n => {
    if (n.style.display === 'none') n.setAttribute('display', 'none');
    if (n.style.opacity !== '') n.setAttribute('opacity', n.style.opacity);
    if (n.style.color) n.setAttribute('color', n.style.color);
    n.removeAttribute('style');
  });
  root.querySelectorAll('[clip-path=""]').forEach(n => n.removeAttribute('clip-path'));
  return root.outerHTML;
}

Object.assign(window, { mount, seek, exportSvg });
