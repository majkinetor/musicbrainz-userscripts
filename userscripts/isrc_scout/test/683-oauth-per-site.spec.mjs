// #683 (majkinetor): on test.musicbrainz.org Setup said "✓ Authorized" while every
// submit failed with "Client not authentified". GM storage is shared by every
// *.musicbrainz.org page, so the production refresh token counted on the sandbox,
// whose OAuth apps and grants are its own. Tokens are kept per server now, and a
// token the server rejects is forgotten.
// test.musicbrainz.org; the only request made is the (refused) token refresh.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openScout, logText } from './is.mjs';

const PROD = 'ii:oauth_refresh_token', TEST = 'ii:oauth_refresh_token@test.musicbrainz.org';
const authState = page => page.evaluate(() => document.getElementById('ii-auth-state')?.textContent || '');
const gmGet = (page, k) => page.evaluate(k => window.GM_getValue(k, null), k);

test.describe('a production token', () => {
  test.use({ gm: { name: 'ISRC Scout', values: { [PROD]: 'production-refresh-token' } } });

  test('#683: does not count as authorized on the sandbox', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
    await openScout(page, inject);
    const s = await authState(page);
    check(/Not authorized on test\.musicbrainz\.org/.test(s), `Setup says not authorized on the sandbox ("${s}")`);
    check(await gmGet(page, PROD) === 'production-refresh-token', 'the production token is kept');
  });
});

test.describe('a sandbox token the server rejects', () => {
  test.use({ gm: { name: 'ISRC Scout', values: { [PROD]: 'production-refresh-token', [TEST]: 'dead-refresh-token' } } });

  test('#683: is forgotten on submit, and Setup says so', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await openScout(page, inject);
    check(/✓ Authorized on test\.musicbrainz\.org/.test(await authState(page)), 'the stored sandbox token shows as authorized at first');
    await page.fill('tr[data-idx="0"] .ii-input', 'XXA001500001');
    await page.click('#ii-submit');
    const gone = await until(() => gmGet(page, TEST), v => v === null);
    check(gone === null, `the rejected token is removed (${gone})`);
    const s = await until(() => authState(page), t => /Not authorized/.test(t));
    check(/Not authorized on test\.musicbrainz\.org/.test(s), `Setup says not authorized ("${s}")`);
    check(/rejected the stored authorization/.test(await logText(page)), 'the log says why');
    check(await gmGet(page, PROD) === 'production-refresh-token', 'the production token is untouched');
  });
});
