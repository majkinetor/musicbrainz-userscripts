import { test, check, SANDBOX, pristine, requireLogin } from '../../../dev/test/harness.mjs';
import { apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('alias additions overlap with at most four requests and persist once each', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const { mbid } = await pristine(page, 'artist');
  await page.goto(`${SANDBOX}/artist/${mbid}/add-alias`);
  await requireLogin(page);
  await inject('apollo_editor');
  const names = ['Parallel Alpha', 'Parallel Beta', 'Parallel Gamma', 'Parallel Delta'];
  for (const name of names) await page.locator('.tc-al-row').last().locator('.tc-al-n').fill(name);
  const active = new Set(); let peak = 0, sent = 0;
  page.on('request', r => {
    if (r.method() !== 'POST' || new URL(r.url()).pathname !== `/artist/${mbid}/add-alias`) return;
    active.add(r); sent++; peak = Math.max(peak, active.size);
  });
  page.on('requestfinished', r => active.delete(r));
  page.on('requestfailed', r => active.delete(r));
  await page.locator('#tc-al-enter').click();
  await page.locator('.tc-al-msg').filter({ hasText: '4 edits entered' }).waitFor();
  check(peak === 4, `four additions in flight, observed ${peak}`);
  check(sent === 4, `one request per alias, observed ${sent}`);
  await page.goto(`${SANDBOX}/artist/${mbid}/aliases`);
  await inject('apollo_editor');
  await page.locator('.tc-al-row').nth(4).waitFor();
  const saved = await page.locator('.tc-al-n').evaluateAll(es => es.map(e => e.value).filter(Boolean).sort());
  check(JSON.stringify(saved) === JSON.stringify(names.sort()), 'every alias persisted exactly once');
});
