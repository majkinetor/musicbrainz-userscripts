// #680: Platform Check's card is in sections, each under its sub-heading: Release (the release's
// links and the release group's Discogs master), Artists, Labels. A section shows only when it
// has something: a row, or linked icons on its sub-heading. The card's header has no linked icons.
// A stand-in PC answers the probe.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's

test('#680: PC card in Release, Artists and Labels sections', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    const label = { type: 'label', mbid: 'l1', name: 'Blue Note' };
    window.__mcSets = [
      // linked release links, a new one, a withheld label link; no artist link
      [{ key: 'discogs', name: 'Discogs', url: 'https://www.discogs.com/release/1', state: 'linked' },
        { key: 'deezer', name: 'Deezer', url: 'https://www.deezer.com/album/1', state: 'new' },
        { key: 'ent:label:l1:bp', icon: 'beatport', name: 'Blue Note · Beatport', url: 'https://www.beatport.com/label/x/1', state: 'withheld', entity: label },
        { key: 'spotify', name: 'Spotify', state: 'none' }],
      // only a linked artist link: Artists shows for its icons, Release and Labels don't
      [{ key: 'ent:artist:a1:sp', icon: 'spotify', name: 'St Germain · Spotify', url: 'https://open.spotify.com/artist/1', state: 'linked', entity: { type: 'artist', mbid: 'a1', name: 'St Germain' } }]];
    window.__mcSet = 0;
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, findings: window.__mcSets[window.__mcSet] }), 50);
    });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-line');

  const card = page.locator('#mc-root [data-card="pc"]');
  const subs = () => card.locator('.mc-sub').evaluateAll(ss => ss.map(s => s.dataset.sub + ':' + s.querySelector('span').textContent));
  let S = await subs();
  check(S.join() === 'release:Release,label:Labels', `Release and Labels, no empty Artists (${S})`);
  check(await card.locator('.mc-sub[data-sub="release"] .mc-linked .mc-pico').count() === 1, "the release's linked Discogs is an icon on Release");
  check(await page.locator('#mc-root .mc-sect[data-sect="pc"] .mc-sect-h .mc-linked').count() === 0, 'no linked icons in the card header');
  const order = await card.locator('.mc-sub, .mc-line').evaluateAll(ls => ls.map(l => l.dataset.sub || l.dataset.key));
  check(order.join() === 'release,deezer,label,ent:label:l1:bp', `each row under its section (${order})`);

  await page.evaluate(() => { window.__mcSet = 1; });
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForFunction(() => document.querySelector('#mc-root [data-card="pc"] .mc-sub[data-sub="artist"]'));
  S = await subs();
  check(S.join() === 'artist:Artists', `a section of linked icons only still shows; the empty ones don't (${S})`);
});
