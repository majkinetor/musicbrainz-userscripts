import { test } from '../../../dev/test/harness.mjs';
import { appendFileSync, writeFileSync } from 'node:fs';
const F = 'test-results/probe.txt';
writeFileSync(F, '');
const log = (...a) => appendFileSync(F, a.join(' ') + '\n');

test.use({ gm: { name: 'Event Horizon' }, pageErrors: 'ignore' });

test('probe', async ({ page, inject }) => {
  const logs = [];
  page.on('console', m => logs.push(m.type() + ' ' + m.text()));
  page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
  const resp = await page.goto(process.env.PROBE_URL || 'https://test.musicbrainz.org/account/applications');
  log('CSP', resp.headers()['content-security-policy'] || 'none', '| ROCSP', resp.headers()['content-security-policy-report-only'] || 'none');
  log('META', await page.evaluate(() => [...document.querySelectorAll('meta[http-equiv]')].map(m => m.outerHTML).join(' ')));
  await inject('event_horizon');
  await page.waitForTimeout(6000);
  log(await page.evaluate(() => JSON.stringify({
    url: location.href, app: !!document.querySelector('#app'), relhd: !!document.querySelector('#eh-relhd'),
    nt: document.querySelectorAll('#eh-relhd .u-nt').length, upg: !!document.querySelector('#eh-upg'),
    html: document.documentElement.className, body: document.body.className,
    ids: [...document.querySelectorAll('[id^=eh-],#app')].map(x => x.id).slice(0, 30),
  })));
  log(logs.slice(0, 40).join('\n'));
});
