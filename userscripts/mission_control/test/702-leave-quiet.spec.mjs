// majkinetor: the browser asked "leave page?" on the consolidation page with nothing changed. MB's release editor
// under the review warns on beforeunload once the page has had a click; while the review covers it, Mission
// Control sets the editor's own flag for leaving on purpose, and clears it when the review is closed (the empty
// editor is then the user's, and its warning is back). No platform is read: a stored album is enough.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

const TOKEN = 'ctestquiet';
const REL = {
  url: 'https://www.deezer.com/album/302127', title: 'Discovery', barcode: '724384960650',
  credit: [{ name: 'Daft Punk', join: '' }], labels: [],
  mediums: [{ tracks: [{ title: 'One More Time', length: 320000, isrc: null, credit: [{ name: 'Daft Punk', join: '' }] }] }],
};

test.use({ gm: { name: 'Mission Control', persist: true } });

async function openReview(page, inject) {
  await page.goto(`${SANDBOX}/release/add#mc=${TOKEN}`, { waitUntil: 'domcontentloaded' });
  await inject('mission_control', { waitFor: '__mccTest' });
  await page.evaluate(({ token, rel }) => GM_setValue('fc.handoff.cons.' + token,
    { v: 1, token, created: Date.now(), source: 'deezer', sourceName: 'Deezer', platform: { id: 'deezer', name: 'Deezer' }, id: '302127', page: rel.url, url: rel.url, rel }), { token: TOKEN, rel: REL });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await inject('mission_control', { waitFor: '__mccTest' });
  await page.waitForSelector('#mcc-root');
  await until(() => page.evaluate(() => !!(window.MB && MB.releaseEditor && MB.releaseEditor.rootField)), x => x, { timeout: 30_000 });
}
// leaves the page as closing the tab does, and says whether the browser asked first
async function asksOnLeave(page) {
  let asked = false;
  page.on('dialog', d => { if (d.type() === 'beforeunload') asked = true; d.accept().catch(() => {}); });
  await page.close({ runBeforeUnload: true });
  await until(async () => asked || page.isClosed(), x => x, { timeout: 10_000 });
  return asked;
}

test('leaving the consolidation page asks nothing while the review covers the editor', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await openReview(page, inject);
  await page.locator('#mcc-root .mcc-side').click();   // the editor warns only once the page has had a click
  check(await page.evaluate(() => MB.releaseEditor.rootField.redirecting === true), "the release editor's flag for leaving on purpose is on");
  check(!(await asksOnLeave(page)), 'the browser asks nothing on leaving');
});

test('once the review is closed, the empty editor warns again', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await openReview(page, inject);
  await page.locator('#mcc-root [data-cc="close"]').click();
  check(await page.evaluate(() => MB.releaseEditor.rootField.redirecting === false), "the release editor's flag is off again");
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  check(await asksOnLeave(page), "the browser asks on leaving, as MusicBrainz's editor does");
});
