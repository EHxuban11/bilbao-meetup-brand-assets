// Live screens: 1920 × 1080 stills and in / loop / out clips, plus stream overlays.
// Each entry of `liveScreens()` is one deliverable (a still and a video folder).
// Layout numbers come from docs/layout-live-screens.md; motion from assets/motion/.
import event from '../../config/event.js';
import theme from '../../config/theme.js';
import { brandFont, shape, fitBox, speakerTracks, mirrorTrack, shiftLoop, logo, motion, retarget, pose, anchorFromPose, poseFrame } from '../lib/assets.mjs';

const { w: W, h: H } = theme.canvas;
const T = theme.type, C = theme.color, G = theme.grid, M = theme.margin;
const FPS = 30, fr = n => n / FPS;

// ---------- text ----------
// With the stand-in font, hero lines get a touch of negative tracking to match Universal Sans widths.
const STANDIN = !brandFont().licensed;
export const line = (text, role, x, y, color, extra = {}) => ({ type: 'line', text, size: T[role].size, line: T[role].line, x, y, color,
  tracking: STANDIN ? theme.font.standInTracking?.[role] : undefined, ...extra });

// Lines stacked downward from a first baseline; `in`/`out` are start times (s), staggered per line.
// Each line gets a `key` (e.g. header0, hero1, foot0) so measured timings can target it.
export function stack(lines, role, x, y0, colors, timing = {}, key = role) {
  return lines.map((t, i) => line(t, role, x, y0 + i * T[role].line, colors[i] ?? colors.at(-1), {
    key: `${key}${i}`,
    in: timing.in !== undefined ? timing.in + i * (timing.stagger ?? 0.067) : undefined,
    out: timing.out !== undefined ? timing.out + i * (timing.outStagger ?? 0) : undefined,
  }));
}
const header = (lines, colors, timing = { in: 0.11, out: 0 }) => stack(lines, 'display', M.side, G.headerBaseline, colors, timing, 'header');
const heroBlock = (lines, colors, t0 = 0.11) => stack(lines, 'hero', M.side, G.heroBaseline, colors, { in: t0, out: 0 }, 'hero');
const footBlock = (lines, colors, t0 = 0.6) => stack(lines, 'body', M.side, G.footBaseline - (lines.length - 1) * T.body.line, colors, { in: t0, out: 0.067 }, 'foot');

// Measured text timings (assets/motion/<preset>.json -> "text") override the defaults above,
// line by line, matched on `key`. Logos keyed "partners" fade in on the same clock.
function applyTiming(els, preset) {
  const tm = preset && motion(preset)?.text;
  if (!tm) return els;
  for (const e of els) {
    if (!e?.key) continue;
    const i = tm.in?.starts?.[e.key], o = tm.out?.starts?.[e.key];
    if (e.type === 'line') {
      if (i !== undefined) Object.assign(e, { in: i, inDur: tm.in.dur, inEase: tm.in.ease, travel: tm.in.travel ?? e.travel });
      if (o !== undefined) Object.assign(e, { out: o, outDur: tm.out.dur, outEase: tm.out.ease });
    } else if (e.type === 'svg') {
      e.fade = { ...(e.fade || {}),
        ...(i !== undefined && { in: { start: i, dur: tm.in.dur, ease: tm.in.ease, from: 0, to: 1 } }),
        ...(o !== undefined && { out: { start: o, dur: tm.out.dur, ease: tm.out.ease, from: 1, to: 0 } }) };
    }
  }
  return els;
}

// ---------- logos ----------
export function logoEl(file, box, color, extra = {}) {
  const L = logo(file);
  if (!L) return null;
  const { x, y } = box;
  const h = box.h ?? box.w / L.aspect, w = box.w ?? h * L.aspect;
  return { type: 'svg', x: box.right !== undefined ? box.right - w : x, y, w, h, viewBox: L.viewBox, markup: L.markup, color, ...extra };
}
// SpaceXAI wordmark top-right (the "-logo" versions): right edge on the margin, top on the margin, 27.92 px tall.
// It holds still through the in and the loop and fades during the last frames of the out.
function brandMark(clips, preset) {
  const outEnd = fr(clips.out ?? 42);
  const lf = preset && motion(preset)?.text?.logoFade;
  const out = lf ? { start: lf.start, dur: lf.dur, ease: lf.ease, from: 1, to: 0 } : { start: outEnd - 0.4, dur: 0.233, from: 1, to: 0 };
  const el = logoEl(event.brandLogo, { right: W - M.side, y: M.top, h: 27.92 }, C.white, { fade: clips.out ? { out } : undefined });
  return el ? [el] : [];
}

