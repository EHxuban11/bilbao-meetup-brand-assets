#!/usr/bin/env node
// The preview reel: every screen in run-of-show order, joined by the five stingers.
// Built from our rendered clips (run `node src/render.mjs video` first).
//   node src/reel.mjs            -> out/live-screens/video/preview/grokbot-bilbao-preview{,-logo}{,-720p}.mp4
//
// Timing measured on the designer's reel (51 s, 1527 frames): a stinger covers each cut at its 800 ms
// mark (frame 24); the next screen starts its "in" 9 frames later and plays into its loop.
// The last screen (Gracias) plays its out to finish the reel.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { ROOT } from './lib/assets.mjs';

const V = resolve(ROOT, 'out/live-screens/video');
const SCREENS = ['01-preshow', '02-welcome', '03-agenda', '04-speaker-hugo', '05-qa-hugo', '06-speaker-leire', '07-qa-leire',
  '12-brb', '08-speaker-xuban', '09-qa-xuban', '10-networking', '11-thanks'];
const CUTS = [135, 255, 404, 525, 630, 750, 855, 974, 1095, 1200, 1350]; // reel frames where the next screen starts
const TOTAL = 1527;
const STINGERS = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1];
const CUT_AT = 24; // stinger frame at which the cut happens
// The next screen starts its "in" this many frames after the cut, as the stinger leaves (measured per screen).
const HOLD = { '03-agenda': 15, '04-speaker-hugo': 10, '08-speaker-xuban': 10 }, HOLD_DEFAULT = 9;

const frames = f => +spawnSync(resolve(ROOT, 'node_modules/ffprobe-static/bin/darwin/arm64/ffprobe'),
  ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f]).stdout.toString().trim();

function build(logo) {
  const inputs = [], parts = [];
  const add = f => { if (!existsSync(f)) throw new Error(`missing ${f}: render the videos first`); inputs.push(f); return inputs.length - 1; };
  const starts = [0, ...CUTS], ends = [...CUTS, TOTAL];
  SCREENS.forEach((id, i) => {
    const folder = logo ? `${id}-logo` : id, base = folder.replace(/^\d+-/, '');
    const len = ends[i] - starts[i], last = i === SCREENS.length - 1;
    const inF = resolve(V, folder, `${base}_1-in.mp4`), loopF = resolve(V, folder, `${base}_2-loop.mp4`), outF = resolve(V, folder, `${base}_3-out.mp4`);
    const nIn = frames(inF), nOut = last ? frames(outF) : 0;
    const hold = i === 0 ? 0 : HOLD[id] ?? HOLD_DEFAULT;
    const nLoop = len - hold - nIn - nOut;
    parts.push([add(inF), Math.min(nIn, len - hold), hold]);
    if (nLoop > 0) parts.push([add(loopF), nLoop]);
    if (last) parts.push([add(outF), nOut]);
  });
  const stIdx = STINGERS.map(n => add(resolve(V, `${15 + n}-stinger-${n}`, `stinger-${n}.webm`)));
  const f = [];
  parts.forEach(([k, n, hold = 0], j) => f.push(`[${k}:v]trim=end_frame=${n},setpts=PTS-STARTPTS${hold ? `,tpad=start=${hold}:start_mode=clone` : ''}[p${j}]`));
  f.push(`${parts.map((_, j) => `[p${j}]`).join('')}concat=n=${parts.length}:v=1:a=0[base0]`);
  stIdx.forEach((k, j) => {
    const start = CUTS[j] - CUT_AT;
    f.push(`[${k}:v]format=yuva420p,setpts=PTS-STARTPTS+${start}/30/TB[s${j}]`);
    f.push(`[base${j}][s${j}]overlay=eof_action=pass:format=auto[base${j + 1}]`);
  });
  const last = `[base${stIdx.length}]`;
  const outDir = resolve(V, 'preview'); mkdirSync(outDir, { recursive: true });
  const name = `grokbot-bilbao-preview${logo ? '-logo' : ''}`;
  const args = ['-v', 'error', '-y'];
  inputs.forEach(i => { if (i.endsWith('.webm')) args.push('-c:v', 'libvpx-vp9'); args.push('-i', i); });
  args.push('-filter_complex', `${f.join(';')};${last}split[o1][o2];[o2]scale=1280:720:flags=lanczos[o720]`,
    '-map', '[o1]', '-frames:v', String(TOTAL), '-r', '30', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', resolve(outDir, `${name}.mp4`),
    '-map', '[o720]', '-frames:v', String(TOTAL), '-r', '30', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', resolve(outDir, `${name}-720p.mp4`));
  const r = spawnSync(ffmpegPath, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status) throw new Error(`ffmpeg failed for ${name}`);
  console.log(`✓ ${name}.mp4 and ${name}-720p.mp4`);
}

build(false);
build(true);
