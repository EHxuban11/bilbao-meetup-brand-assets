#!/usr/bin/env node
// Render deliverables.
//
//   node src/render.mjs stills  [filter]     PNG stills            -> out/live-screens/stills/
//   node src/render.mjs video   [filter]     in / loop / out / full -> out/live-screens/video/
//   node src/render.mjs compare [filter]     diff our stills against reference/ -> out/compare/
//
// `filter`: comma-separated substrings of deliverable ids; prefix with ! to exclude,
// e.g. "speaker-hugo", "logo", "!logo,!networking".
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import os from 'node:os';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import { ROOT, brandFont } from './lib/assets.mjs';
import { liveScreens } from './scenes/live.mjs';

const [cmd = 'stills', filter = '', ...flags] = process.argv.slice(2);
const OUT = resolve(ROOT, 'out');
const jobsFlag = flags.includes('--jobs') ? +flags[flags.indexOf('--jobs') + 1] : Math.max(1, Math.min(6, os.cpus().length - 2));

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.otf': 'font/otf', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

function stageHtml() {
  const f = brandFont();
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: 'Brand'; src: url('/${f.file}'); font-weight: 400; }
    :root { --brand-font: 'Brand'; }
    html, body { margin: 0; padding: 0; overflow: hidden; }
    svg { display: block; text-rendering: geometricPrecision; }
    text { font-family: 'Brand'; font-kerning: normal; }
  </style></head><body><svg id="stage" xmlns="http://www.w3.org/2000/svg"></svg>
  <script type="module">import * as E from '/src/engine/engine.js'; window.__ready = true;</script></body></html>`;
}

export async function openStage(browser, { w = 1920, h = 1080, scale = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  await page.route('http://brand.local/**', route => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    if (path === '/') return route.fulfill({ body: stageHtml(), contentType: 'text/html' });
    const file = resolve(ROOT, '.' + path);
    if (!file.startsWith(ROOT) || !existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ body: readFileSync(file), contentType: MIME[extname(file)] || 'application/octet-stream' });
  });
  page.on('pageerror', e => console.error('[page]', e.message));
  await page.goto('http://brand.local/');
  await page.waitForFunction(() => window.__ready && window.mount);
  return page;
}

async function mountScene(page, scene) {
  await page.setViewportSize({ width: scene.w, height: scene.h });
  await page.evaluate(sc => window.mount(sc), scene);
}
const shot = (page, scene) => page.screenshot({ type: 'png', omitBackground: scene.background === 'transparent', clip: { x: 0, y: 0, width: scene.w, height: scene.h } });

// ---------- ffmpeg ----------
function encoder(file, { alpha = false } = {}) {
  mkdirSync(dirname(file), { recursive: true });
  const codec = file.endsWith('.mov')
    ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0']
    : file.endsWith('.webm')
      ? ['-c:v', 'libvpx-vp9', '-pix_fmt', alpha ? 'yuva420p' : 'yuv420p', '-b:v', '0', '-crf', '18', '-row-mt', '1', '-auto-alt-ref', '0']
      : ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'medium', '-tune', 'animation', '-movflags', '+faststart', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709'];
  const ff = spawn(ffmpegPath, ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-', ...codec, file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg ${file} exited ${c}`)))));
  return {
    write: buf => new Promise(r => (ff.stdin.write(buf) ? r() : ff.stdin.once('drain', r))),
    end: () => { ff.stdin.end(); return done; },
  };
}

// ---------- jobs ----------
async function renderStill(page, job, dir) {
  const { scene } = job.build();
  await mountScene(page, scene);
  await page.evaluate(() => window.seek('still', 0));
  const buf = await shot(page, scene);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `${job.id}.png`), buf);
  return buf;
}

