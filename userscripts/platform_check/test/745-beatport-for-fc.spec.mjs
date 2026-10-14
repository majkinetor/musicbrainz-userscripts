// #745: First Contact asks for a Beatport release whose page Cloudflare refused (pc:beatport-release); Platform Check
// reads it through Beatport's API with its login. Without a login it says so at once, so First Contact can tell the user.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Platform Check' } });

test('#745: without a Beatport login, Platform Check answers that it isn\'t logged in', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/9d290316-dcd3-4d7e-a62b-392ab2396f27`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/beatport/i.test(k)) localStorage.removeItem(k); });
  await inject('platform_check', { waitFor: '__pcTest680' });
  const got = await page.evaluate(() => new Promise(res => {
    document.addEventListener('pc:beatport-release-result', e => res(JSON.parse(e.detail)));
    document.dispatchEvent(new CustomEvent('pc:beatport-release', { detail: JSON.stringify({ id: '7172118', req: 'r745' }) }));
    setTimeout(() => res(null), 10000);
  }));
  console.log(JSON.stringify(got));
  check(got && got.req === 'r745' && !got.release && /isn't logged in to Beatport/.test(got.error || ''), `it answers, with why (${JSON.stringify(got)})`);
});
