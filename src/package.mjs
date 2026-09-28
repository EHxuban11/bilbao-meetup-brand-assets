#!/usr/bin/env node
// Zip everything in out/ into the files the README links to, in dist/.
// Run after rendering (npm run build), then publish with:
//   gh release create v<date> dist/*.zip --title "Brand package, <date>"
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/assets.mjs';

const OUT = resolve(ROOT, 'out'), DIST = resolve(ROOT, 'dist');
const VIDEO = resolve(OUT, 'live-screens/video');
const overlay = name => /^(1[3-9]|2[01])-/.test(name);   // 13-15 lower thirds, 16-20 stingers, 21 logo bug

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// zip(name, cwd, entries): entries are paths relative to cwd
function zip(name, cwd, entries) {
  entries = entries.filter(e => existsSync(resolve(cwd, e)));
  if (!entries.length) { console.warn(`- ${name}: nothing to package (render it first)`); return; }
  execFileSync('zip', ['-r', '-q', '-X', resolve(DIST, name), ...entries, '-x', '*.DS_Store'], { cwd });
  const mb = statSync(resolve(DIST, name)).size / 1e6;
  console.log(`✓ ${name} (${mb.toFixed(1)} MB)`);
}
const ls = dir => (existsSync(dir) ? readdirSync(dir).sort() : []);

zip('grokbot-bilbao-stills.zip', resolve(OUT, 'live-screens'), ['stills']);
zip('grokbot-bilbao-screen-videos.zip', resolve(OUT, 'live-screens'), ls(VIDEO).filter(n => !overlay(n)).map(n => `video/${n}`));
zip('grokbot-bilbao-overlays.zip', resolve(OUT, 'live-screens'), ls(VIDEO).filter(overlay).map(n => `video/${n}`));
zip('grokbot-bilbao-social.zip', OUT, ['social']);
zip('grokbot-bilbao-poster.zip', OUT, ['print']);
zip('grokbot-bilbao-slides.zip', OUT, ['deck']);
