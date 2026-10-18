// #772: in Violentmonkey on Firefox an interval can outlive its clearInterval (#680). The frame's sourcing ran on one,
// and its extra pass found only the best front left: it emptied the stores' other images Mission Control had just been
// offered, so Execute with only the back taken in said "nothing to enter: Discogs#2 not found this time" at once.
//
// The frame here gets a clearInterval that does nothing, as Firefox's did. The release is linked to a Discogs release
// with a front and a back (the real store, so @web); every POST is aborted, so nothing is uploaded.
//
// The back is in this release's archive too (772-mc-dup-unprocessed needs it there), and since #784 a store image
// already in the archive can't be taken in. The first spec compares nothing with the archive, so the back is offered
// as new and can be taken in for Execute.
import { test, check, until, requireLogin, SANDBOX } from '../../../dev/test/harness.mjs';
import { blockPosts } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

const quick = code => code
  .replace('function arDelayMs(attempt) {', 'function arDelayMs(attempt) { return 300;')
  .replace('const arTimes = () =>', 'const arTimes = () => 1 || ');
const noArchive = code => quick(code).replace('const a = arch.find(', 'const a = null && arch.find(');
const REL = '1c0d1707-e032-48a4-acd8-dbaac77be17f';   // Journey Inwards, linked to discogs.com/release/1118432

test('#772: the frame sources once, so the images offered are there at Execute', { tag: ['@sandbox', '@login', '@web'] }, async ({ page, inject }) => {
  test.setTimeout(240_000);
  await blockPosts(page);
  await page.goto(`${SANDBOX}/release/${REL}`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await inject('art_station');
  await page.evaluate(() => {
    window.__f = null; window.__a = null; window.__bests = 0;
    document.addEventListener('mc:findings', e => { window.__f = JSON.parse(e.detail); });
    document.addEventListener('mc:applied', e => { window.__a = JSON.parse(e.detail); });
    window.addEventListener('message', e => { if (e.data && e.data.mcAs === 1 && e.data.type === 'best') window.__bests++; });
    document.dispatchEvent(new CustomEvent('mc:probe', { detail: JSON.stringify({ run: 1 }) }));
  });
  const fr = await until(() => page.frames().find(f => /mc_frame=/.test(f.url())) || null, Boolean, { timeout: 60000 });
  await fr.waitForLoadState('domcontentloaded');
  await fr.evaluate(() => { window.clearInterval = () => {}; });
  await inject('art_station', { target: fr, transform: noArchive });
  await page.waitForFunction(() => window.__f, null, { timeout: 150_000, polling: 500 });
  const extras = await until(() => fr.evaluate(() => window.__asTest.mc.model().filter(x => x._mcPool && x._mcKey).map(x => x._mcKey)), v => v.includes('Discogs#2'));
  console.log('offered', JSON.stringify(extras));
  check(extras.includes('Discogs#2'), `the back is offered (${extras})`);
  await page.waitForTimeout(3000);   // the extra pass, if any, comes within a beat
  check(await page.evaluate(() => window.__bests) === 1, `the frame answered once (${await page.evaluate(() => window.__bests)})`);

  // #784: the back taken in on its card in the gallery, the best front left out; Execute then has a plan to enter
  await page.evaluate(() => { window.__plan = null; document.addEventListener('mc:plan', e => { window.__plan = JSON.parse(e.detail); }); document.dispatchEvent(new CustomEvent('mc:stage', { detail: JSON.stringify({ id: 'as', front: false }) })); });
  const id = await fr.evaluate(() => { const x = window.__asTest.mc.model().find(m => m._mcKey === 'Discogs#2'); x.types = ['Back']; return x.id; });
  await fr.evaluate(i => document.querySelector(`.as-card[data-id="${i}"] .as-undo`).click(), id);   // the frame shows nowhere here (no card)
  await until(() => page.evaluate(() => window.__plan), p => p && p.more >= 1);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('mc:apply', { detail: JSON.stringify({ id: 'as', run: 2, mc: 'test', keys: [] }) })));
  const a = await until(() => page.evaluate(() => window.__a), Boolean, { timeout: 150_000 });
  console.log(JSON.stringify(a));
  check(!!a, 'Execute answers');
  check(!/not found this time|nothing to enter/.test((a && a.note) || ''), `the back is found at Execute (${a && a.note})`);
});

// #772: the best front went in typed Front only when it replaced a smaller one; added beside the archive's covers it
// went in untyped (a Discogs image has no type), so Execute entered "the front cover" as an image with no type. Art
// Station's own first-import Front is off here, as it is when the release has a Front already
test('#772: the best front is typed Front when it is entered', { tag: ['@sandbox', '@login', '@web'] }, async ({ page, inject }) => {
  test.setTimeout(240_000);
  await blockPosts(page);
  await page.goto(`${SANDBOX}/release/${REL}`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await inject('art_station');
  await page.evaluate(() => {
    window.__f = null; window.__a = null;
    document.addEventListener('mc:findings', e => { window.__f = JSON.parse(e.detail); });
    document.addEventListener('mc:applied', e => { window.__a = JSON.parse(e.detail); });
    document.dispatchEvent(new CustomEvent('mc:probe', { detail: JSON.stringify({ run: 1 }) }));
  });
  const fr = await until(() => page.frames().find(f => /mc_frame=/.test(f.url())) || null, Boolean, { timeout: 60000 });
  await fr.waitForLoadState('domcontentloaded');
  await inject('art_station', { target: fr, transform: c => quick(c).replace('function maybeAutoFront(news) {', 'function maybeAutoFront(news) { return;') });
  await page.waitForFunction(() => window.__f, null, { timeout: 150_000, polling: 500 });
  const best = await page.evaluate(() => window.__f.best && window.__f.best.provider);
  check(best === 'Discogs', `Discogs gives the best front (${best})`);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('mc:apply', { detail: JSON.stringify({ id: 'as', run: 2, mc: 'test', keys: ['Discogs'] }) })));
  const types = await until(() => fr.evaluate(() => { const x = window.__asTest.mc.model().find(m => m._new && !m._del); return x ? x.types.join('+') : null; }), v => v !== null, { timeout: 60_000 });
  console.log('best front types', types);
  check(/(^|\+)Front(\+|$)/.test(types || ''), `typed Front (${types})`);
});
