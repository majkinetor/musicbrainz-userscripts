// The Discogs master ✓ beside the Discogs row adds the master to the release group.
//
// #682 (majkinetor): "The only way is to click its check which opens 2 tabs (1 discogs,
//   1 MB)." The click reached the row too, which opens the Discogs page. Now a click opens
//   only the release-group editor, and a right-click adds the master in the background
//   (the row used to open Discogs' search instead) — the background route for a master
//   the + won't queue, because the Discogs release isn't a confirmed match.
//
// test.musicbrainz.org, read-only: tabs are recorded, never opened.
import { test, check, until } from '../../../dev/test/harness.mjs';

const REL = 'c778af9d-fe2f-4502-939c-15e4e2b76c55';   // "Midnight Carnival"
const RG = '9d3283d0-82a1-4b27-901a-de2d2965ebea';
const MASTER = 'https://www.discogs.com/master/123456';
test.use({ gm: { name: 'Platform Check', xhr: 'none' } });

test('#682: the master ✓ opens one tab; right-click adds it in the background', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
  await page.addInitScript(() => {
    window.__opened = []; window.__bg = [];
    window.open = url => { window.__opened.push(String(url)); return {}; };
    window.GM_openInTab = url => { window.__bg.push(String(url)); return { close() {} }; };
  });
  await page.goto(`https://test.musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded' });
  await inject('platform_check', { waitFor: '__pcTest464' });
  check(await until(() => page.evaluate(() => !!document.getElementById('master-discogs')), v => v), 'the master slot is there');
  // the Discogs row as after a scan: a found release, and a master the group lacks
  const click = type => page.evaluate(([m, type]) => {
    const { applyMasterIcon, discogsMasterState } = window.__pcTest464;
    document.getElementById('mb-online-discogs').href = 'https://www.discogs.com/release/1';
    const el = document.getElementById('master-discogs');
    applyMasterIcon(el, discogsMasterState(m, null));
    window.__opened = []; window.__bg = [];
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: type === 'click' ? 0 : 2 }));
    return { opened: window.__opened, bg: window.__bg };
  }, [MASTER, type]);

  const left = await click('click');
  check(left.opened.length === 1 && left.opened[0].includes(`/release-group/${RG}/edit`) && !left.bg.length,
    `a click opens only the release-group editor (${JSON.stringify(left)})`);
  check(!left.opened.some(u => /discogs\.com/.test(u)), 'and not the Discogs page beside it');

  const right = await click('contextmenu');
  check(!right.opened.length, `a right-click opens no foreground tab (${JSON.stringify(right)})`);
  check(right.bg.length === 1 && right.bg[0].includes(`/release-group/${RG}/edit#pc-autocommit`),
    'it adds the master in a background tab that submits itself');
  check(JSON.parse(await page.evaluate(rg => localStorage.getItem('pc:pending:rg:' + rg), RG) || '{}')['discogs-master'] === MASTER,
    'the master is what is queued');
});