// Row of partner logos on one baseline with 64 px gaps (22-agenda-partners, social posts).
// `k` scales the row; each partner's rowHeight/rowBaseline come from config/event.js.
export function partnerRow(x0, baseline, k = 1, gap = 64, extra = {}) {
  const out = []; let x = x0;
  for (const p of event.partners) {
    const L = logo(p.logo); if (!L) continue;
    const h = p.rowHeight * k, w = h * L.aspect;
    out.push({ type: 'svg', x, y: baseline - p.rowBaseline * h, w, h, viewBox: L.viewBox, markup: L.markup, color: C.white, ...extra });
    x += w + gap; // gaps stay 64 px whatever the logo scale (measured on Story Partners)
  }
  return out;
}

// ---------- bots ----------
const DEFAULT_CLIPS = { in: 90, loop: 480, out: 42 };

// A bot placed on a screen. `poseId` is its fitted pose on the designer's still; `preset` its
// captured motion (assets/motion/<preset>.json). The anchor is solved so that the motion's still
// frame lands exactly on the fitted pose; config can override it with `anchor: {x, y, rot, scale}`.
export function screenBot({ spec, poseId, preset, stillKey, botIndex, override, clips = DEFAULT_CLIPS }) {
  const P = poseId ? pose(poseId) : null;
  const m = preset ? motion(preset) : null;
  const byColour = () => m.bots?.find(b => b.shape === spec.shape && b.color?.toLowerCase() === spec.color.toLowerCase()) ?? m.bots?.[botIndex];
  const cap = m ? (botIndex !== undefined ? byColour() : (m.shapes?.[spec.shape] || (m.shapes && Object.values(m.shapes)[0]))) : null;
  const sameShape = P && P.shape === spec.shape;
  let tracks, still, anchor, lengths;
  if (cap) {
    const srcShape = cap.shape || (m.shapes?.[spec.shape] ? spec.shape : Object.keys(m.shapes)[0]);
    tracks = srcShape === spec.shape ? cap.clips : Object.fromEntries(Object.entries(cap.clips).map(([k, v]) => [k, retarget(v, srcShape, spec.shape)]));
    const st = m.stills?.[stillKey] || Object.values(m.stills || {})[0] || { clip: 'loop', frame: 0 };
    const f = tracks[st.clip][st.frame];
    anchor = override || (P ? anchorFromPose(P, f) : { x: cap.anchor.cx, y: cap.anchor.cy, rot: cap.anchor.rot || 0, scale: cap.anchor.scale || 1 });
    still = { b: f.b, e: sameShape && !override ? P.eyes : f.e };
    lengths = Object.fromEntries(Object.entries(tracks).map(([k, v]) => [k, v.length]));
  } else {
    // no capture yet: hold the fitted pose
    const f = P ? { b: [0, 0, 0, 1], e: sameShape ? P.eyes : neutralEyes(spec.shape) } : { b: [0, 0, 0, 1], e: neutralEyes(spec.shape) };
    anchor = override || (P ? { x: P.x, y: P.y, rot: P.rot, scale: P.scale } : fitBox(spec.shape, G.botBox));
    tracks = { in: [f], loop: [f], out: [f] }; still = f; lengths = clips;
  }
  return { el: { type: 'bot', shape: spec.shape, path: shape(spec.shape).path, color: spec.color, anchor, flip: !!P?.flip, track: tracks, still }, lengths };
}
const neutralEyes = name => shape(name).face.map(e => [e.x, e.y, e.w, e.h, e.a || 0]);

