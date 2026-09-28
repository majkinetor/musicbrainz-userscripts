// The session window's title ("Scribe vX") and its –/✕ controls rendered black on the
// dark-green header under dark userstyles. kellnerd's (#564) ships
// `div[style*=background]{color:initial}`; the header div has an inline background but
// no colour of its own, so its text inherited `initial`, which is black.
//
// test.musicbrainz.org, nothing edited: the rule is injected, the session window is
// opened (it draws before contacting the local helper, which gets no answer here), and
// every header text must be light. The title must show the manager's @version.
import { test, check, until, idle, requireLogin, SANDBOX } from '../../../dev/test/harness.mjs';

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
test.use({ gm: { name: 'Scribe', version: '9.9.9-test', xhr: 'none' } });

test('the session window header stays light under a dark userstyle', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`${SANDBOX}/release/${RELEASE}/edit`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await idle(page);
  await page.addStyleTag({ content: 'div[style*=background]{color:initial !important}' });
  await inject('scribe');
  await page.waitForFunction(() => window.__scribe && window.__scribe.startSession, null, { timeout: 20000 });
  await page.evaluate(() => { window.__scribe.startSession(); });
  const panel = page.locator('#scribe-panel');
  await panel.waitFor();

  // until the header has its title and both controls
  const cols = await until(() => page.evaluate(() => {
    const hdr = document.querySelector('#scribe-panel > div');
    // the title and the –/✕ controls, not the count badge
    const kids = [...hdr.children].filter(e => (e.textContent || '').trim() && !/^\d+$/.test(e.textContent.trim()));
    const lum = c => { const m = c.match(/[\d.]+/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
    return kids.map(e => ({ text: e.textContent.trim().slice(0, 20), color: getComputedStyle(e).color, lum: +lum(getComputedStyle(e).color).toFixed(2) }));
  }), c => c.length >= 3);
  await testInfo.attach('session window', { body: await panel.screenshot(), contentType: 'image/png' });
  check(cols.length >= 3, `the title and the –/✕ controls are found (${cols.length})`);
  check(cols.every(c => c.lum > 0.6), `every header text is light (${JSON.stringify(cols)})`);
  check(/v9\.9\.9-test/.test((cols[0] && cols[0].text) || ''), `the title shows the manager's @version (${cols[0] && cols[0].text})`);
});
