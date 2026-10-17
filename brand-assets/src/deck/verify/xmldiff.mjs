// Normalised XML diff of two unzipped PPTX dirs (whitespace, attribute order, self-closing, declaration).
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
const [,, A, B, ...skip] = process.argv;
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const norm = x => x.replace(/<\?xml[^>]*\?>/, '').replace(/>\s+</g, '><').replace(/\s+\/>/g, '/>')
  .replace(/<([\w:]+)((?:\s+[\w:]+="[^"]*")*)\s*>\s*<\/\1>/g, '<$1$2/>')
  .replace(/<([\w:]+)((?:\s+[\w:]+="[^"]*")+)\s*(\/?)>/g, (_, t, attrs, sc) => `<${t} ${attrs.trim().match(/[\w:]+="[^"]*"/g).sort().join(' ')}${sc}>`)
  .trim();
const files = new Set([...walk(A).map(p => relative(A, p)), ...walk(B).map(p => relative(B, p))]);
let same = 0; const diffs = [];
for (const f of [...files].sort()) {
  if (skip.some(s => f.includes(s))) continue;
  const pa = join(A, f), pb = join(B, f);
  if (!existsSync(pa) || !existsSync(pb)) { diffs.push(`${existsSync(pa) ? 'only in ref' : 'only in ours'}: ${f}`); continue; }
  if (!/\.(xml|rels)$/.test(f)) { const eq = readFileSync(pa).equals(readFileSync(pb)); if (eq) same++; else diffs.push(`binary differs: ${f}`); continue; }
  const x = norm(readFileSync(pa, 'utf8')), y = norm(readFileSync(pb, 'utf8'));
  if (x === y) { same++; continue; }
  let i = 0; while (i < x.length && x[i] === y[i]) i++;
  diffs.push(`xml differs: ${f}\n    ref : …${x.slice(Math.max(0, i - 80), i + 120)}\n    ours: …${y.slice(Math.max(0, i - 80), i + 120)}`);
}
console.log(`${same} parts identical after normalisation; ${diffs.length} differ`); diffs.forEach(d => console.log(' - ' + d));
