// #680 Mission Control ↔ Art Station. Art Station also loads on the release page,
// where it has no UI and only answers Mission Control. The sandbox copy of Mocky's
// "Music Will Explain" links several platforms Art Station can source from; the card
// lists them, with the Cover Art Archive's state as its summary.
// Covers are sourced headless: a hidden frame of the cover-art page, where Art Station
// runs with mc_frame and posts the best cover back. The import itself runs through
// ROpdebee's ECAU, which this harness doesn't load, so here the frame finds no cover
// and the card says so; the plumbing (frame, messages, apply answer) is what's checked.
import { test, check } from '../../../dev/test/harness.mjs';

// MusicBrainz's own scripts in a frame removed mid-load (Execute sources again) throw this
test.use({ gm: { name: 'Mission Control' }, pageErrors: ['MB is not defined'] });

const RELEASE = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';

test('#680: Probe asks Art Station; covers are sourced in a hidden frame', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('art_station');
  // a manager runs Art Station in the hidden frame too; here the test puts it there
  page.on('frameattached', async f => {
    await f.waitForLoadState('domcontentloaded').catch(() => {});
    if (/mc_frame=/.test(f.url())) await inject('art_station', { target: f }).catch(e => console.log('frame inject: ' + e.message));
  });
  await page.waitForFunction(() => window.__mcTest.found().as);
  check(await page.locator('#as-root').count() === 0, 'no Art Station gallery on the release page');

  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="as"] .mc-summary', { timeout: 120_000 });
  const summary = await page.locator('#mc-root [data-card="as"] .mc-summary').textContent();
  check(/Cover art/i.test(summary), `card summary: the cover art state (${summary})`);
  const rows = await page.locator('#mc-root [data-card="as"] .mc-line').count();
  check(rows > 0, `a row per linked platform AS can source from (${rows})`);
  check(await page.locator('#mc-root [data-card="as"] .mc-line svg').count() === rows, 'each with its platform icon');

  // tick one source: Execute sources again for it in the hidden frame
  await page.evaluate(() => { let c, n = 0; while ((c = document.querySelector('#mc-root .mc-pick.on')) && n++ < 500) c.click(); });
  await page.locator('#mc-root [data-card="as"] .mc-pick .mc-tick').first().click();
  await page.click('#mc-root [data-act="dry"]');
  await page.waitForSelector('#mc-root [data-card="as"] .mc-applied.ok');
  check(/dry run: would enter the best cover of 1 source/.test(await page.locator('#mc-root [data-card="as"] .mc-applied').textContent()), 'dry run says what it would do');

  await page.click('#mc-root [data-act="exec"]');
  const frame = await page.waitForFunction(() => { const f = document.querySelector('iframe[src*="mc_frame="]'); return f && f.src; }, null, { timeout: 30_000 }).then(h => h.jsonValue());
  const url = new URL(frame);
  check(url.pathname === `/release/${RELEASE}/cover-art`, 'the hidden frame is this release\'s cover-art page');
  check(JSON.parse(url.searchParams.get('mc_source') || '[]').length === 1, 'seeded with the one ticked link');
  check(!/new tab/.test(await page.locator('#mc-root').textContent()), 'no new tab');
  await page.waitForFunction(() => { const a = document.querySelector('#mc-root [data-card="as"] .mc-applied'); return a && !/dry run/.test(a.textContent); }, null, { timeout: 180_000 });
  const note = await page.locator('#mc-root [data-card="as"] .mc-applied').textContent();
  console.log('applied: ' + note);
  check(/no cover could be imported|entered/.test(note), `the frame answered (${note})`);
  await page.screenshot({ path: 'test-results/mc-680-as.png' });
});
