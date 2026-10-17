// Build every screen that runs the "speaker program" (same choreography, different bot/anchor):
//   speaker.json  (speaker screens; shapes square/cloud/round captured, triangle/drop retargeted)
//   qa.json       (Q&A: mirrored program = loop shifted by 240 frames)
//   welcome.json, agenda.json, brb.json, thanks.json
//
// Facts used (verified on captures, see docs/motion-spec.md):
//   in[i]  = loop[390 + i] + (0, rise[i])        rise scales with the gap bot-top -> screen bottom
//   out    = own clip (blink, recentre, back-in sink); sink scales with the same gap
//   mirrored screens: loop' = loop shifted by 240, in'[i] = loop[150 + i] + (0, rise[i]), out' = mirror(out)
//   stills = frame 36 of the screen's loop (i.e. frame 276 of the unshifted loop when mirrored)
import { readFileSync, writeFileSync } from 'node:fs';
import { retargetClip, faceOf, gapOf } from './motion-retarget.mjs';
import { mirror } from './normalise-track.mjs';

const r2 = v => Math.round(v * 100) / 100;
const M = 'tools/scratch/motion';
const SP = JSON.parse(readFileSync(`${M}/speaker-captured.json`, 'utf8')); // raw per-shape captures (tools/motion-build-speaker.mjs)
const load = n => JSON.parse(readFileSync(`assets/bots/${n}.json`, 'utf8'));

// ---- shapes in their upright (neutral) orientation ---------------------------------------------
function pathPoints(d) { // sample potrace-style absolute M/C/L paths
  const tok = d.match(/[MCLZ]|-?\d+(?:\.\d+)?/g); const pts = []; let i = 0, cur = [0, 0], cmd = '';
  while (i < tok.length) {
    if (/[MCLZ]/.test(tok[i])) { cmd = tok[i++]; if (cmd === 'Z') continue; }
    if (cmd === 'M' || cmd === 'L') { cur = [+tok[i], +tok[i + 1]]; i += 2; pts.push(cur); }
    else if (cmd === 'C') { const p = [cur, [+tok[i], +tok[i + 1]], [+tok[i + 2], +tok[i + 3]], [+tok[i + 4], +tok[i + 5]]]; i += 6;
      for (let k = 1; k <= 16; k++) { const t = k / 16, u = 1 - t; pts.push([0, 1].map(j => u * u * u * p[0][j] + 3 * u * u * t * p[1][j] + 3 * u * t * t * p[2][j] + t * t * t * p[3][j])); } cur = p[3]; }
    else i++;
  }
  return pts;
}
function upright(name, deg, face) {
  const s = load(name); const t = deg * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t);
  const pts = pathPoints(s.path).map(([x, y]) => [c * x - sn * y, sn * x + c * y]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { name, upright: deg, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(r2), face: face || s.face };
}
// triangle: canonical file is in the look pose; upright = +5.16 deg (stinger 4 and the 5.17 deg eye tilt).
// Neutral face measured on stinger-4 frame 2 (body s 1.0627): eyes +-106.0, 90.98, 114.3 x 294.5.
const SHAPES = {
  square: upright('square', 0), cloud: upright('cloud', 0), round: upright('round', 0), drop: upright('drop', 0),
  triangle: upright('triangle', 5.16, [{ x: -106.0, y: 90.98, w: 114.3, h: 294.5 }, { x: 106.0, y: 90.98, w: 114.3, h: 294.5 }]),
};

// ---- helpers -------------------------------------------------------------------------------------
// eyes: upright-local -> canonical body-local (rotate by -anchor.rot, which includes the upright angle)
const toCanonical = (frames, rot) => (rot ? frames.map(f => f && {
  b: f.b, e: f.e.map(([x, y, w, h, a]) => { const t = -rot * Math.PI / 180; return [r2(Math.cos(t) * x - Math.sin(t) * y), r2(Math.sin(t) * x + Math.cos(t) * y), w, h, r2(a - rot)]; }),
}) : frames);
const shift = (loop, k) => loop.map((_, i) => loop[(i + k) % loop.length]);

// source program for a target shape: its own capture if we have one, else the square's
function source(shape) {
  const own = SP.shapes[shape] && ['square', 'cloud', 'round'].includes(shape);
  const n = own ? shape : 'square';
  return { name: n, shape: SHAPES[n], anchor: { cx: SP.shapes[n].anchor.cx, cy: SP.shapes[n].anchor.cy, scale: 1 }, clips: SP.shapes[n].clips };
}

