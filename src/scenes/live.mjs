// Live screens: 1920 × 1080 stills and in → loop → out clips.
// Each entry of `liveScreens()` is one deliverable folder in out/live-screens/.
import event from '../../config/event.js';
import theme from '../../config/theme.js';
import { brandFont, shape, fitBox, speakerTracks, mirrorTrack, shiftLoop, logo, motion, retarget } from '../lib/assets.mjs';

const { w: W, h: H } = theme.canvas;
const T = theme.type, C = theme.color, G = theme.grid, M = theme.margin;

// ---------- building blocks ----------
// With the stand-in font, hero lines get a touch of negative tracking to match Universal Sans widths.
const STANDIN = !brandFont().licensed;
const line = (text, role, x, y, color, extra = {}) => ({ type: 'line', text, size: T[role].size, line: T[role].line, x, y, color,
  tracking: STANDIN ? theme.font.standInTracking?.[role] : undefined, ...extra });

// Stack lines downward from a first baseline.
function stack(lines, role, x, y0, colors, timing = {}) {
  return lines.map((t, i) => line(t, role, x, y0 + i * T[role].line, colors[i] ?? colors.at(-1), {
    in: timing.in !== undefined ? timing.in + i * (timing.stagger ?? 0.067) : undefined,
    out: timing.out !== undefined ? timing.out + i * (timing.outStagger ?? 0) : undefined,
  }));
}

function header(lines, colors, timing) {
  return stack(lines, 'display', M.side, G.headerBaseline, colors, timing);
}

// SpaceXAI wordmark top-right (the "-logo" versions). Holds still; fades at the end of the out.
function brandMark(outLen) {
  const L = logo(event.brandLogo);
  if (!L) return [];
  const h = 28, w = h * L.aspect;
  const end = outLen / 30;
  return [{ type: 'svg', x: W - M.side - w, y: M.top, w, h, viewBox: L.viewBox, markup: L.markup, color: C.white,
    fade: { out: { start: end - 0.4, dur: 0.233, from: 1, to: 0 } } }];
}

function bot(spec, anchor, tracks, stillClip, stillFrame, extra = {}) {
  const s = shape(spec.shape);
  return { type: 'bot', shape: spec.shape, path: s.path, color: spec.color, anchor, track: tracks,
    still: tracks[stillClip][stillFrame], ...extra };
}

// ---------- screens ----------
const CLIPS = { speaker: { in: 90, loop: 480, out: 42 } };

function speakerScreen(key, { qa = false } = {}) {
  const sp = event.speakers[key];
  const L = CLIPS.speaker;
  let tracks = speakerTracks(sp.bot.shape);
  if (qa) tracks = { in: mirrorTrack(tracks.in), loop: shiftLoop(tracks.loop, 240), out: mirrorTrack(tracks.out) };
  const anchor = fitBox(sp.bot.shape, G.botBox);

  // bottom-anchored block: talk lines end on the foot baseline
  const foot = qa ? [sp.name] : sp.talk;
  const footFirst = G.footBaseline - (foot.length - 1) * T.body.line;
  const company = footFirst - 99, name = company - T.hero.line, time = name - 136;
  const titleLines = qa ? event.screens.qa.title.concat(event.screens.qa.subtitle) : [sp.name, sp.company];

  const els = [
    bot(sp.bot, anchor, tracks, 'loop', 36),
    ...header(event.name, [C.white], { in: 0.11, out: 0 }),
    line(sp.time, 'display', M.side, time, C.red, { in: 0.36, out: 0.067 }),
    line(titleLines[0], 'hero', M.side, name, C.white, { in: 0.51, out: 0.067 }),
    line(titleLines[1], 'hero', M.side, company, C.grey, { in: 0.61, out: 0.067 }),
  ];
  if (qa) els.push(line(null, 'body', M.side, G.footBaseline, C.white, { spans: [{ text: sp.name, color: C.white }, { text: ` · ${sp.company}`, color: C.grey }], in: 0.91, out: 0.067 }));
  else els.push(...stack(sp.talk, 'body', M.side, footFirst, [C.white], { in: 0.91, out: 0.067 }));
  return { els, clips: L };
}

