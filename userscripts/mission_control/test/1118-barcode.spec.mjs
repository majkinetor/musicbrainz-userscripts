// #1118: a consolidation from a barcode. String Theory's palette opens /release/add#mc=<token>&bc=<barcode>
// with no album stored; Platform Check looks the barcode up (mc:barcode-find), First Contact reads the first
// album found, and that album is the source of an ordinary consolidation.
//
// Fixture: Daft Punk, "Discovery" (barcode 724384960650, 14 tracks), as in 702-consolidate.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

const BARCODE = '724384960650';

test.use({ gm: { name: 'Mission Control' } });

test('a barcode alone starts a consolidation', { tag: ['@sandbox', '@web'] }, async ({ page, inject }, info) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`${SANDBOX}/release/add#mc=btest1118&bc=${BARCODE}`, { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  await inject('platform_check', { waitFor: '__pcTest702' });
  await inject('mission_control', { waitFor: '__mccTest' });
  await page.waitForSelector('#mcc-root');
  const src = await until(() => page.evaluate(() => { const s = window.__mccTest.state(); return { bc: s.bc && s.bc.state, err: s.error, src: s.src && s.src.source }; }),
    s => s.src || s.err || s.bc === 'none', { timeout: 120_000 });
  console.log(JSON.stringify(src));
  check(src.src && !src.err, `an album found by the barcode is the source: ${JSON.stringify(src)}`);
  const st = await until(() => page.evaluate(() => { const s = window.__mccTest.state(); return { pc: s.pc.state, n: s.sources.length }; }), s => s.pc === 'done', { timeout: 180_000 });
  check(st.n >= 3, `then Platform Check found it on the other platforms (${st.n} sources)`);
  const m = await page.evaluate(() => { const m = window.__mccTest.model(); return { title: m.fields.title.win && m.fields.title.win.val, barcode: m.fields.barcode.win && m.fields.barcode.win.show }; });
  check(/Discovery/.test(m.title || '') && /724384960650$/.test(m.barcode || ''), `the consolidation has the album: ${JSON.stringify(m)}`);
  await info.attach('barcode consolidation', { body: await page.screenshot(), contentType: 'image/png' });
});

test('a barcode no platform has says so', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  test.setTimeout(120_000);
  await page.goto(`${SANDBOX}/release/add#mc=btest1118n&bc=4006381333931`, { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  await inject('platform_check', { waitFor: '__pcTest702' });
  await inject('mission_control', { waitFor: '__mccTest' });
  await page.waitForSelector('#mcc-root');
  const err = await until(() => page.evaluate(() => window.__mccTest.state().error), Boolean, { timeout: 90_000 });
  console.log(JSON.stringify(await page.evaluate(() => window.__mccTest.state().bc)));
  check(/barcode 4006381333931/.test(err), `the error names the barcode: ${err}`);
  check(/command palette/.test(await page.locator('#mcc-root').textContent()), 'and points to the palette to try another');
});