// Build the three clips for a shape at an anchor (upright-local eyes), optionally mirrored.
function program(shape, anchor, mirrored) {
  const src = source(shape), tgt = { shape: SHAPES[shape], anchor };
  const kG = gapOf(tgt.shape, anchor) / gapOf(src.shape, src.anchor);
  const loop = retargetClip(src.clips.loop, 'loop', src, tgt);
  const out = retargetClip(src.clips.out, 'out', src, tgt);
  const base = mirrored ? 150 : 390;
  const inn = src.clips.in.map((f, i) => {
    if (!f) return null;
    const L = src.clips.loop[(390 + i) % 480];
    const rise = (f.b[1] - L.b[1]) * kG;
    const T = loop[(base + i) % 480];
    return { b: [T.b[0], r2(T.b[1] + rise), T.b[2], T.b[3]], e: T.e };
  });
  return mirrored ? { in: inn, loop: shift(loop, 240), out: mirror(out) } : { in: inn, loop, out };
}

// Measured rise (reel captures): replace the retargeted rise where the reel shows the bot.
// rise_px(i) = measured body y - rise-free prediction; before the first reliable frame the bot
// is extended backward with a spring from fully below the screen; after frame 48 taper to 0.
function applyMeasuredRise(clips, shape, anchor, mirrored, rawFile, riseFrom = 'body', seg = 14) {
  const raw = JSON.parse(readFileSync(rawFile, 'utf8')).frames;
  const base = mirrored ? 150 : 390;
  const loopUnshifted = mirrored ? shift(clips.loop, 240) : clips.loop; // back to unshifted indexing
  const riseFree = i => loopUnshifted[(base + i) % 480];
  const meas = [];
  // eyes are the robust signal (body registration on the reel can slip); fall back to the body
  const eyeY = (f) => { const S = anchor.scale * f.b[3], t = (anchor.rot + f.b[2]) * Math.PI / 180;
    const y = anchor.cy + f.b[1] * anchor.scale; return f.e.reduce((a, e) => a + y + (Math.sin(t) * e[0] + Math.cos(t) * e[1]) * S, 0) / f.e.length; };
  for (let i = 0; i < 90; i++) { const r = raw[seg + i]; if (!r || r.x === undefined || i < 8) { meas.push(null); continue; }
    const re = (r.eyes || []).filter(e => e.w > 3 && e.h > 20);
    if (riseFrom === 'eyes' && re.length === 2) meas.push((re.reduce((a, e) => a + e.y, 0) / 2 - eyeY(riseFree(i))) / anchor.scale);
    else if ((r.vis ?? 1) >= 0.5) meas.push((r.y - (anchor.cy + riseFree(i).b[1] * anchor.scale)) / anchor.scale);
    else meas.push(null); }
  const med = meas.map((v, i) => { if (v === null) return null; const w = [meas[i - 1], v, meas[i + 1]].filter(x => x !== null && x !== undefined).sort((a, b) => a - b); return w[Math.floor(w.length / 2)]; });
  const first = med.findIndex(v => v !== null); if (first < 0) return clips;
  // backward spring extension from rest at D (bot top below the screen), matched at `first`
  const gapPx = 1080 - (anchor.cy + anchor.scale * SHAPES[shape].bbox[1]); const D = (gapPx + 60) / anchor.scale;
  const z = 0.86, w = 5.5, wd = w * Math.sqrt(1 - z * z);
  const spring = t => (t <= 0 ? D : D * Math.exp(-z * w * t) * (Math.cos(wd * t) + z * w / wd * Math.sin(wd * t)));
  let t0 = 0, best = 1e18; for (let t = -60; t <= first; t += 0.05) { const e = Math.abs(spring((first - t) / 30) - med[first]); if (e < best) { best = e; t0 = t; } }
  const rise = med.map((v, i) => (i < first ? spring((i - t0) / 30) : v === null ? 0 : i > 56 ? 0 : i > 48 ? v * (56 - i) / 8 : v));
  const inn = clips.in.map((f, i) => { const L = riseFree(i); const y = L.b[1] + rise[i];
    const topPx = anchor.cy + anchor.scale * (y + SHAPES[shape].bbox[1] * L.b[3]);
    return topPx >= 1080 ? null : { b: [L.b[0], r2(y), L.b[2], L.b[3]], e: L.e }; });
  return { ...clips, in: inn };
}

