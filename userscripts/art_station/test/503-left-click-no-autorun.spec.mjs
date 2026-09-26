// #503 (majkinetor, live: "when opening the 'enter edit' dialog with normal left click it
// immediately entered edit… not distinguishable"): a destructive "Remove Front" batch
// nearly ran on a routine left click. `commit.onclick = enterEdit;` passed the click
// Event as enterEdit's only parameter, `immediate`, and an Event is truthy, so every
// left click behaved like the right-click "run now" (#493). Now `() => enterEdit()`.
//
// test.musicbrainz.org, with "Dry run" ticked in the injected copy, so a run only
// previews; the write endpoints are stubbed and recorded as well.
import { test, check } from '../../../dev/test/harness.mjs';
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
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !document.querySelector('.as-commit').disabled), 'a staged comment enables the commit button');

  // the regression: a plain left click must not run
  await page.click('.as-commit');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !!document.getElementById('as-commit')), 'a left click opens the review window');
  const left = await page.evaluate(() => document.querySelector('.as-cm-op .as-cm-st')?.textContent || null);
  check(left === '○', `…and the operation stays untouched (${left})`);
  check(writes.length === 0, `nothing was sent (${writes.length})`);

  // #493: a right click still runs at once
  await page.evaluate(() => document.getElementById('as-commit')?.remove());
  await page.waitForTimeout(200);
  await page.click('.as-commit', { button: 'right' });
  const atOpen = await page.evaluate(() => document.querySelector('.as-cm-op .as-cm-st')?.textContent || null);
  await page.waitForTimeout(1500);
  const settled = await page.evaluate(() => document.querySelector('.as-cm-op .as-cm-st')?.textContent || null);
  check(atOpen === '○', `a right click opens with the plan visible first (${atOpen})`);
  check(settled === '👁', `…and runs it without a Run click (dry-run preview: ${settled})`);
});
