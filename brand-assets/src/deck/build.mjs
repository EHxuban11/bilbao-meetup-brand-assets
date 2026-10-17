#!/usr/bin/env node
// Speaker slide decks for the Grok Bot Bilbao Meetup.
//
//   node src/deck/build.mjs                         -> every template deck in out/deck/
//   node src/deck/build.mjs --speaker hugo          -> Hugo's template deck
//   node src/deck/build.mjs talk.json [-o deck.pptx] [--speaker hugo] [--strict]
//   node src/deck/build.mjs --layouts               -> every layout and its fields
//   node src/deck/build.mjs --kit [--speaker hugo]  -> the speaker's AI kit .zip (template.pptx +
//                                                      the designer's build.py, SKILL.md, DESIGN.md…)
//
// talk.json is the designer's format (reference/speaker-deck/ai-kit/SKILL.md). The speaker's
// bot comes from config/event.js: --speaker <id>, or the speaker whose name matches talk.json,
// or the generic template bot.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { readdirSync } from 'node:fs';
import { buildDeck, LAYOUTS } from './deck.mjs';
import { templateTalk } from './template-content.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { default: event } = await import(join(ROOT, 'config', 'event.js'));
const TEMPLATE_BOT = { shape: 'round', color: '#FFFFFF' };

const argv = process.argv.slice(2);
const flag = k => argv.includes(k);
const opt = (...ks) => { for (const k of ks) { const i = argv.indexOf(k); if (i >= 0) return argv[i + 1]; } return undefined; };
const positional = argv.filter((a, i) => !a.startsWith('-') && !['-o', '--out', '--speaker'].includes(argv[i - 1]));

const slug = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
const deckName = sp => `Grok-Bot-Bilbao-${sp ? slug(sp.name) : 'plantilla'}.pptx`;

function speakerFor(id) {
  if (!id || id === 'template' || id === 'plantilla') return null;
  const sp = event.speakers[id];
  if (!sp) { console.error(`unknown speaker "${id}". Use one of: ${Object.keys(event.speakers).join(', ')}, template`); process.exit(1); }
  return sp;
}

function report({ errors, warnings }) {
  for (const w of warnings) console.log('warning:', w);
  for (const e of errors) console.log('error:', e);
}

if (flag('--layouts')) {
  for (const [k, [name, fields]] of Object.entries(LAYOUTS)) {
    console.log(`${k}  (${name})`);
    for (const [f, d] of Object.entries(fields)) console.log(`    ${f ? f + ': ' : ''}${d}`);
  }
  process.exit(0);
}

const talkFile = positional[0];
if (talkFile) {
  // A real talk, from talk.json (build.py semantics).
  const src = resolve(talkFile);
  const talk = JSON.parse(readFileSync(src, 'utf8'));
  const byName = Object.entries(event.speakers).find(([, s]) => s.name === talk.speaker?.name);
  const sp = opt('--speaker') ? speakerFor(opt('--speaker')) : byName?.[1];
  const res = await buildDeck(talk, { root: ROOT, base: dirname(src), event, bot: sp?.bot || TEMPLATE_BOT });
  report(res);
  if (res.errors.length || (flag('--strict') && res.warnings.length)) { console.log('Not saved. Fix talk.json and build again.'); process.exit(1); }
  const out = resolve(opt('-o', '--out') || src.replace(/\.json$/i, '') + '.pptx');
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, res.buffer);
  const measured = res.measured ? 'measured with the embedded font' : 'estimated; add the licensed font to fonts/ to measure exactly';
  console.log(`Saved ${out} · ${talk.slides.length} slides · ${res.warnings.length} warnings · line lengths ${measured}`);
} else {
  // Template decks: one example slide per layout, with the speaker's bot, name and title.
  const outDir = resolve(opt('-o', '--out') || join(ROOT, 'out', 'deck'));
  mkdirSync(outDir, { recursive: true });
  const ids = opt('--speaker') ? [opt('--speaker')] : ['template', ...Object.keys(event.speakers)];
  for (const id of ids) {
    const sp = speakerFor(id);
    const talk = templateTalk(sp && { name: sp.name, org: sp.company, talk: sp.talk });
    const res = await buildDeck(talk, { root: ROOT, base: talk.base, event, bot: sp?.bot || TEMPLATE_BOT, template: true });
    report({ errors: res.errors, warnings: [] }); // the example copy is the designer's; rule warnings don't apply
    if (res.errors.length) process.exit(1);
    const out = join(outDir, deckName(sp));
    writeFileSync(out, res.buffer);
    console.log(`Saved ${out}${res.embedded ? ' · font embedded' : ' · font NOT embedded (no licensed file in fonts/)'}`);
    if (flag('--kit')) {
      const kitOut = out.replace(/\.pptx$/, '-kit.zip');
      writeFileSync(kitOut, await kit(res.buffer));
      console.log(`Saved ${kitOut}`);
    }
  }
}

// The speaker kit, as the designer shipped it: our template.pptx next to the designer's own
// build.py / SKILL.md / LEEME.md / DESIGN.md (which work unchanged with it), an example talk,
// and the layout pictures.
async function kit(templateBuffer) {
  const z = new JSZip(); const ref = join(ROOT, 'reference', 'speaker-deck');
  z.file('template.pptx', templateBuffer);
  for (const f of ['build.py', 'SKILL.md', 'LEEME.md', 'DESIGN.md']) z.file(f, readFileSync(join(ref, 'ai-kit', f)));
  const example = JSON.parse(readFileSync(join(ROOT, 'examples', 'talk.example.json'), 'utf8'));
  for (const s of example.slides) {           // point the example's images at the kit's examples/
    if (s.image) { s.image = `examples/${s.image.split('/').pop()}`; }
    for (const im of s.images || []) im.image = `examples/${im.image.split('/').pop()}`;
  }
  z.file('talk.example.json', JSON.stringify(example, null, 2) + '\n');
  const photos = join(ROOT, 'src', 'deck', 'examples');
  for (const f of readdirSync(photos)) z.file(`examples/${f}`, readFileSync(join(photos, f)), { createFolders: false });
  for (const f of readdirSync(ref).filter(f => f.endsWith('.png'))) z.file(`examples/${f}`, readFileSync(join(ref, f)), { createFolders: false });
  return z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