// Measured sink (thanks: the reel ends with its out clip, reel segment frames 141..182).
function applyMeasuredSink(clips, shape, anchor, rawFile, start) {
  const raw = JSON.parse(readFileSync(rawFile, 'utf8')).frames;
  const dy = clips.out.map((f, i) => { const r = raw[start + i]; return f && r && r.x !== undefined && (r.vis ?? 1) >= 0.2 ? (r.y - anchor.cy) / anchor.scale : null; });
  const last = dy.reduce((a, v, i) => (v !== null ? i : a), -1);
  if (last < 3) return clips;
  const v = dy[last] - dy[last - 1], acc = (dy[last] - dy[last - 1]) - (dy[last - 1] - dy[last - 2]);
  const out = clips.out.map((f, i) => {
    if (!f) return null;
    if (i < 12) return f; // blink + recentre: keep the program (sink not started)
    let y = dy[i]; if (y === null || i > last) { const k = i - last; y = dy[last] + v * k + 0.5 * Math.max(0, acc) * k * k; }
    const topPx = anchor.cy + anchor.scale * (y + SHAPES[shape].bbox[1] * f.b[3]);
    return topPx >= 1080 ? null : { b: [f.b[0], r2(y), f.b[2], f.b[3]], e: f.e };
  });
  return { ...clips, out };
}

// Anchor from a still: registration of the canonical shape on the still (tools/scratch/motion/stills)
// minus the track offset at the still frame.
function anchorFromStill(shape, stillName, mirrored, rotFromEyes) {
  const reg = JSON.parse(readFileSync(`${M}/stills/${stillName}.raw.json`, 'utf8')).frames[0];
  let rot = reg.rot;
  if (rotFromEyes) { const g = reg.eyes.filter(e => e.h > e.w && e.w > 3); rot = g.reduce((s, e) => s + e.a, 0) / g.length; }
  // provisional anchor (scale/pos) to evaluate the retargeted loop frame, then solve exactly
  let A = { cx: reg.x, cy: reg.y, scale: reg.s, rot: 0 };
  for (let it = 0; it < 3; it++) {
    const L = program(shape, A, mirrored).loop[36];
    const scale = reg.s / L.b[3];
    A = { cx: r2(reg.x - L.b[0] * scale), cy: r2(reg.y - L.b[1] * scale), scale: Math.round(scale * 10000) / 10000, rot: r2(rot - L.b[2]) };
  }
  return A;
}
// Layout rule for speaker screens: neutral bot contained in box [1040,210,1840,990], bottom-right.
function anchorFromBox(shape, box = [1040, 210, 1840, 990]) {
  const b = SHAPES[shape].bbox, sc = Math.min((box[2] - box[0]) / (b[2] - b[0]), (box[3] - box[1]) / (b[3] - b[1]));
  return { cx: r2(box[2] - sc * b[2]), cy: r2(box[3] - sc * b[3]), scale: Math.round(sc * 10000) / 10000, rot: SHAPES[shape].upright || 0 };
}

function write(preset, shapesSpec, notes, stills) {
  const out = { preset, fps: 30, shapes: {}, stills, notes };
  for (const [shape, { anchor, mirrored, how, reel, riseFrom }] of Object.entries(shapesSpec)) {
    let clips = program(shape, anchor, mirrored);
    if (reel) clips = applyMeasuredRise(clips, shape, anchor, mirrored, reel, riseFrom);
    if (reel && preset === 'thanks') clips = applyMeasuredSink(clips, shape, anchor, reel, 141);
    out.shapes[shape] = {
      anchor: { ...anchor, how },
      clips: { in: toCanonical(clips.in, anchor.rot), loop: toCanonical(clips.loop, anchor.rot), out: toCanonical(clips.out, anchor.rot) },
    };
  }
  writeFileSync(`assets/motion/${preset}.json`, JSON.stringify(out));
  console.log(`assets/motion/${preset}.json`, Object.entries(out.shapes).map(([k, v]) => `${k} @ (${v.anchor.cx}, ${v.anchor.cy}) rot ${v.anchor.rot} s ${v.anchor.scale}`).join('; '));
  return out;
}

