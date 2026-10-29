import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// the entity's own ws/2 answer is held back 6 s, as when the shared MusicBrainz gate holds it
for (const [kind, id, sec] of [
  ['artist', 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d', 'dg'], // The Beatles: the discography comes first
  ['label', '46f0f4cd-8aab-4b33-b698-f459faf64190', 'ed'], // Warner: its releases come first
]) {
  test(`a ${kind} page shows a section while the ${kind} is still loading, then fills in`, { tag: '@sandbox' }, async ({ page, inject }) => {
    await page.route(new RegExp(`/ws/2/${kind}/${id}`), async r => { await new Promise(res => setTimeout(res, 6000)); await r.fallback(); });
    await page.goto(`https://test.musicbrainz.org/${kind}/${id}`);
    // nothing kept from an earlier visit (#847), or the page would draw at once
    await page.evaluate(() => new Promise(ok => { const q = indexedDB.deleteDatabase('eh-kept'); q.onsuccess = q.onerror = q.onblocked = () => ok(); }));
    await inject('event_horizon');
    check(await until(() => page.locator(`#app #s-${sec}`).count(), n => n > 0, 5000) > 0, 'a section shows before the entity arrives');
    check(await page.locator('#app .sk-page .sk-st').count() > 0, 'the hero shows its loader meanwhile');
    check(await until(() => page.locator('#app h1').count(), n => n > 0, 15000) > 0, 'the hero fills in when it arrives');
    check(await page.locator('#app .sk-page').count() === 0, 'the loader goes');
  });
}
