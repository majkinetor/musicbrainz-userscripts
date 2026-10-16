// #721 (mr44er, MusicBrainz in German): Front and Back were dropped from uploads and the gallery
// showed "Typen: Vorderseite" as a cover's comment. Art Station read MB's type labels and its
// "Types:" line as English; German says "Vorderseite", "Rückseite" (Booklet and Medium stay, so
// those worked). With the sandbox in German: the uploads carry Front's and Back's type ids, the
// gallery (once the add page has shown MB's form in German) shows the English types and the real
// comment, and a comment edit keeps the types.
// The upload and edit POSTs are captured and aborted: the register path itself is unchanged,
// only which type ids it is given. Runs on test.musicbrainz.org.
import { test, check, until, requireLogin, SANDBOX, idle } from '../../../dev/test/harness.mjs';
import { RELEASE } from './as.mjs';

test.use({ gm: { name: 'Art Station', persist: true } });   // the gallery reads what the add page learnt

const body = r => Object.fromEntries([...new URLSearchParams(r.postData() || '')].reduce((m, [k, v]) => m.set(k, [...(m.get(k) || []), v]), new Map()));

test('in German, uploads keep Front and Back and the gallery reads types, not comments', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
  // expires by itself too: a clear at the end hasn't always reached the shared profile on disk
  await context.addCookies([{ name: 'lang', value: 'de', domain: 'test.musicbrainz.org', path: '/', expires: Math.floor(Date.now() / 1000) + 600 }]);
  try {
    const adds = [], edits = [];
    await page.route(/\/(add|reorder|edit)-cover-art(\/\d+)?(\?|$)/, r => {
      if (r.request().method() !== 'POST') return r.fallback();
      (/edit-cover-art/.test(r.request().url()) ? edits : adds).push(body(r.request()));
      return r.abort();
    });

    // uploads: types from the file names, sent as ids
    await page.goto(`${SANDBOX}/release/${RELEASE}/add-cover-art`, { waitUntil: 'domcontentloaded' });
    await requireLogin(page); await idle(page);
    await inject('art_station');
    await page.waitForSelector('#as-root', { timeout: 20000 }); await idle(page);
    await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = c.height = 600; const x = c.getContext('2d'); x.fillStyle = '#36c'; x.fillRect(0, 0, 600, 600);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const dt = new DataTransfer(); for (const n of ['front.png', 'back.png', 'booklet.png']) dt.items.add(new File([blob], n, { type: 'image/png' }));
      window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
    await until(() => page.evaluate(() => !document.querySelector('.as-commit')?.disabled), Boolean);
    await page.evaluate(() => document.querySelector('.as-commit').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await until(() => adds.length >= 3, Boolean, { timeout: 90000 });
    const ids = adds.map(a => (a['add-cover-art.type_id'] || []).join(',')).sort();
    check(JSON.stringify(ids) === '["1","2","3"]', `uploads carry Front, Back and Booklet (${JSON.stringify(ids)})`);

    // gallery: existing covers read in German
    await page.goto(`${SANDBOX}/release/${RELEASE}/cover-art`, { waitUntil: 'domcontentloaded' });
    await idle(page);
    check(await page.evaluate(() => /^Typen:/.test(document.querySelector('.artwork-cont p')?.textContent.trim())), 'fixture: MB shows the page in German');
    await inject('art_station');
    await page.waitForSelector('#as-root .as-card', { timeout: 20000 }); await idle(page);
    const cards = await page.evaluate(() => [...document.querySelectorAll('#as-root .as-card')].map(c => ({
      type: c.querySelector('.as-type:not(.as-type-add)')?.textContent || '', cmt: c.querySelector('.as-cmt-text')?.textContent.trim() || '' })));
    const untypedOnPage = await page.evaluate(() => [...document.querySelectorAll('.artwork-cont')].filter(b => /:\s*-$/.test(b.querySelector('p').textContent.trim())).length);
    const untyped = cards.filter(c => !c.type).length;
    check(cards.length && untyped === untypedOnPage, `a cover is untyped only where MB says "Typen: -" (${untyped} vs ${untypedOnPage})`);
    check(cards.some(c => /^Front\b/.test(c.type)) && !cards.some(c => /Vorderseite|Rückseite/.test(c.type)), 'Vorderseite reads as Front');
    check(!cards.some(c => /Typen/.test(c.cmt)), 'no comment holds the types line');

    // a comment edit keeps the cover's types: on a Front cover, wherever it is (the gallery lists the
    // newest first, and other specs upload to this release)
    const front = page.locator('#as-root .as-card').filter({ has: page.locator('.as-type:not(.as-type-add)', { hasText: /^Front\b/ }) }).first();
    await front.hover();
    await front.locator('.as-pencil, .as-cmt-text').first().click();
    await page.keyboard.type(' 721');
    await page.keyboard.press('Escape');
    await until(() => page.evaluate(() => !document.querySelector('.as-commit')?.disabled), Boolean);
    await page.evaluate(() => document.querySelector('.as-commit').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await until(() => edits.length, Boolean, { timeout: 60000 });
    const e = edits[0] || {};
    check((e['edit-cover-art.type_id'] || []).includes('1'), `the comment edit keeps Front (type_id ${JSON.stringify(e['edit-cover-art.type_id'])})`);
    check(/ 721$/.test((e['edit-cover-art.comment'] || [''])[0]), `and sends the new comment (${JSON.stringify(e['edit-cover-art.comment'])})`);

  } finally {
    await context.clearCookies({ name: 'lang' });
  }
});
