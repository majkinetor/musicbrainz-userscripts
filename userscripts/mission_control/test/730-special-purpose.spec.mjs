// #730: a finding on a special-purpose artist or label ([no label], [unknown], Various Artists, …)
// is left out: since MBS-14146 a regular editor can't edit one, so Falcon could never apply it.
// A stand-in Platform Check answers the probe with one ordinary entity and two special-purpose ones.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's

test('#730: special-purpose entities are left out', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    const f = (key, type, mbid, name) => ({ key, name: 'Deezer', url: 'https://www.deezer.com/' + type + '/' + key, state: 'new', entity: { type, mbid, name } });
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, findings: [
        f('a1', 'artist', '056e4f3e-d505-4dad-8ec1-d04f521cbb56', 'Daft Punk'),
        f('l1', 'label', '157afde4-4bf5-4039-8ad2-5a15acc85176', '[no label]'),
        f('a2', 'artist', '125EC42A-7229-4250-AFC5-E057484327FE', '[unknown]'),   // case doesn't matter
      ] }), 50);
    });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.locator('#mc-root [data-card="pc"] .mc-line').first().waitFor();
  const lines = await page.locator('#mc-root [data-card="pc"] .mc-line').evaluateAll(ls => ls.map(l => l.textContent));
  console.log(JSON.stringify(lines));
  check(lines.some(t => t.includes('artist/a1')), 'the ordinary artist is offered');
  check(lines.length === 1 && !lines.some(t => t.includes('label/l1') || t.includes('artist/a2')), `the special-purpose ones are not (${JSON.stringify(lines)})`);
  const exec = await page.locator('#mc-root [data-act="exec"]').textContent();
  check(exec === 'Execute (1)', `Execute counts only the ordinary one (${exec})`);
});
