// Builds a speaker deck (.pptx) from a talk object — the same talk.json format as the
// designer's build.py (reference/speaker-deck/ai-kit/). Same layouts, fields, checks and
// messages; the output is generated with PptxGenJS instead of filling template.pptx.
import { existsSync, readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import PptxGenJS from 'pptxgenjs';
import sharp from 'sharp';
import { layouts, FONT, WHITE, GREY, px, box, ROW, SLIDE_NUMBER } from './layouts.mjs';
import { SIZE, findLicensedFont, loadWidths, makeMeasure } from './text.mjs';
import { botPng, arrowPng, dataUri } from './bots.mjs';
import { postprocess } from './postprocess.mjs';
import { toEOT, inspectFont, embeddable } from './eot.mjs';

export const MAX_WORDS = 30;

// layout key -> (layout name, fields) — verbatim from build.py
export const LAYOUTS = {
  portada: ['01 Portada', { '': 'uses "title" and "speaker" from the top of talk.json' }],
  seccion: ['02 Sección', { number: '"01", "02"…', title: 'section name, 1 line' }],
  filas: ['03 Título y filas', { title: 'statement, up to 3 short lines', rows: '1–4 of {"text": idea, "detail": optional grey line}' }],
  frase: ['04 Frase', { text: 'the sentence to remember, up to 3 lines' }],
  cifra: ['05 Cifra', { title: 'statement, 1 line', figure: 'the number, up to 4 characters, e.g. "12", "3,5×"', label: 'what it means, 1 line', source: '"Fuente: …"' }],
  'tres-cifras': ['06 Tres cifras', { title: 'statement, 1 line', figures: '1–3 of {"value": "45", "unit": optional "min", "label": 1 line}' }],
  imagen: ['07 Imagen con título', { title: 'statement, 1 line', image: 'path relative to talk.json', caption: 'optional, e.g. "Foto: Autor"' }],
  'imagen-sola': ['08 Imagen sola', { image: 'path; screenshots and portrait photos', caption: 'optional' }],
  'imagen-a-sangre': ['09 Imagen a sangre', { image: 'landscape photo, 1920 × 1080 or more', caption: 'optional, white' }],
  'dos-imagenes': ['10 Dos imágenes', { title: 'statement, 1 line', images: 'exactly 2 of {"image", "label", "detail": optional}' }],
  cita: ['11 Cita', { quote: 'up to 12 words, with “ ”', author: 'name', role: 'optional, grey' }],
  codigo: ['12 Código', { title: 'statement, 1 line', code: 'up to 14 lines, use \\n', comment: 'optional comment prefix, default "#" (lines starting with it go grey)' }],
  cierre: ['13 Cierre', { '': 'uses "speaker" and "link" from the top of talk.json' }],
};
// build.py's aliases, plus the English names used for the example PNGs.
const ALIASES = {
  sangre: 'imagen-a-sangre', cover: 'portada', closing: 'cierre',
  section: 'seccion', rows: 'filas', statement: 'frase', number: 'cifra', stats: 'tres-cifras',
  image: 'imagen', 'image-solo': 'imagen-sola', bleed: 'imagen-a-sangre', pair: 'dos-imagenes',
  quote: 'cita', code: 'codigo',
};
export const layoutKey = s => {
  const k = String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\x00-\x7f]/g, '').toLowerCase().trim().replace(/ /g, '-');
  return ALIASES[k] ?? k;
};

const imageSize = async p => { const m = await sharp(p).metadata(); return { w: m.width, h: m.height }; };

/**
 * @param {object} talk     talk.json content
 * @param {object} o        { root, base (dir for image paths), event (config), bot {shape,color},
 *                            template (true = reproduce the designer's example slides exactly) }
 * @returns {{ buffer?, errors, warnings, measured, embedded }}
 */
