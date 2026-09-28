// Rebuild every assets/motion/*.json from the raw captures in tools/scratch/motion/ (in order).
// Raw captures are made with tools/mocap.mjs; the commands are listed in docs/motion-spec.md.
import { execFileSync } from 'node:child_process';
const run = (...a) => { console.log('>', a.join(' ')); execFileSync('node', a, { stdio: 'inherit' }); };
run('tools/motion-build-speaker.mjs');                 // per-shape captured speaker source (scratch)
run('tools/motion-build-program.mjs');                 // speaker, qa, welcome, agenda, brb, thanks
run('tools/motion-build.mjs', 'tools/motion-specs/preshow.json');
run('tools/motion-build-lower-third.mjs');
run('tools/motion-build-networking.mjs');
run('tools/motion-build-stingers.mjs');
run('tools/motion-add-text.mjs');                      // text/logo timing + logo-bug.json (last)
