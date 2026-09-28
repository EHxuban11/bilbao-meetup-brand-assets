// Extract the paths of a PDF-converted artwork (tools/pdf2svg.mjs --json) that fall inside a
// region (mm from the trim box top-left) into a standalone SVG with a tight viewBox.
// usage: node tools/pdf-extract.mjs <art.json> <x0> <y0> <x1> <y1> <out.svg> [--colour 0/0/0/0] [--title "..."]
import { readFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2);
const [art, ...r] = argv; const [X0, Y0, X1, Y1] = r.slice(0, 4).map(Number); const out = r[4];
const colour = argv.includes('--colour') ? argv[argv.indexOf('--colour') + 1] : null;
const title = argv.includes('--title') ? argv[argv.indexOf('--title') + 1] : '';
const d = JSON.parse(readFileSync(art));
const MM = 25.4 / 72 * d.userUnit, TX = d.trimBox[0], TY = d.height - d.trimBox[3];
const sel = d.paths.filter(p => {
  if (colour && (p.cmyk || []).join('/') !== colour) return false;
  const n = p.d.match(/-?\d+\.?\d*/g).map(Number); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let k = 0; k < n.length; k += 2) { x0 = Math.min(x0, n[k]); x1 = Math.max(x1, n[k]); y0 = Math.min(y0, n[k + 1]); y1 = Math.max(y1, n[k + 1]); }
  const b = [(x0 - TX) * MM, (y0 - TY) * MM, (x1 - TX) * MM, (y1 - TY) * MM];
  return b[0] >= X0 && b[2] <= X1 && b[1] >= Y0 && b[3] <= Y1;
});
// re-express coordinates in mm relative to the region's own ink box
const toMM = (x, y) => [(x - TX) * MM, (y - TY) * MM];
let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
const conv = sel.map(p => p.d.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (_, x, y) => { const [a, b] = toMM(+x, +y); bx0 = Math.min(bx0, a); bx1 = Math.max(bx1, a); by0 = Math.min(by0, b); by1 = Math.max(by1, b); return `${a.toFixed(4)} ${b.toFixed(4)}`; }));
const shift = s => s.replace(/(-?\d+\.\d+) (-?\d+\.\d+)/g, (_, x, y) => `${(+x - bx0).toFixed(3)} ${(+y - by0).toFixed(3)}`);
const w = bx1 - bx0, h = by1 - by0;
const svg = `<!-- ${title} Extracted as vectors from the poster PDF (reference/print). Units: mm. Poster position: x ${bx0.toFixed(2)} y ${by0.toFixed(2)} mm. -->\n` +
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(3)}" height="${h.toFixed(3)}" viewBox="0 0 ${w.toFixed(3)} ${h.toFixed(3)}" fill="currentColor">\n` +
  conv.map((c, i) => `<path${sel[i].rule === 'evenodd' ? ' fill-rule="evenodd"' : ''} d="${shift(c)}"/>`).join('\n') + '\n</svg>\n';
writeFileSync(out, svg);
console.log(`${sel.length} paths -> ${out}  box(mm) x ${bx0.toFixed(2)} y ${by0.toFixed(2)} w ${w.toFixed(2)} h ${h.toFixed(2)}`);