const common = 'Speaker program: in 90 fr (3.0 s), loop 480 fr (16 s, seamless), out 42 fr (1.4 s). in[i] = loop[390+i] + vertical rise; the in ends on loop frame 479 and flows into loop frame 0; the out starts on loop frame 0. Anchor = neutral pose (eyes centred, vertical). anchor.rot/scale are relative to assets/bots/<shape>.json; b offsets are in canonical px (multiply by anchor.scale), eyes in canonical body px.';
const speakerAnchors = {};
for (const s of ['square', 'cloud', 'round']) speakerAnchors[s] = { cx: SP.shapes[s].anchor.cx, cy: SP.shapes[s].anchor.cy, scale: 1, rot: 0, how: `captured: speaker loop frame 90 (${{ square: 'hugo', cloud: 'leire', round: 'xuban' }[s]})` };
for (const s of ['triangle', 'drop']) speakerAnchors[s] = { ...anchorFromBox(s), how: 'layout rule: neutral bbox contained in [1040,210,1840,990], bottom-right aligned (the captured square/cloud/round anchors follow it within ~1 px)' };

write('speaker', Object.fromEntries(Object.entries(speakerAnchors).map(([s, a]) => [s, { anchor: a, mirrored: false, how: a.how }])),
  `${common} square/cloud/round: captured on Hugo/Leire/Xuban. triangle/drop: retargeted from the square (validated square->cloud/round: body 0.1-0.4 px, eyes 0.2-0.7 px rms). Still = loop frame 36 (look right).`,
  { speaker: { clip: 'loop', frame: 36 } });
write('qa', Object.fromEntries(Object.entries(speakerAnchors).map(([s, a]) => [s, { anchor: a, mirrored: true, how: a.how }])),
  `${common} Q&A = the speaker program mirrored: loop = speaker loop shifted by 240 frames, in = loop[150+i] + rise, out = mirror(speaker out). Same anchors as the speaker screens (verified on 05/07/09 stills: 0.2 px). Verified on the preview reel (Q&A in starts 9 frames after the stinger cut). Still = frame 36 of this loop (= speaker loop 276, look left).`,
  { qa: { clip: 'loop', frame: 36 } });
const screens = [
  // preset, shape, still, mirrored, rotFromEyes, stillFrame, anchorOverride, note
  ['welcome', 'triangle', 'welcome', false, false, 36, null, 'Welcome (02): red triangle, look right first. Anchor confirmed on the reel (eyes 0.8 px rms).'],
  ['agenda', 'triangle', 'agenda', true, false, 36, null, 'Agenda (03/22): triangle on the left at 0.73 scale, mirrored program (looks left first). Anchor confirmed on the reel (eyes 0.4 px rms).'],
  // BRB still is NOT frame 36: it is frame 18 of the mirrored loop. Anchor fitted on the reel eyes
  // (Q&A cloud program + (3.5, 3.2) px, scale 0.99; eyes 0.48 px rms), still frame 18 then fits 0.55 px.
  ['brb', 'cloud', 'brb', true, false, 18, { cx: r2(SP.shapes.cloud.anchor.cx + 3.5), cy: r2(SP.shapes.cloud.anchor.cy + 3.2), scale: 0.99, rot: 0 }, 'Be right back (12): blue cloud, mirrored program. The published still is loop frame 18 (not 36).'],
  ['thanks', 'round', 'thanks', false, true, 36, null, 'Gracias (11): orange round at 1.354, always cut by the bottom edge. Anchor confirmed on the reel (eyes 0.8 px rms). The out sink (from out frame 12) is measured: the reel ends with this out clip (reel frames 1359+90+36+1 ...).'],
];
for (const [preset, shape, still, mirrored, rfe, stillFrame, override, note] of screens) {
  const anchor = override || anchorFromStill(shape, still, mirrored, rfe);
  const how = override ? 'fitted on the preview reel (eyes), see note' : `from still reference/live-screens/stills/${{ welcome: '02-welcome', agenda: '03-agenda', brb: '12-brb', thanks: '11-thanks' }[still]}.png (canonical registered, minus loop frame 36 offset); confirmed on the reel`;
  write(preset, { [shape]: { anchor, mirrored, reel: `${M}/reel-${preset}.raw.json`, riseFrom: preset === 'brb' ? 'eyes' : 'body', how } },
    `${common} ${note} The in-clip rise is the one measured on the preview reel (frames >= 8; earlier frames extended with a spring from below the screen); the out sink is the speaker one scaled by the gap unless noted. Still = loop frame ${stillFrame} of this file.`, { [preset]: { clip: 'loop', frame: stillFrame } });
}