export async function buildDeck(talk, { root, base, event, bot, template = false }) {
  const errors = [], warnings = [];
  const warn = (n, m) => warnings.push(`slide ${n}: ${m}`), err = (n, m) => errors.push(`slide ${n}: ${m}`);

  // Font: licensed Universal Sans Display if present (measured + embedded), else estimate like build.py.
  const fontFile = findLicensedFont(root);
  const M = makeMeasure(loadWidths(fontFile));
  let eot = null, typeface = FONT;
  if (fontFile) {
    const ttf = readFileSync(fontFile); const info = inspectFont(ttf); const e = embeddable(info.fsType);
    typeface = info.family || FONT;
    if (!info.trueType) console.warn(`font: ${basename(fontFile)} has CFF outlines; PowerPoint can only embed TrueType (.ttf). Not embedded.`);
    else if (!e.ok) console.warn(`font: ${basename(fontFile)} can't be embedded: ${e.why}.`);
    else eot = toEOT(ttf, { familyName: typeface });
  }

  const accent = (bot.color || '#FFFFFF').replace('#', '').toUpperCase();
  const assets = {
    coverBot: dataUri(await botPng(root, bot, 'cover')),
    closingBot: dataUri(await botPng(root, bot, 'closing')),
    arrow: dataUri(await arrowPng()),
  };
  const defs = layouts({ event, accent, assets });
  if (typeface !== FONT) retypeface(defs, typeface);
  const byName = new Map(defs.map(d => [d.title, d]));

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.theme = { headFontFace: typeface, bodyFontFace: typeface };
  pptx.author = pptx.company = 'SpaceXAI Euskadi';
  pptx.revision = '1';
  for (const d of defs) pptx.defineSlideMaster({ title: d.title, background: { color: '000000' }, objects: d.objects, ...(d.number === false ? {} : { slideNumber: { ...SLIDE_NUMBER, fontFace: typeface } }) });

  const t = talk; const speaker = t.speaker || {};
  const name = speaker.name || '', org = speaker.org || '';
  const link = String(t.link || '').replace(/^https:\/\//, '').replace(/^http:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  pptx.title = template ? `${event.nameOneLine} · ${name}` : `${t.title || ''} · ${name}`.replace(/^[ ·]+|[ ·]+$/g, '');
  pptx.subject = '';
  if (!Array.isArray(t.slides) || !t.slides.length) { errors.push('talk.json has no "slides"'); return { errors, warnings, measured: M.measured }; }

  const fits = (n, field, s, style, width, lines = 1) => {
    if (!s) return; const got = M.lineCount(s, SIZE[style], width);
    if (got > lines) warn(n, `${field} runs to ${got} lines (max ${lines}): "${s}". Shorten it or split the slide.`);
  };
  const statement = (n, field, s, maxWords = 8) => {
    if (!s) return; const words = String(s).split(/\s+/).filter(Boolean).length;
    if (words > maxWords) warn(n, `${field} has ${words} words; titles are statements of ${maxWords} words or fewer.`);
    if (String(s).trimEnd().endsWith('.')) warn(n, `${field} ends with a full stop; drop it.`);
  };
  const image = (n, rel) => {
    if (!rel) { err(n, 'missing "image"'); return null; }
    const p = resolve(base, rel); if (!existsSync(p)) { err(n, `image not found: ${rel}`); return null; } return p;
  };
  // runs: [[text, colour|null], …] per paragraph; soft line breaks inside a paragraph via { br: true }
  const runs = paragraphs => {
    const out = [];
    paragraphs.forEach((p, i) => p.forEach((r, j) => {
      const o = {}; if (r.color) o.color = r.color; if (r.br) o.softBreakBefore = true;
      if (j === p.length - 1 && i < paragraphs.length - 1) o.breakLine = true;
      out.push({ text: r.text, options: o });
    }));
    return out;
  };
  const balancedRuns = (value, style, width, explicitLines) =>
    runs((explicitLines ? [explicitLines] : M.balance(value, SIZE[style], width)).map(lines => lines.map((l, j) => ({ text: l, br: j > 0 }))));
  const plainRuns = value => runs(String(value).split('\n').map(l => [{ text: l }]));

  for (const [i, s] of t.slides.entries()) {
    const n = i + 1; const lk = layoutKey(s.layout);
    if (!LAYOUTS[lk]) { err(n, `unknown layout "${s.layout}". Use one of: ${Object.keys(LAYOUTS).join(', ')}`); continue; }
    const def = byName.get(LAYOUTS[lk][0]);
    const slide = pptx.addSlide({ masterName: def.title });
    const put = (field, textRuns) => slide.addText(textRuns, { placeholder: field });
    const plain = (field, value) => { if (value) put(field, plainRuns(value)); };
    const balanced = (field, value, style, width, lines) => {
      if (!value) return;
      if (template && field === 'title' && lk !== 'portada') return plain(field, value); // example copy is raw in the designer's template
      put(field, balancedRuns(value, style, width, lines));
    };
    const words = [];
    const notes = () => { if (s.notes) slide.addNotes(String(s.notes)); };

    if (lk === 'portada') {
      const title = t.title || '';
      if (!title || !name) err(n, 'portada needs "title" and "speaker": {"name", "org"} at the top of talk.json');
      fits(n, 'title', title, 'hero', 1760, 2);
      balanced('title', title, 'hero', 1760, t.titleLines);
      put('speaker', runs([org ? [{ text: name }, { text: ` · ${org}`, color: GREY }] : [{ text: name }]]));
    } else if (lk === 'seccion') {
      plain('number', s.number || '');
      statement(n, 'title', s.title); fits(n, 'title', s.title, 'hero', 1760, 1);
      balanced('title', s.title, 'hero', 1760); words.push(s.title || '');
    } else if (lk === 'filas') {
      const rows = s.rows || [];
      if (!(rows.length >= 1 && rows.length <= 4)) err(n, `filas takes 1–4 rows, got ${rows.length}; split the list over two slides.`);
      statement(n, 'title', s.title, 10); fits(n, 'title', s.title, 'display', 804, 3);
      balanced('title', s.title, 'display', 804);
      rows.slice(0, 4).forEach((row0, r) => {
        const row = typeof row0 === 'object' && row0 ? row0 : { text: String(row0) };
        const y = ROW.y0 + r * ROW.step;
        slide.addText([{ text: String(r + 1).padStart(2, '0'), options: { color: GREY } }],
          { ...box(ROW.numX, y, ROW.numW, ROW.numH), isTextBox: true, fontFace: typeface, fontSize: 20, lineSpacing: 24, margin: 0, valign: 'top', align: 'left' });
        const lines = [{ text: row.text || '', color: WHITE }, ...(row.detail ? [{ text: row.detail, color: GREY }] : [])];
        slide.addText(lines.map((l, j) => ({ text: l.text, options: { color: l.color, breakLine: j < lines.length - 1, ...(template || j ? { paraSpaceBefore: 3 } : {}) } })),
          { ...box(ROW.textX, y, ROW.textW, ROW.textH), isTextBox: true, fontFace: typeface, fontSize: 20, lineSpacing: 24, margin: 0, valign: 'top', align: 'left' });
        for (const field of ['text', 'detail']) {
          fits(n, `row ${r + 1} ${field}`, row[field], 'body', 684, 1);
          if (String(row[field] ?? '').trimEnd().endsWith('.')) warn(n, `row ${r + 1} ${field} ends with a full stop; drop it.`);
        }
        words.push(row.text || '', row.detail || '');
      });
      words.push(s.title || '');
    } else if (lk === 'frase') {
      fits(n, 'text', s.text, 'hero', 1560, 3);
      if (!s.text) err(n, 'frase needs "text"');
      balanced('title', s.text, 'hero', 1560); words.push(s.text || '');
    } else if (lk === 'cifra') {
      const fig = String(s.figure ?? '');
      if (!fig) err(n, 'cifra needs "figure"');
      if ([...fig].length > 4) warn(n, `figure "${fig}" is longer than 4 characters; round it or move the unit into the label.`);
      if (!s.source) warn(n, 'every number needs a source: add "source": "Fuente: …"');
      statement(n, 'title', s.title); fits(n, 'title', s.title, 'display', 1760, 1);
      fits(n, 'label', s.label, 'body', 1560, 1); fits(n, 'source', s.source, 'small', 1300, 1);
      balanced('title', s.title, 'display', 1760); plain('figure', fig); plain('label', s.label); plain('source', s.source);
      words.push(s.title || '', s.label || '', s.source || '');
    } else if (lk === 'tres-cifras') {
      const figs = s.figures || [];
      if (!(figs.length >= 1 && figs.length <= 3)) err(n, `tres-cifras takes 1–3 figures, got ${figs.length}`);
      statement(n, 'title', s.title); fits(n, 'title', s.title, 'display', 1760, 1);
      balanced('title', s.title, 'display', 1760);
      const three = figs.slice(0, 3);
      three.forEach((f, k) => {
        const value = String(f.value ?? ''), unit = f.unit;
        put(`figure${k + 1}`, runs([[{ text: value }, ...(unit ? [{ text: ` ${unit}`, color: GREY }] : [])]]));
        fits(n, `figure ${k + 1}`, `${value} ${unit || ''}`.trim(), 'hero', 570, 1);
        if (!template) plain(`label${k + 1}`, f.label);
        fits(n, `label ${k + 1}`, f.label, 'body', 570, 1); words.push(f.label || '');
      });
      if (template) three.forEach((f, k) => plain(`label${k + 1}`, f.label));
      words.push(s.title || '');
    } else if (lk === 'imagen' || lk === 'imagen-sola') {
      const p = image(n, s.image);
      if (lk === 'imagen') { statement(n, 'title', s.title); fits(n, 'title', s.title, 'display', 1760, 1); balanced('title', s.title, 'display', 1760); }
      fits(n, 'caption', s.caption, 'small', 1300, 1);
      plain('caption', s.caption);
      if (p) {
        const { w, h } = await imageSize(p); const [x, y, zw, zh] = lk === 'imagen' ? [80, 200, 1760, 680] : [80, 160, 1760, 760];
        const k = Math.min(zw / w, zh / h);
        if (k > 1.25) warn(n, `${basename(p)} is ${w} × ${h} px and will be enlarged ${k.toFixed(1)}×; use a sharper image (at least ${Math.trunc(w * k)} × ${Math.trunc(h * k)}).`);
        const dw = w * k, dh = h * k;
        slide.addImage({ path: p, ...box(x + (zw - dw) / 2, y + (zh - dh) / 2, dw, dh), altText: s.alt || s.caption || basename(p) });
      }
      words.push(s.title || '', s.caption || '');
    } else if (lk === 'imagen-a-sangre') {
      const p = image(n, s.image);
      if (p) { await fillPicture(slide, 'image', p, [0, 0, 1920, 1080], n, 1920, warn, s.alt || s.caption); }
      plain('caption', s.caption); words.push(s.caption || '');
    } else if (lk === 'dos-imagenes') {
      const imgs = s.images || [];
      if (imgs.length !== 2) err(n, `dos-imagenes takes exactly 2 images, got ${imgs.length}`);
      statement(n, 'title', s.title); fits(n, 'title', s.title, 'display', 1760, 1);
      balanced('title', s.title, 'display', 1760);
      const two = imgs.slice(0, 2);
      for (const [k, im] of two.entries()) {
        const p = image(n, im.image);
        if (p) await fillPicture(slide, `image${k + 1}`, p, [k ? 992 : 80, 302, 848, 477], n, 848, warn, im.alt || im.detail || im.label);
        if (!template) { plain(`label${k + 1}`, im.label); plain(`note${k + 1}`, im.detail); }
        fits(n, `image ${k + 1} label`, im.label, 'small', 848, 1); fits(n, `image ${k + 1} detail`, im.detail, 'small', 848, 1);
        words.push(im.label || '', im.detail || '');
      }
      if (template) two.forEach((im, k) => { plain(`label${k + 1}`, im.label); plain(`note${k + 1}`, im.detail); });
      words.push(s.title || '');
    } else if (lk === 'cita') {
      let q = String(s.quote ?? '').trim();
      if (!q) err(n, 'cita needs "quote"');
      if (q && !q.startsWith('“')) q = '“' + q.replace(/^["'«»“”]+|["'«»“”]+$/g, '') + '”';
      const qw = q.split(/\s+/).filter(Boolean).length; if (qw > 12) warn(n, `the quote has ${qw} words (max 12)`);
      fits(n, 'quote', q, 'hero', 1560, 3);
      balanced('title', q, 'hero', 1560);
      put('author', runs([[{ text: s.author || '' }, ...(s.role ? [{ text: ` · ${s.role}`, color: GREY }] : [])]]));
      words.push(q);
    } else if (lk === 'codigo') {
      const code = String(s.code ?? '').replace(/\n+$/, ''); const prefix = s.comment ?? '#';
      const lines = code.split('\n');
      if (lines.length > 14) err(n, `code has ${lines.length} lines (max 14); show only the part you explain.`);
      const longest = Math.max(0, ...lines.map(l => [...l].length));
      if (longest > 88) warn(n, `a code line is ${longest} characters (max 88); wrap it by hand.`);
      statement(n, 'title', s.title); fits(n, 'title', s.title, 'display', 1760, 1);
      balanced('title', s.title, 'display', 1760);
      put('code', runs(lines.map(l => [{ text: l || '\u00a0', color: prefix && l.trimStart().startsWith(prefix) ? GREY : null }])));
      words.push(s.title || '');
    } else if (lk === 'cierre') {
      if (!name) err(n, 'cierre needs "speaker": {"name", "org"} at the top of talk.json');
      put('title', runs([[{ text: 'Gracias' }], [{ text: 'Eskerrik asko', color: GREY }]]));
      plain('name', name); plain('org', org);
      if (link) { if (M.textWidth(link, 32) > 500) warn(n, `link "${link}" is too long for the pill; use a shorter URL.`); plain('link', link); }
      else warn(n, 'no "link" at the top of talk.json; the pill will be empty.');
    }

    const count = words.filter(Boolean).reduce((a, w) => a + String(w).split(/\s+/).filter(Boolean).length, 0);
    if (count > MAX_WORDS) warn(n, `${count} words on the slide (max ${MAX_WORDS}); move detail to the notes or split it.`);
    notes();
  }

  if (errors.length) return { errors, warnings, measured: M.measured };
  const raw = await pptx.write({ outputType: 'nodebuffer' });
  // PptxGenJS adds every unused layout placeholder as an empty shape. The template keeps them
  // (they show the layout's prompt when editing by hand); a built talk drops them, like build.py.
  const buffer = await postprocess(raw, { layoutDefs: defs, eot, typeface, dropEmptyPlaceholders: !template });
  return { buffer, errors, warnings, measured: M.measured, embedded: !!eot, fontFile };
}

// Picture placeholder filled edge to edge (cropped to cover), like python-pptx insert_picture.
async function fillPicture(slide, field, p, [x, y, w, h], n, minW, warn, alt) {
  const s = await imageSize(p);
  if (s.w < minW) warn(n, `${basename(p)} is ${s.w} px wide; this layout needs at least ${minW}.`);
  // PptxGenJS "cover": object w/h carry the image's aspect, sizing.w/h the box.
  const iw = w, ih = (w * s.h) / s.w;
  slide.addImage({ placeholder: field, path: p, x: px(x), y: px(y), w: px(iw), h: px(ih), sizing: { type: 'cover', w: px(w), h: px(h) }, altText: alt || basename(p) });
}

function retypeface(defs, face) {
  const walk = o => { if (!o || typeof o !== 'object') return; if (o.fontFace === FONT) o.fontFace = face; Object.values(o).forEach(walk); };
  defs.forEach(walk);
}
