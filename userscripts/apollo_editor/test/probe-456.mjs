// Probe #456 — pattern Track parser. Loads Apollo on a real release, exercises the
// engine in-page, opens the modal, pastes a tracklist under a pattern, checks the live
// preview (matched dots + extracted fields + a per-row override), then Applies and
// confirms the tracks took the parsed titles/lengths. Read-only (never submits).
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const REL = '20b03c7d-9e8a-42b9-8a96-bcc9564de034';
const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1500, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.goto(`https://musicbrainz.org/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForSelector('#release-editor, form', { timeout: 30000 }).catch(() => {});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 20000 }).catch(() => {});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1) engine wired in-page
const eng = await page.evaluate(() => {
  const A = window.__apolloEditor;
  return {
    ex3: A.tpCompile('# A - T (L)').exec('1 Miles Davis - So What (9:22)'),
    slice: A.tpCompile('T[9-]').exec('[bonus] So What'),
    sep: A.tpCompile('# A - T').exec('1 Foo – Bar'),
  };
});
ck(eng.ex3 && eng.ex3.artist === 'Miles Davis' && eng.ex3.title === 'So What' && eng.ex3.length === '9:22', 'engine: # A - T (L) in-page');
ck(eng.slice && eng.slice.title === 'So What', 'engine: slice T[9-] in-page');
ck(eng.sep && eng.sep.title === 'Bar', 'engine: en-dash matches literal - in-page');

// 2) open the modal
await page.evaluate(() => window.__apolloEditor.openTrackPatternParser(0));
await page.waitForSelector('#tc-tpppop', { timeout: 8000 });
ck(await page.$('#tc-tpppop') !== null, 'modal opened');

// 3) pattern "#. T" + paste 3 numbered titles → 3 matched rows, titles extracted
await page.fill('#tc-tpppop .tc-tpp-pi', '#. T');
await page.fill('#tc-tpppop .tc-tpp-ta', '1. Intro\n2. The Descent\n3. Copenhagen');
await page.waitForTimeout(300);
const prev = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#tc-tpppop .tc-tpp-tbl tbody tr')];
  const titleCol = tr => tr.querySelectorAll('.tc-tpp-c')[2].textContent;
  const dot = tr => tr.querySelector('.tc-tpp-dot span').style.background;
  return { n: rows.length, titles: rows.map(titleCol), green: rows.filter(r => /128|2e7d32|rgb\(46/.test(dot(r))).length, cnt: document.querySelector('#tc-tpppop .tc-tpp-cnt').textContent };
});
ck(prev.n === 3, `3 preview rows (got ${prev.n})`);
ck(JSON.stringify(prev.titles) === JSON.stringify(['Intro', 'The Descent', 'Copenhagen']), `titles extracted: ${JSON.stringify(prev.titles)}`);
ck(prev.green === 3, `all 3 rows matched (green dots: ${prev.green})`);

// 4) a per-row override: row 3 uses a different pattern
await page.fill('#tc-tpppop .tc-tpp-ta', '1. Intro\n2. The Descent\nZZ // Copenhagen');
await page.waitForTimeout(200);
await page.fill('#tc-tpppop .tc-tpp-tbl tbody tr:nth-child(3) .tc-tpp-ov', 'A // T');
await page.waitForTimeout(200);
const ov = await page.evaluate(() => {
  const tr = document.querySelectorAll('#tc-tpppop .tc-tpp-tbl tbody tr')[2];
  return { artist: tr.querySelectorAll('.tc-tpp-c')[1].textContent, title: tr.querySelectorAll('.tc-tpp-c')[2].textContent, amber: /176|b26a00|rgb\(178/.test(tr.querySelector('.tc-tpp-dot span').style.background) };
});
ck(ov.artist === 'ZZ' && ov.title === 'Copenhagen', `override row parsed (artist=${ov.artist} title=${ov.title})`);
ck(ov.amber, 'overridden row shows the amber dot');

// 5) Apply the default-pattern titles, confirm the tracks took them (reopen for clean rows)
await page.evaluate(() => window.__apolloEditor.openTrackPatternParser(0));
await page.waitForSelector('#tc-tpppop', { timeout: 8000 });
await page.fill('#tc-tpppop .tc-tpp-pi', '#. T');
await page.fill('#tc-tpppop .tc-tpp-ta', '1. Alpha One\n2. Beta Two\n3. Gamma Three');
await page.waitForTimeout(300);
await page.click('#tc-tpppop .tc-tpp-ok');
await page.waitForTimeout(800);
const after = await page.evaluate(() => window.__apolloEditor.readTracklist().slice(0, 3).map(t => t.title));
ck(after[0] === 'Alpha One' && after[1] === 'Beta Two' && after[2] === 'Gamma Three', `tracks took parsed titles: ${JSON.stringify(after)}`);
ck(await page.$('#tc-tpppop') === null, 'modal closed after Apply');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
