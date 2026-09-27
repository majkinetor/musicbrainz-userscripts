// #531 (majkinetor): the toolbar sometimes appeared only after ~10 s, with nothing to
// say why, and the log spoke of "6 links" on a release with one.
//
// Diagnostics: every boot phase is stamped against script start; the log is mirrored
// to the console, so it exists even when the bar (which owns the log) hasn't mounted;
// the link count is the release's real url count, not the six provider slots CH looks
// for.
//
// The cause, found with them: "Boot: title-remix probe done (+12347ms)". The remix
// probe reads the tracklist from the public, rate-limited /ws/2 API, and all it
// decides is whether to offer the "Titles" source, yet the toolbar waited for it.
// It no longer does, and a late Titles result still reaches the toolbar.
//
// test.musicbrainz.org, read-only.
import { test, check, requireLogin, SANDBOX } from '../../../dev/test/harness.mjs';

const GM_INFO = "window.GM_info = window.GM_info || { script: { name: 'CH (test)', version: 'test' }, scriptHandler: 'Playwright', version: 'test' };\n";
const NIGHT_ILLUSION = `${SANDBOX}/release/fdb4fbd8-fcc9-4469-b3a4-a91c1975dde5/edit-relationships`;   // one Discogs link, no remixes
const REMIXES = `${SANDBOX}/release/9929e7ce-77d2-40e9-8cf3-e9d853e8e027/edit-relationships`;          // every title names a remixer
test.use({ gm: false });

async function open(page, url) {
  for (let a = 1; ; a++) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) throw e; await page.waitForTimeout(4000); }
  }
  await requireLogin(page);
  await page.waitForTimeout(500);
}
const consoleOf = page => { const lines = []; page.on('console', m => { if (m.text().includes('[credit_hoarder]')) lines.push(m.text()); }); return lines; };

test('boot is logged phase by phase, to the console too, with the real link count', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const consoleLines = consoleOf(page);
  await open(page, NIGHT_ILLUSION);
  await inject('credit_hoarder', { transform: code => GM_INFO + code });
  check(await page.waitForSelector('.discogs-bar', { timeout: 40000 }).then(() => true).catch(() => false), 'the toolbar mounts');
  await page.waitForTimeout(500);

  check(consoleLines.some(l => /Boot: script running/.test(l)), `the log is mirrored to the console from the first line, before the bar exists (${consoleLines.length} lines)`);
  const logText = (await page.locator('.discogs-output').textContent().catch(() => '')) || '';
  for (const p of ['Boot: script running', 'Boot: DOM ready', 'Boot: source probe done', 'Boot: toolbar mounted']) {
    check(logText.includes(p) || consoleLines.some(l => l.includes(p)), `phase logged: "${p}"`);
  }
  check(/Boot: toolbar mounted \(\+\d+ms/.test(logText), 'the mount line carries the time since script start');
  const rel = logText.match(/MusicBrainz returned (\d+) relationship\(s\)[^,]*, (\d+) of them url\(s\)/) || [];
  const src = logText.match(/(\d+) import source\(s\) from (\d+) link\(s\)/) || [];
  check(rel.length && src.length && src[2] === rel[2], `the source line's link count is the release's url count (${src[2]} = ${rel[2]}), not the 6 provider slots`);
});

test("the toolbar doesn't wait for the tracklist probe, and a late Titles result still arrives", { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  // 4 s: under the throttle's own 10 s timeout, which would abort and retry
  const STALL_MS = 4000;
  let stalled = 0;
  await page.route(u => /\/ws\/2\/release\/[0-9a-f-]{36}\?.*inc=recordings/.test(u.href), async route => {
    stalled++;
    await new Promise(r => setTimeout(r, STALL_MS));
    return route.fallback().catch(() => {});
  });
  await open(page, NIGHT_ILLUSION);
  const t0 = Date.now();
  await inject('credit_hoarder', { transform: code => GM_INFO + code });
  const appeared = await page.waitForSelector('.discogs-bar', { timeout: 30000 }).then(() => Date.now() - t0).catch(() => null);
  check(appeared != null && appeared < STALL_MS - 1500, `the toolbar mounts without waiting for the probe (${appeared} ms, probe stalled ${STALL_MS} ms)`);
  check(stalled >= 1, `the stall was in effect (${stalled} requests held)`);
  const icons = await page.locator('.discogs-src-icons .discogs-src-ico').evaluateAll(els => els.map(e => e.dataset.src));
  check(icons.includes('Discogs'), `the linked source is usable at once (${JSON.stringify(icons)})`);

  // a release whose titles name remixers: Titles arrives after the mount
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await open(page, REMIXES);
  await inject('credit_hoarder', { transform: code => GM_INFO + code });
  check(await page.waitForSelector('.discogs-bar', { timeout: 40000 }).then(() => true).catch(() => false), 'the toolbar mounts on the remix release');
  await page.waitForFunction(() => [...document.querySelectorAll('.discogs-src-icons .discogs-src-ico')].some(e => e.dataset.src === 'Titles'), null, { timeout: 30000 }).catch(() => {});
  const late = await page.locator('.discogs-src-icons .discogs-src-ico').evaluateAll(els => els.map(e => e.dataset.src));
  check(late.includes('Titles'), `the Titles source is offered (${JSON.stringify(late)})`);
});
