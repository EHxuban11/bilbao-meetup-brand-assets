// Bot overlays for the cover and closing layouts (1920 × 1080 transparent PNGs), and the
// link-pill arrow icon. Shapes come from assets/bots/<shape>.json (path centred on the body
// centroid, neutral face). Placement rule measured on the designer's templates:
//   cover:   bot 600 px tall, right edge at x 1960, bottom edge at y 450 (cut by the top/right edges)
//   closing: bot 780 px tall, right edge at x 1960, top edge at y 450    (cut by the bottom/right edges)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

export const PLACEMENT = {
  cover: { height: 600, right: 1960, bottom: 450 },
  closing: { height: 780, right: 1960, top: 450 },
};

export function loadShape(root, shape) {
  return JSON.parse(readFileSync(join(root, 'assets', 'bots', `${shape}.json`), 'utf8'));
}

/** Transform (centre x/y and scale) that puts a shape where the layout wants it. */
export function place(shapeData, which) {
  const [l, t, r, b] = shapeData.bbox; const p = PLACEMENT[which];
  const s = p.height / (b - t);
  const x = p.right - r * s;
  const y = which === 'cover' ? p.bottom - b * s : p.top - t * s;
  return { x, y, s };
}

export function botSvg(shapeData, color, { x, y, s }, W = 1920, H = 1080) {
  const eyes = (shapeData.face || []).map(e =>
    `<rect x="${(e.x - e.w / 2).toFixed(2)}" y="${(e.y - e.h / 2).toFixed(2)}" width="${e.w}" height="${e.h}" rx="${(Math.min(e.w, e.h) / 2).toFixed(2)}" fill="#000"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<g transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${s.toFixed(5)})"><path d="${shapeData.path}" fill="${color}"/>${eyes}</g></svg>`;
}

export async function botPng(root, bot, which) {
  const shape = loadShape(root, bot.shape);
  return sharp(Buffer.from(botSvg(shape, bot.color, place(shape, which)))).png({ compressionLevel: 9 }).toBuffer();
}

// ↗ in a 24-unit box, 2-unit stroke, rendered at 144 × 144 (shown at 36 × 36 px).
export const ARROW_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 24 24">' +
  '<path d="M7 7h10v10M6.6 17.4L17 7" stroke="#000" stroke-width="2" fill="none"/></svg>';
export const arrowPng = () => sharp(Buffer.from(ARROW_SVG)).png({ compressionLevel: 9 }).toBuffer();

export const dataUri = buf => `image/png;base64,${buf.toString('base64')}`;
