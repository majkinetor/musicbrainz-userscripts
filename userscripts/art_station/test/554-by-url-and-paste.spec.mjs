// The Source popover's "By URL" control, and Ctrl+V on the gallery.
//
// #507 (majkinetor): the always-visible "or paste any URL" row and its Fetch button gave
// way to a "By URL" title-bar toggle that unrolls into an input filling the title.
// Escape rolls it back up; pasting a URL imports it, with no button.
//
// #554 (vzell): "automatically paste the URL … when clicking the 'By URL' link". After
// several rounds, majkinetor: "Revert the button and input to previous and keep ctrl +
// v." So the control is as #507 left it, and #554 adds a page-level Ctrl+V. A paste
// gesture carries its own data, so it needs no clipboard permission and raises no
// prompt; reading the clipboard from a click did.
//
// test.musicbrainz.org: nothing is uploaded or submitted (write requests are counted).
import { readFile } from 'node:fs/promises';
import { test, check, sourceOf } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test('"By URL" unrolls, Escape rolls it up, a pasted URL imports; Ctrl+V imports from anywhere', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
  const writes = [];
  page.on('request', r => {
    // only writes count: MusicBrainz's own telemetry POSTs are not ours
    if ((r.method() === 'POST' || r.method() === 'PUT') && /\/ws\/2\/|\/cover-art-archive\/|archive\.org|\/edit\/|\/ws\/js\/edit/i.test(r.url())) writes.push(r.method() + ' ' + r.url());
  });
  await openArtStation(page, inject);
  const code = await readFile(sourceOf('art_station'), 'utf8');

  // ── the control (#507) ──
  await page.click('.as-src');
  await page.waitForSelector('.as-src-pop', { timeout: 5000 });
  check(!(await page.locator('.as-src-or, .as-src-go, .as-src-inp').count()), 'the old "or paste any URL" row, Fetch button and fixed input are gone');
  check(await page.locator('.as-src-url-btn').isVisible(), 'a "By URL" toggle sits in the title bar');
  check(((await page.locator('.as-src-url-btn').textContent()) || '').trim() === 'By URL', 'reading "By URL"');
  check(!(await page.locator('.as-src-url-inp').isVisible()), 'its input is hidden until clicked');

  await page.click('.as-src-url-btn');
  await page.waitForTimeout(150);
  check(await page.locator('.as-src-url-inp').isVisible(), 'clicking it unrolls the input');
  check(!(await page.locator('.as-src-htxt').isVisible()) && !(await page.locator('.as-src-url-btn').isVisible()), 'which takes the place of the title and the toggle');
  check(await page.evaluate(() => document.activeElement === document.querySelector('.as-src-url-inp')), 'and is focused');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check(await page.locator('.as-src-pop').count() === 1, 'Escape rolls the input up, and leaves the popover open');
  check(!(await page.locator('.as-src-url-inp').isVisible()) && await page.locator('.as-src-url-btn').isVisible(), 'the toggle is back');

  await page.click('.as-src-url-btn');
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const inp = document.querySelector('.as-src-url-inp');
    const dt = new DataTransfer(); dt.setData('text/plain', 'https://example.com/some-cover.jpg');
    inp.value = 'https://example.com/some-cover.jpg';
    inp.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  });
  await page.waitForTimeout(400);
  check(!(await page.locator('.as-src-pop').count()), 'pasting a URL imports it and closes the popover, no Fetch click');
  check(await page.locator('.as-srcing-thumb, .as-dmeta').count() > 0, 'a sourcing slot was created for it');

  // ── Ctrl+V anywhere (#554), with no clipboard reading ──
  check(!/navigator\.clipboard\.readText/.test(code) && !/pasteUrlAndGo|clipboardGranted/.test(code), 'the script never reads the clipboard, so no permission prompt can be raised');
  const paste = (text, into) => page.evaluate(async ([t, into]) => {
    if (window.__asTest) window.__asTest.lastSource = null;
    let target = document.body;
    if (into) { target = document.createElement('input'); document.body.appendChild(target); target.focus(); }
    const dt = new DataTransfer(); dt.setData('text', t);
    target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 350));
    if (into) target.remove();
    return (window.__asTest && window.__asTest.lastSource) || null;
  }, [text, into]);
  await page.evaluate(() => document.querySelectorAll('.as-pop').forEach(p => p.remove()));
  const got = await paste('https://www.example.com/anywhere.jpg');
  check(got === 'https://www.example.com/anywhere.jpg', `Ctrl+V on the gallery imports the URL (${JSON.stringify(got)})`);
  check(await paste('https://www.example.com/typed-into-a-field.jpg', true) === null, 'a paste into an input is left to the input');
  for (const junk of ['Psych Funk Sa-Re-Ga!', 'javascript:alert(1)', 'C:\\covers\\front.jpg']) {
    check(await paste(junk) === null, `pasting something that isn't an http(s) URL does nothing (${JSON.stringify(junk)})`);
  }
  check(writes.length === 0, `nothing was uploaded or submitted (${writes.length})`);
});
