// #543 (majkinetor): "When multiple URLs are pasted, in (+) line, Apollo should add them
// all at once … Find out only links, no matter where they are, so they could be
// intermingled with text", and "Automatically select most appropriate link type (same
// mechanism as PC)". Then: "Make a hint show that it can be multiple links", and, once it
// did, "its always shown now, it doesn't collapse to (+) and draws over button" — the
// collapse rules keyed on MusicBrainz's placeholder text; they key on :placeholder-shown.
//
// His two examples, verbatim. On a sandbox release's editor; nothing is submitted.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });
const REL = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const BC = 'https://digthiswayrecords.bandcamp.com/album/musical-breed-save-the-little-children';
const SP = 'https://open.spotify.com/album/3ibDwnUIydFebHj3pNW9WR';

test('links are found anywhere in the pasted text', { tag: '@unit' }, async ({ page, inject }) => {
  await page.setContent('<!DOCTYPE html><html><body></body></html>');
  await inject('apollo_editor', { waitFor: '__apolloEditor' });
  const ex = await page.evaluate(({ BC, SP }) => {
    const f = window.__apolloEditor.alExtractUrls;
    return {
      labelled: f(`Bandcamp: ${BC}\nSpotify: ${SP}`), markdown: f(`Available on [Bandcamp](${BC}) & [Spotify](${SP})`),
      punct: f(`see ${SP}, and ${BC}.`), dupes: f(`${SP} ${SP}`), none: f('no links here at all'), scheme: f('http://'),
    };
  }, { BC, SP });
  check(JSON.stringify(ex.labelled) === JSON.stringify([BC, SP]), 'his labelled block: exactly the two links');
  check(JSON.stringify(ex.markdown) === JSON.stringify([BC, SP]), 'his markdown line: the closing paren is not taken');
  check(JSON.stringify(ex.punct) === JSON.stringify([SP, BC]), `a trailing comma or full stop is not taken (${JSON.stringify(ex.punct)})`);
  check(ex.dupes.length === 1, 'one link twice is one link');
  check(ex.none.length === 0 && ex.scheme.length === 0, 'prose, or a bare scheme, is nothing');
});

test('the (+) row: its hint, and collapsed until focused', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { release: REL });
  const hint = await page.waitForFunction(() => {
    const i = [...document.querySelectorAll('#external-links-editor input[type=url]')].find(x => !x.value);
    return i && i.placeholder !== 'Add link' ? i.placeholder : null;
  }, null, { timeout: 20000 }).then(h => h.jsonValue()).catch(() => null);
  check(hint === 'Paste one or more links', `it says several links can be pasted (${hint})`);
  const idle = await page.evaluate(() => ({ riOn: document.body.classList.contains('tc-ri-on'), w: Math.round([...document.querySelectorAll('#external-links-editor input[type=url]')].find(x => !x.value).getBoundingClientRect().width) }));
  check(idle.riOn, "Apollo's release view is on (the rules are scoped to it)");
  check(idle.w <= 40, `idle, it is a [+] button (${idle.w} px)`);
  const focused = await page.evaluate(async () => {
    const bar = document.querySelector('#tc-ri-toolbar');
    const before = bar ? (bar.style.display = '', getComputedStyle(bar).display) : null;   // no links yet: shown for the rule to decide
    const i = [...document.querySelectorAll('#external-links-editor input[type=url]')].find(x => !x.value);
    i.focus();
    await new Promise(z => setTimeout(z, 250));
    const ir = i.getBoundingClientRect(), after = bar ? getComputedStyle(bar).display : null, br = bar && bar.getBoundingClientRect();
    const overlaps = !!bar && after !== 'none' && !(br.right < ir.left || br.left > ir.right || br.bottom < ir.top || br.top > ir.bottom);
    i.blur();
    return { w: Math.round(ir.width), before, after, overlaps };
  });
  check(focused.w > idle.w * 3, `focused, a real input (${idle.w} → ${focused.w} px)`);
  check(focused.before !== 'none' && focused.after === 'none' && !focused.overlaps, `the Check-links toolbar steps aside while it is focused, never drawn over it (${JSON.stringify(focused)})`);
});

test('a paste adds every link, with its type', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
  const submitted = await openApollo(page, inject, { release: REL });
  const urls = () => page.evaluate(() => [...document.querySelectorAll('#external-links-editor tr.external-link-item')].map(r => {
    const a = r.querySelector('a.url') || r.querySelector('input[type=url]'), sib = r.nextElementSibling;
    const sel = sib && sib.classList.contains('relationship-item') ? sib.querySelector('select.link-type') : null;
    return { url: a ? a.href || a.value || '' : '', type: sel ? (sel.selectedOptions[0] ? sel.selectedOptions[0].textContent.trim() : '(blank)') : null };
  }).filter(x => x.url));
  await page.waitForSelector('#external-links-editor input[type=url]', { timeout: 20000 });
  const before = (await urls()).length;
  await page.evaluate(({ BC, SP }) => {
    const input = [...document.querySelectorAll('#external-links-editor input[type=url]')].find(i => !i.value);
    input.focus();
    const dt = new DataTransfer();
    dt.setData('text', `Bandcamp: ${BC}\nSpotify: ${SP}`);
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, { BC, SP });
  await page.waitForFunction(n => document.querySelectorAll('#external-links-editor tr.external-link-item a.url, #external-links-editor tr.external-link-item input[type=url]:not(:placeholder-shown)').length >= n + 2, before, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const after = await urls();
  check(after.length === before + 2, `both links added by one paste (${before} → ${after.length})`);
  const bc = after.find(r => r.url.includes('bandcamp.com')), sp = after.find(r => r.url.includes('open.spotify.com'));
  check(bc && sp, 'the Bandcamp and the Spotify link');
  check(bc && /stream/i.test(bc.type || ''), `Bandcamp's type is set, to the free-streaming one Platform Check picks (${bc && bc.type})`);
  check(sp && sp.type !== '(blank)', `Spotify's is MusicBrainz's own choice, not blanked (${sp && sp.type})`);
  check(submitted.length === 0, 'nothing submitted');
});
