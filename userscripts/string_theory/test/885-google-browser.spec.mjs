import { readFileSync } from 'node:fs';
import { test, expect, SANDBOX, answerGm } from '../../../dev/test/harness.mjs';
import { googleCloud } from './support/google-drive.mjs';
const members = readFileSync(new URL('../members.txt', import.meta.url), 'utf8').split(/\r?\n/).map(x => x.replace(/#.*/, '').trim()).filter(Boolean);
test.use({ gm: { name: 'String Theory', persist: true, values: {
  'string_theory.off': members, saved: 'snapshot', view: { width: 800, stars: [] },
  'string_theory.sync.auth': { refreshToken: { token: 'dropbox-retained' } },
} } });

test('Google provider connects for backups only and retains Dropbox when disconnected', { tag: '@sandbox' }, async ({ page, context, inject }, info) => {
  const server = googleCloud();
  await answerGm(context, async opts => {
    if (!opts.url.startsWith('https://www.googleapis.com/')) return null;
    const r = await server.request(opts); return { status: r.status, body: r.text, headers: r.headers };
  });
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'text/javascript', body: `
    window.google = { accounts: { oauth2: {
      hasGrantedAllScopes: (r,s) => r.scope === s,
      initTokenClient: config => ({ requestAccessToken: () => {
        window.__googleRequest = {clientId:config.client_id,scope:config.scope,include:config.include_granted_scopes};
        config.callback({ access_token:'google-token', expires_in:3600, token_type:'Bearer', scope:config.scope });
      } })
    } } };
  ` }));
  const prepare = () => {
    const xhr = window.GM_xmlhttpRequest;
    window.GM_xmlhttpRequest = opts => xhr({ ...opts, data: opts.data instanceof ArrayBuffer ? new TextDecoder().decode(opts.data) : opts.data });
  };
  await page.goto(SANDBOX + '/search/edits'); await page.evaluate(prepare); await inject('string_theory');
  const open = async () => { await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings'))); await page.locator('#st-tab-s').click(); };
  await open(); await page.locator('#st-sync-provider').selectOption('google');
  await expect(page.locator('#st-sync-connect')).toHaveText('Connect');
  await page.locator('#st-sync-connect').click();
  await expect(page.locator('#st-sync-connect')).toHaveText('Reconnect');
  await expect(page.locator('#st-sync-status')).toBeHidden();
  expect(await page.evaluate(() => window.__googleRequest)).toEqual({ clientId: '762250056217-8uip1j2fusc9npm4fievee31btjqf02o.apps.googleusercontent.com', scope: 'https://www.googleapis.com/auth/drive.file', include: false });
  await expect(page.locator('#st-sync-google-message')).toContainText('Sync is disabled');
  await expect(page.locator('#st-sync-controls')).toBeHidden();
  for (const id of ['now', 'push', 'pull', 'auto']) await expect(page.locator('#st-sync-' + id)).toBeDisabled();
  await page.locator('#st-sync-remote-backup').click();
  await expect(page.locator('#st-sync-backup-status')).toHaveText('Backup saved to Google Drive.');
  await page.locator('#st-sync-remote-import').click();
  await expect(page.locator('#st-sync-backups [data-backup-action=apply]')).toHaveCount(1);
  await page.screenshot({ path: 'dev/_google-sync.png' });
  await info.attach('Google Drive settings', { path: 'dev/_google-sync.png', contentType: 'image/png' });
  await page.evaluate(() => GM_setValue('saved', 'edit'));
  await page.locator('#st-sync-backups [data-backup-action=apply]').click();
  await expect(page.locator('#st-sync-reload')).toBeVisible();
  expect(await page.evaluate(() => GM_getValue('saved'))).toBe('edit');
  await page.reload(); await page.evaluate(prepare); await inject('string_theory');
  expect(await page.evaluate(() => GM_getValue('saved'))).toBe('snapshot');
  expect(await page.evaluate(() => GM_getValue('view').width)).toBe(800);
  await open(); await page.locator('#st-sync-remote-import').click();
  const remove = page.locator('#st-sync-backups [data-backup-action=delete]');
  await remove.click(); await expect(remove).toHaveText('Confirm delete'); await remove.click();
  await expect(page.locator('#st-sync-backups')).toHaveText('No remote backups yet.');
  expect([...server.files.values()].filter(f => f.trashed)).toHaveLength(1);
  const before = server.calls.length;
  await page.evaluate(() => { const a = GM_getValue('string_theory.sync.google.auth'); a.accessToken.expiresAt = 1; GM_setValue('string_theory.sync.google.auth', a); });
  await page.locator('#st-sync-remote-backup').click();
  await expect(page.locator('#st-sync-status')).toContainText('Reconnect to continue');
  expect(server.calls).toHaveLength(before);
  expect([...server.files.values()].filter(f => f.appProperties?.stKind === 'sync')).toHaveLength(0);
  await page.locator('#st-sync-disconnect').click();
  expect(await page.evaluate(() => GM_getValue('string_theory.sync.auth').refreshToken.token)).toBe('dropbox-retained');
  expect(await page.evaluate(() => GM_getValue('string_theory.sync.google.auth'))).toBeUndefined();
});
