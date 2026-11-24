import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('revoke an application inline and keep the profile navigation', { tag: '@sandbox' }, async ({ page, inject }) => {
  const name = 'EH revoke test ' + Date.now();
  await page.goto('https://test.musicbrainz.org/account/applications/register');
  await page.locator('[name="application.name"]').fill(name);
  await page.locator('[name="application.oauth_type"]').selectOption('installed');
  await page.locator('form[method="post"] button[type="submit"]').click();
  const devRow = page.locator('tr').filter({ hasText: name });
  await devRow.waitFor();
  const client = (await devRow.locator('td').nth(2).textContent()).trim();
  const secret = (await devRow.locator('td').nth(3).textContent()).trim();
  const remove = await devRow.locator('a[href*="/remove"]').getAttribute('href');
  const auth = new URL('https://test.musicbrainz.org/oauth2/authorize');
  for (const [k, v] of Object.entries({ client_id: client, response_type: 'code', redirect_uri: 'urn:ietf:wg:oauth:2.0:oob', scope: 'profile' })) auth.searchParams.set(k, v);
  await page.goto(auth.href);
  await page.getByRole('button', { name: 'Allow access' }).click();
  // the success page shows the code in a code element: waiting for it waits for that page
  const code = (await page.locator('#content code, code').first().innerText()).match(/\b[A-Za-z0-9_-]{30,}\b/);
  if (!code) throw new Error('OAuth authorization code not found');
  const token = await page.request.post('https://test.musicbrainz.org/oauth2/token', { form: { grant_type: 'authorization_code', code: code[0], redirect_uri: 'urn:ietf:wg:oauth:2.0:oob' }, headers: { Authorization: 'Basic ' + Buffer.from(client + ':' + secret).toString('base64') } });
  if (!token.ok()) throw new Error('OAuth token exchange failed: ' + token.status());
  await page.goto('https://test.musicbrainz.org/account/applications');
  const row = page.locator('tr').filter({ hasText: name }).filter({ has: page.locator('a[href*="revoke-access"]') });
  await row.waitFor();
  await inject('event_horizon');
  check(await until(() => page.locator('#eh-relhd .u-nt').count(), n => n >= 10) >= 10, 'public and account tabs are present');   // the header comes once EH has read the page
  await row.locator('a[href*="revoke-access"]').click();
  check(page.url().endsWith('/account/applications'), 'confirmation stays on the applications page');
  await row.locator('[data-eh-revoke-cancel]').click();
  check(await row.locator('a[href*="revoke-access"]').count() === 1, 'cancel keeps access');
  await page.goto('https://test.musicbrainz.org/user/majkinetor');
  await inject('event_horizon');
  await page.locator('#app .u-nav a[href$="/account/applications"]').click();
  const inlineRow = page.locator('#eh-upg tr').filter({ hasText: name }).filter({ has: page.locator('a[href*="revoke-access"]') });
  await inlineRow.locator('a[href*="revoke-access"]').click();
  await inlineRow.locator('a[href*="revoke-access"]').click();
  check(await until(() => inlineRow.count(), n => n === 0) === 0, 'the revoked row disappears');
  await page.reload();
  check(await row.count() === 0, 'the grant remains revoked after reload');
  await page.goto(new URL(remove, page.url()).href);
  await page.locator('form[method="post"] button[type="submit"]').first().click();
});

test('applications opens from the profile without a page load', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/user/majkinetor');
  await inject('event_horizon');
  await page.locator('#app .u-nav a[href$="/account/applications"]').click();
  check(await until(() => page.locator('#eh-upg a[href*="revoke-access"]').count(), n => n > 0) > 0, 'applications load inside the viewer');
  check(await page.locator('#eh-upghd .u-nt').count() >= 10, 'the profile and account tabs remain available');
});
