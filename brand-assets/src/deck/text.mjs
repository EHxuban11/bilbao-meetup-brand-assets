// Text measurement, wrapping and balancing. A port of the designer's build.py
// (reference/speaker-deck/ai-kit/build.py): same greedy wrap, same line counts, same
// "text-wrap: balance" search, same 0.52 em estimate when the real font isn't available.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import opentype from 'opentype.js';

export const SIZE = { numeral: 240, hero: 120, display: 64, body: 40, small: 32 };

/** The licensed Universal Sans Display file, if someone dropped it in fonts/. */
export function findLicensedFont(root) {
  if (process.env.DECK_FONT) return process.env.DECK_FONT; // testing / alternative location
  const dir = join(root, 'fonts');
  if (!existsSync(dir)) return null;
  const hit = readdirSync(dir).find(f => /^universal.*sans.*display.*\.(ttf|otf)$/i.test(f));
  return hit ? join(dir, hit) : null;
}

/** Advance-width function (em units per char), like build.py's load_widths(). */
export function loadWidths(fontFile) {
  if (!fontFile) return null;
  const buf = readFileSync(fontFile);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const upm = font.unitsPerEm; const notdef = font.glyphs.get(0).advanceWidth;
  const cache = new Map();
  return ch => {
    if (!cache.has(ch)) { const g = font.charToGlyphIndex(ch); cache.set(ch, (g ? font.glyphs.get(g).advanceWidth : notdef) / upm); }
    return cache.get(ch);
  };
}

export function makeMeasure(widthFn) {
  const textWidth = (s, px) => { let w = 0; for (const c of String(s)) w += widthFn ? widthFn(c) : 0.52; return w * px; };

  /** Greedy wrap, like PowerPoint: as many words per line as fit. */
  const wrap = (text, px, width) => {
    const lines = []; let line = '';
    for (const word of String(text).split(/\s+/).filter(Boolean)) {
      const trial = `${line} ${word}`.trim();
      if (line && textWidth(trial, px) > width) { lines.push(line); line = word; } else line = trial;
    }
    return line ? [...lines, line] : lines;
  };

  const lineCount = (s, px, width) => String(s).split('\n').reduce((n, para) => n + Math.max(1, wrap(para, px, width).length), 0);

  /** CSS text-wrap: balance. Keep the greedy line count, find the narrowest width that still fits. */
  const balance = (text, px, width) => String(text).split('\n').map(para => {
    let lines = wrap(para, px, width);
    if (lines.length > 1) {
      let lo = Math.max(...para.split(/\s+/).filter(Boolean).map(w => textWidth(w, px))), hi = width;
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (wrap(para, px, mid).length <= lines.length) hi = mid; else lo = mid; }
      lines = wrap(para, px, hi);
    }
    return lines.length ? lines : [''];
  });

  return { textWidth, wrap, lineCount, balance, measured: !!widthFn };
}
