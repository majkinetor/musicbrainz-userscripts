import { readFileSync } from 'node:fs';
import { test, expect, answerGm } from '../../../dev/test/harness.mjs';

const SANDBOX = 'https://test.musicbrainz.org';
const members = readFileSync(new URL('../members.txt', import.meta.url), 'utf8').split(/\r?\n/).map(x => x.replace(/#.*/, '').trim()).filter(Boolean);
test.use({ profile: 'fresh', gm: { name: 'String Theory', persist: 'tabs', values: {
  'string_theory.off': members, 'string_theory.sync.settings': { provider: 'google' },
} } });

test('expired Google callback can retry with fresh PKCE and notify the original tab', { tag: '@sandbox' }, async ({ page, context, inject }, info) => {
  const requests = [];
  await answerGm(context, opts => {
    if (opts.url === 'https://oauth2.googleapis.com/token') {
      requests.push(new URLSearchParams(opts.data));
      return { status: 200, body: JSON.stringify({ access_token: 'retry-access', refresh_token: 'retry-refresh', expires_in: 3600 }) };
    }
    if (opts.url.startsWith('https://www.googleapis.com/drive/v3/about')) return { status: 200, body: JSON.stringify({ user: { permissionId: 'retry-account', displayName: 'Retry fixture' } }) };
    return null;
  });
  const transform = code => code
    .replaceAll('https://musicbrainz.org/?st-google=callback', SANDBOX + '/?st-google=callback')
    .replace("callback.origin !== 'https://musicbrainz.org'", 'callback.origin !== ' + JSON.stringify(SANDBOX))
    .replace("location.origin === 'https://musicbrainz.org'", 'location.origin === ' + JSON.stringify(SANDBOX));
  await page.goto(SANDBOX + '/');
  await page.evaluate(() => {
    window.GM_openInTab = url => { window.__authorize = url; };
    window.GM_addValueChangeListener = (key, fn) => {
      window.addEventListener('storage', e => { if (e.key && e.key.endsWith(key)) fn(key, e.oldValue && JSON.parse(e.oldValue), e.newValue && JSON.parse(e.newValue), true); });
    };
  });
  await inject('string_theory', { transform });
  await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings')));
  await page.locator('#st-tab-s').click();
  await page.locator('#st-sync-connect').click();
  await expect.poll(() => page.evaluate(() => window.__authorize || '')).toContain('code_challenge=');
  const first = new URL(await page.evaluate(() => window.__authorize));
  await page.evaluate(() => {
    const pending = GM_getValue('string_theory.sync.oauth');
    GM_setValue('string_theory.sync.oauth', { ...pending, at: Date.now() - 11 * 60e3 });
  });
  const popup = await context.newPage();
  const callback = new URL(first.searchParams.get('redirect_uri'));
  callback.searchParams.set('state', first.searchParams.get('state')); callback.searchParams.set('code', 'expired-code');
  await popup.goto(callback.href);
  await inject('string_theory', { target: popup, transform });
  await expect(popup.locator('body')).toContainText('Authorization expired');
  expect(requests).toHaveLength(0);
  await popup.screenshot({ path: 'dev/_946-oauth-retry.png' });
  await info.attach('Expired authorization with recovery', { path: 'dev/_946-oauth-retry.png', contentType: 'image/png' });
  await popup.route('https://accounts.google.com/o/oauth2/v2/auth*', route => route.fulfill({ contentType: 'text/html', body: '<p>Google sign-in fixture</p>' }));
  await popup.getByRole('button', { name: 'Try again', exact: true }).click();
  await popup.waitForURL('https://accounts.google.com/o/oauth2/v2/auth*');
  const retry = new URL(popup.url());
  expect(retry.searchParams.get('state')).not.toBe(first.searchParams.get('state'));
  expect(retry.searchParams.get('code_challenge')).not.toBe(first.searchParams.get('code_challenge'));
  await expect(page.locator('#st-sync-status')).toContainText('Waiting for Google Drive');
  const fresh = new URL(retry.searchParams.get('redirect_uri'));
  fresh.searchParams.set('state', retry.searchParams.get('state')); fresh.searchParams.set('code', 'fresh-code');
  await popup.goto(fresh.href);
  await popup.evaluate(() => { window.close = () => {}; });
  await inject('string_theory', { target: popup, transform });
  await expect(popup.locator('body')).toContainText('Connected to Google Drive');
  await expect(page.locator('#st-sync-connect')).toHaveText('Reconnect');
  expect(requests).toHaveLength(1);
  expect(requests[0].get('code')).toBe('fresh-code');
  expect(requests[0].get('code_verifier').length).toBeGreaterThanOrEqual(43);
  await popup.close();
});
