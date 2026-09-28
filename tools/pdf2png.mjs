// Render page 1 of a PDF to PNG at a given pixel width, using pdf.js in headless Chromium.
// usage: node tools/pdf2png.mjs <in.pdf> <out.png> [widthPx]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [,, pdf, out, width = '3000'] = process.argv;
const root = resolve('node_modules/pdfjs-dist/build');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route('http://pdf.local/**', r => {
  const p = new URL(r.request().url()).pathname;
  if (p === '/doc.pdf') return r.fulfill({ body: readFileSync(pdf), contentType: 'application/pdf' });
  if (p === '/') return r.fulfill({ body: '<html><body></body></html>', contentType: 'text/html' });
  return r.fulfill({ body: readFileSync(root + p), contentType: 'text/javascript' });
});
await page.goto('http://pdf.local/');
const b64 = await page.evaluate(async (W) => {
  const pdfjs = await import('/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
  const doc = await pdfjs.getDocument({ url: '/doc.pdf' }).promise;
  const pg = await doc.getPage(1);
  const v1 = pg.getViewport({ scale: 1 });
  const vp = pg.getViewport({ scale: W / v1.width });
  const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  return c.toDataURL('image/png').split(',')[1];
}, +width);
writeFileSync(out, Buffer.from(b64, 'base64'));
await browser.close();
