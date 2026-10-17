// SVG (from the scene engine) -> print-ready PDF.
// Colours are written as CMYK using the table below (the designer's own values, read
// from the poster PDF); text is embedded with the brand font; pages get proper
// TrimBox/BleedBox and, optionally, crop marks.
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import { createWriteStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, brandFont } from './assets.mjs';

const MM = 72 / 25.4; // points per mm

// sRGB hex -> CMYK (0-100). Anything not listed is converted naively (and reported).
export const CMYK = {
  '#000000': [60, 40, 40, 100],     // rich black
  '#ffffff': [0, 0, 0, 0],
  '#ee3342': [0, 94.1, 74.8, 0],    // event red
  '#777777': [54.6, 46.1, 45.7, 11.1],
  '#f0f0fa': [0, 0, 0, 0],          // SpaceX off-white prints as paper white
};
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
function toCmyk(rgb, unknown) {
  const h = hex(rgb);
  if (CMYK[h]) return CMYK[h];
  unknown.add(h);
  const [r, g, b] = rgb.map(v => v / 255), k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 100];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map(v => +(v * 100).toFixed(1));
}

function fontFile() {
  // pdfkit needs OTF/TTF (not woff2)
  const lic = ['UniversalSansDisplay-Regular.otf', 'UniversalSansDisplay-Regular.ttf'].map(f => resolve(ROOT, 'fonts', f)).find(existsSync);
  return lic || resolve(ROOT, 'fonts/stand-in/InterDisplay-Regular.otf');
}

/**
 * @param svg      SVG markup whose viewBox covers the *bleed* area
 * @param file     output PDF path
 * @param trimMm   [w, h] finished size in mm
 * @param bleedMm  bleed on each side in mm
 * @param marks    add crop marks (10 mm slug around the bleed)
 */
export async function svgToPdf(svg, file, { trimMm, bleedMm = 3, marks = false, title = '', author = '' }) {
  const slug = marks ? 10 : 0;
  const [tw, th] = trimMm;
  const pw = (tw + 2 * bleedMm + 2 * slug) * MM, ph = (th + 2 * bleedMm + 2 * slug) * MM;
  const doc = new PDFDocument({ size: [pw, ph], margin: 0, autoFirstPage: false, info: { Title: title, Author: author, Creator: 'bilbao-meetup-brand-assets' } });
  doc.registerFont('Brand', fontFile());
  doc.addPage({ size: [pw, ph], margin: 0 });
  // PDF boxes use bottom-left origin
  const b = slug * MM, t = (slug + bleedMm) * MM;
  doc.page.dictionary.data.BleedBox = [b, b, pw - b, ph - b];
  doc.page.dictionary.data.TrimBox = [t, t, pw - t, ph - t];
  const unknown = new Set();
  SVGtoPDF(doc, svg, b, b, {
    width: (tw + 2 * bleedMm) * MM, height: (th + 2 * bleedMm) * MM, preserveAspectRatio: 'none',
    fontCallback: () => 'Brand',
    colorCallback: c => (c ? [toCmyk(c[0], unknown), c[1]] : c),
    warningCallback: w => { if (!/not supported|text-rendering/.test(w)) console.warn('  svg->pdf:', w); },
  });
  if (marks) cropMarks(doc, pw, ph, slug * MM, bleedMm * MM);
  const done = new Promise((res, rej) => { const s = createWriteStream(file); s.on('finish', res); s.on('error', rej); doc.pipe(s); });
  doc.end();
  await done;
  if (unknown.size) console.warn(`  ${file}: colours without an explicit CMYK value (converted naively): ${[...unknown].join(', ')}`);
}

// Registration-black crop marks at the trim corners, outside the bleed.
function cropMarks(doc, pw, ph, slug, bleed) {
  const t = slug + bleed, len = slug - 2 * MM, gap = bleed + 1 * MM;
  doc.save().lineWidth(0.25).strokeColor([100, 100, 100, 100]);
  for (const [x, y] of [[t, t], [pw - t, t], [t, ph - t], [pw - t, ph - t]]) {
    const sx = x < pw / 2 ? -1 : 1, sy = y < ph / 2 ? -1 : 1;
    doc.moveTo(x + sx * gap, y).lineTo(x + sx * (gap + len), y).stroke();
    doc.moveTo(x, y + sy * gap).lineTo(x, y + sy * (gap + len)).stroke();
  }
  doc.restore();
}
