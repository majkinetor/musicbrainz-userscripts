// #657 (majkinetor): "I want to rclick Create so it goes to background as usual, after I set
// disamb" — in the ▾ popup ("Create artist in MusicBrainz"), a right-click on Create ↗ creates in
// a background tab, as a right-click on the row's + does (#273), with the name and
// disambiguation from the popup. A left click still opens the create page in front.
//
// On the #605 release ("Bad Boys!", copied to the sandbox), with production's web-service
// answers (fixtures/ws-613-add-alias.json.gz). The tabs are caught, nothing is created.
import { test, check, replayWs } from '../../../dev/test/harness.mjs';
import { withShim, openEditor } from './ch.mjs';

test.use({ gm: false });

test('#657: right-click on the popup\'s Create creates in the background, with its disambiguation', { tag: ['@sandbox', '@login', '@web'] }, async ({ page, inject }) => {
  test.setTimeout(6 * 60_000);
  await openEditor(page, 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c');
  const ws = await replayWs(page, new URL('./fixtures/ws-613-add-alias.json.gz', import.meta.url));
  await page.evaluate(() => {
    window.__bg = []; window.__fg = [];
    window.GM_openInTab = (url, o) => { window.__bg.push({ url: String(url), active: !!(o && o.active) }); return { close() {} }; };
    window.open = url => { window.__fg.push(String(url)); return null; };
  });
  await inject('credit_hoarder', { transform: withShim });
  await page.waitForSelector('.discogs-bar', { timeout: 30000 });
  await page.click('.discogs-src-ico[data-src="Discogs"]').catch(() => page.click('.discogs-src-ico'));
  await page.waitForFunction(() => /Preflight done/.test(document.body.innerText), null, { timeout: 180000 });

  const adv = page.locator('tbody button', { hasText: /^▾$/ }).first();
  check(await adv.count() === 1, 'a row offers ▾ (create with options)');
  const popup = async () => {
    await adv.click();
    const heading = page.getByText(/^Create (artist|label|place|work) in MusicBrainz$/);
    await heading.waitFor();
    const modal = heading.locator('..');
    await modal.locator('input').nth(1).fill('CH 657 test disambiguation');
    return modal.locator('button', { hasText: 'Create ↗' });
  };

  const create = await popup();
  check(/right-click: create silently in a background tab/.test(await create.getAttribute('title') || ''), 'Create says what a right-click does');
  await create.click({ button: 'right' });
  const bg = await page.evaluate(() => ({ bg: window.__bg.slice(), fg: window.__fg.slice(), popup: [...document.querySelectorAll('div')].some(d => /^Create (artist|label|place|work) in MusicBrainz$/.test(d.textContent)) }));
  check(bg.bg.length === 1 && !bg.bg[0].active && !bg.fg.length, `right-click: one background tab, nothing in front (${JSON.stringify(bg)})`);
  const u = new URL(bg.bg[0].url);
  check(/\/(artist|label|place|work)\/create$/.test(u.pathname) && /^#ch-autocommit=/.test(u.hash), `…the create page, auto-submitted (${u.pathname}${u.hash.slice(0, 16)})`);
  check([...u.searchParams].some(([k, v]) => /\.comment$/.test(k) && v === 'CH 657 test disambiguation'), `…with the popup's disambiguation (${[...u.searchParams].filter(([k]) => /\.(comment|name)$/.test(k)).map(kv => kv.join('=')).join(' · ')})`);
  check(!bg.popup, 'the popup closed');

  // a left click is unchanged: the create page in front, for review
  await page.evaluate(() => { window.__bg = []; window.__fg = []; });
  // the row now shows "Creating … in the background"; another row's ▾ (or none) is what's left
  if (await adv.count() === 1) {
    const again = await popup();
    await again.click();
    const fg = await page.evaluate(() => ({ bg: window.__bg.length, fg: window.__fg.slice() }));
    check(fg.bg === 0 && fg.fg.length === 1 && /\/create\?/.test(fg.fg[0]) && /comment=CH\+657/.test(fg.fg[0]), `left click: the create page in front, with the disambiguation (${JSON.stringify(fg)})`);
  }
  await ws.done();
});
