import { readFileSync } from 'node:fs';
import { test, expect, SANDBOX, answerGm } from '../../../dev/test/harness.mjs';
const members = readFileSync(new URL('../members.txt', import.meta.url), 'utf8').split(/\r?\n/).map(x => x.replace(/#.*/, '').trim()).filter(Boolean);
test.use({ gm: { name: 'String Theory', persist: true, values: {
  'string_theory.off': members,
  view: { width: 800, stars: [] },
  'mbu.archive': { iaKey: 'fixture-key', iaSecret: 'fixture-secret' },
} } });

test('backup download and import use the bundle’s real settings and apply on reload', { tag: '@sandbox' }, async ({ page, inject }, info) => {
  await page.goto(SANDBOX + '/search/edits', { waitUntil: 'load' });
  await inject('string_theory');
  await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings')));
  await page.locator('#st-tab-s').click();
  await expect(page.locator('#st-sync-auto')).not.toBeChecked();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#st-sync-export').click();
  const download = await downloadPromise;
  const backup = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(backup.data.gm['mbu.archive'].value.iaSecret).toBe('fixture-secret');
  expect(backup.data.gm.view.value.width).toBeUndefined();
  backup.data.gm.view.value.stars = [{ key: 'artist/7a2e9474-459e-44f5-8421-8b7943c8a6f0', title: 'Fixture' }];
  backup.data.gm.view.value.width = 1600; // imports reapply exclusions too
  await page.locator('#st-sync-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.locator('#st-sync-reload')).toBeVisible();
  expect(await page.evaluate(() => GM_getValue('view'))).toEqual({ width: 800, stars: [] });
  await page.screenshot({ path: 'dev/_885-sync.png', fullPage: false });
  await info.attach('Sync settings', { path: 'dev/_885-sync.png', contentType: 'image/png' });
  await page.reload(); await inject('string_theory');
  const stored = await page.evaluate(() => GM_getValue('view'));
  expect(stored.width).toBe(800); expect(stored.stars).toHaveLength(1);
  expect(await page.evaluate(() => GM_getValue('string_theory.sync.stage'))).toBeUndefined();
});

test.describe('automatic Dropbox authorization', () => {
  test.use({ gm: { name: 'String Theory', persist: 'tabs', values: { 'string_theory.off': members } } });
  test('callback completes in another tab and notifies the initiating settings window', { tag: '@sandbox' }, async ({ page, context, inject }, info) => {
    const requests = [];
    await answerGm(context, opts => {
      if (opts.url === 'https://api.dropbox.com/oauth2/token') {
        const form = new URLSearchParams(opts.data);
        expect(form.get('redirect_uri')).toBe(SANDBOX + '/?st-dropbox=callback');
        expect(form.get('code')).toBe('fixture-code'); expect(form.get('code_verifier').length).toBeGreaterThanOrEqual(43);
        requests.push('token');
        return { status: 200, body: JSON.stringify({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_in: 14400 }) };
      }
      if (opts.url === 'https://api.dropboxapi.com/2/users/get_current_account') {
        requests.push('account');
        return { status: 200, body: JSON.stringify({ account_id: 'fixture-account', name: { display_name: 'Fixture' } }) };
      }
      return null;
    });
    const transform = code => code
      .replaceAll('https://musicbrainz.org/?st-dropbox=callback', SANDBOX + '/?st-dropbox=callback')
      .replace("callback.origin !== 'https://musicbrainz.org'", 'callback.origin !== ' + JSON.stringify(SANDBOX))
      .replace("location.origin === 'https://musicbrainz.org'", 'location.origin === ' + JSON.stringify(SANDBOX));
    await page.goto(SANDBOX + '/search/edits');
    const prepare = () => {
      window.GM_openInTab = url => { window.__dropboxAuthorize = url; };
      // The harness shares values through localStorage; emulate the manager's cross-tab notification.
      window.GM_addValueChangeListener = (key, fn) => {
        window.addEventListener('storage', e => { if (e.key && e.key.endsWith(key)) fn(key, e.oldValue && JSON.parse(e.oldValue), e.newValue && JSON.parse(e.newValue), true); });
        return 1;
      };
    };
    await page.evaluate(prepare);
    await inject('string_theory', { transform });
    await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings')));
    await page.locator('#st-tab-s').click();
    await page.locator('#st-sync-connect').click();
    await expect.poll(() => page.evaluate(() => window.__dropboxAuthorize || '')).toContain('code_challenge=');
    const auth = new URL(await page.evaluate(() => window.__dropboxAuthorize));
    const callback = new URL(auth.searchParams.get('redirect_uri'));
    callback.searchParams.set('code', 'fixture-code'); callback.searchParams.set('state', auth.searchParams.get('state'));
    // Authorization can outlive a reload of its initiating tab; the GM verifier and listener resume.
    await page.reload(); await page.evaluate(prepare); await inject('string_theory', { transform });
    await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings')));
    await page.locator('#st-tab-s').click();
    await expect(page.locator('#st-sync-status')).toContainText('Waiting for Dropbox');
    const popup = await context.newPage();
    await popup.goto(callback.href);
    await popup.evaluate(() => { window.close = () => { window.__requestedClose = true; }; });
    await inject('string_theory', { target: popup, transform });
    await expect(page.locator('#st-sync-status')).toContainText('Connected: Fixture');
    await expect.poll(() => popup.evaluate(() => !!window.__requestedClose)).toBe(true);
    expect(new URL(popup.url()).searchParams.has('code')).toBe(false);
    expect(await popup.locator('#eh-launch,#mc-launch,#st-cfg').count()).toBe(0);
    expect(await page.evaluate(() => GM_getValue('string_theory.sync.oauth'))).toBeUndefined();
    expect(await page.locator('#st-sync-code').count()).toBe(0);
    expect(requests).toEqual(['token', 'account']);
    await page.screenshot({ path: 'dev/_885-sync-connected.png' });
    await info.attach('Connected sync settings', { path: 'dev/_885-sync-connected.png', contentType: 'image/png' });
    await popup.close();
  });
});
