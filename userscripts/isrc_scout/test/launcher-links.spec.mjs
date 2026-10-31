import { test, check, functionSource } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

test('background findings reach an already open editor', { tag: '@sandbox' }, async ({ page, inject }) => {
  await openScout(page, inject, { edit: j => {
    for (const m of j.media || []) for (const t of m.tracks || []) t.recording.relations = [];
  } });
  await page.evaluate(() => {
    const store = window.__isrcScoutTestStore.store;
    localStorage.removeItem('mbu.dockOpen');
    document.documentElement.setAttribute('data-mbu-dock', '');
    document.documentElement.removeAttribute('data-mbu-dock-open');
    const withheld = document.createElement('button'); withheld.id = 'test-withheld-only';
    withheld.dataset.mbCorner = 'br'; withheld.dataset.mbCornerStatus = '0,3'; withheld.dataset.mbuActionable = 'false'; withheld.dataset.mbuWithheldOnly = '';
    document.documentElement.appendChild(withheld);
    const rec = document.querySelector('#ii-tbody .ii-tl-add').dataset.rec;
    const release = location.pathname.split('/')[2];
    store.set('bg_links_cache', { [release]: { at: Date.now(), isrcs: {}, isrcsDone: true,
      done: window.__isrcScoutTest466.PROV.map(p => p.code),
      links: [{ rec, code: 'dz', url: 'https://www.deezer.com/track/123456' },
        { rec, code: 'dz', url: 'https://www.deezer.com/track/654321' },
        { rec, code: 'sp', url: 'https://open.spotify.com/track/stale' }],
    } });
    store.set('platform_spotify', false);
    store.set('links_auto', 'background');
    // The dock observes the page button, as it does when background progress changes it.
    document.querySelector('#ii-btn-status').textContent += ' ';
  });
  await page.waitForSelector('#ii-tbody .ii-tl-add .ii-tl.new');
  check(await page.locator('#ii-tbody .ii-tl-add .ii-tl.new').count() === 1, 'late findings populate one provider slot');
  check(/1 to add/.test(await page.locator('#ii-summary-links').textContent()), 'footer counts the finding');
  check(/1/.test(await page.locator('#ii-btn-links').textContent()), 'launcher counts the same finding');
  check((await page.locator('#ii-dock').getAttribute('data-mb-corner-status')) === '0,1', 'dock separates zero new ISRCs from one new link');
  const dockState = await page.evaluate(() => ({ root: document.documentElement.outerHTML.slice(0, 500), scout: document.querySelector('#ii-dock')?.outerHTML, held: document.querySelector('#test-withheld-only')?.outerHTML }));
  check((await page.locator('#ii-dock').getAttribute('data-mbu-docked')) === 'peek', `a link-only finding remains visible in the folded dock (${JSON.stringify(dockState)})`);
  check((await page.locator('#test-withheld-only').getAttribute('data-mbu-docked')) === 'hide', 'a withheld-only count remains hidden in the folded dock');
});

test('launcher counts only cached links the editor can offer', { tag: '@unit' }, async () => {
  const src = await functionSource('isrc_scout', ['bgLinksToAdd', 'providersFor', 'linkedUrl']);
  const PROV = [
    { code: 'sp', album: true, urlKey: 'spotifyId', test: u => u.startsWith('spotify:') },
    { code: 'qz', album: true, urlKey: 'qobuzId', test: u => u.startsWith('qobuz:') },
    { code: 'yt', test: u => u.startsWith('youtube:') },
    { code: 'dz', test: u => u.startsWith('deezer:') },
  ];
  const RELEASE = { tracks: [{ recId: 'r', recUrls: ['qobuz:linked'] }], qobuzId: 'album' };
  const links = [
    { rec: 'r', code: 'sp', url: 'spotify:stale-album' },
    { rec: 'r', code: 'qz', url: 'qobuz:another-id' },
    { rec: 'r', code: 'dz', url: 'deezer:disabled' },
    { rec: 'r', code: 'unknown', url: 'unknown:removed' },
    { rec: 'gone', code: 'yt', url: 'youtube:gone' },
    { rec: 'r', code: 'yt', url: 'youtube:first' },
    { rec: 'r', code: 'yt', url: 'youtube:second' },
  ];
  const run = new Function('RELEASE', 'PROV', 'codeOn', 'bgCache', src + '\nconst BG = { prov: c => PROV.find(p => p.code === c) }; const TrackLinks = { providersFor }; return bgLinksToAdd;')(RELEASE, PROV, c => c !== 'dz', () => ({ links }));
  check(JSON.stringify(run()) === JSON.stringify([links[5]]), 'one addable slot, matching the editor; stale, linked and disabled findings excluded');
  RELEASE.spotifyId = 'album';
  check(run().length === 2, 'an album provider becomes eligible with its album link');
  RELEASE.tracks[0].recUrls.push('youtube:first');
  check(run().length === 1, 'adding a link removes that platform from the pending count');
});