// ---------- screens ----------
function speakerScreen(key, { qa = false } = {}) {
  const sp = event.speakers[key];
  let tracks = speakerTracks(sp.bot.shape);
  if (qa) tracks = { in: mirrorTrack(tracks.in), loop: shiftLoop(tracks.loop, 240), out: mirrorTrack(tracks.out) };
  const anchor = sp.anchor || fitBox(sp.bot.shape, G.botBox);

  // bottom-anchored block: the talk lines end on the foot baseline
  const foot = qa ? [sp.name] : sp.talk;
  const footFirst = G.footBaseline - (foot.length - 1) * T.body.line;
  const company = footFirst - 99, name = company - T.hero.line, time = name - 136;
  const titles = qa ? [...event.screens.qa.title, ...event.screens.qa.subtitle] : [sp.name, sp.company];

  const els = [
    { type: 'bot', shape: sp.bot.shape, path: shape(sp.bot.shape).path, color: sp.bot.color, anchor, track: tracks, still: tracks.loop[36] },
    ...header(event.name, [C.white]),
    line(sp.time, 'display', M.side, time, C.red, { key: 'time', in: 0.36, out: 0.067 }),
    line(titles[0], 'hero', M.side, name, C.white, { key: 'name', in: 0.51, out: 0.067 }),
    line(titles[1], 'hero', M.side, company, C.grey, { key: 'company', in: 0.61, out: 0.067 }),
  ];
  if (qa) els.push(line(null, 'body', M.side, G.footBaseline, C.white, { key: 'foot0', spans: [{ text: sp.name, color: C.white }, { text: ` · ${sp.company}`, color: C.grey }], in: 0.91, out: 0.067 }));
  else els.push(...stack(sp.talk, 'body', M.side, footFirst, [C.white], { in: 0.91, out: 0.067 }, 'talk'));
  const preset = qa ? 'qa' : 'speaker';
  return { els: applyTiming(els, preset), clips: { in: tracks.in.length, loop: tracks.loop.length, out: tracks.out.length }, preset };
}

function singleBot(key, poseId, text, { preset = key, stillKey = key, clips } = {}) {
  const spec = event.screens[key].bot;
  const b = screenBot({ spec, poseId, preset, stillKey, override: event.screens[key].anchor, clips });
  return { els: [b.el, ...applyTiming(text, preset)], clips: b.lengths, preset };
}

function agendaRows(t0 = 0.3) {
  const rows = []; let y = 128, k = 0;
  for (const item of event.agenda) {
    const sp = item.speaker ? event.speakers[item.speaker] : null;
    const title = sp ? sp.name : item.title;
    const lines = sp ? [sp.company, ...sp.talk] : item.lines;
    const start = t0 + k * 0.1;
    rows.push(line(item.time, 'agenda', G.rightColumn, y, C.red, { key: `row${k}`, in: start, out: 0.067 }));
    rows.push(line(title, 'agenda', G.agendaText, y, C.white, { key: `row${k}`, in: start, out: 0.067 }));
    lines.forEach((l, i) => rows.push(line(l, 'agenda', G.agendaText, y + (i + 1) * T.agenda.line, C.grey, { key: `row${k}.detail${i}`, in: start + 0.05 * (i + 1), out: 0.067 })));
    y += (lines.length + 1) * T.agenda.line + 18; k++;
  }
  return rows;
}

