// Fit every bot in the designer's stills and write assets/poses/stills.json.
// Re-run whenever a shape in assets/bots/ changes:  node tools/fit-stills.mjs
// Each pose: { shape, color, x, y, rot, scale, flip, eyes: [[x, y, w, h, a], ...] (body-local) }.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';

const L = 'reference/live-screens/stills/', S = 'reference/social/SpaceXAI Bilbao ';
// id, image, shape, colour, region [x0 y0 x1 y1], extra flags
const JOBS = [
  ['01-preshow', L + '01-preshow.png', 'round', '#7761aa', [700, 0, 1920, 1080]],
  ['01-preshow-logo', L + '01-preshow-logo.png', 'round', '#7761aa', [700, 0, 1920, 1080]],
  ['02-welcome', L + '02-welcome.png', 'triangle', '#ee3342', [900, 0, 1920, 1080], ['--noflip']],
  ['03-agenda', L + '03-agenda.png', 'triangle', '#ee3342', [0, 300, 940, 1080]],
  ['22-agenda-partners', L + '22-agenda-partners.png', 'triangle', '#ee3342', [0, 300, 940, 900]],
  ['11-thanks', L + '11-thanks.png', 'round', '#f8981d', [600, 0, 1920, 1080]],
  ['12-brb', L + '12-brb.png', 'cloud', '#457bbe', [900, 0, 1920, 1080]],
  ['10-networking/0', L + '10-networking.png', 'drop', '#ffcc00', [880, 0, 1920, 1080], ['--noflip']],
  ['10-networking/1', L + '10-networking.png', 'round', '#ff6700', [880, 0, 1920, 1080]],
  ['10-networking/2', L + '10-networking.png', 'cloud', '#ff309b', [880, 0, 1920, 1080]],
  ['10-networking/3', L + '10-networking.png', 'round', '#1084fe', [840, 0, 1920, 1080]],
  ['10-networking/4', L + '10-networking.png', 'square', '#00c972', [880, 0, 1920, 1080]],
  ['10-networking/5', L + '10-networking.png', 'triangle', '#ee3342', [880, 0, 1920, 1080]],
  ['13-lower-hugo', L + '13-lower-hugo.png', 'triangle', '#ee3342', [80, 820, 205, 1000]],
  ['14-lower-leire', L + '14-lower-leire.png', 'cloud', '#ed3a95', [80, 820, 205, 1000]],
  ['15-lower-xuban', L + '15-lower-xuban.png', 'round', '#ffffff', [80, 800, 205, 1000]],
  ['16-stinger-1', L + '16-stinger-1.png', 'round', '#ff6700', [0, 0, 1920, 1080]],
  ['17-stinger-2', L + '17-stinger-2.png', 'cloud', '#1084fe', [0, 0, 1920, 1080]],
  ['18-stinger-3', L + '18-stinger-3.png', 'drop', '#ff9800', [0, 0, 1920, 1080]],
  ['19-stinger-4', L + '19-stinger-4.png', 'triangle', '#ff309b', [0, 0, 1920, 1080]],
  ['20-stinger-5', L + '20-stinger-5.png', 'square', '#00bca6', [0, 0, 1920, 1080]],
  ['social/horizontal', S + 'Horizontal.png', 'triangle', '#ee3342', [0, 300, 960, 1080]],
  ['social/horizontal-partners', S + 'Horizontal Partners.png', 'triangle', '#ee3342', [0, 300, 960, 830]],
  ['social/story', S + 'Story.png', 'triangle', '#ee3342', [480, 200, 1080, 800]],
  ['social/story-partners', S + 'Story Partners.png', 'triangle', '#ee3342', [480, 150, 1080, 750]],
  ['social/partners-feed', S + 'Partners Feed.png', 'drop', '#457bbe', [480, 0, 1080, 1150], ['--noflip']],
  ['social/partners-story', S + 'Partners Story.png', 'drop', '#457bbe', [480, 0, 1080, 1300], ['--noflip']],
  ['social/partners-horizontal', S + 'Partners Horizontal.png', 'drop', '#457bbe', [0, 300, 960, 1080], ['--noflip']],
];

const r2 = v => Math.round(v * 100) / 100;
const exec = promisify(execFile);
const run = async ([id, img, shape, hex, box, flags = []]) => {
  const { stdout } = await exec('node', ['tools/fit-bot.mjs', img, shape, hex, ...box.map(String), ...flags, '--json'], { maxBuffer: 1 << 24 });
  const f = JSON.parse(stdout.trim().split('\n').pop());
  return ([id, { shape, color: hex.toUpperCase(), x: f.x, y: f.y, rot: f.rot, scale: f.scale, flip: f.flip, iou: f.iou,
    eyes: f.eyesLocal.map(e => [r2(e.x), r2(e.y), r2(e.w), r2(e.h), r2(e.a)]) }]);
};

// small pool: fit-bot is single-threaded
const results = []; let i = 0;
await Promise.all(Array.from({ length: Math.max(1, os.cpus().length - 2) }, async () => {
  while (i < JOBS.length) { const j = JOBS[i++]; try { results.push(await run(j)); console.log('✓', j[0]); } catch (e) { console.error('✗', j[0], e.message.split('\n')[0]); } }
}));
// The blue round in the networking cluster is half hidden behind the green square, which
// drags a plain silhouette fit off; this pose was fitted with the occluder masked out
// (docs/layout-live-screens.md, IoU 0.9969).
const OVERRIDES = { '10-networking/3': { x: 972.66, y: 823.02, rot: 6.03, scale: 0.4083, iou: 0.9969 } };
for (const r of results) if (OVERRIDES[r[0]]) Object.assign(r[1], OVERRIDES[r[0]]);
const poses = Object.fromEntries(results.sort((a, b) => a[0].localeCompare(b[0])));
mkdirSync('assets/poses', { recursive: true });
writeFileSync('assets/poses/stills.json', JSON.stringify(poses, null, 1));
console.log(`wrote ${results.length} poses -> assets/poses/stills.json`);
