// #652: Release Information's artist and label, matched on a par with the Tracklist. The release
// artist credit runs through the same stages (here First Contact's platform link and the exact
// name), gets the same badge, match card and offers (＋ / 🔗 / ⚠) next to the field; a label is
// also matched by its Discogs or platform link.
//
// Sandbox data: Daft Punk has https://www.deezer.com/artist/27. Two labels are named "Warp"
// (the UK one and an Australian one), so the name can't settle it; Discogs label 23528 is linked
// from the UK Warp only.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const DAFT_PUNK = '056e4f3e-d505-4dad-8ec1-d04f521cbb56';
const WARP_UK = '46f0f4cd-8aab-4b33-b698-f459faf64190';
const seed = {
  name: 'Apollo 652 release info', status: 'official',
  'artist_credit.names.0.name': 'D. Punk', 'artist_credit.names.0.join_phrase': ' & ',
  'artist_credit.names.1.name': 'Zzq Nobody 652',
  'labels.0.name': 'Warp',
  'mediums.0.format': 'Digital Media',
  'mediums.0.track.0.name': 'One', 'mediums.0.track.0.length': '200000', 'mediums.0.track.0.artist_credit.names.0.name': 'D. Punk',
};
const handoff = {
  v: 1, token: 't652', created: Date.now(), source: 'deezer', sourceName: 'Deezer', url: 'https://www.deezer.com/album/1', title: seed.name,
  credit: [{ name: 'D. Punk', join: ' & ', url: 'https://www.deezer.com/artist/27' }, { name: 'Zzq Nobody 652', join: '', url: null }],
  labels: [{ name: 'Warp', catno: '', url: 'https://www.discogs.com/label/23528' }],
  mediums: [{ tracks: [{ title: 'One', credit: [{ name: 'D. Punk', join: '', url: 'https://www.deezer.com/artist/27' }] }] }],
};
const liveCredit = page => page.evaluate(() => window.MB.releaseEditor.rootField.release().artistCredit().names.map(n => ({ name: n.name, gid: n.artist && n.artist.gid })));

test.describe('release artist and label', () => {
  test.use({ gm: apolloGm() });

  test('the release artist and label go through the stages, with badges and offers', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
    await openApollo(page, inject, {
      seed,
      before: () => page.evaluate(h => { localStorage.removeItem('apollo:discogs-link-cache-v1'); document.documentElement.dataset.firstContact = JSON.stringify(h); }, handoff),
    });
    const ri = await until(() => page.evaluate(() => (window.__apolloEditor.riArt || []).map(s => ({ c: s.creditedAs, status: s.status, gid: s.gid, committed: !!s.committed, plat: s._platUrl || null }))), v => v.length === 2, { timeout: 60000 });
    console.log(JSON.stringify(ri));
    check(ri[0] && ri[0].status === 'plat' && ri[0].committed && ri[0].gid === DAFT_PUNK, `"D. Punk" → Daft Punk by the Deezer link: ${JSON.stringify(ri[0])}`);
    const credit = await liveCredit(page);
    check(credit[0].gid === DAFT_PUNK && credit[0].name === 'D. Punk', `written into the release's artist credit, keeping the credited name: ${JSON.stringify(credit)}`);
    check(ri[1] && !ri[1].committed && credit[1] && !credit[1].gid, `an artist no stage finds is left unset: ${JSON.stringify(ri[1])}`);

    await until(() => page.locator('.tc-ri-am .tc-badge').count(), n => n >= 1, { timeout: 10000 });
    const ui = await page.evaluate(() => {
      const box = document.querySelector('#information td.release-artist .tc-ri-am');
      return box && { badges: [...box.querySelectorAll('.tc-badge')].map(b => b.textContent + '@' + b.dataset.ri), names: [...box.querySelectorAll('.tc-ri-nm')].map(n => n.textContent), mk: [...box.querySelectorAll('.tc-ri-mk')].length };
    });
    check(ui && ui.badges[0] === 'dz@0', `the dz badge by the field: ${JSON.stringify(ui)}`);
    check(ui && JSON.stringify(ui.names) === JSON.stringify(['D. Punk', 'Zzq Nobody 652']), 'each name is labelled when the credit has several');
    check(ui && ui.mk === 1, `＋ for the unset artist: ${JSON.stringify(ui)}`);

    const card = await page.evaluate(() => window.__apolloEditor.matchCardHtml(window.__apolloEditor.riArt[0]));
    check(/Platform link/.test(card) && /deezer\.com\/artist\/27/.test(card), 'the match card says it was the Deezer link');
    // the card opens on hover, as on the Tracklist
    await page.locator('.tc-ri-am .tc-badge[data-ri="0"]').hover();
    const opened = await page.waitForSelector('#tc-mtip', { timeout: 5000 }).then(h => h.textContent()).catch(() => '');
    check(/Platform link/.test(opened), 'hovering the badge opens its match card');

    const create = await page.evaluate(() => { const opened = []; window.open = u => { opened.push(String(u)); return null; }; document.querySelector('.tc-ri-am .tc-ri-mk').click(); return opened[0] || ''; });
    const cu = create ? new URL(create) : null;
    check(cu && /\/artist\/create$/.test(cu.pathname) && cu.searchParams.get('edit-artist.name') === 'Zzq Nobody 652', `＋ opens the create form for that name: ${create}`);

    const label = await until(() => page.evaluate(() => { const l = window.MB.releaseEditor.rootField.release().labels()[0].label(); return l && l.gid; }), Boolean, { timeout: 30000 });
    check(label === WARP_UK, `the label "Warp" → the UK Warp by its Discogs link, though two labels have the name (${label})`);
    const lb = await until(() => page.evaluate(() => { const b = document.querySelector('.tc-ri-lab .tc-badge'); return b && b.textContent; }), Boolean, { timeout: 10000 });
    check(lb === 'disc', `the label's badge (${lb})`);
  });

  test('without a link the name stages still run', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openApollo(page, inject, { seed: { ...seed, 'artist_credit.names.0.name': 'Pharrell Williams', 'labels.0.name': 'Zzq No Label 652' } });
    const ri = await until(() => page.evaluate(() => (window.__apolloEditor.riArt || []).map(s => ({ c: s.creditedAs, status: s.status, committed: !!s.committed }))), v => v.length === 2, { timeout: 60000 });
    check(ri[0] && ['high', 'alias'].includes(ri[0].status) && ri[0].committed, `"Pharrell Williams" by its exact name: ${JSON.stringify(ri[0])}`);
    const label = await page.evaluate(() => { const l = window.MB.releaseEditor.rootField.release().labels()[0].label(); return l && l.gid; });
    check(!label, 'a label nobody has stays unset');
    check(await page.locator('.tc-ri-lab').count() === 0, 'and gets no badge');
  });
});
