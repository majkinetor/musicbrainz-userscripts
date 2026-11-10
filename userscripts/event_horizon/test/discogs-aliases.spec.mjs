import { test, check, requireLogin, answerGm, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

for (const mode of ['popup', 'page']) {
  test(`Discogs aliases can be fetched in the Event Horizon ${mode}`, { tag: ['@sandbox', '@login'] }, async ({ page, inject, context }, testInfo) => {
    const artist = 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d';
    answerGm(context, ({ url }) => {
      const m = /^https:\/\/api\.discogs\.com\/artists\/(\d+)$/.exec(url);
      if (!m) return null;
      return { status: 200, body: JSON.stringify({ id: Number(m[1]), name: 'The Beatles', namevariations: ['Original Brothers International Band Of Imo State (7)'] }) };
    });
    await page.goto(`https://test.musicbrainz.org/artist/${artist}${mode === 'page' ? '/aliases' : ''}`);
    await requireLogin(page);
    await page.evaluate(() => localStorage.removeItem('apollo:session:current'));
    await inject('event_horizon');
    if (mode === 'popup') await page.locator('button.eh-edit[data-aliases]').first().click();
    const box = page.locator(mode === 'popup' ? '#eh-aliases #tc-alias' : '#s-ali #tc-alias');
    const fetch = box.getByRole('button', { name: 'Fetch from Discogs', exact: true });
    await fetch.waitFor();
    await fetch.click();
    await box.locator('.tc-al-msg').filter({ hasText: '1 aliases added for review' }).waitFor();
    check(await box.locator('.tc-al-new .tc-al-n').inputValue() === 'Original Brothers International Band Of Imo State', 'the fetched name is an unsaved editable row');
    check(await box.locator('.tc-al-new .tc-al-source').getAttribute('href') === 'https://www.discogs.com/artist/82730', 'the source link belongs to the imported row');
    await box.locator('.tc-al-new .tc-al-detect').click();
    check(await box.locator('.tc-al-new .tc-al-l').getAttribute('data-v') === 'en', 'the shared detector works in this Event Horizon editor');
    check(await page.evaluate(() => {
      const id = localStorage.getItem('apollo:session:current'), log = localStorage.getItem('apollo:session:' + id) || '';
      return log.includes('locale recognized') && log.includes('Alias editor hosted by Event Horizon');
    }), 'Event Horizon alias work is retained in Apollo’s history');
    await box.locator('.tc-al-new .tc-al-clear').click();
    check(await box.locator('.tc-al-new .tc-al-l').getAttribute('data-v') === '', 'the clear action works in this Event Horizon view');
    check((await box.locator('.tc-al-note').inputValue()).includes('https://www.discogs.com/artist/'), 'the edit note cites the linked artist');
    await attachShot(testInfo, page, 'discogs-aliases-' + mode);
    await page.screenshot({ path: 'dev/_discogs-aliases-' + mode + '.png' });
  });
}
