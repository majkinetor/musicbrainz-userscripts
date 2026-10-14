// #749 (majkinetor): "Scout shows per track isrc and links … Native release page doesnt
// have that. Lets add an option to show it on tracks."
//
// test.musicbrainz.org, a release whose ten tracks each have an ISRC.
import { test, check, until, mbJson, SANDBOX } from '../../../dev/test/harness.mjs';
import { openScout, ANY_RELEASE } from './is.mjs';

// what the sandbox has for each track: its row id, its ISRCs and its links
async function expected() {
  const r = await mbJson(`${SANDBOX}/ws/2/release/${ANY_RELEASE}?inc=recordings+isrcs+recording-level-rels+url-rels&fmt=json`);
  return r.media.flatMap(m => m.tracks).map(t => ({
    id: t.id, isrcs: t.recording.isrcs || [],
    links: (t.recording.relations || []).filter(x => x.url).length,
  }));
}
const shown = page => page.evaluate(() => [...document.querySelectorAll('.ii-trk')].map(s => ({
  id: s.closest('tr').id,
  isrcs: [...s.querySelectorAll('.ii-trk-isrc')].map(a => a.textContent),
  links: s.querySelectorAll('.ii-trk-ln').length,
  afterTitle: !!s.previousElementSibling?.matches('a[href*="/recording/"]'),
})));

test.describe('setting on', () => {
  test.use({ gm: { name: 'ISRC Scout', values: { 'ii:track_data': true } } });

  test('each track shows its ISRCs and links after its title, and the setting hides them', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
    const want = await expected();
    await openScout(page, inject, { open: false });
    const got = await until(() => shown(page), g => g.length >= want.filter(t => t.isrcs.length || t.links).length);
    for (const w of want) {
      const g = got.find(x => x.id === w.id);
      check(g && g.isrcs.join() === w.isrcs.join(), `track ${w.id}: ISRCs ${w.isrcs.join() || 'none'} (shown ${g ? g.isrcs.join() : 'nothing'})`);
      check(!g || g.links === w.links, `track ${w.id}: ${w.links} link(s) (shown ${g && g.links})`);
      check(!g || g.afterTitle, `track ${w.id}: right after the title`);
    }
    await page.evaluate(() => document.getElementById('ii-btn').click());
    await page.waitForSelector('#ii-modal.open', { timeout: 15000 });
    await page.evaluate(() => { const c = document.getElementById('ii-track-data'); c.click(); });
    check((await until(() => shown(page), g => !g.length)).length === 0, 'unticking the setting takes them off the tracklist');
  });
});

test.describe('setting off', () => {
  test.use({ gm: { name: 'ISRC Scout' } });

  test('off by default: the tracklist is left as it is', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await openScout(page, inject, { open: false });
    await page.waitForFunction(() => /^[✓⚠?]/.test(document.getElementById('ii-btn-status')?.textContent || ''), null, { timeout: 45000 });
    check((await shown(page)).length === 0, 'no ISRCs or links on the tracklist');
  });
});
