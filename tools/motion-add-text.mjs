// Write the non-bot timing (text line reveals, logo fades) into assets/motion/*.json as data,
// and write assets/motion/logo-bug.json. Values measured with tools/motion-text-fit.mjs and
// tools/motion-region-level.mjs (see docs/motion-spec.md); "assumed" entries have no reference clip.
//
// text.in / text.out: { dur (s), ease, travel, starts: { <line key>: seconds from clip start } }
//   travel: 'line' = one line height of that line's type role (in: from +L to 0, out: 0 to -L),
//   the line is clipped to its own line box (mask).
// text.logoFade: fade of the brand logo (the "-logo" versions) during the OUT clip.
import { readFileSync, writeFileSync } from 'node:fs';

const IN = { dur: 1.0, ease: 'expoOut', travel: 'line' };
const OUT = { dur: 0.483, ease: 'cubicInOut', travel: 'line' };
const LOGO_FADE = { start: 1.033, dur: 0.3, ease: 'linear', note: 'measured on speaker-hugo-logo_3-out.mp4; the logo is static during in and loop' };

const TIMING = {
  speaker: {
    in: { ...IN, starts: { header0: 0.108, header1: 0.175, time: 0.358, name: 0.517, company: 0.633, talk0: 0.908, talk1: 0.933 },
      measured: 'speaker-hugo/xuban_1-in (1080p). 2-line talk (Xuban): name 0.525, company 0.625; talk1 about 1 frame after talk0' },
    out: { ...OUT, starts: { header0: 0.0, header1: 0.058, time: 0.108, name: 0.158, company: 0.2, talk0: 0.242, talk1: 0.283 },
      measured: 'speaker-hugo-logo_3-out (1080p); talk1 assumed (+0.042)' },
    logoFade: LOGO_FADE,
  },
  qa: {
    in: { ...IN, starts: { header0: 0.108, header1: 0.167, time: 0.358, hero0: 0.517, hero1: 0.633, foot0: 0.908 },
      measured: 'preview reel (Q&A Hugo). hero1 measured 0.683 on few samples; 0.633 kept = same slot as the speaker company line' },
    out: { ...OUT, starts: { header0: 0.0, header1: 0.058, time: 0.108, hero0: 0.158, hero1: 0.2, foot0: 0.242 }, measured: 'assumed = speaker out (same layout)' },
    logoFade: LOGO_FADE,
  },
  preshow: {
    in: { ...IN, starts: { header0: 0.108, header1: 0.183, header2: 0.25, foot0: 0.508 }, measured: 'preshow_1-in (1080p)' },
    out: { ...OUT, starts: { header0: 0.0, header1: 0.058, header2: 0.092, foot0: 0.15 }, measured: 'preshow_3-out (1080p)' },
    logoFade: { ...LOGO_FADE, note: 'assumed = speaker (preshow-logo out clip not available)' },
  },
  welcome: {
    in: { ...IN, starts: { hero0: 0.517, hero1: 0.625, foot0: 0.9, foot1: 0.933 }, measured: 'preview reel' },
    out: { ...OUT, starts: { hero0: 0.0, hero1: 0.04, foot0: 0.08, foot1: 0.12 }, measured: 'assumed (thanks pattern: ~0.04 s per line)' },
    logoFade: LOGO_FADE,
  },
  agenda: {
    in: { ...IN, starts: {
      header0: 0.108, header1: 0.175, header2: 0.258,
      'row0.time': 0.383, row0: 0.433, 'row0.detail0': 0.483,
      'row1.time': 0.525, row1: 0.575, 'row1.detail0': 0.625, 'row1.detail1': 0.675,
      'row2.time': 0.667, row2: 0.717, 'row2.detail0': 0.775, 'row2.detail1': 0.817,
      'row3.time': 0.808, row3: 0.858, 'row3.detail0': 0.917, 'row3.detail1': 0.958, 'row3.detail2': 1.008,
      'row4.time': 0.942, row4: 0.992, 'row4.detail0': 1.05,
      partners: 1.1,
    }, rule: 'row i: time = 0.383 + 0.142 i, title = time + 0.05, detail j = title + 0.05 (j + 1)',
      measured: 'preview reel (03 Agenda). partners (22 only) assumed: after the last row' },
    out: { ...OUT, starts: {
      header0: 0.0, header1: 0.04, header2: 0.08,
      'row0.time': 0.0, row0: 0.0, 'row0.detail0': 0.02,
      'row1.time': 0.05, row1: 0.05, 'row1.detail0': 0.07, 'row1.detail1': 0.09,
      'row2.time': 0.1, row2: 0.1, 'row2.detail0': 0.12, 'row2.detail1': 0.14,
      'row3.time': 0.15, row3: 0.15, 'row3.detail0': 0.17, 'row3.detail1': 0.19, 'row3.detail2': 0.21,
      'row4.time': 0.2, row4: 0.2, 'row4.detail0': 0.22,
      partners: 0.12,
    }, measured: 'assumed (no agenda out clip): header like other screens, rows 0.05 s apart, details +0.02' },
    logoFade: LOGO_FADE,
  },
  networking: {
    in: { ...IN, starts: { hero0: 0.517, hero1: 0.625, hero2: 0.742 }, measured: 'networking_1-in (1080p)' },
    out: { ...OUT, starts: { hero0: 0.0, hero1: 0.04, hero2: 0.08 }, measured: 'assumed (thanks pattern)' },
    logoFade: LOGO_FADE,
  },
  thanks: {
    in: { ...IN, starts: { hero0: 0.425, hero1: 0.525, foot0: 0.8, foot1: 0.833, wordmark: 1.21 },
      measured: 'preview reel. wordmark = the SpaceX wordmark of the clean version, revealed like a line (travel = its own height ~24 px)' },
    out: { ...OUT, starts: { hero0: 0.0, hero1: 0.008, foot0: 0.067, foot1: 0.108, wordmark: 0.033 }, measured: 'preview reel (the reel ends with this out clip)' },
    logoFade: { ...LOGO_FADE, note: 'the -logo version shows the SpaceXAI logo instead of the wordmark: static, then this fade' },
  },
  brb: {
    in: { ...IN, starts: { hero0: 0.417, hero1: 0.525, foot0: 0.808 }, measured: 'preview reel' },
    out: { ...OUT, starts: { hero0: 0.0, hero1: 0.04, foot0: 0.08 }, measured: 'assumed (thanks pattern)' },
    logoFade: LOGO_FADE,
  },
};

