// #531 (majkinetor): "Toolbar sometimes doesn't appear" — until you refresh.
//
// Cause, the same shape as art_station #530: the bootstrap did
//
//     getSourceUrlsForRelease(mbid).catch(() => ({}))
//
// and getSourceUrlsForRelease was a bare fetch().json() with no ok-check and no
// retry. MusicBrainz answers a busy moment with a 503 HTML page, .json() throws,
// the catch turns it into `{}` = "no linked sources", and the very next line is
//
//     if (!hasProvider && remixCount === 0) return;   // don't mount
//
// so the toolbar silently never appeared. A refresh usually hit a healthy MB,
// which is exactly the "sometimes" in the title.
//
// This stubs /ws/js/release to fail deterministically instead of waiting for MB
// to have a bad moment.
// Run: node test/probe-531-toolbar-missing.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { launchTestContext } from './lib/browser.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'dist', 'credit_hoarder.user.js');
// A release whose track titles yield NO derivable remixers — critical, because
// `remixCount > 0` would keep the toolbar alive on its own and make the whole
// test vacuous (the first version of this file used a "Remixes" release and
// "passed" against the unfixed code for exactly that reason).
// The Discogs link is supplied by the route stub below, so the only thing that
// can mount the bar here is the source probe succeeding.
const REL = 'https://musicbrainz.org/release/bafa58c1-e9b3-4ed3-b42d-70a387e411f4/edit-relationships';

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const code = await readFile(SCRIPT, 'utf8');
const ctx = await launchTestContext();
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));

let relHits = 0, mode = 'fail';
await page.route(u => /\/ws\/js\/release\/[0-9a-f-]{36}\?.*inc=rels/.test(u.href), async route => {
    relHits++;
    if (mode === 'fail') return route.fulfill({ status: 503, contentType: 'text/html', body: '<html>busy</html>' });
    // healthy: exactly one Discogs link, in MB's /ws/js shape
    return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ relationships: [{ target: { sidebar_name: 'Discogs', href_url: '//www.discogs.com/release/1234' } }] }),
    });
});

async function load() {
    for (let a = 1; ; a++) {
        try { await page.goto(REL, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
        catch (e) { if (a >= 3) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
    }
    if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
    await page.waitForTimeout(800);
    const shim = `window.GM_info = window.GM_info || { script: { name: 'CH (test)', version: 'test' }, scriptHandler: 'Playwright', version: 'test' };`;
    await page.addScriptTag({ content: shim + code });
}

// ── the reported symptom: MB is failing ─────────────────────────────────────
relHits = 0;
await load();
// the retries take a few seconds; give them room, then look
const appeared = await page.waitForSelector('.discogs-bar', { timeout: 30000 }).then(() => true).catch(() => false);
console.log('requests while failing: ' + relHits);
ck(appeared, 'the toolbar STILL mounts when the source lookup fails (this is the bug)');
ck(relHits >= 2, 'the failing lookup was retried, not accepted first time (' + relHits + ')');
if (appeared) {
    const warn = (await page.locator('.discogs-src-probe-failed').textContent().catch(() => '')) || '';
    console.log('warning shown: ' + JSON.stringify(warn.trim()));
    ck(/could not read/i.test(warn), 'and it says why it has no sources rather than looking empty');
}

// ── control: with MB healthy the toolbar mounts with its real sources ───────
mode = 'ok';
relHits = 0;
await load();
await page.waitForSelector('.discogs-bar', { timeout: 30000 });
const icons = await page.locator('.discogs-src-icons .discogs-src-ico').count();
const warnGone = await page.locator('.discogs-src-probe-failed').count();
const iconNames = await page.locator('.discogs-src-icons .discogs-src-ico').evaluateAll(els => els.map(e => e.dataset.src));
console.log('healthy: ' + icons + ' source icon(s) ' + JSON.stringify(iconNames) + ', warning nodes ' + warnGone);
ck(iconNames.includes('Discogs'), 'with MusicBrainz healthy the Discogs source is listed');
ck(!iconNames.includes('Titles'), 'and this release offers no Titles source, so the probe is the ONLY thing that mounts the bar');
ck(warnGone === 0, 'and no failure warning is shown');

ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
