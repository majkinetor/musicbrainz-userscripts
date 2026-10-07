// #680: Art Station's rows are the sources it searched, not covers to enter: only the best cover's
// row says it enters, the others say "searched", and the step counts one cover, not one per row.
// A stand-in AS answers the probe the way AS does (role 'best' / 'searched').
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's

test('#680: AS rows: the best enters, the rest were searched', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    const row = (name, url, role) => ({ key: name, name, url, state: 'new', role,
      why: role === 'best' ? 'the best cover (1400×1200); larger than the current front (500×500), which it replaces' : 'searched; only Bandcamp\'s larger cover is entered' });
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'as', run: d.run, summary: 'Cover art: 1 image, front cover ✓',
        findings: [row('Discogs', 'https://www.discogs.com/release/8846789', 'searched'), row('Bandcamp', 'https://x.bandcamp.com/album/y', 'best'), row('Deezer', 'https://www.deezer.com/album/1', 'searched')],
        best: { provider: 'Bandcamp', w: 1400, h: 1200, bytes: 300000, of: 3, larger: true, replace: true, current: { id: 1, w: 500, h: 500, bytes: 48000 } } }), 50);
    });
    send('mc:provider', { id: 'as', name: 'Art Station', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  const lines = page.locator('#mc-root [data-card="as"] .mc-line');
  await lines.first().waitFor();
  const got = await lines.evaluateAll(ls => ls.map(l => ({ t: l.querySelector('.t').textContent, pill: l.querySelector('.mc-pill').textContent, on: l.classList.contains('on') })));
  console.log(JSON.stringify(got));
  const by = n => got.find(x => x.t === n) || {};
  check(by('Bandcamp').pill === 'enters', 'the best cover\'s row: enters');
  check(by('Discogs').pill === 'searched' && by('Deezer').pill === 'searched', 'the other rows: searched');
  check(got.every(x => x.on), 'every source stays ticked: they are the pool the best comes from');
  const step = await page.locator('#mc-root .mc-step[data-step="as"]').innerText();
  console.log(step);
  check(/1 cover to enter/.test(step), 'the step counts one cover, not one per row');
  await page.locator('#mc-root [data-card="as"]').screenshot({ path: 'test-results/mc-680-as-searched-rows.png' });
});
