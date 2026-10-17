// Minimal PDF page -> SVG converter for vector artwork (Illustrator exports with outlined text).
// Handles q/Q, cm, m/l/c/v/y/h/re, f/f*/B/S/n, W/W* clipping (dropped), k/K/rg/RG/g/G colours.
// Each filled path becomes <path data-cmyk="c m y k" fill="#rgb" d="..."> in page units
// (PDF user space, y flipped). Page units are points x /UserUnit (the poster uses UserUnit 10).
// usage: node tools/pdf2svg.mjs <in.pdf> <out.svg> [--json out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

const [,, inp, out, , jsonOut] = process.argv;
const buf = readFileSync(inp); const s = buf.toString('latin1');

// find page content stream(s): the object referenced by /Contents of the first /Page
const objAt = n => { const m = new RegExp(`(^|[^0-9])${n} 0 obj`).exec(s); return m ? m.index + m[1].length : -1; };
const pageIdx = s.search(/\/Type\s*\/Page[^s]/);
const pageObjStart = s.lastIndexOf(' 0 obj', pageIdx);
const pageDict = s.slice(pageObjStart, s.indexOf('endobj', pageIdx));
const contents = [...(pageDict.match(/\/Contents\s*(\[[^\]]*\]|\d+ 0 R)/)[1].matchAll(/(\d+) 0 R/g))].map(m => +m[1]);
const mediaBox = pageDict.match(/\/MediaBox\s*\[([^\]]+)\]/)[1].trim().split(/\s+/).map(Number);
const trimBox = (pageDict.match(/\/TrimBox\s*\[([^\]]+)\]/) || [, mediaBox.join(' ')])[1].trim().split(/\s+/).map(Number);
const userUnit = +(pageDict.match(/\/UserUnit\s*([\d.]+)/) || [, 1])[1];

function streamOf(n) {
  const at = objAt(n); const end = s.indexOf('endobj', at); const chunk = s.slice(at, end);
  const si = chunk.search(/stream\r?\n/); const dict = chunk.slice(0, si);
  const start = at + si + chunk.slice(si).match(/stream\r?\n/)[0].length;
  let data = buf.subarray(start, s.lastIndexOf('endstream', end));
  if (/FlateDecode/.test(dict)) data = zlib.inflateSync(data);
  return data.toString('latin1');
}
const content = contents.map(streamOf).join('\n');

// tokenizer
const toks = content.match(/\/[^\s\/\[\]()<>]+|\([^)]*\)|<<|>>|\[|\]|[^\s\/\[\]()<>]+/g);
const H = mediaBox[3];
let ctm = [1, 0, 0, 1, 0, 0]; const stack = []; let fill = [0, 0, 0, 1], fillSpace = 'cmyk';
let path = ''; const paths = []; let ops = [];
const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
const P = (x, y) => { const X = ctm[0] * x + ctm[2] * y + ctm[4], Y = ctm[1] * x + ctm[3] * y + ctm[5]; return `${+X.toFixed(4)} ${+(H - Y).toFixed(4)}`; };
let cur = [0, 0];
const hex = v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
const rgbOf = () => fillSpace === 'cmyk' ? '#' + [0, 1, 2].map(i => hex((1 - fill[i]) * (1 - fill[3]))).join('') : fillSpace === 'rgb' ? '#' + fill.map(hex).join('') : '#' + hex(fill[0]).repeat(3);
for (const t of toks) {
  if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) { ops.push(+t); continue; }
  const a = ops; ops = [];
  switch (t) {
    case 'q': stack.push({ ctm: ctm.slice(), fill: fill.slice(), fillSpace }); break;
    case 'Q': ({ ctm, fill, fillSpace } = stack.pop()); break;
    case 'cm': ctm = mul(a, ctm); break;
    case 'm': path += `M${P(a[0], a[1])} `; cur = [a[0], a[1]]; break;
    case 'l': path += `L${P(a[0], a[1])} `; cur = [a[0], a[1]]; break;
    case 'c': path += `C${P(a[0], a[1])} ${P(a[2], a[3])} ${P(a[4], a[5])} `; cur = [a[4], a[5]]; break;
    case 'v': path += `C${P(cur[0], cur[1])} ${P(a[0], a[1])} ${P(a[2], a[3])} `; cur = [a[2], a[3]]; break;
    case 'y': path += `C${P(a[0], a[1])} ${P(a[2], a[3])} ${P(a[2], a[3])} `; cur = [a[2], a[3]]; break;
    case 'h': path += 'Z '; break;
    case 're': { const [x, y, w, h] = a; path += `M${P(x, y)} L${P(x + w, y)} L${P(x + w, y + h)} L${P(x, y + h)} Z `; break; }
    case 'f': case 'F': case 'f*': case 'B': case 'B*': case 'b': case 'b*':
      paths.push({ d: path.trim(), rule: t.includes('*') ? 'evenodd' : 'nonzero', cmyk: fillSpace === 'cmyk' ? fill.slice() : null, rgb: rgbOf() }); path = ''; break;
    case 'n': case 'S': case 's': path = ''; break;
    case 'W': case 'W*': break;
    case 'k': fill = a; fillSpace = 'cmyk'; break;
    case 'rg': fill = a; fillSpace = 'rgb'; break;
    case 'g': fill = a; fillSpace = 'gray'; break;
    default: break; // K/RG/G stroke colours, gs, BDC/EMC, Do (images are ignored)
  }
}
const vb = [mediaBox[0], H - mediaBox[3], mediaBox[2] - mediaBox[0], mediaBox[3] - mediaBox[1]];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" data-userunit="${userUnit}" data-trimbox="${trimBox.join(' ')}">\n` +
  paths.map((p, i) => `<path id="p${i}" fill="${p.rgb}"${p.cmyk ? ` data-cmyk="${p.cmyk.join(' ')}"` : ''}${p.rule === 'evenodd' ? ' fill-rule="evenodd"' : ''} d="${p.d}"/>`).join('\n') + '\n</svg>\n';
writeFileSync(out, svg);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ mediaBox, trimBox, userUnit, height: H, paths }, null, 0));
console.log(`${paths.length} filled paths; MediaBox ${mediaBox}; TrimBox ${trimBox}; UserUnit ${userUnit}`);
