import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control', values: { 'mc.settings': JSON.stringify({ v: 2, reloadAfter: false }) } } });

test('completed parallel provider updates while the other is still applying', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/release/e91b84a9-6b98-4d64-b4fc-753a9c674c4c', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const rec = document.querySelector('#content table.medium a[href*="/recording/"]').href.match(/recording\/([0-9a-f-]{36})/)[1];
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    window.__pendingApply = {};
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => {
        send('mc:findings', { id: 'is', run: d.run, findings: [{ key: rec, track: rec, isrc: 'XXA0Z2600040', state: 'new', existing: [], linkUrls: [] }] });
        send('mc:findings', { id: 'as', run: d.run, findings: [{ key: 'discogs', name: 'Discogs', url: 'https://www.discogs.com/release/1', state: 'new' }] });
      }, 50);
    });
    document.addEventListener('mc:apply', e => { const d = JSON.parse(e.detail); window.__pendingApply[d.id] = d; });
    window.__finishApply = id => { const d = window.__pendingApply[id]; send('mc:applied', { id, run: d.run, ok: true, sent: 1, note: 'done' }); };
    ['is', 'as'].forEach(id => send('mc:provider', { id, name: id, version: 1, capabilities: ['probe', 'apply'] }));
  });
  await page.click('#mc-launch');
  await page.click('#mc-root [data-act="probe"]');
  await until(() => page.evaluate(() => (window.__mcTest.picked().is || []).length && (window.__mcTest.picked().as || []).length), Boolean);
  await page.evaluate(() => { window.__mcTest.execute(false); });
  await until(() => page.evaluate(() => !!window.__pendingApply.is && !!window.__pendingApply.as), Boolean);
  await page.evaluate(() => window.__finishApply('is'));
  const left = await until(() => page.evaluate(() => (window.__mcTest.picked().is || []).length), n => n === 0, { timeout: 3000 });
  check(left === 0, 'ISRC Scout is marked done before Art Station answers');
  check(/Executing/.test(await page.locator('#mc-root [data-act="exec"]').textContent()), 'the overall run is still executing');
  await page.evaluate(() => window.__finishApply('as'));
  await until(() => page.locator('#mc-root [data-act="exec"]').textContent(), t => !/Executing/.test(t));
});
