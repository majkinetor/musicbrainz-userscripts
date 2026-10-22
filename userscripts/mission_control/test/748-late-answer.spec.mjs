// A provider that answers Execute after Mission Control stopped waiting (ISRC Scout submitting 94 links) still had
// its work taken: what it applied shows as applied, and Execute stops offering it. And a provider that finds it all
// on MusicBrainz already ("nothing left to add", doneKeys) has those items counted as done, not offered again.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';

test('#748: a late answer is still taken; doneKeys from a "nothing left" answer count as done', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  const recs = await page.evaluate(() => [...document.querySelectorAll('#content table.medium a[href*="/recording/"]')].slice(0, 2).map(a => a.href.match(/recording\/([0-9a-f-]{36})/)[1]));
  await page.evaluate(recs => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    window.__applies = [];
    const isrc = (r, i) => ({ key: r, track: r, isrc: 'XXA0Z26000' + (50 + i), state: 'new', source: 'Deezer', existing: [], links: 0, linkUrls: [] });
    const link = (r, i) => ({ key: `link:${r}:https://www.deezer.com/track/749${i}`, kind: 'link', track: r, url: `https://www.deezer.com/track/749${i}`, icon: 'deezer', state: 'new' });
    document.addEventListener('mc:probe', e => { const d = JSON.parse(e.detail); setTimeout(() => send('mc:findings', { id: 'is', run: d.run, release: d.release, findings: recs.map(isrc).concat(recs.map(link)) }), 50); });
    document.addEventListener('mc:apply', e => {
      const d = JSON.parse(e.detail); if (d.id !== 'is') return;
      window.__applies.push(d.keys.slice().sort());
      // the first apply: the links went through, the ISRCs didn't, said after Mission Control stopped waiting; the second: the ISRCs are there already
      if (window.__applies.length === 1) setTimeout(() => send('mc:applied', { id: 'is', run: d.run, release: d.release, ok: false, sent: 2, doneKeys: d.keys.filter(k => k.startsWith('link:')), note: '2 links submitted · ISRCs: submit failed (503)' }), 6000);
      else setTimeout(() => send('mc:applied', { id: 'is', run: d.run, release: d.release, ok: true, sent: 0, doneKeys: d.keys, note: 'nothing left to add: ' + d.keys.length + ' already on MusicBrainz' }), 50);
    });
    send('mc:provider', { id: 'is', name: 'ISRC Scout', version: 1, capabilities: ['probe', 'apply'] });
  }, recs);
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await until(() => page.evaluate(() => (window.__mcTest.picked().is || []).length), n => n === 4);
  // a silent provider: given up after 3 s of no word (60 s in use); its answer at 6 s is still taken
  await page.evaluate(() => window.__mcTest.setApplyWait(3000, 60_000));
  await page.click('#mc-root [data-act="exec"]');
  await until(() => page.evaluate(() => window.__mcTest.results().is.applied && window.__mcTest.results().is.applied.note), n => /no word for 3 s/.test(n || ''), { timeout: 10_000 });
  check((await page.evaluate(() => window.__mcTest.picked().is.length)) === 4, 'nothing marked while no answer came');
  const left = await until(() => page.evaluate(() => window.__mcTest.picked().is.slice().sort()), v => v.length === 2, { timeout: 10_000 });
  check(JSON.stringify(left) === JSON.stringify(recs.slice().sort()), `the late answer's links are done; the ISRCs are left (${JSON.stringify(left)})`);
  check(/links submitted/.test(await page.evaluate(() => window.__mcTest.results().is.applied.note)), 'the late answer replaced the timeout on the card');
  await page.click('#mc-root [data-act="exec"]');
  await until(() => page.evaluate(() => window.__applies.length), n => n === 2);
  const none = await until(() => page.evaluate(() => window.__mcTest.picked().is.length), n => n === 0, { timeout: 10_000 });
  check(none === 0, 'the doneKeys of a "nothing left to add" answer count as done');
});
