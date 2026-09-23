// #604 — unit test for the in-browser ZIP reader (filesFromZip / expandZips), run in Node
// against the REAL functions sliced from the source. Three archives:
//   as        — built by Art Station's own makeZip (stored, method 0) with its README.md
//               manifest → covers come back in order with exact types + comments,
//               including "none" (untyped, comment kept)
//   deflate   — built by the OS zip tool (bsdtar -a → deflate, method 8), with a subfolder,
//               a too-deep file, a non-image and a __MACOSX entry → only the covers within
//               bounds, decompressed byte-for-byte
//   notzip    — random bytes named .zip → a clean "not a ZIP archive" error
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
const HERE = dirname(fileURLToPath(import.meta.url));
const src = (await readFile(process.env.AS_SRC || resolve(HERE, '..', 'art_station.user.js'), 'utf8')).replace(/\r\n/g, '\n');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// slice a top-level (2-space indented) declaration out of the userscript
const grab = (start) => {
  const a = src.indexOf(start); if (a < 0) throw new Error('not found: ' + start);
  const end = src.indexOf('\n  }\n', a);
  const line = src.indexOf('\n', a);
  return src.slice(a, /[{(]\s*$/.test(src.slice(a, line)) || src.slice(a, line).includes('{ ') && !src.slice(a, line).trim().endsWith(';') ? end + 4 : line);
};
const lines = [
  "const DIR_MAX_DEPTH = 1, DIR_MAX_FILES = 100;",
  "const DIR_ACCEPT_RE = /\\.(jpe?g|png|gif|pdf)$/i;",
  'const IS_EVENT = false, COVER_ORDER = [];',   // the sliced type tables define ITEM/ITEMS themselves
];
const logs = [], toasts = [];
const pieces = [
  src.slice(src.indexOf('  const COVER_TYPES'), src.indexOf('  let MODEL = [];')),   // type tables + parseName
  grab('const isZipFile ='), grab('const MIME_BY_EXT ='), grab('const AS_MANIFEST_RE ='),
  grab('function parseDownloadName'), grab('async function inflateRaw'), grab('async function filesFromZip'), grab('async function expandZips'),
  src.slice(src.indexOf('  function crc32'), src.indexOf('  function zipNames')),        // #240 zip writer (crc32 + records + makeZip)
];
const asLog = { debug: m => logs.push('D ' + m), info: m => logs.push('I ' + m), warn: m => logs.push('W ' + m) };
const logErr = (c, e) => logs.push('E ' + c + ' — ' + (e.message || e));
const toast = m => toasts.push(m);
const body = lines.join('\n') + '\n' + pieces.join('\n') + '\nreturn { filesFromZip, expandZips, makeZip, parseDownloadName };';
let api;
try { api = new Function('asLog', 'logErr', 'toast', body)(asLog, logErr, toast); }
catch (e) { console.log('could not assemble the sliced functions: ' + e.message); process.exit(2); }

// fake image payloads with real magic bytes (content doesn't need to decode here)
const img = (tag, n = 2000) => { const b = new Uint8Array(n); b.set([0xff, 0xd8, 0xff, 0xe0]); for (let i = 4; i < n; i++) b[i] = (i * 31 + tag.charCodeAt(0)) & 0xff; return b; };
const png = (tag, n = 1500) => { const b = img(tag, n); b.set([0x89, 0x50, 0x4e, 0x47]); return b; };

// ── 1. Art Station's own archive
{
  const enc = new TextEncoder();
  const files = [
    { name: '01 front.jpg', data: img('a') },
    { name: '02 back,spine barcode side.jpg', data: img('b') },
    { name: '03 none loose insert.png', data: png('c') },
    { name: '10 booklet page 12.jpg', data: img('d') },
    { name: 'README.md', data: enc.encode('# X - [Y](u)\n\n## Artwork\n\n*Report created with [Art Station](https://x) v1*\n') },
  ];
  // shuffle into the archive out of order — the reader must restore NN order
  const zipBlob = api.makeZip([files[3], files[0], files[4], files[2], files[1]]);
  const zf = new File([await zipBlob.arrayBuffer()], 'MBID 2026-09-23T19-00-00 4 covers.zip', { type: 'application/zip' });
  const out = await api.expandZips([zf, new File([img('loose')], 'loose.jpg', { type: 'image/jpeg' })]);
  const names = out.files.map(f => f.name);
  ck(JSON.stringify(names) === JSON.stringify(['01 front.jpg', '02 back,spine barcode side.jpg', '03 none loose insert.png', '10 booklet page 12.jpg', 'loose.jpg']),
    'AS zip: 4 covers in NN order, README skipped, loose file passed through — ' + JSON.stringify(names));
  const m = out.metas;
  ck(m[0] && m[0].exactName && JSON.stringify(m[0].types) === '["Front"]' && m[0].comment === '', 'AS zip: 01 → [Front], no comment');
  ck(m[1] && JSON.stringify(m[1].types) === '["Back","Spine"]' && m[1].comment === 'barcode side', 'AS zip: 02 → [Back, Spine] "barcode side" — ' + JSON.stringify(m[1]));
  ck(m[2] && m[2].exactName && m[2].types.length === 0 && m[2].comment === 'loose insert', 'AS zip: "none" → untyped, comment kept — ' + JSON.stringify(m[2]));
  ck(m[3] && JSON.stringify(m[3].types) === '["Booklet"]' && m[3].comment === 'page 12', 'AS zip: 10 → [Booklet] "page 12" — ' + JSON.stringify(m[3]));
  ck(m[4] === undefined, 'loose file carries no zip meta');
  ck(out.files[0].type === 'image/jpeg' && out.files[2].type === 'image/png', 'MIME types from extensions');
  const same = async (f, want) => { const got = new Uint8Array(await f.arrayBuffer()); return got.length === want.length && got.every((b, i) => b === want[i]); };
  ck(await same(out.files[1], files[1].data) && await same(out.files[2], files[2].data), 'stored entries come back byte-identical');
  ck(toasts.some(t => /Unpacked 4 covers from/.test(t)), 'toast: ' + toasts.at(-1));
}

// ── 2. an OS-made deflate zip (Windows bsdtar: tar -a -c -f x.zip …)
{
  const dir = join(tmpdir(), 'as604-' + Date.now()); await mkdir(join(dir, 'Album', 'scans', 'deep'), { recursive: true });
  const a = img('x', 50000), b = png('y', 30000), c = img('z', 20000);
  await writeFile(join(dir, 'Album', 'cover.jpg'), a);
  await writeFile(join(dir, 'Album', 'scans', 'back.png'), b);
  await writeFile(join(dir, 'Album', 'scans', 'deep', 'too-deep.jpg'), c);
  await writeFile(join(dir, 'Album', 'notes.txt'), 'hello');
  await mkdir(join(dir, '__MACOSX'), { recursive: true }); await writeFile(join(dir, '__MACOSX', '._cover.jpg'), 'junk');
  const zp = join(dir, 'os.zip');
  // Windows' own bsdtar (Git Bash's GNU tar reads 'C:' as a remote host); -a picks zip from the extension
  execFileSync(process.platform === 'win32' ? 'C:/Windows/System32/tar.exe' : 'bsdtar', ['-a', '-c', '-f', 'os.zip', 'Album', '__MACOSX'], { cwd: dir });
  const bytes = await readFile(zp);
  // confirm the archive really uses deflate, else this case proves nothing
  const methods = []; for (let i = 0; i + 4 < bytes.length; i++) if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 1 && bytes[i + 3] === 2) methods.push(bytes[i + 10]);
  ck(methods.includes(8), 'fixture: OS zip really contains deflate entries (methods ' + JSON.stringify(methods) + ')');
  logs.length = 0; toasts.length = 0;
  const out = await api.expandZips([new File([bytes], 'os.zip', { type: 'application/x-zip-compressed' })]);
  const names = out.files.map(f => f.name);
  ck(JSON.stringify(names) === JSON.stringify(['cover.jpg', 'back.png']), 'deflate zip: root + one subfolder level only, no txt / __MACOSX / too-deep — ' + JSON.stringify(names));
  const eq = async (f, want) => { const got = new Uint8Array(await f.arrayBuffer()); return got.length === want.length && got.every((v, i) => v === want[i]); };
  ck(await eq(out.files[0], a) && await eq(out.files[1], b), 'deflated entries decompress byte-identical');
  ck(out.metas.every(x => x === undefined), 'non-AS zip: no exact-name metas (normal auto-type applies)');
  ck(logs.some(l => /skipped Album\/notes\.txt/.test(l)), 'non-image entry logged as skipped');
  ck(toasts.some(t => /Unpacked 2 covers from os\.zip — 1 file skipped.*capped/.test(t)), 'toast names the skip and the cap: ' + toasts.at(-1));
  await rm(dir, { recursive: true, force: true });
}

// ── 3. not a zip
{
  logs.length = 0; toasts.length = 0;
  const out = await api.expandZips([new File([img('q', 400)], 'broken.zip', { type: 'application/zip' })]);
  ck(out.files.length === 0 && out.zips === 1, 'not-a-zip: nothing staged');
  ck(toasts.some(t => /Couldn't read broken\.zip: not a ZIP archive/.test(t)), 'not-a-zip: clear toast — ' + toasts.at(-1));
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
