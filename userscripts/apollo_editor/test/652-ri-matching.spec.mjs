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
const liveCredit = page => page.evaluate(() => window.MB.releaseEditor.rootField.release().artistCredit().names.map(n => ({ name: n.name, join: n.joinPhrase, gid: n.artist && n.artist.gid })));

test.describe('release artist and label', () => {
  test.use({ gm: apolloGm() });

  test('the release artist and label go through the stages, with badges and offers', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
    await openApollo(page, inject, {
      seed,
      before: () => page.evaluate(h => { localStorage.removeItem('apollo:discogs-link-cache-v1'); document.documentElement.dataset.firstContact = JSON.stringify(h); }, handoff),
    });
    const ri = await until(() => page.evaluate(() => (window.__apolloEditor.riArt || []).map(s => ({ c: s.creditedAs, status: s.status, gid: s.gid, committed: !!s.committed, plat: s._platUrl || null }))), v => v.length === 2 && v[0].status !== 'none', { timeout: 60000 });
    console.log(JSON.stringify(ri));
    check(ri[0] && ri[0].status === 'plat' && ri[0].committed && ri[0].gid === DAFT_PUNK, `"D. Punk" → Daft Punk by the Deezer link: ${JSON.stringify(ri[0])}`);
    const credit = await liveCredit(page);
    check(credit[0].gid === DAFT_PUNK && credit[0].name === 'D. Punk', `written into the release's artist credit, keeping the credited name: ${JSON.stringify(credit)}`);
    check(ri[1] && !ri[1].committed && credit[1] && !credit[1].gid, `an artist no stage finds is left unset: ${JSON.stringify(ri[1])}`);

    await until(() => page.locator('.tc-ri-rb .tc-badge').count(), n => n >= 1, { timeout: 10000 });
    const ui = await page.evaluate(() => {
      const cell = document.querySelector('#information td.release-artist .tc-ri-art');
      return cell && { badges: [...cell.querySelectorAll('.tc-aslot')].map(l => [...l.querySelectorAll('.tc-ri-rb .tc-badge')].map(b => b.textContent + '@' + b.dataset.ri).join()), mk: cell ? [...cell.querySelectorAll('.tc-aslot')].map(l => [...l.querySelectorAll('.mk')].filter(m => m.offsetParent).length) : [] };
    });
    check(ui && ui.badges[0] === 'dz@0', `the dz badge on its line: ${JSON.stringify(ui)}`);
    check(ui && ui.badges.length === 2 && !/@0/.test(ui.badges[1]), `each badge sits on its own artist's line: ${JSON.stringify(ui && ui.badges)}`);
    check(ui && JSON.stringify(ui.mk) === '[0,1]', `＋ in the cell for the unset artist only: ${JSON.stringify(ui)}`);

    const card = await page.evaluate(() => window.__apolloEditor.matchCardHtml(window.__apolloEditor.riArt[0]));
    check(/Platform link/.test(card) && /deezer\.com\/artist\/27/.test(card), 'the match card says it was the Deezer link');
    // the card opens on hover, as on the Tracklist
    await page.locator('.tc-ri-rb .tc-badge[data-ri="0"]').hover();
    const opened = await page.waitForSelector('#tc-mtip', { timeout: 5000 }).then(h => h.textContent()).catch(() => '');
    check(/Platform link/.test(opened), 'hovering the badge opens its match card');

    const create = await page.evaluate(() => { const opened = []; window.open = u => { opened.push(String(u)); return null; }; document.querySelectorAll('.tc-ri-art .tc-aslot')[1].querySelector('.mk').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); return opened[0] || ''; });
    const cu = create ? new URL(create) : null;
    check(cu && /\/artist\/create$/.test(cu.pathname) && cu.searchParams.get('edit-artist.name') === 'Zzq Nobody 652', `＋ opens the create form for that name: ${create}`);

    const label = await until(() => page.evaluate(() => { const l = window.MB.releaseEditor.rootField.release().labels()[0].label(); return l && l.gid; }), Boolean, { timeout: 30000 });
    check(label === WARP_UK, `the label "Warp" → the UK Warp by its Discogs link, though two labels have the name (${label})`);
    const lb = await until(() => page.evaluate(() => { const b = document.querySelector('.tc-ri-lab .tc-badge'); return b && b.textContent; }), Boolean, { timeout: 10000 });
    check(lb === 'disc', `the label's badge (${lb})`);
  });

  test('without a link the name stages still run', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openApollo(page, inject, { seed: { ...seed, 'artist_credit.names.0.name': 'Pharrell Williams', 'labels.0.name': 'Zzq No Label 652' } });
    const ri = await until(() => page.evaluate(() => (window.__apolloEditor.riArt || []).map(s => ({ c: s.creditedAs, status: s.status, committed: !!s.committed }))), v => v.length === 2 && v[0].status !== 'none', { timeout: 60000 });
    check(ri[0] && ['high', 'alias'].includes(ri[0].status) && ri[0].committed, `"Pharrell Williams" by its exact name: ${JSON.stringify(ri[0])}`);
    const label = await page.evaluate(() => { const l = window.MB.releaseEditor.rootField.release().labels()[0].label(); return l && l.gid; });
    check(!label, 'a label nobody has stays unset');
    check(await page.locator('.tc-ri-lab').count() === 0, 'and gets no badge');
  });
  test('the release Artist field is the Tracklist artist cell', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
    await openApollo(page, inject, { seed: { ...seed, 'artist_credit.names.0.name': 'Daft Punk', 'artist_credit.names.1.name': 'Zzq Nobody 652', 'labels.0.name': '' } });
    await until(() => page.evaluate(() => (window.__apolloEditor.riArt || [])[0]?.committed), Boolean, { timeout: 60000 });
    const cell = '#information td.release-artist .tc-ri-art';
    const ui = await page.evaluate(c => ({
      native: getComputedStyle(document.querySelector('#information td.release-artist .artist-credit-editor')).display,
      slots: [...document.querySelectorAll(c + ' .tc-aslot')].map(l => ({ nm: l.querySelector('input.nm').value, matched: l.querySelector('.tc-search').classList.contains('matched') })),
      // #652: credited-as sits in the label column, a row per line, the artist search lined up with Title
      lead: [...document.querySelectorAll('#information .tc-ri-artlbl .tc-ri-leadrow')].map(r => ({ cred: r.querySelector('input.tc-cred')?.placeholder, top: Math.round(r.getBoundingClientRect().top) })),
      tops: [...document.querySelectorAll(c + ' .tc-aslot')].map(l => Math.round(l.getBoundingClientRect().top)),
      label: getComputedStyle(document.querySelector('#information .tc-ri-artlbl > :not(.tc-ri-lead)') || document.body).display,
      searchLeft: Math.round(document.querySelector(c + ' .tc-search').getBoundingClientRect().left),
      titleLeft: Math.round(document.querySelector('#name').getBoundingClientRect().left),
      prev: !!document.querySelector('.tc-ri-prev, .tc-ri-cp'),
    }), cell);
    console.log(JSON.stringify(ui));
    check(ui.native === 'none', `MusicBrainz's artist field is hidden (${ui.native})`);
    check(ui.slots.length === 2 && ui.slots[0].nm === 'Daft Punk' && ui.slots[0].matched && !ui.slots[1].matched, `one line per artist, the matched one green: ${JSON.stringify(ui.slots)}`);
    check(ui.lead.length === 2 && ui.lead[0].cred === 'Daft Punk' && ui.lead.every((r, i) => Math.abs(r.top - ui.tops[i]) <= 2), `credited-as in the label column, level with each line: ${JSON.stringify(ui.lead)} / ${ui.tops}`);
    check(ui.label === 'none', `the Artist label gives way to it (${ui.label})`);
    check(Math.abs(ui.searchLeft - ui.titleLeft) <= 2, `the artist search lines up with the Title field (${ui.searchLeft} / ${ui.titleLeft})`);
    check(!ui.prev, 'no preview, no copy / paste');
    // a theme that pads the label column and makes the lines taller must not knock them apart (majkinetor's sat a line low)
    await page.addStyleTag({ content: '#information .tc-ri-artlbl{padding-top:22px!important}#information .tc-ri-art .tc-aslot{height:38px!important}' });
    const skew = await until(() => page.evaluate(c => {
      const rows = [...document.querySelectorAll('#information .tc-ri-leadrow')], lines = [...document.querySelectorAll(c + ' .tc-aslot')];
      return rows.map((r, i) => Math.round(Math.abs((r.getBoundingClientRect().top + r.getBoundingClientRect().height / 2) - (lines[i].getBoundingClientRect().top + lines[i].getBoundingClientRect().height / 2))));
    }, cell), v => v.every(d => d <= 2), { timeout: 5000 }).catch(e => String(e));
    check(Array.isArray(skew) && skew.every(d => d <= 2), `credited-as stays level with its line under a padded theme (off by ${JSON.stringify(skew)} px)`);

    // join phrase → the release credit
    await page.evaluate(c => { const j = document.querySelector(c + ' .tc-join'); j.value = ' feat. '; j.dispatchEvent(new Event('change')); }, cell);
    let credit = await until(() => liveCredit(page), c => c[0] && c[0].join === ' feat. ', { timeout: 5000 }).catch(() => null);
    credit = credit || await page.evaluate(() => window.MB.releaseEditor.rootField.release().artistCredit().names.map(n => ({ name: n.name, join: n.joinPhrase })));
    console.log('after join', JSON.stringify(credit));
    check(credit[0] && credit[0].join === ' feat. ' && credit[0].gid === DAFT_PUNK, `the join phrase is written, the linked artist kept: ${JSON.stringify(credit)}`);

    // remove the second artist → one artist left
    await page.evaluate(c => document.querySelectorAll(c + ' .tc-aslot')[1].querySelector('.tc-slotx').click(), cell);
    credit = await liveCredit(page);
    check(credit.length === 1 && credit[0].gid === DAFT_PUNK && !credit[0].join, `✕ removes an artist: ${JSON.stringify(credit)}`);

    // ↵ adds a line after it, focused
    await page.evaluate(c => document.querySelector(c + ' .tc-aslot .tc-enter').click(), cell);
    const added = await page.evaluate(c => ({ n: document.querySelectorAll(c + ' .tc-aslot').length, focused: document.activeElement === document.querySelectorAll(c + ' input.nm')[1] }), cell);
    check(added.n === 2 && added.focused, `↵ adds an artist line and focuses it: ${JSON.stringify(added)}`);

    // search and pick in the new line
    await page.locator(cell + ' input.nm').nth(1).fill('Pharrell Williams');
    await page.waitForSelector('.tc-acpop .tc-acrow[data-i]', { timeout: 20000 });
    await page.locator(cell + ' input.nm').nth(1).press('Enter');
    credit = await until(() => liveCredit(page), c => c.length === 2 && c[1].gid, { timeout: 15000 });
    check(credit[1].gid && credit[0].gid === DAFT_PUNK, `picking from the search links the artist: ${JSON.stringify(credit)}`);
    await page.keyboard.press('Escape'); await page.locator('h1, h2').first().click().catch(() => {});
    const clip = await page.locator('#information td.release-artist').evaluate(td => { const r = td.closest('tr').getBoundingClientRect(), t = document.querySelector('#name').closest('tr').getBoundingClientRect(); return { x: r.left, y: t.top, width: r.width, height: r.bottom - t.top }; });
    await page.screenshot({ path: 'test-results/652-artist-cell.png', clip });

  });
});
