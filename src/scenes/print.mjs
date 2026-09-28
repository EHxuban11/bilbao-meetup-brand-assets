// The 50 × 70 cm poster. Layout: docs/layout-social-print.md ("the screen system at 0.4 mm per px").
// The scene is drawn in 0.4 mm units, with the 3 mm bleed around it, then exported to a CMYK PDF.
import event from '../../config/event.js';
import theme from '../../config/theme.js';
import { shape, pose } from '../lib/assets.mjs';
import { qrGroup } from '../lib/qr.js';
import { line, logoEl } from './live.mjs';

const C = theme.color;
export const POSTER = { trimMm: [500, 700], bleedMm: 3, mmPerUnit: 0.4 };
const B = POSTER.bleedMm / POSTER.mmPerUnit;            // bleed in scene units (7.5)
const u = mm => mm / POSTER.mmPerUnit;                  // mm -> scene units
const X = mm => u(mm) + B, Y = mm => u(mm) + B;         // trim coordinates -> scene (with bleed)

function agenda() {
  // times at 30 mm, text at 106.8 mm (the screen's 192 px column gap); pitch 21.4 mm, rows +28.6 mm.
  // The designer set continuation lines of a talk title 19.0 mm under the line above; kept as he did.
  const out = []; let y = 183.0;
  for (const item of event.agenda) {
    const sp = item.speaker ? event.speakers[item.speaker] : null;
    const lines = [sp ? sp.name : item.title, ...(sp ? [sp.company, ...sp.talk] : item.lines)];
    out.push(line(item.time, 'agenda', X(30), Y(y), C.red));
    let ly = y;
    lines.forEach((l, i) => {
      if (i) ly += sp && i >= 3 ? 19.0 : 21.4;
      out.push(line(l, 'agenda', X(106.8), Y(ly), i ? C.grey : C.white));
    });
    y = ly + 28.6;
  }
  return out;
}

export function posterScene() {
  const w = u(POSTER.trimMm[0]) + 2 * B, h = u(POSTER.trimMm[1]) + 2 * B;
  const P = pose('social/story'); // the poster reuses the story's bot pose and face
  const bot = { type: 'bot', shape: 'triangle', path: shape('triangle').path, color: event.screens.agenda.bot.color,
    anchor: { x: X(383.55), y: Y(176.92), rot: 10.02, scale: 0.4904 }, flip: true, still: { b: [0, 0, 0, 1], e: P.eyes }, track: {} };
  const pillText = line(event.url, 'small', X(40.3) - 1, Y(662.2), C.black, { id: 'pill-text' });
  const els = [
    bot,
    line(event.poster.title[0], 'display', X(30), Y(54.2), C.white),
    line(event.poster.title[1], 'display', X(30), Y(84.6), C.white),
    line(event.date, 'display', X(30), Y(115.0), C.grey),
    logoEl(event.brandLogo, { x: X(277.3), y: Y(28.2), h: u(23.6) }, C.white),
    ...agenda(),
    // partner row: its own proportions on the poster, 21.6 mm gaps
    logoEl(event.partners[0].logo, { x: X(30.0), y: Y(546.93), h: u(20.98) }, C.white),
    logoEl(event.partners[1].logo, { x: X(108.45), y: Y(549.04), h: u(17.93) }, C.white),
    logoEl(event.partners[2].logo, { x: X(218.04), y: Y(551.65), h: u(12.69) }, C.white),
    line(event.poster.closing, 'display', X(30), Y(629.2), C.white),
    { type: 'rect', x: X(30), y: Y(645.2), h: u(24.8), r: u(12.4), fill: C.white, fitText: { ids: ['pill-text'], pad: u(10.3) } },
    pillText,
    { type: 'raw', markup: qrGroup(event.url, { x: X(338), y: Y(538), size: u(132), dark: C.black, light: C.white }) },
  ];
  return { w, h, fps: 30, background: C.black, elements: els.filter(Boolean) };
}
