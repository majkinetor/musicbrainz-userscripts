// #841: Execute first lists what it will send, one line per selected change, grouped by step; an unticked line is
// left out, Cancel sends nothing, and a right-click on Execute skips the list. A stand-in Art Station gives two rows.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's

async function open(page, inject) {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    window.__applies = [];
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'as', run: d.run, release: d.release, summary: '', findings: [
        { key: 'Spotify', name: 'Spotify', icon: 'spotify', url: 'https://open.spotify.com/album/1', state: 'new' },
        { key: 'Deezer', name: 'Deezer', icon: 'deezer', url: 'https://www.deezer.com/album/1', state: 'new' },
      ] }), 50);
    });
    document.addEventListener('mc:apply', e => {
      const d = JSON.parse(e.detail); if (d.id !== 'as') return;
      window.__applies.push(d.keys);
      setTimeout(() => send('mc:applied', { id: 'as', run: d.run, release: d.release, ok: true, sent: d.keys.length, note: 'done' }), 50);
    });
    send('mc:provider', { id: 'as', name: 'Art Station', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await until(() => page.locator('#mc-root [data-act="exec"]').textContent(), t => t === 'Execute (2)', { timeout: 10_000 });
}

test('#841: Execute lists the changes first; an unticked one is left out', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await open(page, inject);
  await page.click('#mc-root [data-act="exec"]');
  const rv = page.locator('.mc-review');
  await rv.waitFor();
  check(/Execute 2 changes\?/.test(await rv.locator('h2').textContent()), 'the list says how many');
  const lines = await rv.locator('.mc-rv-i').allTextContents();
  check(lines.length === 2 && /Spotify/.test(lines[0]) && /Deezer/.test(lines[1]), `a line per change (${JSON.stringify(lines)})`);
  await rv.screenshot({ path: 'test-results/mc-841-review.png' });
  check(await page.evaluate(() => window.__applies.length) === 0, 'nothing applied while it is open');
  await rv.locator('.mc-rv-i input').nth(1).uncheck();
  await rv.locator('[data-rv="go"]').click();
  const applies = await until(() => page.evaluate(() => window.__applies), a => a.length > 0, { timeout: 10_000 });
  check(JSON.stringify(applies) === '[["Spotify"]]', `only the ticked one is sent (${JSON.stringify(applies)})`);
});

test('#841: Cancel sends nothing; a right-click on Execute skips the list', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await open(page, inject);
  await page.click('#mc-root [data-act="exec"]');
  await page.locator('.mc-review [data-rv="cancel"]').click();
  check(await page.locator('.mc-review').count() === 0, 'Cancel closes it');
  await page.waitForTimeout(500);
  check(await page.evaluate(() => window.__applies.length) === 0, 'and nothing is applied');
  await page.click('#mc-root [data-act="exec"]', { button: 'right' });
  const applies = await until(() => page.evaluate(() => window.__applies), a => a.length > 0, { timeout: 10_000 });
  check(await page.locator('.mc-review').count() === 0 && applies[0].length === 2, `right-click executes at once (${JSON.stringify(applies)})`);
});
