// #503 (majkinetor, live: "when opening the 'enter edit' dialog with normal left click it
// immediately entered edit… not distinguishable"): a destructive "Remove Front" batch
// nearly ran on a routine left click. `commit.onclick = enterEdit;` passed the click
// Event as enterEdit's only parameter, `immediate`, and an Event is truthy, so every
// left click behaved like the right-click "run now" (#493). Now `() => enterEdit()`.
//
// test.musicbrainz.org, with "Dry run" ticked in the injected copy, so a run only
// previews; the write endpoints are stubbed and recorded as well.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test('a left click opens the plan without running it; a right click still runs it', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
  const writes = [];
  await page.route(u => /\/edit-cover-art\//.test(u.pathname), r => {
    if (r.request().method() !== 'POST') return r.fallback();
    writes.push(r.request().url());
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<html>blocked-for-test</html>' });
  });
  await page.route(u => u.pathname === '/ws/js/edit/create', r => { writes.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"edits":[]}' }); });
  await openArtStation(page, inject, {
    transform: code => code.replace('<input type="checkbox" class="as-cm-dryrun">', '<input type="checkbox" class="as-cm-dryrun" checked>'),
  });

  // the first card that can be edited (a card with an open edit on it can't), by
  // position: its pencil turns into the comment box once clicked
  const idx = await page.evaluate(() => [...document.querySelectorAll('.as-card')].findIndex(c => c.querySelector('.as-pencil')));
  const card = page.locator('.as-card').nth(idx);
  await card.locator('.as-pencil').click();
  await card.locator('.as-cmt').fill('as503dryrun-' + Date.now());
  await card.locator('.as-cmt').blur();
  check(await until(() => page.evaluate(() => !document.querySelector('.as-commit').disabled)), 'a staged comment enables the commit button');

  // A run starts two animation frames after the review window paints (the right-click
  // path's own wait), so "it has not started" is read after those frames, not a sleep.
  const afterStartWindow = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const status = () => page.evaluate(() => document.querySelector('.as-cm-op .as-cm-st')?.textContent || null);

  // the regression: a plain left click must not run
  await page.click('.as-commit');
  await page.waitForSelector('#as-commit', { timeout: 10000 }).catch(() => {});
  await afterStartWindow();
  check(await page.evaluate(() => !!document.getElementById('as-commit')), 'a left click opens the review window');
  const left = await status();
  check(left === '○', `…and the operation stays untouched (${left})`);
  check(writes.length === 0, `nothing was sent (${writes.length})`);

  // #493: a right click still runs at once. That it STARTS is the point (⏳ running,
  // or 👁 already previewed); how long the dry run's read of the edit form takes is
  // the sandbox's business, not this spec's.
  await page.evaluate(() => document.getElementById('as-commit')?.remove());
  await page.click('.as-commit', { button: 'right' });
  const atOpen = await status();
  const started = await page.waitForFunction(() => { const s = document.querySelector('.as-cm-op .as-cm-st')?.textContent; return s && s !== '○'; }, null, { timeout: 10000 }).then(() => true, () => false);
  check(atOpen === '○', `a right click opens with the plan visible first (${atOpen})`);
  check(started, `…and starts it without a Run click (status: ${await status()})`);
});
