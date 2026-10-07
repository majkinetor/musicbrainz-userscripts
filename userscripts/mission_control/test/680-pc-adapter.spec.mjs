// #680 Mission Control ↔ Platform Check: the first provider adapter.
// MC loads first and PC second, so PC's hello on load is what connects them (not
// MC's discover). Probe then waits for PC's own scan and fills the Platforms card
// with one row per platform; the confirmed ones are ticked and counted.
// Nothing is submitted: Execute goes to a stand-in Falcon.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // sandbox copy of "Bad Boys!" (dev/test/sandbox-copies.json)

test('#680: Probe asks Platform Check and shows its platforms', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('platform_check', { waitFor: '__pcTest680' });
  check(!!(await page.evaluate(() => window.__mcTest.found().pc)), 'PC announced itself to MC on load');
  // a release link where MusicBrainz offers several types and picks none goes to Falcon with PC's
  // own pick, or Falcon drops it as "ambiguous relationship type" (Bandcamp album, #680)
  const types = await page.evaluate(() => ['https://fingersinthenoise.bandcamp.com/album/discret-lounge-june-2011', 'https://music.apple.com/us/album/x/123', 'https://www.qobuz.com/gb-en/album/x/abc', 'https://open.spotify.com/album/abc']
    .map(u => window.__pcTest680.pcMcReleaseLinkTypes(u)[0].linkTypeId));
  check(JSON.stringify(types) === '[85,980,74,null]', `release link types: Bandcamp 85, Apple 980, Qobuz 74, Spotify left to MusicBrainz (${JSON.stringify(types)})`);

  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  check(/connected/.test(await page.locator('#mc-root .mc-step[data-step="pc"]').getAttribute('title')), 'PC step reads connected');

  // the header pulses while the probe is out (seen at any point), and stops once it's answered
  await page.evaluate(() => { const h = document.querySelector('#mc-root .mc-hdr'); window.__busySeen = h.classList.contains('mc-busy'); new MutationObserver(() => { if (h.classList.contains('mc-busy')) window.__busySeen = true; }).observe(h, { attributes: true }); });
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-line', { timeout: 180_000 });
  // the release's platforms only: PC's artist and label links (#680) are rows too, marked mc-ent
  const rows = await page.locator('#mc-root [data-card="pc"] .mc-line:not(.mc-ent)').count();
  console.log('artist/label link rows: ' + await page.locator('#mc-root [data-card="pc"] .mc-line.mc-ent').count());
  const enabled = await page.evaluate(() => document.querySelectorAll('[id^="mb-online-"]').length);
  console.log(`platform rows: ${rows} · PC panel rows: ${enabled}`);
  const none = await page.locator('#mc-root [data-card="pc"] .mc-none .mc-pico').count();
  // the release's linked platforms are icons in the card's header; the artists' and labels' sit on their sub-heading
  const linkedIcons = await page.locator('#mc-root .mc-sect-h .mc-linked .mc-pico:not(.mc-ent)').count();
  check(await page.locator('#mc-root .mc-sect-h .mc-linked .mc-pico.mc-ent').evaluateAll(ps => ps.every(p => !/·/.test(p.title))), 'no artist or label icon in the header');
  const linkedAll = (await page.locator('#mc-root .mc-linked .mc-lk').allTextContents()).reduce((n, t) => n + +t.replace(/\D/g, ''), 0);
  check(rows + none + linkedIcons === enabled, `every platform PC scanned is a row, a linked icon in the header, or a not-found icon (${rows} + ${linkedIcons} + ${none} of ${enabled})`);
  check(await page.locator('#mc-root [data-card="pc"] .mc-line.linked').count() === 0, 'linked platforms are not rows by default');
  if (linkedAll) {
    await page.locator('#mc-root .mc-linked').first().click();
    check(await page.locator('#mc-root [data-card="pc"] .mc-line.linked').count() === linkedAll, 'clicking the linked icons lists them as rows');
    const order = await page.locator('#mc-root [data-card="pc"] .mc-line').evaluateAll(ls => ls.map(l => l.classList.contains('linked')));
    check(order.indexOf(true) === -1 || order.slice(order.indexOf(true)).every(Boolean), 'linked rows come last');
    await page.locator('#mc-root .mc-linked').first().click();
    check(await page.locator('#mc-root [data-card="pc"] .mc-line.linked').count() === 0, 'and fold back');
  }

  const states = await page.locator('#mc-root [data-card="pc"] .mc-line').evaluateAll(ls => ls.map(l => l.className.replace('mc-line ', '')));
  console.log('states: ' + JSON.stringify(states));
  const nNew = states.filter(s => s === 'new').length;
  const ticked = await page.locator('#mc-root [data-card="pc"] .mc-pick.on').count();
  check(ticked === nNew, `ticked by default = the confirmed ones (${ticked} of ${nNew})`);
  check((await page.locator('#mc-root [data-act="exec"]').textContent()) === (nNew ? 'Execute (' + nNew + ')' : 'Execute'), 'Execute counts the ticked rows');

  // unticking one changes the count
  if (nNew) {
    await page.locator('#mc-root [data-card="pc"] .mc-pick.on .mc-tick').first().click();
    check((await page.locator('#mc-root [data-act="exec"]').textContent()) === (nNew - 1 ? 'Execute (' + (nNew - 1) + ')' : 'Execute'), 'unticking lowers the count');
  }
  check(!/busy|stalled/.test(await page.locator('#mc-root .mc-step[data-step="pc"]').getAttribute('class')), 'PC step no longer busy');

  // the cards under the tracks: only installed providers' (AS and CH aren't here), so PC has the width
  const cards = () => page.evaluate(() => { const row = document.querySelector('#mc-root .mc-row2'), vis = s => !!(s && s.offsetParent);
    const box = s => s && s.closest('.mc-sect').getBoundingClientRect(), rw = row.getBoundingClientRect().width;
    const pc = document.querySelector('#mc-root [data-card="pc"]'), as = document.querySelector('#mc-root [data-card="as"]'), ch = document.querySelector('#mc-root .mc-chrel');
    // reading order: each card right of the one before on its line, or on a line below it
    const order = [pc, as, ch].filter(vis).map(box).every((b, i, a) => !i || (b.top === a[i - 1].top ? b.left > a[i - 1].left : b.top > a[i - 1].top));
    // no hole: with two columns the third card goes under the shorter of the first two
    const under = vis(ch) && vis(as) ? (box(as).bottom <= box(pc).bottom ? box(ch).left === box(as).left : box(ch).left === box(pc).left) : null;
    return { pc: vis(pc), as: vis(as), ch: vis(ch), pcFull: vis(pc) && Math.abs(box(pc).width - rw) < 2, order, under, align: getComputedStyle(row).alignItems }; });
  const c1 = await cards();
  check(c1.pc && !c1.as && !c1.ch && c1.pcFull, `no empty card for a provider not on the page; PC alone takes the width (${JSON.stringify(c1)})`);
  // a provider that turns up brings its card, after the links in reading order
  await page.evaluate(() => ['as', 'ch'].forEach(id => document.dispatchEvent(new CustomEvent('mc:provider', { detail: JSON.stringify({ id, name: id, version: 1, capabilities: ['probe'] }) }))));
  const c2 = await cards();
  check(c2.pc && c2.as && c2.ch && !c2.pcFull && c2.order && c2.under && c2.align === 'flex-start', `reading order, release credits under the shorter card, none stretched to its neighbour (${JSON.stringify(c2)})`);
  check(await page.evaluate(() => window.__busySeen), 'the header pulsed while probing');
  // it ends where a pulse cycle does (a fade, not a cut), so within one cycle
  check(!(await until(() => page.locator('#mc-root .mc-hdr.mc-busy').count(), n => n === 0, { timeout: 4000 })), 'and stopped once the probe was answered');

  // Apply. No Falcon on the page first: PC says so, and the card shows the failure.
  const pickable = page.locator('#mc-root [data-card="pc"] .mc-pick');
  test.skip(!(await pickable.count()), 'no platform to tick on this fixture');
  await page.evaluate(() => { let c, n = 0; while ((c = document.querySelector('#mc-root .mc-pick.on')) && n++ < 500) c.click(); });
  await pickable.first().locator('.mc-tick').click();   // the row's edge: its middle can be the url, a link that opens
  check(await page.locator('#mc-root [data-act="exec"]').isEnabled(), 'Execute enabled once something is ticked');
  await page.click('#mc-root [data-act="exec"]');
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-applied');
  check(/Falcon is not running/.test(await page.locator('#mc-root [data-card="pc"] .mc-applied.err').textContent()), 'no Falcon: failure on the card');

  // A stand-in for Falcon records what it's handed (Falcon's own run is its own tests' job).
  await page.evaluate(() => {
    window.__falconGot = [];
    for (const ev of ['falcon:run', 'falcon:import']) document.addEventListener(ev, e => { window.__falconGot.push({ ev, json: JSON.parse(e.detail) }); document.dispatchEvent(new CustomEvent('falcon:import-ok')); });
  });
  await page.evaluate(() => { window.__mcTest.execute(true); });   // Dry run: the test hook only (#680)
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-applied.ok');
  await page.click('#mc-root [data-act="exec"]');
  await page.waitForFunction(() => window.__falconGot.length === 2);
  const got = await page.evaluate(() => window.__falconGot);
  check(got[0].ev === 'falcon:import' && got[1].ev === 'falcon:run', 'dry run queues, Execute runs');
  const item = got[1].json.items[0];
  check(item.entityType === 'release' && item.mbid === RELEASE && new Set(item.urls.map(u => u.url)).size === 1, 'one release item with the ticked link');
  const want = await page.evaluate(u => window.__pcTest680.pcMcReleaseLinkTypes(u), item.urls[0].url);
  check(JSON.stringify(item.urls) === JSON.stringify(want), `the link goes with PC's link type (${JSON.stringify(item.urls)})`);
  const state = await pickable.first().evaluate(c => c.closest('.mc-line').className);
  if (/withheld/.test(state)) check(/added by hand over link confidence/.test(got[1].json.note), 'a withheld link ticked by hand is noted as forced');
  // the header line names GM_info's script, which in this test is the shared shim's; the confidence line is PC's own
  check(/Link confidence:/.test(got[1].json.note), "PC's own edit note");
  // #680: Execute runs Falcon headless, tagged; Falcon's falcon:status for that tag shows in the card
  const tag = got[1].json.tag;
  check(got[1].json.headless === true && /^mc:pc:/.test(tag || '') && !got[0].json.headless, `Execute is headless and tagged (${tag}); a dry run is not`);
  await page.evaluate(([tag, mbid]) => {
    const st = (status, error) => document.dispatchEvent(new CustomEvent('falcon:status', { detail: JSON.stringify({ tag, running: status === 'active', items: [{ entityType: 'release', mbid, name: 'Bad Boys!', status, error, urls: 1, cover: 0 }] }) }));
    st('active', ''); window.__st = st;
  }, [tag, RELEASE]);
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-falcon .mc-falcon-i.st-active');
  check(/Falcon is running: 0 of 1 finished/.test(await page.locator('#mc-root [data-card="pc"] .mc-falcon').textContent()), 'the card shows Falcon running');
  check(await page.locator('#mc-root .mc-hdr.mc-busy').count() === 1, 'the header pulses while Falcon runs the batch Execute handed over');
  await page.evaluate(() => window.__st('failed', 'MB said no'));
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-falcon.bad .mc-falcon-open');
  check(/MB said no/.test(await page.locator('#mc-root [data-card="pc"] .mc-falcon').textContent()), 'a failed item shows why, with Open Falcon');
  check(!(await until(() => page.locator('#mc-root .mc-hdr.mc-busy').count(), n => n === 0, { timeout: 4000 })), 'and stops when Falcon has finished');
  check(await page.locator('#mc-root [data-card="pc"] .mc-pick.on').count() === 1, 'a failed item stays picked');
  // once Falcon reports it done, the link shows as linked: no longer a picked row
  await page.evaluate(() => window.__st('done', ''));
  await page.waitForFunction(() => document.querySelectorAll('#mc-root [data-card="pc"] .mc-pick.on').length === 0, null, { timeout: 5000 }).catch(() => {});
  check(await page.locator('#mc-root [data-card="pc"] .mc-pick.on').count() === 0, 'a done item turns linked');
  await page.screenshot({ path: 'test-results/mc-680-pc.png' });
});
