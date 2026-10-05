// Social posts (stills). Layout numbers: docs/layout-social-print.md.
// Social margins are 80 px on every side; the agenda block is the screen agenda.
import event from '../../config/event.js';
import theme from '../../config/theme.js';
import { shape, pose } from '../lib/assets.mjs';
import { line, logoEl, partnerRow, screenBot } from './live.mjs';

const T = theme.type, C = theme.color;
const WORDMARK = { w: 407.96, h: 49.79 };

// Top-left block: "Grok Bot" / "Bilbao Meetup" 70 apart, the grey date 76 below.
const header = (x, y) => [
  line(event.name[0], 'display', x, y, C.white),
  line(event.name[1], 'display', x, y + 70, C.white),
  line(event.date, 'display', x, y + 146, C.grey),
];

// The agenda rows (times red, first line white, details grey; pitch 54, rows 18 apart).
// The designer's agenda is 14 lines tall; when the copy runs shorter, the missing height is
// spread over the gaps between rows so the block still ends where it did.
const AGENDA_LINES = 14;
function agenda(timeX, textX, y0) {
  const out = []; let y = y0;
  const rows = event.agenda.map(item => {
    const sp = item.speaker ? event.speakers[item.speaker] : null;
    return { time: item.time, lines: [sp ? sp.name : item.title, ...(sp ? [sp.company, ...sp.talk] : item.lines)] };
  });
  const total = rows.reduce((n, r) => n + r.lines.length, 0);
  const gap = 18 + Math.max(0, AGENDA_LINES - total) * T.agenda.line / Math.max(1, rows.length - 1);
  for (const { time, lines } of rows) {
    out.push(line(time, 'agenda', timeX, y, C.red));
    lines.forEach((l, i) => out.push(line(l, 'agenda', textX, y + i * T.agenda.line, i ? C.grey : C.white)));
    y += lines.length * T.agenda.line + gap;
  }
  return out;
}

// White link pill with the URL and a ↗ arrow; right and bottom edges on the margins.
const linkPill = (x0, x1, y) => [
  { type: 'rect', x: x0, y, w: x1 - x0, h: 62, r: 31, fill: C.white },
  line(event.url, 'small', x0 + 24, y + 42, C.black),
  { type: 'arrow', x: x1 - 39, y: y + 22, s: 18, color: C.black, stroke: 3 },
];
// "LINK INSTAGRAM": a placeholder for Instagram's link sticker, centred.
const instaPill = (cx, y) => [
  { type: 'rect', x: cx, y, h: 62, r: 31, fill: C.white, fitText: { ids: ['insta'], pad: 26, center: cx } },
  line('LINK INSTAGRAM', 'small', cx, y + 42, C.black, { id: 'insta', anchor: 'middle' }),
];

const wordmark = (x, y) => logoEl(event.brandLogo, { x, y, h: WORDMARK.h }, C.white);

function bot(poseId, spec) {
  const P = pose(poseId);
  const s = spec || { shape: P.shape, color: P.color };
  const eyes = s.shape === P.shape ? P.eyes : shape(s.shape).face.map(e => [e.x, e.y, e.w, e.h, e.a || 0]);
  const fr = { b: [0, 0, 0, 1], e: eyes };
  return { type: 'bot', shape: s.shape, path: shape(s.shape).path, color: s.color, anchor: { x: P.x, y: P.y, rot: P.rot, scale: P.scale }, flip: P.flip, still: fr, track: {} };
}

// Partner logos stacked with captions ("Con el apoyo de" / "Nos acoge").
// slots: [partnerIndex, x, y, h] per logo; captions: [text, baseline].
function partnerStack(x, slots, captions) {
  const els = captions.map(([text, y]) => line(text, 'body', x, y, C.grey));
  for (const [i, lx, ly, h] of slots) { const p = event.partners[i]; els.push(logoEl(p.logo, { x: lx, y: ly, h }, C.white)); }
  return els;
}
const support = event.partnerCopy.support, venue = event.partnerCopy.venue;