async function renderVideo(page, job, dir) {
  const { scene, clips, formats = ['mp4'] } = job.build();
  await mountScene(page, scene);
  const base = job.folder.replace(/^\d+-/, '');
  const folder = resolve(dir, job.folder);
  const alpha = scene.background === 'transparent';
  const outs = formats.map(ext => ({
    in: encoder(resolve(folder, `${base}_1-in.${ext}`), { alpha }),
    loop: encoder(resolve(folder, `${base}_2-loop.${ext}`), { alpha }),
    out: encoder(resolve(folder, `${base}_3-out.${ext}`), { alpha }),
    full: encoder(resolve(folder, `${base}_full.${ext}`), { alpha }),
  }));
  for (const clip of ['in', 'loop', 'out']) {
    for (let f = 0; f < clips[clip]; f++) {
      await page.evaluate(([c, n]) => window.seek(c, n), [clip, f]);
      const buf = await shot(page, scene);
      for (const o of outs) { await o[clip].write(buf); await o.full.write(buf); }
    }
  }
  await Promise.all(outs.flatMap(o => [o.in.end(), o.loop.end(), o.out.end(), o.full.end()]));
}

async function compare(job, ours) {
  const ref = resolve(ROOT, 'reference/live-screens/stills', `${job.id}.png`);
  if (!existsSync(ref)) return null;
  const a = await sharp(ours).flatten({ background: '#000' }).removeAlpha().raw().toBuffer();
  const b = await sharp(ref).flatten({ background: '#000' }).removeAlpha().resize(1920, 1080).raw().toBuffer();
  let sum = 0, bad = 0; const diff = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i += 3) {
    const d = (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
    sum += d; if (d > 32) bad++;
    // overlay: reference in red, ours in cyan; identical pixels look grey/white
    const ya = (a[i] + a[i + 1] + a[i + 2]) / 3, yb = (b[i] + b[i + 1] + b[i + 2]) / 3;
    diff[i] = yb; diff[i + 1] = ya; diff[i + 2] = ya;
  }
  const dir = resolve(OUT, 'compare'); mkdirSync(dir, { recursive: true });
  await sharp(diff, { raw: { width: 1920, height: 1080, channels: 3 } }).png().toFile(resolve(dir, `${job.id}.png`));
  return { id: job.id, meanDiff: +(sum / (a.length / 3)).toFixed(2), badPct: +(100 * bad / (a.length / 3)).toFixed(2) };
}

async function pool(items, n, fn) {
  const browser = await chromium.launch();
  const pages = await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => openStage(browser)));
  let i = 0; const results = [];
  await Promise.all(pages.map(async page => { while (i < items.length) { const it = items[i++]; const t = Date.now(); results.push(await fn(page, it)); console.log(`✓ ${it.id} (${((Date.now() - t) / 1000).toFixed(1)} s)`); } }));
  await browser.close();
  return results;
}

async function main() {
  if (!brandFont().licensed) console.warn('! Universal Sans Display not found in fonts/ — rendering with the Inter Display stand-in (see fonts/README.md).');
  const terms = filter.split(',').filter(Boolean);
  const inc = terms.filter(t => !t.startsWith('!')), exc = terms.filter(t => t.startsWith('!')).map(t => t.slice(1));
  const jobs = liveScreens().filter(j => (!inc.length || inc.some(t => j.id.includes(t))) && !exc.some(t => j.id.includes(t)));
  if (!jobs.length) { console.error(`no deliverable matches "${filter}"`); process.exit(1); }
  if (cmd === 'stills') await pool(jobs, jobsFlag, (p, j) => renderStill(p, j, resolve(OUT, 'live-screens/stills')));
  else if (cmd === 'video') await pool(jobs, jobsFlag, (p, j) => renderVideo(p, j, resolve(OUT, 'live-screens/video')));
  else if (cmd === 'compare') {
    const res = await pool(jobs, jobsFlag, async (p, j) => compare(j, await renderStill(p, j, resolve(OUT, 'live-screens/stills'))));
    console.table(res.filter(Boolean));
  } else { console.error(`unknown command ${cmd}`); process.exit(1); }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