// Motion for a single-bot screen: the screen's own capture (assets/motion/<preset>.json)
// when it exists, otherwise the speaker motion for that shape.
function screenMotion(preset, shapeName) {
  const m = motion(preset);
  const entry = m?.shapes?.[shapeName] || (m?.shapes && Object.values(m.shapes)[0]);
  if (entry) {
    const src = m.shapes[shapeName] ? shapeName : Object.keys(m.shapes)[0];
    const clips = src === shapeName ? entry.clips : Object.fromEntries(Object.entries(entry.clips).map(([k, v]) => [k, retarget(v, src, shapeName)]));
    const st = m.stills?.[preset] || m.stills?.default || { clip: 'loop', frame: 0 };
    return { tracks: clips, still: st, lengths: { in: clips.in.length, loop: clips.loop.length, out: clips.out.length }, anchor: entry.screenAnchor };
  }
  const tracks = speakerTracks(shapeName);
  return { tracks, still: { clip: 'loop', frame: 36 }, lengths: CLIPS.speaker };
}

// Bot anchors for the fixed screens, fitted on the designer's stills (see docs/layout-live-screens.md).
// A screen can override with `anchor: {x, y, rot, scale}` in config/event.js.
const ANCHORS = {
  preshow: { box: [700, 150, 2030, 1330] },
  welcome: { box: [1012, 191, 1900, 1065] },
  agenda: { box: [95, 351, 760, 990], align: 'left bottom' },
  agendaPartners: { box: [87, 342, 700, 860], align: 'left bottom' },
  thanks: { box: [900, 190, 1780, 1250] },
  brb: { box: [1073, 345, 1864, 990] },
};
function anchorFor(key, shapeName) {
  const cfg = event.screens[key]?.anchor;
  if (cfg) return cfg;
  const a = ANCHORS[key];
  return fitBox(shapeName, a.box, { align: a.align || 'right bottom' });
}

function singleBotScreen(key, preset, botSpec, text, anchorKey = key) {
  const m = screenMotion(preset, botSpec.shape);
  const anchor = m.anchor || anchorFor(anchorKey, botSpec.shape);
  const b = { type: 'bot', shape: botSpec.shape, path: shape(botSpec.shape).path, color: botSpec.color, anchor, track: m.tracks, still: m.tracks[m.still.clip][m.still.frame] };
  return { els: [b, ...text], clips: m.lengths };
}

const heroBlock = (lines, colors, t0 = 0.11) => stack(lines, 'hero', M.side, G.heroBaseline, colors, { in: t0, out: 0 });
const footBlock = (lines, colors, t0 = 0.6) => stack(lines, 'body', M.side, G.footBaseline - (lines.length - 1) * T.body.line, colors, { in: t0, out: 0.067 });

function agendaRows(t0 = 0.3) {
  const rows = [];
  let y = 128, k = 0;
  for (const item of event.agenda) {
    const sp = item.speaker ? event.speakers[item.speaker] : null;
    const title = sp ? sp.name : item.title;
    const lines = sp ? [sp.company, ...sp.talk] : item.lines;
    const start = t0 + k * 0.1;
    rows.push(line(item.time, 'agenda', G.rightColumn, y, C.red, { in: start, out: 0.067 }));
    rows.push(line(title, 'agenda', G.agendaText, y, C.white, { in: start, out: 0.067 }));
    lines.forEach((l, i) => rows.push(line(l, 'agenda', G.agendaText, y + (i + 1) * T.agenda.line, C.grey, { in: start + 0.05 * (i + 1), out: 0.067 })));
    y += (lines.length + 1) * T.agenda.line + 18;
    k++;
  }
  return rows;
}

function partnerRow(y = 920, h = 62) {
  // Row of partner logos, bottom-left, as on 22-agenda-partners (placeholder until logos exist).
  const out = []; let x = M.side;
  for (const p of event.partners) {
    const L = logo(p.logo); if (!L) continue;
    const lh = p.rowHeight || 48, w = lh * L.aspect;
    out.push({ type: 'svg', x, y, w, h: lh, viewBox: L.viewBox, markup: L.markup, color: C.white, fade: { in: { start: 0.9, dur: 0.4, from: 0, to: 1, ease: 'cubicOut' } } });
    x += w + 48;
  }
  return out;
}