const POSTS = {
  'horizontal': () => ({ w: 1920, h: 1080, els: [
    bot('social/horizontal', event.social?.agendaBot), ...header(80, 128), ...agenda(964, 1156, 118),
    wordmark(81.02, 950.12), ...linkPill(954, 1840, 938)] }),
  'horizontal-partners': () => ({ w: 1920, h: 1080, els: [
    bot('social/horizontal-partners', event.social?.agendaBot), ...header(80, 128), ...agenda(964, 1156, 118),
    ...partnerRow(80, 880), wordmark(81.02, 950.12), ...linkPill(954, 1840, 938)] }),
  'story': () => ({ w: 1080, h: 1920, els: [
    bot('social/story', event.social?.agendaBot), ...header(80, 308), ...agenda(80, 272, 707),
    ...instaPill(540, 1552), wordmark(336.02, 1674.12)] }),
  'story-partners': () => ({ w: 1080, h: 1920, els: [
    bot('social/story-partners', event.social?.agendaBot), ...header(80, 248), ...agenda(80, 272, 647),
    ...instaPill(540, 1487), wordmark(336.02, 1592.12), ...centredRow(1760, 1.119, 1080)] }),
  'partners-feed': () => ({ w: 1080, h: 1350, els: [
    bot('social/partners-feed', event.social?.partnersBot), ...header(80, 128),
    ...partnerStack(80, [[0, 80.06, 635.92, 133.14], [1, 79.98, 829.97, 78.03], [2, 79.99, 1055.97, 57.13]], [[support, 598], [venue, 1018]]),
    wordmark(81.02, 1210.12)] }),
  'partners-story': () => ({ w: 1080, h: 1920, els: [
    bot('social/partners-story', event.social?.partnersBot), ...header(80, 308),
    ...partnerStack(80, [[0, 80.06, 875.92, 133.14], [1, 79.98, 1069.97, 78.03], [2, 79.99, 1295.97, 57.13]], [[support, 838], [venue, 1258]]),
    ...instaPill(540, 1498), wordmark(336.03, 1620.13)] }),
  'partners-horizontal': () => ({ w: 1920, h: 1080, els: [
    bot('social/partners-horizontal', event.social?.partnersBot), ...header(80, 128),
    ...partnerStack(964, [[0, 963.95, 163.22, 166.39], [1, 964, 405.66, 97.57], [2, 964, 657.72, 71.49]], [[support, 118], [venue, 613]]),
    wordmark(81.02, 950.12), ...linkPill(954, 1840, 938)] }),
};

// A partner row centred on the canvas.
function centredRow(baseline, k, width) {
  const row = partnerRow(0, baseline, k);
  const right = Math.max(...row.map(e => e.x + e.w));
  const dx = (width - right) / 2;
  return row.map(e => ({ ...e, x: e.x + dx }));
}

// File names follow the designer's delivery.
const FILES = {
  'horizontal': ['SpaceXAI Bilbao Horizontal', [1, 2]],
  'story': ['SpaceXAI Bilbao Story', [1, 2]],
  'horizontal-partners': ['SpaceXAI Bilbao Horizontal Partners', [1]],
  'story-partners': ['SpaceXAI Bilbao Story Partners', [1]],
  'partners-feed': ['SpaceXAI Bilbao Partners Feed', [1]],
  'partners-story': ['SpaceXAI Bilbao Partners Story', [1]],
  'partners-horizontal': ['SpaceXAI Bilbao Partners Horizontal', [1]],
};

export function socialPosts() {
  const list = [];
  for (const [key, [file, scales]] of Object.entries(FILES)) for (const scale of scales) {
    const name = scale === 1 ? file : `${file}@${scale}x`;
    list.push({
      id: `social/${key}${scale === 1 ? '' : `@${scale}x`}`, file: name, scale, ref: `reference/social/${name}.png`,
      build() { const { w, h, els } = POSTS[key](); return { scene: { w, h, fps: 30, background: C.black, elements: els.filter(Boolean) } }; },
    });
  }
  return list;
}

// Animated versions of the posts: the layout above with the bot driven by a captured screen
// motion (the agenda choreography), anchored so its still frame lands on the post's fitted pose.
const VIDEOS = {
  'horizontal-partners': event.social?.agendaBot,
  'horizontal': event.social?.agendaBot,
  'partners-feed': event.social?.partnersBot,
};
export function socialVideos() {
  return Object.entries(VIDEOS).map(([key, spec]) => ({
    id: `social-${key}`, folder: `social-${key}`,
    build() {
      const { w, h, els } = POSTS[key]();
      const P = pose(`social/${key}`);
      const b = screenBot({ spec: spec || { shape: P.shape, color: P.color }, poseId: `social/${key}`, preset: 'agenda', stillKey: 'agenda' });
      const elements = [b.el, ...els.slice(1)].filter(Boolean);
      return { scene: { w, h, fps: 30, background: C.black, elements }, clips: b.lengths };
    },
  }));
}