const PRESHOW_CLIPS = { in: 72, loop: 600, out: 42 };
const SCREENS = {
  preshow: withLogo => singleBot('preshow', withLogo ? '01-preshow-logo' : '01-preshow', [
    ...header([...event.name, event.date], [C.white, C.white, C.grey]),
    ...footBlock([event.screens.preshow.note], [C.grey]),
  ], { clips: PRESHOW_CLIPS, stillKey: withLogo ? 'preshow-logo' : 'preshow' }),
  welcome: () => singleBot('welcome', '02-welcome', [
    ...heroBlock([...event.screens.welcome.title, ...event.screens.welcome.subtitle], [C.white, C.grey]),
    ...footBlock([event.nameOneLine, event.date], [C.white, C.grey]),
  ]),
  agenda: () => singleBot('agenda', '03-agenda', [
    ...header([...event.name, event.date], [C.white, C.white, C.grey]),
    ...agendaRows(),
  ]),
  agendaPartners: () => singleBot('agenda', '22-agenda-partners', [
    ...header([...event.name, event.date], [C.white, C.white, C.grey]),
    ...agendaRows(),
    ...partnerRow(M.side, 963, 1, 64, { key: 'partners', fade: { in: { start: 0.9, dur: 0.4, from: 0, to: 1, ease: 'cubicOut' }, out: { start: 0, dur: 0.3, from: 1, to: 0 } } }),
  ], { preset: 'agenda-partners', stillKey: 'agenda-partners' }),
  thanks: withLogo => {
    const s = singleBot('thanks', '11-thanks', [
      ...heroBlock([...event.screens.thanks.title, ...event.screens.thanks.subtitle], [C.white, C.grey]),
      ...footBlock([event.nameOneLine, event.date], [C.white, C.grey]),
    ]);
    // the clean "Gracias" carries the classic SpaceX wordmark (the -logo version swaps in SpaceXAI)
    if (!withLogo) { const e = brandMark(s.clips, 'thanks')[0]; const h = logoEl(event.hostLogo, { right: 1839.8, y: 100.62, h: 22.7 }, C.spacex, { fade: e?.fade }); if (h) s.els.push(h); }
    return s;
  },
  brb: () => singleBot('brb', '12-brb', [
    ...heroBlock(event.screens.brb.title, [C.white, C.white]),
    ...footBlock([event.nameOneLine], [C.white]),
  ]),
  networking: () => {
    const bots = event.networkingBots.map((spec, i) => screenBot({ spec, poseId: `10-networking/${i}`, preset: 'networking', stillKey: 'networking', botIndex: i }));
    // back to front: the green square sits over the blue round
    const order = [3, 1, 2, 0, 4, 5];
    const text = heroBlock([...event.screens.networking.title, ...event.screens.networking.subtitle], [C.white, C.white, C.grey]);
    return { els: [...order.map(i => bots[i].el), ...applyTiming(text, 'networking')], clips: bots[0].lengths, preset: 'networking' };
  },
};

// ---------- overlays (alpha) ----------
// Lower third: black pill on the bottom-left margin, speaker icon in the left cap, name + details.
function lowerThird(key) {
  const sp = event.speakers[key];
  const detail = sp.lowerThird || [`${sp.company} · ${sp.talk[0]}`, ...sp.talk.slice(1)];
  const rows = 1 + detail.length, h = rows === 2 ? 128 : 128 + (rows - 2) * 36;
  const top = 990 - h, nameY = top + (rows === 2 ? 59 : 58);
  const m = motion('lower-third'), tm = m?.timing;
  const tIn = tm?.text.in, tOut = tm?.text.out;
  const ids = ['lt-name', ...detail.map((_, i) => `lt-d${i}`)];
  const els = [
    { type: 'rect', id: 'lt-pill', x: M.side, y: top, h, r: 36, fill: C.black, fitText: { ids, padRight: 45 },
      grow: tm && { in: { start: fr(tm.pill.in.t0), dur: fr(tm.pill.in.dur), ease: tm.pill.in.ease, from: 0, to: 1 },
                    out: { start: fr(tm.pill.out.t0), dur: fr(tm.pill.out.dur), ease: tm.pill.out.ease, from: 1, to: 0 } } },
    line(sp.name, 'body', 212, nameY, C.white, { id: 'lt-name', travel: 40,
      in: tIn && fr(tIn.starts.name), inDur: tIn && fr(tIn.dur), inEase: tIn?.ease,
      out: tOut && fr(tOut.starts.name), outDur: tOut && fr(tOut.dur), outEase: tOut?.ease }),
    ...detail.map((d, i) => line(d, 'small', 212, nameY + 40 + i * T.small.line, C.grey, { id: `lt-d${i}`, travel: 38,
      in: tIn && fr(tIn.starts.detail + i * 1.75), inDur: tIn && fr(tIn.dur), inEase: tIn?.ease,
      out: tOut && fr(tOut.starts.detail + i * 1.75), outDur: tOut && fr(tOut.dur), outEase: tOut?.ease })),
  ];
  const poseId = { hugo: '13-lower-hugo', leire: '14-lower-leire', xuban: '15-lower-xuban' }[key];
  const b = screenBot({ spec: sp.lowerThirdBot, poseId, preset: 'lower-third', stillKey: 'lower', clips: { in: 48, loop: 480, out: 36 } });
  // The icon's pop (back-out in, swell and shrink out) is part of the captured track's scale.
  // Without a capture, animate it from the measured timing instead.
  const ic = tm?.icon;
  if (ic && !m?.shapes) b.el.pop = { in: { start: fr(ic.in.t0), dur: fr(ic.in.dur), ease: ic.in.ease, k: ic.in.overshoot, from: 0, to: 1 },
                                     out: { start: fr(ic.out.t0), dur: fr(ic.out.dur), ease: ic.out.ease, k: ic.out.overshoot, from: 1, to: 0 } };
  els.splice(1, 0, b.el);
  return { els, clips: tm ? tm.clips : b.lengths, background: 'transparent', formats: ['mov', 'webm'] };
}

