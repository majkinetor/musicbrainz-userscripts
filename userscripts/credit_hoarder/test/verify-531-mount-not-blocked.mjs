// #531, the actual cause — found by the boot instrumentation, in majkinetor's
// own console export:
//
//   [credit_hoarder] Boot: source probe done (+457ms)
//   [credit_hoarder] Boot: title-remix probe done (+12347ms)
//   [credit_hoarder] Boot: toolbar mounted (+12351ms from script start)
//
// "It looks like title-remix probe done is the culprit and #271 is exactly when
// I remember this starting to happen."
//
// The remix probe reads the tracklist from the PUBLIC /ws/2 API — rate-limited,
// and occasionally many seconds slow — and all it decides is whether to offer
// the "Titles" source. The toolbar no longer waits for it.
//
// The test stalls that endpoint for 10s on purpose, so a regression cannot hide
// behind a fast day at MusicBrainz. Read-only: nothing is submitted.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { launchTestContext } from './lib/browser.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'dist', 'credit_hoarder.user.js');
// majkinetor's release from the console export: one Discogs link, no remixes.
const REL = 'https://musicbrainz.org/release/fdb4fbd8-fcc9-4469-b3a4-a91c1975dde5/edit-relationships';
// 4s, deliberately UNDER the throttle's own 10s per-request timeout: a longer
// stall trips that, retries, and the probe never lands inside the test window.
// (majkinetor's 12347ms was exactly that shape — one 10s timeout, one retry,
// then a 2.3s success.)
const STALL_MS = 4000;

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const code = await readFile(SCRIPT, 'utf8');
const ctx = await launchTestContext();
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const consoleLines = [];
page.on('console', msg => { const t = msg.text(); if (t.includes('[credit_hoarder]')) consoleLines.push(t); });

// Stall exactly the endpoint the remix probe uses, and nothing else.
let stalled = 0;
await page.route(u => /\/ws\/2\/release\/[0-9a-f-]{36}\?.*inc=recordings/.test(u.href), async route => {
    stalled++;
    await new Promise(r => setTimeout(r, STALL_MS));
    return route.continue();
});

for (let a = 1; ; a++) {
    try { await page.goto(REL, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(500);

const t0 = Date.now();
const shim = `window.GM_info = window.GM_info || { script: { name: 'CH (test)', version: 'test' }, scriptHandler: 'Playwright', version: 'test' };`;
await page.addScriptTag({ content: shim + code });
const appeared = await page.waitForSelector('.discogs-bar', { timeout: 30000 }).then(() => Date.now() - t0).catch(() => null);
console.log(`toolbar appeared after ${appeared}ms (the tracklist endpoint is stalled for ${STALL_MS}ms)`);
ck(appeared != null, 'the toolbar mounts');
ck(appeared != null && appeared < STALL_MS - 1500, `and does not wait for the tracklist probe (${appeared}ms vs a ${STALL_MS}ms stall)`);
ck(stalled >= 1, `the stall really was in effect (${stalled} request(s) held)`);

// The Discogs source is there immediately — that is what the toolbar is for.
const iconsEarly = await page.locator('.discogs-src-icons .discogs-src-ico').evaluateAll(els => els.map(e => e.dataset.src));
console.log('sources at mount: ' + JSON.stringify(iconsEarly));
ck(iconsEarly.includes('Discogs'), 'with its linked source usable straight away');

// Under an artificial stall the probe's own completion time is not worth
// asserting: CH's throttle aborts any request at 10s and retries, so the
// timings compound with the stall. (That abort-and-retry is, incidentally,
// exactly the shape of majkinetor's 12347ms: one 10s timeout, one retry, then
// a 2.3s success.) What matters — and is asserted above — is that the mount
// overtook it. The other half of the contract, that a late probe result still
// reaches the toolbar, is checked below on a release that really has remixes,
// with the network left alone.
await page.unrouteAll({ behavior: 'ignoreErrors' });
{
    // "Remixes" — every track title names a remixer, so the Titles source must
    // be offered. This release has no linked provider either, which is the case
    // where the toolbar exists BECAUSE of the remix probe.
    const REMIXES = 'https://musicbrainz.org/release/9929e7ce-77d2-40e9-8cf3-e9d853e8e027/edit-relationships';
    for (let a = 1; ; a++) {
        try { await page.goto(REMIXES, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
        catch (e) { if (a >= 3) throw e; await page.waitForTimeout(4000); }
    }
    await page.waitForTimeout(500);
    await page.addScriptTag({ content: shim + code });
    const ok = await page.waitForSelector('.discogs-bar', { timeout: 40000 }).then(() => true).catch(() => false);
    ck(ok, 'the toolbar still mounts on a release whose only source is its titles');
    await page.waitForFunction(() => [...document.querySelectorAll('.discogs-src-icons .discogs-src-ico')].some(e => e.dataset.src === 'Titles'), null, { timeout: 30000 }).catch(() => {});
    const icons = await page.locator('.discogs-src-icons .discogs-src-ico').evaluateAll(els => els.map(e => e.dataset.src));
    console.log('sources on the remix release: ' + JSON.stringify(icons));
    const late = consoleLines.filter(l => /Titles:|title-remix|mounting/i.test(l));
    late.forEach(l => console.log('   ' + l));
    ck(icons.includes('Titles'), 'and the Titles source is offered — a result arriving after the mount is not lost');
}

ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
