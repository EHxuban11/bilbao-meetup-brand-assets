// QR code in the event style (reverse-engineered from the poster PDF, module-exact):
//   - error correction M; mask chosen by the encoder (for luma.com/spacexai-euskadi: version 3, mask 0,
//     which is exactly the poster's matrix)
//   - white card, 2-module quiet zone, card corner radius 4 modules (poster: 132 mm card, 4 mm modules)
//   - dark modules: squares whose corners are rounded (radius ½ module, drawn as quadratic curves
//     with the control point on the corner) only where both neighbouring sides are empty
//   - finder patterns: rounded 7×7 square (r 2.4), white 5×5 inside (r 1.4), round 3×3 centre (r 1.5)
//
// Units: 1 module = 1 unit; the card is (n + 4) units square. Scale with `size`.
import QRCode from 'qrcode';

const K = 0.5523; // circle kappa for the finder corners and centre

function roundRect(x, y, w, h, r) {
  const k = r * K;
  return `M${x + r} ${y}H${x + w - r}C${x + w - r + k} ${y} ${x + w} ${y + r - k} ${x + w} ${y + r}` +
    `V${y + h - r}C${x + w} ${y + h - r + k} ${x + w - r + k} ${y + h} ${x + w - r} ${y + h}` +
    `H${x + r}C${x + r - k} ${y + h} ${x} ${y + h - r + k} ${x} ${y + h - r}` +
    `V${y + r}C${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y}Z`;
}
const circle = (cx, cy, r) => roundRect(cx - r, cy - r, 2 * r, 2 * r, r);

function modulePath(x, y, [tl, tr, br, bl]) {
  // start at top middle, clockwise; rounded corner = quadratic through the corner point
  let d = `M${x + 0.5} ${y}`;
  d += tr ? `Q${x + 1} ${y} ${x + 1} ${y + 0.5}` : `L${x + 1} ${y}L${x + 1} ${y + 0.5}`;
  d += br ? `Q${x + 1} ${y + 1} ${x + 0.5} ${y + 1}` : `L${x + 1} ${y + 1}L${x + 0.5} ${y + 1}`;
  d += bl ? `Q${x} ${y + 1} ${x} ${y + 0.5}` : `L${x} ${y + 1}L${x} ${y + 0.5}`;
  d += tl ? `Q${x} ${y} ${x + 0.5} ${y}` : `L${x} ${y}L${x + 0.5} ${y}`;
  return d + 'Z';
}

/**
 * Geometry of the styled QR, in module units (card is (n+4) × (n+4)).
 * @returns {{units:number, n:number, version:number, mask:number, card:string, dark:string}}  (draw `dark` with fill-rule evenodd)
 */
export function qrParts(text, { errorCorrectionLevel = 'M', maskPattern, version } = {}) {
  const q = QRCode.create(text, { errorCorrectionLevel, ...(maskPattern !== undefined && { maskPattern }), ...(version && { version }) });
  const n = q.modules.size, Q = 2, units = n + 2 * Q;
  const on = (r, c) => r >= 0 && c >= 0 && r < n && c < n && !!q.modules.get(r, c);
  const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  let dark = ''; // draw with fill-rule="evenodd" (modules never overlap)
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!on(r, c) || inFinder(r, c)) continue;
    const up = on(r - 1, c) && !inFinder(r - 1, c), down = on(r + 1, c) && !inFinder(r + 1, c);
    const left = on(r, c - 1) && !inFinder(r, c - 1), right = on(r, c + 1) && !inFinder(r, c + 1);
    dark += modulePath(Q + c, Q + r, [!up && !left, !up && !right, !down && !right, !down && !left]);
  }
  for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const x = Q + c, y = Q + r;
    // ring (outer minus inner, via evenodd) + centre dot
    dark += roundRect(x, y, 7, 7, 2.4) + roundRect(x + 1, y + 1, 5, 5, 1.4) + circle(x + 3.5, y + 3.5, 1.5);
  }
  return { units, n, version: q.version, mask: q.maskPattern, card: roundRect(0, 0, units, units, 4), dark };
}

/**
 * Standalone SVG of the styled QR card.
 * @param {string} text  URL to encode
 * @param {{size?:number, dark?:string, light?:string, card?:boolean}} opts  size = card width in px (or any unit)
 */
export function qrSvg(text, { size = 132, dark = '#000000', light = '#FFFFFF', card = true, ...enc } = {}) {
  const p = qrParts(text, enc);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${p.units} ${p.units}">` +
    (card ? `<path fill="${light}" d="${p.card}"/>` : '') +
    `<path fill="${dark}" fill-rule="evenodd" d="${p.dark}"/></svg>`;
}

/** SVG group (no outer <svg>) placed at x, y with the given card size, for embedding in a scene. */
export function qrGroup(text, { x = 0, y = 0, size = 132, dark = '#000000', light = '#FFFFFF', card = true, ...enc } = {}) {
  const p = qrParts(text, enc); const s = size / p.units;
  return `<g transform="translate(${x} ${y}) scale(${s})">` + (card ? `<path fill="${light}" d="${p.card}"/>` : '') +
    `<path fill="${dark}" fill-rule="evenodd" d="${p.dark}"/></g>`;
}
