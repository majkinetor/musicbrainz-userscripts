import { test, check, until, pristine } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';
test.use({ gm: { name: 'ISRC Scout' } });

test('a real link edit expires the saved Match cache and updates the dock', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(240000);
  const release = await pristine(page, 'release');
  await openScout(page, inject, { release: release.mbid, edit: data => {
    for (const medium of data.media || []) for (const track of medium.tracks || []) track.recording.isrcs = ['USAAA2000001'];
  } });
  const url = `https://www.deezer.com/track/8${Date.now()}`;
  await page.evaluate(({ id, url }) => {
    const store = window.__isrcScoutTestStore.store, rec = document.querySelector('#ii-tbody .ii-tl-add').dataset.rec;
    store.set('bg_links_cache', { [id]: { at: Date.now(), isrcs: {}, isrcsDone: true, done: window.__isrcScoutTest466.PROV.map(p => p.code), links: [{ rec, code: 'dz', url }] } });
    store.set('links_auto', 'background'); document.querySelector('#ii-btn-status').textContent += ' ';
  }, { id: release.mbid, url });
  await page.waitForSelector('#ii-tbody .ii-tl-add .ii-tl.new');
  check((await page.locator('#ii-dock').getAttribute('data-mb-corner-status')) === '0,1', 'the dock shows the link to add');
  await page.click('#ii-submit');
  await page.waitForFunction(() => /Linked 1 track-link/.test(window.__isrcScoutLog?.() || ''), null, { timeout: 120000 });
  const status = await until(() => page.locator('#ii-dock').getAttribute('data-mb-corner-status'), s => s === '✓', { timeout: 15000 });
  check(status === '✓', `the dock reflects the completed edit (${status})`);
  check(await page.evaluate(id => !(window.__isrcScoutTestStore.store.get('bg_links_cache', {}) || {})[id], release.mbid), 'the saved cache is expired');
  const recording = await until(async () => page.evaluate(async id => {
    const r = await fetch(`/ws/2/recording/${id}?inc=url-rels&fmt=json`); return r.ok ? r.json() : null;
  }, release.recordings[0]), data => !!data && (data.relations || []).some(rel => rel.url?.resource === url), { timeout: 30000 });
  check(!!recording && (recording.relations || []).some(rel => rel.url?.resource === url), 'MusicBrainz has the submitted link');
});
