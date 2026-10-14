// #748: a provider whose apply went through in part says what did (mc:applied's doneKeys): MC shows it as done, so
// Execute's count drops to what is left and the done links are no longer offered; the failure offers Retry. A stand-in
// ISRC Scout submits the links and fails the ISRCs (503), as on majkinetor's release.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';

test('#748: what went through is done, though the step failed', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  const recs = await page.evaluate(() => [...document.querySelectorAll('#content table.medium a[href*="/recording/"]')].slice(0, 2).map(a => a.href.match(/recording\/([0-9a-f-]{36})/)[1]));
  await page.evaluate(recs => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    window.__applies = [];
    const isrc = (r, i) => ({ key: r, track: r, isrc: 'XXA0Z26000' + (40 + i), state: 'new', source: 'Deezer', existing: [], links: 0, linkUrls: [] });
    const link = (r, i) => ({ key: `link:${r}:https://www.deezer.com/track/748${i}`, kind: 'link', track: r, url: `https://www.deezer.com/track/748${i}`, icon: 'deezer', state: 'new' });
    document.addEventListener('mc:probe', e => { const d = JSON.parse(e.detail); setTimeout(() => send('mc:findings', { id: 'is', run: d.run, release: d.release, findings: recs.map(isrc).concat(recs.map(link)) }), 50); });
    document.addEventListener('mc:apply', e => {
      const d = JSON.parse(e.detail); if (d.id !== 'is') return;
      window.__applies.push(d.keys.slice().sort());
      const first = window.__applies.length === 1;
      setTimeout(() => send('mc:applied', first
        ? { id: 'is', run: d.run, release: d.release, ok: false, sent: 2, retry: true, doneKeys: d.keys.filter(k => k.startsWith('link:')), note: '2 links submitted · ISRCs: submit failed (503) (repeated 10 times)' }
        : { id: 'is', run: d.run, release: d.release, ok: true, sent: 2, note: '2 ISRCs submitted' }), 50);
    });
    send('mc:provider', { id: 'is', name: 'ISRC Scout', version: 1, capabilities: ['probe', 'apply'] });
  }, recs);
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await until(() => page.evaluate(() => (window.__mcTest.picked().is || []).length), n => n === 4);
  check((await page.locator('#mc-root [data-act="exec"]').textContent()).trim() === 'Execute (4)', 'four to send: two ISRCs, two links');
  await page.click('#mc-root [data-act="exec"]');
  const left = await until(() => page.evaluate(() => window.__mcTest.picked().is.slice().sort()), v => v.length === 2, { timeout: 10_000 });
  check(JSON.stringify(left) === JSON.stringify(recs.slice().sort()), `the links that went through are done; the ISRCs are left (${JSON.stringify(left)})`);
  check((await page.locator('#mc-root [data-act="exec"]').textContent()).trim() === 'Execute (2)', `Execute counts what is left (${(await page.locator('#mc-root [data-act="exec"]').textContent()).trim()})`);
  const retry = page.locator('#mc-root [data-act="retry-apply"][data-prov="is"]');
  check(await retry.count() === 1, 'the failure offers Retry');
  await retry.click();
  await until(() => page.evaluate(() => window.__applies.length), n => n === 2);
  check(JSON.stringify((await page.evaluate(() => window.__applies))[1]) === JSON.stringify(recs.slice().sort()), 'Retry sends only the ISRCs');
});
