// The release Label field searches with Apollo's picker in place of MusicBrainz's (majkinetor:
// "replace native label search with ours, like artist … along with + on the right to create
// new"). MusicBrainz's input stays; its jQuery UI lookup is switched off and ＋ takes the search
// icon's place. The Original view hands the field back.
//
// Sandbox data: two labels are named "Warp", the UK one and an Australian one.
import { test, check, until, idle } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const WARP_UK = '46f0f4cd-8aab-4b33-b698-f459faf64190';
const seed = { name: 'Apollo label search', 'labels.0.name': 'Warp', 'mediums.0.format': 'Digital Media', 'mediums.0.track.0.name': 'One' };
const live = page => page.evaluate(() => { const l = window.MB.releaseEditor.rootField.release().labels()[0].label(); return { name: l && l.name, gid: (l && l.gid) || null, val: document.getElementById('label-0').value }; });
const field = page => page.evaluate(() => {
  const inp = document.getElementById('label-0'), host = inp.closest('span.autocomplete');
  const vis = el => !!(el && el.offsetParent && getComputedStyle(el).display !== 'none');
  const w = window.jQuery(inp).data('mbEntitylookup');
  return { taken: host.classList.contains('tc-ri-labhost'), mk: vis(host.querySelector('.tc-ri-labmk')), icon: vis(host.querySelector('img.search')), nativeOff: !!(w && w.options.disabled),
    badge: (host.querySelector('.tc-ri-lab .tc-badge') || {}).textContent || '', dis: (host.querySelector('.tc-ri-labdis') || {}).textContent || '' };
});

test.describe('label search', () => {
  test.use({ gm: apolloGm({ autoMatchLabel: false }) });

  test('Apollo\'s picker sets the label; ＋ creates one; the Original view gets MusicBrainz\'s back', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
    await openApollo(page, inject, { seed });
    const f0 = await until(() => field(page), v => v.taken);
    check(f0.taken && f0.nativeOff, `MusicBrainz's lookup is off, Apollo's is on: ${JSON.stringify(f0)}`);
    check(!f0.icon && f0.mk, `＋ in place of the search icon on an unlinked label: ${JSON.stringify(f0)}`);

    await page.locator('#label-0').click();
    const rows = await until(() => page.evaluate(() => [...document.querySelectorAll('.tc-labpop .tc-acrow[data-i]')].map(r => ({ gid: (r.querySelector('a.tic').href.match(/label\/([0-9a-f-]{36})/) || [])[1], exact: r.classList.contains('exact'), nm: r.querySelector('.nm').textContent }))), v => v.length >= 2);
    console.log(JSON.stringify(rows));
    check(rows.filter(r => r.exact && r.nm === 'Warp').length >= 2, `both labels named Warp are listed as exact: ${JSON.stringify(rows)}`);
    check(rows.some(r => r.gid === WARP_UK), 'the UK Warp is among them');
    check(await page.evaluate(() => [...document.querySelectorAll('ul.ui-autocomplete')].every(u => !u.offsetParent)), 'MusicBrainz\'s own menu stays shut');

    await page.locator(`.tc-labpop .tc-acrow:has(a.tic[href$="${WARP_UK}"])`).click();
    const set = await until(() => live(page), v => v.gid === WARP_UK);
    check(set.gid === WARP_UK && set.val === 'Warp', `the pick is written into the release's label: ${JSON.stringify(set)}`);
    await page.locator('#catno-0').click();
    const f1 = await until(() => field(page), v => v.badge === 'user');
    check(f1.badge === 'user' && !f1.mk, `a picked label shows "user", and ＋ only while the field has focus: ${JSON.stringify(f1)}`);

    // typing unlinks it, as MusicBrainz's own field does; ＋ opens the create form for the typed name
    await page.locator('#label-0').fill('Zzq Label Search New');
    const un = await until(() => live(page), v => !v.gid);
    check(!un.gid && un.name === 'Zzq Label Search New', `typing unlinks the label: ${JSON.stringify(un)}`);
    const opened = await page.evaluate(() => { const o = []; window.open = u => { o.push(String(u)); return null; }; document.querySelector('.tc-ri-labmk').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); return o[0] || ''; });
    const cu = opened ? new URL(opened) : null;
    check(cu && /\/label\/create$/.test(cu.pathname) && cu.searchParams.get('edit-label.name') === 'Zzq Label Search New', `＋ opens the create-label form for that name: ${opened}`);

    // a pasted MBID sets that label at once
    await page.locator('#label-0').fill(WARP_UK);
    const pasted = await until(() => live(page), v => v.gid === WARP_UK);
    check(pasted.gid === WARP_UK && pasted.val === 'Warp', `a pasted MBID resolves to its label: ${JSON.stringify(pasted)}`);
    await page.keyboard.press('Escape');

    // Original view: MusicBrainz's lookup and search icon come back
    await page.locator('#catno-0').click();
    await page.evaluate(() => document.querySelector('#tc-launch .tc-launch-lbl').click());
    await idle(page);
    const f2 = await until(() => field(page), v => !v.taken);
    check(!f2.taken && !f2.nativeOff && f2.icon && !f2.mk, `the Original view hands the field back: ${JSON.stringify(f2)}`);
  });
});
