// #531 (majkinetor): "Still happens. It can appear after around 10s … But in
// any case I can't see the reason it waits. How can I check log in that case
// (maybe we should print it in console)" — plus "Not sure why it says 6 links".
//
// The toolbar mounting late is only half the problem; the other half is that
// nothing recorded WHEN each phase happened, so a slow mount, a slow probe and
// a late script start were indistinguishable. This asserts the diagnostics that
// make the next occurrence self-explanatory:
//
//   * every phase is stamped against script execution;
//   * the log is mirrored to the console, so the lines exist even when the bar
//     (which owns the log) has not mounted yet — the exact case being chased;
//   * the link count is the release's real url count, not the number of
//     provider slots CH looks for (that is where "6 links" came from).
//
// Read-only: this page is never submitted.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { launchTestContext } from './lib/browser.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'dist', 'credit_hoarder.user.js');
// majkinetor's own case from the issue.
const REL = 'https://musicbrainz.org/release/634213af-bd40-485f-98fe-b3938fdfaf0e/edit-relationships';

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const code = await readFile(SCRIPT, 'utf8');
const ctx = await launchTestContext();
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const consoleLines = [];
page.on('console', msg => { const t = msg.text(); if (t.includes('[credit_hoarder]')) consoleLines.push(t); });

for (let a = 1; ; a++) {
    try { await page.goto(REL, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(600);
const shim = `window.GM_info = window.GM_info || { script: { name: 'CH (test)', version: 'test' }, scriptHandler: 'Playwright', version: 'test' };`;
await page.addScriptTag({ content: shim + code });

const appeared = await page.waitForSelector('.discogs-bar', { timeout: 40000 }).then(() => true).catch(() => false);
ck(appeared, 'the toolbar mounts on this release');
await page.waitForTimeout(500);

// ── the log reaches the console, mounted bar or not ─────────────────────────
console.log('--- console lines CH emitted ---');
consoleLines.slice(0, 12).forEach(l => console.log('   ' + l));
ck(consoleLines.length > 0, 'CH mirrors its log to the console (visible even when the bar never mounts)');
ck(consoleLines.some(l => /Boot: script running/.test(l)), 'including the very first line, emitted before the bar exists');

// ── every phase is timed ────────────────────────────────────────────────────
const logText = (await page.locator('.discogs-output').textContent().catch(() => '')) || '';
const phases = ['Boot: script running', 'Boot: DOM ready', 'Boot: source probe done', 'Boot: toolbar mounted'];
phases.forEach(p => ck(logText.includes(p) || consoleLines.some(l => l.includes(p)), `phase logged: "${p}"`));
const mounted = (logText.match(/Boot: toolbar mounted \(\+(\d+)ms/) || [])[1];
console.log('mount took: ' + (mounted ? mounted + 'ms from script start' : '(not found)'));
ck(mounted != null, 'the mount line carries the elapsed time, so a 10s wait can be attributed to a phase');

// ── the link count is real ──────────────────────────────────────────────────
// "6 links" was Object.keys(sources).length — the provider slots CH looks for
// (discogs/tidal/qobuz/deezer/apple/metalArchives) — on a release with one url.
const relLine = (logText.match(/MusicBrainz returned (\d+) relationship\(s\)[^,]*, (\d+) of them url\(s\)/) || []);
const srcLine = (logText.match(/(\d+) import source\(s\) from (\d+) link\(s\)/) || []);
console.log(`rel line: ${JSON.stringify(relLine[0] || null)}`);
console.log(`src line: ${JSON.stringify(srcLine[0] || null)}`);
ck(relLine.length > 0, 'the probe reports how many of the relationships are urls');
ck(srcLine.length > 0, 'and the source line reports a link count');
ck(srcLine[2] === relLine[2], `the two agree (${srcLine[2]} = ${relLine[2]}) — not the 6 provider slots`);
ck(srcLine[2] !== '6' || relLine[2] === '6', 'so "6 links" can only appear if the release really has six');

ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
