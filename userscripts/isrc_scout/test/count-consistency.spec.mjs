import { test, check, until, functionSource } from '../../../dev/test/harness.mjs';
import { openScout, openStub } from './is.mjs';
test.use({ gm: { name: 'ISRC Scout' } });

test('the open editor and dock show the same pending ISRC counts', { tag: '@sandbox' }, async ({ page, inject }) => {
  await openScout(page, inject, { edit: data => { for (const medium of data.media || []) for (const track of medium.tracks || []) track.recording.isrcs = []; } });
  const inputs = page.locator('#ii-tbody tr[data-idx] .ii-input');
  await inputs.nth(0).fill('USAAA2000001'); await inputs.nth(1).fill('USAAA2000002');
  const status = () => page.locator('#ii-dock').getAttribute('data-mb-corner-status');
  check(await until(status, s => s === '2,0', { timeout: 3000 }) === '2,0', 'two valid pending ISRCs are shown');
  await inputs.nth(0).fill('');
  check(await until(status, s => s === '1,0', { timeout: 3000 }) === '1,0', 'clearing one pending ISRC updates the dock');
});

test('only a successful submit expires the Match cache', { tag: '@unit' }, async () => {
  const src = await functionSource('isrc_scout', ['submitIsrcs']);
  let fail = false, invalidations = 0;
  const submit = new Function('withRepeat', 'submitIsrcsOnce', 'invalidateMatchCache', src + '\nreturn submitIsrcs;')(
    async () => { if (fail) throw Error('offline'); }, () => {}, () => { invalidations++; });
  await submit({}, ''); fail = true; await submit({}, '').catch(() => {});
  check(invalidations === 1, 'successful submits invalidate; failed submits do not');
});

test('cache controls and successful edit invalidate the saved snapshot', { tag: '@unit' }, async () => {
  const src = await functionSource('isrc_scout', ['matchCacheDays', 'bgCache', 'bgSave', 'invalidateMatchCache']);
  const values = { match_cache_days: 3, match_cache_enabled: true, bg_links_cache: {} }, updates = [];
  const store = { get: (k, d) => k in values ? values[k] : d, set: (k, v) => { values[k] = v; } };
  const state = { generation: 0, running: { x: {} }, started: true };
  const api = new Function('store', 'BG', 'notifyMatchCounts', 'localStorage', 'let mbid = "r", BG_DAYS = 7;\n' + src + '\nreturn { matchCacheDays, bgCache, bgSave, invalidateMatchCache };')(
    store, state, () => updates.push(true), { setItem() {} });
  check(api.matchCacheDays() === 3, 'the configured cache lifetime is used');
  const current = api.bgCache(); current.links.push({ rec: 'r', url: 'https://example.test' }); api.bgSave(current);
  check(!!values.bg_links_cache.r, 'enabled cache persists findings');
  api.invalidateMatchCache();
  check(!values.bg_links_cache.r && api.bgCache().links.length === 1, 'a local edit expires persistence and retains unfinished page results');
  check(state.generation === 1 && !Object.keys(state.running).length && updates.length === 1, 'old scans cannot remain active');
  values.match_cache_enabled = false; api.bgSave(api.bgCache());
  check(!values.bg_links_cache.r, 'disabled cache does not persist findings');
});

test('a failed release load stops the dock loading without opening Scout', { tag: '@sandbox' }, async ({ page, context, inject }) => {
  await openStub(page, context, inject);
  const dock = page.locator('#ii-dock');
  await dock.waitFor({ state: 'attached' });
  const state = () => dock.evaluate(el => ({ status: el.dataset.mbCornerStatus, busy: el.hasAttribute('data-mbu-busy') }));
  const result = await until(state, s => s.status === '?' && !s.busy);
  check(result.status === '?' && !result.busy, `failed release loading is reported (${JSON.stringify(result)})`);
  check(await page.locator('#ii-modal.open').count() === 0, 'Scout was never opened');
});
