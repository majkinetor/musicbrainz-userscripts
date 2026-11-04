import { readFileSync } from 'node:fs';
import { test, expect, SANDBOX, answerGm } from '../../../dev/test/harness.mjs';
import { davCloud } from './support/webdav.mjs';
const members = readFileSync(new URL('../members.txt', import.meta.url), 'utf8').split(/\r?\n/).map(x => x.replace(/#.*/, '').trim()).filter(Boolean);
test.use({ gm: { name: 'String Theory', persist: true, values: {
  'string_theory.off': members, saved: 'snapshot', view: { width: 800, stars: [] },
  'string_theory.sync.auth': { refreshToken: { token: 'dropbox-retained' } },
} } });
const URL_ = 'https://dav.example.test/files/me/String Theory';
const SYNC = '/files/me/String Theory/string-theory.json';

test('WebDAV provider connects with a password, syncs with ETags and keeps remote backups', { tag: '@sandbox' }, async ({ page, context, inject }, info) => {
  const server = davCloud();
  await answerGm(context, async opts => {
    if (!opts.url.startsWith('https://dav.example.test/')) return null;
    const r = await server.request(opts); return { status: r.status, body: r.text, headers: r.headers };
  });
  await page.goto(SANDBOX + '/search/edits'); await inject('string_theory');
  const q = id => page.locator('#st-sync-' + id);
  const open = async () => { await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings'))); await page.locator('#st-tab-s').click(); };
  await open(); await q('provider').selectOption('webdav');
  await expect(q('dav')).toBeVisible();
  await expect(q('connect')).toHaveText('Connect');
  await expect(q('now')).toBeDisabled();

  await q('dav-url').fill(URL_); await q('dav-user').fill('me');
  await page.locator('#st-cfg').screenshot({ path: 'dev/_webdav-form.png' });
  await info.attach('WebDAV form', { path: 'dev/_webdav-form.png', contentType: 'image/png' });
  // A wrong password saves nothing.
  await q('dav-url').fill(URL_); await q('dav-user').fill('me'); await q('dav-password').fill('wrong');
  await q('connect').click();
  await expect(page.locator('#mbu-toast')).toContainText('WebDAV sign-in failed');
  expect(await page.evaluate(() => GM_getValue('string_theory.sync.webdav.auth'))).toBeUndefined();

  // Enter connects; the missing folder is created.
  await q('dav-password').fill('secret'); await q('dav-password').press('Enter');
  await expect(q('dav')).toBeHidden();
  await expect(q('connect')).toHaveText('Reconnect');
  expect(server.dirs.has('/files/me/String Theory/')).toBe(true);
  expect(await page.evaluate(() => GM_getValue('string_theory.sync.webdav.auth'))).toEqual({ url: 'https://dav.example.test/files/me/String%20Theory/', user: 'me', password: 'secret' });

  // First sync creates the file; a later one carries its ETag and retries after a concurrent write.
  await q('now').click();
  await expect(q('last')).toContainText('Last sync');
  expect(server.calls.find(c => c.method === 'PUT' && c.path === SYNC).status).toBe(201);
  expect(JSON.parse(server.files.get(SYNC).text).data.gm.saved.value).toBe('snapshot');
  await page.evaluate(() => GM_setValue('saved', 'edit'));
  server.race = true;
  await q('now').click();
  await expect.poll(() => server.calls.filter(c => c.method === 'PUT' && c.path === SYNC).map(c => c.status)).toEqual([201, 412, 204]);
  expect(JSON.parse(server.files.get(SYNC).text).data.gm.saved.value).toBe('edit');
  expect(await page.evaluate(() => GM_getValue('string_theory.sync.auth').refreshToken.token)).toBe('dropbox-retained');

  // Remote backups: save, list, apply, delete.
  await q('remote-backup').click();
  await expect(q('backup-status')).toHaveText('Backup saved to WebDAV.');
  expect([...server.files.keys()].filter(p => p.startsWith('/files/me/String Theory/backups/'))).toHaveLength(1);
  await q('remote-import').click();
  await expect(page.locator('#st-sync-remote [data-backup-action=apply]')).toHaveCount(1);
  await page.screenshot({ path: 'dev/_webdav-sync.png' });
  await info.attach('WebDAV settings', { path: 'dev/_webdav-sync.png', contentType: 'image/png' });
  await page.evaluate(() => GM_setValue('saved', 'later'));
  await page.locator('#st-sync-remote [data-backup-action=apply]').click();
  await expect(q('reload')).toBeVisible();
  await page.reload(); await inject('string_theory');
  expect(await page.evaluate(() => GM_getValue('saved'))).toBe('edit');
  await open(); await q('remote-import').click();
  await page.locator('#st-sync-remote [data-backup-action=delete]').click();
  await expect(q('backups')).toHaveText('No remote backups yet.');
  await q('backup-close').click();
  expect([...server.files.keys()].filter(p => p.includes('/backups/'))).toHaveLength(0);

  // Reconnect reopens the form with the URL and user filled in, not the password.
  await q('connect').click();
  await expect(q('dav')).toBeVisible();
  await expect(q('dav-url')).toHaveValue('https://dav.example.test/files/me/String%20Theory/');
  await expect(q('dav-user')).toHaveValue('me');
  await expect(q('dav-password')).toHaveValue('');
  await q('disconnect').click();
  expect(await page.evaluate(() => GM_getValue('string_theory.sync.webdav.auth'))).toBeUndefined();
  expect(await page.evaluate(() => GM_getValue('string_theory.sync.auth').refreshToken.token)).toBe('dropbox-retained');
});
