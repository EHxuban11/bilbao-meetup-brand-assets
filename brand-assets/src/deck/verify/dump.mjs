// Summarise a PPTX (unzipped dir): layouts, slides, shapes, text, notes.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const dir = process.argv[2]; const only = process.argv[3];
const px = v => Math.round(+v / 6350 * 100) / 100;
const rd = p => readFileSync(`${dir}/${p}`, 'utf8');
function shapes(xml) {
  const out = [];
  const re = /<p:(sp|pic|graphicFrame|cxnSp)>([\s\S]*?)<\/p:\1>/g; let m;
  while ((m = re.exec(xml))) {
    const b = m[2];
    const name = (b.match(/<p:cNvPr id="(\d+)" name="([^"]*)"(?: descr="([^"]*)")?/) || []).slice(1).join('|');
    const ph = (b.match(/<p:ph([^/]*)\/>/) || [])[1] || '';
    const off = b.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/); const ext = b.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    const rot = (b.match(/<a:xfrm rot="(-?\d+)"/) || [])[1];
    const geom = (b.match(/prstGeom prst="(\w+)"/) || [])[1];
    const fill = (b.match(/<p:spPr>[\s\S]*?<a:solidFill><a:srgbClr val="(\w+)"/) || [])[1];
    const body = (b.match(/<a:bodyPr([^>]*)>/) || [])[1] || '';
    const anchor = (body.match(/anchor="(\w+)"/) || [])[1];
    const embed = (b.match(/r:embed="(\w+)"/) || [])[1];
    const src = (b.match(/<a:srcRect([^/]*)\/>/) || [])[1];
    const paras = [...b.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map(p => {
      const pp = p[1]; const ln = (pp.match(/<a:lnSpc><a:spcPts val="(\d+)"/) || [])[1]; const al = (pp.match(/algn="(\w+)"/) || [])[1];
      const sb = (pp.match(/<a:spcBef><a:spcPts val="(\d+)"/) || [])[1];
      const runs = [...pp.matchAll(/<a:r>([\s\S]*?)<\/a:r>|<a:fld[^>]*type="(\w+)"/g)].map(r => { if (r[2]) return `{fld:${r[2]}}`; const rr = r[1]; const sz = (rr.match(/sz="(\d+)"/) || [])[1]; const c = (rr.match(/srgbClr val="(\w+)"/) || [])[1]; const f = (rr.match(/latin typeface="([^"]+)"/) || [])[1]; const t = (rr.match(/<a:t>([\s\S]*?)<\/a:t>/) || [])[1]; return `[${sz}/${c}${f && !f.startsWith('Universal') ? '/' + f : ''}]${t}`; });
      return `    ¶ ${al || ''} ln${ln || '-'}${sb ? ' bef' + sb : ''}: ${runs.join('')}`;
    });
    // lstStyle defaults
    const lst = (b.match(/<a:lstStyle>([\s\S]*?)<\/a:lstStyle>/) || [])[1] || '';
    const ldef = lst ? `lst(sz${(lst.match(/sz="(\d+)"/) || [])[1]} ${(lst.match(/srgbClr val="(\w+)"/) || [])[1]} ln${(lst.match(/spcPts val="(\d+)"/) || [])[1]})` : '';
    out.push(`  ${m[1]} ${name} ${ph ? 'ph[' + ph.trim() + ']' : ''} ${off ? `@(${px(off[1])},${px(off[2])}) ${px(ext[1])}x${px(ext[2])}` : ''}${rot ? ' rot' + rot : ''} ${geom || ''}${fill ? ' fill' + fill : ''}${anchor ? ' anchor=' + anchor : ''}${embed ? ' img=' + embed : ''}${src ? ' crop' + src : ''} ${ldef}`);
    out.push(...paras);
  }
  return out.join('\n');
}
const rels = p => { const f = p.replace(/([^/]+)$/, '_rels/$1.rels'); if (!existsSync(`${dir}/${f}`)) return ''; return [...rd(f).matchAll(/Id="(\w+)"[^>]*Target="([^"]+)"/g)].map(m => `${m[1]}=${m[2].replace('../', '')}`).join(' '); };
if (!only || only === 'layouts') for (const f of readdirSync(`${dir}/ppt/slideLayouts`).filter(f => f.endsWith('.xml')).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)))) {
  const x = rd(`ppt/slideLayouts/${f}`); console.log(`== ${f} "${(x.match(/<p:cSld name="([^"]*)"/) || [])[1]}"  rels: ${rels('ppt/slideLayouts/' + f)}`); console.log(shapes(x));
}
if (!only || only === 'slides') for (let i = 1; existsSync(`${dir}/ppt/slides/slide${i}.xml`); i++) {
  const x = rd(`ppt/slides/slide${i}.xml`); console.log(`== slide${i} rels: ${rels('ppt/slides/slide' + i + '.xml')}`); console.log(shapes(x));
  const n = `ppt/notesSlides/notesSlide${i}.xml`; if (existsSync(`${dir}/${n}`)) { const t = [...rd(n).matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(m => m[1]).join(' / '); console.log('  NOTES: ' + t); }
}
if (!only || only === 'master') { const x = rd('ppt/slideMasters/slideMaster1.xml'); console.log('== master rels: ' + rels('ppt/slideMasters/slideMaster1.xml')); console.log(shapes(x)); }
