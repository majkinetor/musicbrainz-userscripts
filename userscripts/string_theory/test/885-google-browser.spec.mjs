import { readFileSync } from 'node:fs';
import { test, expect, SANDBOX, answerGm } from '../../../dev/test/harness.mjs';
import { googleCloud } from './support/google-drive.mjs';
const members = readFileSync(new URL('../members.txt', import.meta.url), 'utf8').split(/\r?\n/).map(x => x.replace(/#.*/, '').trim()).filter(Boolean);
test.use({ gm: { name: 'String Theory', persist: true, values: {
  'string_theory.off': members, saved: 'snapshot', view: { width: 800, stars: [] },
  'string_theory.sync.auth': { refreshToken: { token: 'dropbox-retained' } },
} } });

test('Google provider connects and retains Dropbox when disconnected', { tag: '@sandbox' }, async ({ page, context, inject }, info) => {
  const server = googleCloud(), refreshed = [];
  await answerGm(context, async opts => {
    if (opts.url === 'https://oauth2.googleapis.com/token') { refreshed.push(String(opts.data)); return { status: 200, body: JSON.stringify({ access_token: 'google-token', expires_in: 3600, token_type: 'Bearer' }), headers: 'content-type: application/json' }; }
    if (!opts.url.startsWith('https://www.googleapis.com/')) return null;
    const r = await server.request(opts); return { status: r.status, body: r.text, headers: r.headers };
  });
  const prepare = () => {
    window.GM_openInTab = url => { window.__authorize = url; };   // the redirect code flow (dc4a1f9b) opens Google's page
    const xhr = window.GM_xmlhttpRequest;
    window.GM_xmlhttpRequest = opts => xhr({ ...opts, data: opts.data instanceof ArrayBuffer ? new TextDecoder().decode(opts.data) : opts.data });
  };
  await page.goto(SANDBOX + '/search/edits'); await page.evaluate(prepare); await inject('string_theory');
  const open = async () => { await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings'))); await page.locator('#st-tab-s').click(); };
  await open(); await page.locator('#st-sync-provider').selectOption('google');
  await expect(page.locator('#st-sync-connect')).toHaveText('Connect');
  await page.locator('#st-sync-connect').click();
  await expect.poll(() => page.evaluate(() => window.__authorize || '')).toContain('code_challenge=');
  const auth = new URL(await page.evaluate(() => window.__authorize)).searchParams;
  expect({ clientId: auth.get('client_id'), scope: auth.get('scope'), access: auth.get('access_type') }).toEqual({ clientId: '762250056217-8uip1j2fusc9npm4fievee31btjqf02o.apps.googleusercontent.com', scope: 'https://www.googleapis.com/auth/drive.file', access: 'offline' });
  // the callback's token exchange is 946-oauth-retry's; here the tokens it leaves behind
  await page.evaluate(() => { GM_setValue('string_theory.sync.google.auth', { accessToken: { token: 'google-token', expiresAt: Date.now() + 3600e3 }, refreshToken: { token: 'google-refresh' } }); GM_deleteValue('string_theory.sync.oauth'); });
  await page.reload(); await page.evaluate(prepare); await inject('string_theory');
  await open();
  await expect(page.locator('#st-sync-connect')).toHaveText('Reconnect');
  await expect(page.locator('#st-sync-status')).toBeHidden();
  await expect(page.locator('#st-sync-controls')).toBeVisible();   // Google syncs again since dc4a1f9b
  for (const id of ['now', 'push', 'pull']) await expect(page.locator('#st-sync-' + id)).toBeEnabled();
  await page.locator('#st-sync-remote-backup').click();
  await expect(page.locator('#st-sync-backup-status')).toHaveText('Backup saved to Google Drive.');
  await page.locator('#st-sync-remote-import').click();
  await expect(page.locator('#st-sync-remote [data-backup-action=apply]')).toHaveCount(1);
  await page.screenshot({ path: 'dev/_google-sync.png' });
  await info.attach('Google Drive settings', { path: 'dev/_google-sync.png', contentType: 'image/png' });
  await page.evaluate(() => GM_setValue('saved', 'edit'));
  await page.locator('#st-sync-remote [data-backup-action=apply]').click();
  await expect(page.locator('#st-sync-reload')).toBeVisible();
  expect(await page.evaluate(() => GM_getValue('saved'))).toBe('edit');
  await page.reload(); await page.evaluate(prepare); await inject('string_theory');
  expect(await page.evaluate(() => GM_getValue('saved'))).toBe('snapshot');
  expect(await page.evaluate(() => GM_getValue('view').width)).toBe(800);
  await open(); await page.locator('#st-sync-remote-import').click();
  const remove = page.locator('#st-sync-remote [data-backup-action=delete]');
  await remove.click();
  await expect(page.locator('#st-sync-backups')).toHaveText('No remote backups yet.');
  await page.locator('#st-sync-backup-close').click();
  expect([...server.files.values()].filter(f => f.trashed)).toHaveLength(1);
  // an expired access token is renewed with the refresh token (dc4a1f9b), not a new connection
  await page.evaluate(() => { const a = GM_getValue('string_theory.sync.google.auth'); a.accessToken.expiresAt = 1; GM_setValue('string_theory.sync.google.auth', a); });
  await page.locator('#st-sync-remote-backup').click();
  await expect(page.locator('#st-sync-backup-status')).toHaveText('Backup saved to Google Drive.');
  expect(refreshed.join()).toContain('refresh_token=google-refresh');
  expect(await page.evaluate(() => GM_getValue('string_theory.sync.google.auth').accessToken.expiresAt > Date.now())).toBe(true);
  await page.locator('#st-sync-disconnect').click();
  expect(await page.evaluate(() => GM_getValue('string_theory.sync.auth').refreshToken.token)).toBe('dropbox-retained');
  expect(await page.evaluate(() => GM_getValue('string_theory.sync.google.auth'))).toBeUndefined();
});