const SCREENS = {
  preshow: () => singleBotScreen('preshow', 'preshow', event.screens.preshow.bot, [
    ...header([...event.name, event.date], [C.white, C.white, C.grey], { in: 0.11, out: 0 }),
    ...footBlock([event.screens.preshow.note], [C.grey]),
  ]),
  welcome: () => singleBotScreen('welcome', 'welcome', event.screens.welcome.bot, [
    ...heroBlock([...event.screens.welcome.title, ...event.screens.welcome.subtitle], [C.white, C.grey]),
    ...footBlock([event.nameOneLine, event.date], [C.white, C.grey]),
  ]),
  agenda: () => singleBotScreen('agenda', 'agenda', event.screens.agenda.bot, [
    ...header([...event.name, event.date], [C.white, C.white, C.grey], { in: 0.11, out: 0 }),
    ...agendaRows(),
  ]),
  agendaPartners: () => singleBotScreen('agenda', 'agenda-partners', event.screens.agenda.bot, [
    ...header([...event.name, event.date], [C.white, C.white, C.grey], { in: 0.11, out: 0 }),
    ...agendaRows(),
    ...partnerRow(),
  ], 'agendaPartners'),
  thanks: withLogo => {
    const s = singleBotScreen('thanks', 'thanks', event.screens.thanks.bot, [
      ...heroBlock([...event.screens.thanks.title, ...event.screens.thanks.subtitle], [C.white, C.grey]),
      ...footBlock([event.nameOneLine, event.date], [C.white, C.grey]),
    ]);
    if (!withLogo) { // the clean "Gracias" carries the SpaceX wordmark instead
      const L = logo(event.hostLogo);
      if (L) { const h = 24, w = h * L.aspect; s.els.push({ type: 'svg', x: 1837 - w, y: 100, w, h, viewBox: L.viewBox, markup: L.markup, color: C.spacex, fade: { out: { start: 1.0, dur: 0.233, from: 1, to: 0 } } }); }
    }
    return s;
  },
  brb: () => singleBotScreen('brb', 'brb', event.screens.brb.bot, [
    ...heroBlock(event.screens.brb.title, [C.white, C.white]),
    ...footBlock([event.nameOneLine], [C.white]),
  ]),
};

// Registry: id -> builder. `logo` variants add the SpaceXAI wordmark.
export function liveScreens() {
  const list = [];
  const add = (id, folder, fn) => {
    for (const withLogo of [false, true]) {
      list.push({
        id: withLogo ? `${id}-logo` : id, folder: withLogo ? `${folder}-logo` : folder,
        build() {
          const { els, clips, background = C.black } = fn(withLogo);
          const elements = withLogo ? [...els, ...brandMark(clips.out)] : els;
          return { scene: { w: W, h: H, fps: 30, background, elements }, clips };
        },
      });
    }
  };
  add('01-preshow', '01-preshow', SCREENS.preshow);
  add('02-welcome', '02-welcome', SCREENS.welcome);
  add('03-agenda', '03-agenda', SCREENS.agenda);
  const order = ['hugo', 'leire', 'xuban'];
  order.forEach((k, i) => {
    const n = 4 + i * 2;
    add(`${String(n).padStart(2, '0')}-speaker-${k}`, `${String(n).padStart(2, '0')}-speaker-${k}`, () => speakerScreen(k));
    add(`${String(n + 1).padStart(2, '0')}-qa-${k}`, `${String(n + 1).padStart(2, '0')}-qa-${k}`, () => speakerScreen(k, { qa: true }));
  });
  add('10-networking', '10-networking', () => networkingScreen());
  add('11-thanks', '11-thanks', SCREENS.thanks);
  add('12-brb', '12-brb', SCREENS.brb);
  add('22-agenda-partners', '22-agenda-partners', SCREENS.agendaPartners);
  return list;
}

// Networking: six bots in a cluster, each with its own track when captured.
function networkingScreen() {
  const m = motion('networking');
  const text = heroBlock([...event.screens.networking.title, ...event.screens.networking.subtitle], [C.white, C.white, C.grey]);
  const bots = event.networkingBots.map((spec, i) => {
    const cap = m?.bots?.[i];
    const tracks = cap ? cap.clips : speakerTracks(spec.shape);
    const anchor = cap?.screenAnchor || NETWORK_ANCHORS[i];
    const st = m?.stills?.networking || { clip: 'loop', frame: 36 };
    return { type: 'bot', shape: spec.shape, path: shape(spec.shape).path, color: spec.color, anchor, track: tracks, still: tracks[st.clip][st.frame] };
  });
  const L = m ? { in: bots[0].track.in.length, loop: bots[0].track.loop.length, out: bots[0].track.out.length } : CLIPS.speaker;
  return { els: [...bots, ...text], clips: L };
}
// Provisional cluster anchors (body centroids measured on 10-networking.png); refined by fitting.
const NETWORK_ANCHORS = [
  { x: 1293, y: 277, rot: 0, scale: 0.42 },
  { x: 1092, y: 521, rot: 0, scale: 0.41 },
  { x: 1467, y: 534, rot: 0, scale: 0.44 },
  { x: 1004, y: 823, rot: 0, scale: 0.36 },
  { x: 1298, y: 803, rot: 0, scale: 0.46 },
  { x: 1659, y: 848, rot: 0, scale: 0.40 },
];
