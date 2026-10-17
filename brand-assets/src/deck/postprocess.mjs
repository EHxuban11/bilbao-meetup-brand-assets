// Post-processing of the PptxGenJS output, reproducing what the designer's pipeline did
// after PptxGenJS (see docs/deck.md):
//  1. layout placeholders get their field names ("title", "rows", "figure1"…) and zero
//     insets + vertical anchor. build.py looks placeholders up by these names.
//  2. picture placeholders get type="pic" (PptxGenJS drops it).
//  3. red guides on the margins, right column and image zone (View → Guides).
//  4. the licensed font, if present, is embedded as ppt/fonts/font1.fntdata (EOT).
import JSZip from 'jszip';
import { GUIDES } from './layouts.mjs';

const ANCHOR = { top: 't', bottom: 'b', middle: 'ctr' };

function fixLayout(xml, def) {
  if (!def) return xml;
  const phs = def.objects.map((o, i) => ({ o, idx: 100 + i })).filter(p => p.o.placeholder);
  return xml.replace(/<p:sp>([\s\S]*?)<\/p:sp>/g, (sp, body) => {
    const m = body.match(/<p:ph\s+idx="(\d+)"/); if (!m) return sp;
    const p = phs.find(q => q.idx === +m[1]); if (!p) return sp;
    const o = p.o.placeholder.options;
    const pic = o.type === 'image' || o.type === 'pic';
    let s = sp
      .replace(/<p:cNvPr id="(\d+)" name="[^"]*">\s*<\/p:cNvPr>/, `<p:cNvPr id="$1" name="${o.name}"/>`)
      .replace(/<p:ph\s+idx="(\d+)"\s*(type="\w+")?\s*(hasCustomPrompt="1")?\s*\/>/, (_, idx, type, prompt) =>
        `<p:ph idx="${idx}"${pic ? '' : type ? ` ${type}` : ''}${prompt ? ' hasCustomPrompt="1"' : ''}${pic ? ' type="pic"' : ''}/>`)
      .replace(/<a:bodyPr[^>]*>\s*<\/a:bodyPr>|<a:bodyPr[^>]*\/>/, `<a:bodyPr wrap="square" rtlCol="0" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${ANCHOR[o.valign] || 't'}"/>`);
    return s;
  });
}

const guidesXml = () => {
  let id = 0; const g = (pos, horz) => `<p15:guide id="${++id}" pos="${pos * 4}"${horz ? ' orient="horz"' : ''}><p15:clr><a:srgbClr val="EE3342"/></p15:clr></p15:guide>`;
  return '<p:extLst><p:ext uri="{EFAFB233-063F-42B5-8137-9DF3F51BA10A}"><p15:sldGuideLst xmlns:p15="http://schemas.microsoft.com/office/powerpoint/2012/main">' +
    GUIDES.vertical.map(v => g(v, false)).join('') + GUIDES.horizontal.map(v => g(v, true)).join('') + '</p15:sldGuideLst></p:ext></p:extLst>';
};

/**
 * @param {Buffer} pptx PptxGenJS output
 * @param {object} opts { layoutDefs, eot (Buffer|null), typeface }
 */
export async function postprocess(pptx, { layoutDefs, eot, typeface, dropEmptyPlaceholders = false }) {
  const zip = await JSZip.loadAsync(pptx);

  if (dropEmptyPlaceholders) for (const name of Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))) {
    const xml = await zip.file(name).async('string');
    zip.file(name, xml.replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<p:ph\s+idx="\d+"[\s\S]*?<\/p:sp>/g, sp => (/type="sldNum"/.test(sp) || /<a:t>[^<]/.test(sp)) ? sp : ''));
  }
  const byTitle = new Map(layoutDefs.map(d => [d.title, d]));

  for (const name of Object.keys(zip.files).filter(n => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(n))) {
    const xml = await zip.file(name).async('string');
    const title = (xml.match(/<p:cSld name="([^"]*)"/) || [])[1];
    zip.file(name, fixLayout(xml, byTitle.get(title)).replace(/ descr="preencoded\.png"/g, ' descr=""'));
  }

  let pres = await zip.file('ppt/presentation.xml').async('string');
  pres = pres.replace(' saveSubsetFonts="1"', '');
  if (eot) {
    pres = pres.replace('autoCompressPictures="0"', 'autoCompressPictures="0" embedTrueTypeFonts="1"')
      .replace(/(<p:notesSz [^>]*\/>)/, `$1<p:embeddedFontLst><p:embeddedFont><p:font typeface="${typeface}" pitchFamily="34" charset="0"/><p:regular r:id="rId100"/></p:embeddedFont></p:embeddedFontLst>`);
    zip.file('ppt/fonts/font1.fntdata', eot, { createFolders: false }); // build.py reads the first ppt/fonts/ entry: no folder entry
    const rels = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
    zip.file('ppt/_rels/presentation.xml.rels', rels.replace('</Relationships>',
      '<Relationship Id="rId100" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font1.fntdata"/></Relationships>'));
    const ct = await zip.file('[Content_Types].xml').async('string');
    if (!ct.includes('Extension="fntdata"')) zip.file('[Content_Types].xml', ct.replace('<Default Extension="xml"', '<Default Extension="fntdata" ContentType="application/x-fontdata"/><Default Extension="xml"'));
  }
  pres = pres.replace('</p:presentation>', `${guidesXml()}</p:presentation>`);
  zip.file('ppt/presentation.xml', pres);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