// Stinger: one 1.6 s clip with alpha; the cut sits at 800 ms (frame 24), hidden by a blink.
// The clip is absolute (anchored at the screen centre); the still keeps the fitted pose.
function stinger(i) {
  const spec = event.stingers[i];
  const P = pose(`${16 + i}-stinger-${i + 1}`);
  const S = motion('stingers')?.stingers?.find(s => s.id === `stinger-${i + 1}`);
  const m = motion('stingers');
  const anchor = m ? { x: m.anchor.cx, y: m.anchor.cy, rot: 0, scale: 1 } : { x: 960, y: 540, rot: 0, scale: 1 };
  const clip = S && S.shape === spec.shape ? S.clip : S ? retarget(S.clip, S.shape, spec.shape) : [];
  // Stills: stinger 3 shows only a sliver of the bot, so the designer's still matches frame 4 of the
  // captured clip better than a silhouette fit (checked by diffing every frame against the still);
  // the others use the fitted pose, with the eyes exactly as fitted (some are off-screen or mid-blink).
  const STILL_FRAME = { 3: 4 };
  const still = STILL_FRAME[i + 1] !== undefined && clip[STILL_FRAME[i + 1]]
    ? clip[STILL_FRAME[i + 1]]
    : { b: [P.x - anchor.x, P.y - anchor.y, P.rot, P.scale], e: P.eyes };
  const el = { type: 'bot', shape: spec.shape, path: shape(spec.shape).path, color: spec.color, anchor, flip: !!P.flip, track: { main: clip }, still };
  return { els: [el], clips: { main: clip.length || 48 }, background: 'transparent', formats: ['mov', 'webm'] };
}

function logoBug() {
  const m = motion('logo-bug');
  const clips = m?.clips || { in: 18, loop: 306, out: 18 };
  const [el] = brandMark(clips);
  const f = m?.logo;
  if (el && f) el.fade = { in: f.in && { from: 0, to: 1, ...f.in }, out: f.out && { from: 1, to: 0, ...f.out } };
  return { els: el ? [el] : [], clips, background: 'transparent', formats: ['mov', 'webm'] };
}

// ---------- registry ----------
export function liveScreens() {
  const list = [];
  const pad = n => String(n).padStart(2, '0');
  const add = (id, fn, { variants = [false, true] } = {}) => {
    for (const withLogo of variants) list.push({
      id: withLogo ? `${id}-logo` : id, folder: withLogo ? `${id}-logo` : id,
      build() {
        const { els, clips, background = C.black, formats, preset } = fn(withLogo);
        const elements = withLogo ? [...els, ...brandMark(clips, preset)] : els;
        return { scene: { w: W, h: H, fps: FPS, background, elements }, clips, formats };
      },
    });
  };
  add('01-preshow', SCREENS.preshow);
  add('02-welcome', SCREENS.welcome);
  add('03-agenda', SCREENS.agenda);
  ['hugo', 'leire', 'xuban'].forEach((k, i) => {
    add(`${pad(4 + i * 2)}-speaker-${k}`, () => speakerScreen(k));
    add(`${pad(5 + i * 2)}-qa-${k}`, () => speakerScreen(k, { qa: true }));
  });
  add('10-networking', SCREENS.networking);
  add('11-thanks', SCREENS.thanks);
  add('12-brb', SCREENS.brb);
  ['hugo', 'leire', 'xuban'].forEach((k, i) => add(`${13 + i}-lower-${k}`, () => lowerThird(k), { variants: [false] }));
  event.stingers.forEach((_, i) => add(`${16 + i}-stinger-${i + 1}`, () => stinger(i), { variants: [false] }));
  add('21-logo-bug', logoBug, { variants: [false] });
  add('22-agenda-partners', SCREENS.agendaPartners);
  return list;
}
