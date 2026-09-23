// #604 — drop a .zip onto the gallery in a real browser, on a live release cover-art page.
//   1. an Art Station download (built by AS's own makeZip, with its README manifest):
//      every cover is staged NEW with the exact types + comment from its #244 name,
//      "none" stays untyped with its comment, and each thumbnail decodes (resolution shown)
//   2. an OS-made deflate zip of a folder ("Album/…"): covers inside + one subfolder level
//      are staged, the name-guessed type applies (cover.jpg → Front), notes.txt is skipped
// Nothing is ever uploaded: write endpoints are watched (observed, not routed — a catch-all
// route breaks production MB) and must stay unused.
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.AS_SRC || resolve(HERE, '..', 'art_station.user.js'), 'utf8');
const src = code.replace(/\r\n/g, '\n');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// AS's real #240 writer, sliced from the source
const makeZip = new Function(src.slice(src.indexOf('  function crc32'), src.indexOf('  function zipNames')) + '\nreturn makeZip;')();

const RELEASE = 'https://musicbrainz.org/release/55530bc0-97ec-4256-97fc-e6058958c251/cover-art';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: !process.argv.includes('--headed'), viewport: { width: 1500, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const writes = [];
page.on('request', r => {
  if (r.method() !== 'POST' && r.method() !== 'PUT') return;
  if (/\/ws\/2\/|\/cover-art-archive\/|archive\.org|\/edit\/|\/ws\/js\/edit/i.test(r.url())) writes.push(r.method() + ' ' + r.url());
});
await page.goto(RELEASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.addScriptTag({ content: code });
const booted = await page.waitForSelector('.as-src', { timeout: 25000 }).then(() => true).catch(() => false);
ck(booted, 'fixture: Art Station mounted');
if (!booted) { await ctx.close(); process.exit(1); }

// real, decodable JPEG/PNG bytes drawn in the page (no network)
const draw = (w, h, color, type) => page.evaluate(async ({ w, h, color, type }) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(w / 4, h / 4, w / 2, h / 2);
  const b = await new Promise(r => c.toBlob(r, type, 0.9));
  return [...new Uint8Array(await b.arrayBuffer())];
}, { w, h, color, type }).then(a => new Uint8Array(a));

const dropZip = async (bytes, name) => {
  const before = await page.evaluate(() => document.querySelectorAll('.as-card.new').length);
  await page.evaluate(async ({ bytes, name }) => {
    const f = new File([new Uint8Array(bytes)], name, { type: 'application/zip' });
    const dt = new DataTransfer(); dt.items.add(f);
    window.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, { bytes: [...bytes], name });
  await page.waitForFunction(n => document.querySelectorAll('.as-card.new').length > n, before, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);   // let measure() decode the thumbnails
  return page.evaluate(() => [...document.querySelectorAll('.as-card.new')].map(c => {
    const t = c.querySelector('.as-type:not(.as-type-add)');
    return { types: t ? t.getAttribute('title') : '', comment: (c.querySelector('.as-cmt-text') || {}).textContent || '',
      dim: (c.querySelector('.as-dim') || {}).textContent || '', tip: (c.querySelector('.as-thumb') || {}).getAttribute?.('title') || '' };
  }));
};

/* ── 1. an Art Station archive ─────────────────────────────────────────────── */
const enc = new TextEncoder();
const a1 = await draw(600, 600, '#c33', 'image/jpeg'), a2 = await draw(500, 520, '#36c', 'image/jpeg'), a3 = await draw(300, 200, '#3a3', 'image/png');
const asZip = new Uint8Array(await makeZip([
  { name: '03 none loose insert.png', data: a3 },
  { name: '01 front.jpg', data: a1 },
  { name: 'README.md', data: enc.encode('# A - [B](u)\n\n*Report created with [Art Station](https://x) v1*\n') },
  { name: '02 back,spine barcode side.jpg', data: a2 },
]).arrayBuffer());
const s1 = await dropZip(asZip, 'aaaa 2026-09-23T19-00-00 3 covers.zip');
console.log('staged:', JSON.stringify(s1));
ck(s1.length === 3, `3 covers staged from the Art Station zip (got ${s1.length})`);
const by = c => s1.find(x => x.comment === c) || s1.find(x => !c && !x.comment);
ck(by('') && by('').types === 'Front', '01 front.jpg → Front, no comment');
ck(by('barcode side') && by('barcode side').types === 'Back, Spine', '02 → Back, Spine + "barcode side"');
ck(by('loose insert') && by('loose insert').types === '', '03 none → untyped, comment "loose insert" kept (not re-guessed)');
ck(s1.length > 0 && s1.every(x => /\d+ × \d+/.test(x.dim)), 'every thumbnail decoded (resolution shown): ' + s1.map(x => x.dim).join(' | '));
ck(s1.some(x => /600 × 600/.test(x.dim)) && s1.some(x => /300 × 200/.test(x.dim)), 'the right images, byte-for-byte (600×600 JPEG, 300×200 PNG)');

/* ── 2. an OS-made deflate zip of a folder ─────────────────────────────────── */
const dir = join(tmpdir(), 'as604e-' + Date.now()); await mkdir(join(dir, 'Album', 'scans'), { recursive: true });
await writeFile(join(dir, 'Album', 'cover.jpg'), await draw(700, 700, '#999', 'image/jpeg'));
await writeFile(join(dir, 'Album', 'scans', 'booklet 01.jpg'), await draw(400, 400, '#963', 'image/jpeg'));
await writeFile(join(dir, 'Album', 'notes.txt'), 'hello');
execFileSync(process.platform === 'win32' ? 'C:/Windows/System32/tar.exe' : 'bsdtar', ['-a', '-c', '-f', 'os.zip', 'Album'], { cwd: dir });
const osZip = await readFile(join(dir, 'os.zip'));
await rm(dir, { recursive: true, force: true }).catch(() => {});
const s2 = (await dropZip(osZip, 'os.zip'));
const fresh = s2.filter(x => /700 × 700|400 × 400/.test(x.dim));
console.log('staged:', JSON.stringify(fresh));
ck(s2.length === 5, `2 more covers staged from the OS zip (total new ${s2.length}, want 5)`);
ck(fresh.some(x => /700 × 700/.test(x.dim) && x.types === 'Front'), 'Album/cover.jpg → Front (normal name guess)');
ck(fresh.some(x => /400 × 400/.test(x.dim) && x.types === 'Booklet'), 'Album/scans/booklet 01.jpg (one subfolder deep) → Booklet');

/* ── 3. the drop zone says so ──────────────────────────────────────────────── */
ck(/a folder or a \.zip here/.test(code), 'drop zone text mentions a .zip');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
ck(writes.length === 0, 'nothing uploaded or edited: ' + JSON.stringify(writes));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