for (const [preset, text] of Object.entries(TIMING)) {
  const file = `assets/motion/${preset}.json`;
  const j = JSON.parse(readFileSync(file, 'utf8'));
  j.text = text;
  writeFileSync(file, JSON.stringify(j));
  console.log(file, 'text:', Object.keys(text.in.starts).length, 'in /', Object.keys(text.out.starts).length, 'out lines');
}

// lower third: add the same text object shape (values already in timing.text)
{
  const f = 'assets/motion/lower-third.json'; const j = JSON.parse(readFileSync(f, 'utf8'));
  j.text = {
    in: { dur: 0.983, ease: 'expoOut', travel: 'line', starts: { name: 0.433, detail0: 0.492, detail1: 0.525 }, measured: 'lower-leire_1-in (detail1 = 3-line Xuban pill, assumed +1 frame)' },
    out: { dur: 0.483, ease: 'cubicInOut', travel: 'line', starts: { name: 0.0, detail0: 0.058, detail1: 0.1 }, measured: 'lower-leire_3-out' },
  };
  writeFileSync(f, JSON.stringify(j)); console.log(f, 'text added');
}

// logo bug: SpaceXAI wordmark alone on alpha, top-right box x 1611-1835, y 90-117 (same place as on the -logo screens)
writeFileSync('assets/motion/logo-bug.json', JSON.stringify({
  preset: 'logo-bug', fps: 30,
  clips: { in: 24, loop: 300, out: 18 },
  logo: {
    box: { x: 1611, y: 90, w: 224, h: 27, note: 'right edge 1835-1840, top 90: same placement as the -logo screens' },
    in: { prop: 'opacity', from: 0, to: 1, start: 0.1, dur: 0.6, ease: 'linear', note: 'frames 3 -> 21; no scale or position change' },
    loop: { prop: 'opacity', value: 1 },
    out: { prop: 'opacity', from: 1, to: 0, start: 0.0, dur: 0.5, ease: 'linear', note: 'frames 0 -> 15 of the 18-frame out clip' },
  },
  notes: 'Measured on logo-bug_full.webm (342 fr = in + loop + out) and logo-bug_3-out.webm (18 fr), decoded with libvpx-vp9 for alpha. The out starts at full frame 324, so in + loop = 324; in 24 / loop 300 (0.8 s / 10 s) is inferred (the in/loop clips were not in the download). Loop is static, so any loop length works.',
}));
console.log('assets/motion/logo-bug.json');
