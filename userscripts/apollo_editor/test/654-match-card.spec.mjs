// #654 (majkinetor): "maybe we should have richer tooltip (visually as HTML and more relevant
// info) that contains not only description but also more match details visible in the log",
// then, on the mock: "go with the mock, its awesome".
//
// Hover a badge and its card opens: the stage, the artist it linked, the evidence the stage had
// (here: which sibling release in the release group, and which track), when it matched. The card
// stays while the pointer is on it, and Esc closes it.
//
// The matching data is replayed (the tracklist spec's fixture), so the badges are rg.
import { test, check, idle, replayWs } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm({ autoMatch: true, autoMatchRec: false, autoMatchLabel: false, discogsUrlMatch: false }) });

test('a badge opens its match card: stage, artist, the release that proves it, when', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const ws = await replayWs(page, new URL('./fixtures/ws-tracklist.json.gz', import.meta.url), { paths: /^\/ws\/(2|js\/entity)\// });
  await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
  await page.waitForSelector('.tc-medsec .tc-mirror tbody tr[data-tk]', { timeout: 60000 });
  await page.waitForFunction(() => { const m = window.__apolloEditor.model; return m && m.tracks.length && m.tracks.every(t => t.slots.every(s => !s._pending)); }, null, { timeout: 120000 });
  await idle(page);
  await ws.done();   // the matching ran on the fixture; the card itself fetches nothing

  const badge = page.locator('.tc-mirror .tc-badge.rg').first();
  check(await badge.count() > 0, 'the fixture has rg badges');
  check(!(await badge.getAttribute('title')), 'no plain title to compete with the card');
  await badge.hover();
  const card = page.locator('#tc-mtip');
  await card.waitFor({ state: 'visible', timeout: 5000 });
  const txt = await card.textContent();
  check(/Release group/.test(txt) && /stage 2 · auto-linked/.test(txt), `the stage, and that Apollo linked it ("${txt.slice(0, 120)}")`);
  check(/Credited .*on the same track of another release in the release group/.test(txt) && /track \d+\.\d+/.test(txt), `the evidence: the sibling release and its track ("${txt}")`);
  check(await card.locator('a[href*="/release/"]').count() > 0 && await card.locator('.tc-mt-who a[href*="/artist/"]').count() === 1, 'links to the sibling release and the linked artist');
  check(/matched \d\d:\d\d:\d\d/.test(txt), 'when it matched');

  // the pointer can go onto the card (to follow a link) and the card stays
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 10, { steps: 6 });
  await page.waitForTimeout(500);
  check(await card.isVisible(), 'the card stays while the pointer is on it');
  await page.keyboard.press('Escape');
  check(await page.locator('#tc-mtip').count() === 0, 'Esc closes it');
});
