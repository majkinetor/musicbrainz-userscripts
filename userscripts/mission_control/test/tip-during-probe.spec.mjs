// A header tooltip stays up while a probe repaints the header: every progress note sets the same
// data-tip again on Execute and a new one on the step, and each used to re-render the tip hidden.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';

for (const sel of ['[data-act="exec"]', '.mc-step[data-step="is"]']) {
  test('a header tip stays up through a probe\'s repaints: ' + sel, { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#content table.medium');
    await inject('mission_control', { waitFor: '__mcTest' });
    await page.evaluate(() => {
      const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
      window.__ticks = 0;
      document.addEventListener('mc:probe', e => {
        const d = JSON.parse(e.detail);
        setInterval(() => send('mc:progress', { id: 'is', run: d.run, release: d.release, state: 'busy', note: 'step ' + (window.__ticks++ % 3) }), 300);
      });
      send('mc:provider', { id: 'is', name: 'ISRC Scout', version: 1, capabilities: ['probe', 'apply'] });
    });
    await page.click('#mc-launch');
    await page.waitForSelector('#mc-root');
    await page.click('#mc-root [data-act="probe"]');
    await page.mouse.move(5, 300);
    await page.hover('#mc-root ' + sel);
    const shown = await until(() => page.evaluate(() => !!document.querySelector('#mbu-tip.mbu-tip-on')), v => v);
    check(shown, 'the tip shows');
    const from = await page.evaluate(() => window.__ticks);
    await until(() => page.evaluate(() => window.__ticks), n => n >= from + 6);
    check(await page.evaluate(() => !!document.querySelector('#mbu-tip.mbu-tip-on')), 'the tip is still up after six progress notes');
  });
}
