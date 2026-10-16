// #772: Art Station's card offers the stores' other images (best.extras), taken in, typed and commented as in
// Art Station: a right-click or right-drag takes in or leaves out, a click shows the image full screen, the type
// pill opens the picker (right-click a type: only that one), ✎ the comment (Enter: the next one; Esc saves, and
// doesn't close MC). Nothing starts taken in. Execute sends the taken in to AS as mc:apply's extras, and they
// show as entered after.
// A stand-in AS answers the probe and the apply.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's

test('#772: more images, taken in, typed and commented, sent with Execute', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const draw = (w, h, color) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, w, h); return c.toDataURL('image/png'); };
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    window.__applied = [];
    const ex = (provider, n, of, w, color, dup) => ({ key: provider + '#' + n, provider, n, of, w, h: w, bytes: 1000 * n, url: '', thumb: draw(60, 60, color), types: [], ...(dup ? { dup } : {}) });
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'as', run: d.run, findings: [{ key: 'Amazon', name: 'Amazon', url: 'https://www.amazon.com/dp/B000', state: 'new', role: 'best' }],
        best: { provider: 'Amazon', w: 1500, h: 1500, bytes: 300000, of: 2, thumb: draw(50, 50, '#c00'), larger: true, replace: false, current: null,
          types: ['Front', 'Back', 'Booklet', 'Medium', 'Tray', 'Obi', 'Spine', 'Track', 'Liner', 'Sticker', 'Poster', 'Watermark', 'Raw/Unedited', 'Matrix/Runout', 'Top', 'Bottom', 'Panel', 'Other'],
          extras: [ex('Amazon', 2, 2, 1400, '#0a0'), ex('Discogs', 1, 3, 600, '#c00', '= Amazon 1'), ex('Discogs', 2, 3, 800, '#00c'), ex('Discogs', 3, 3, 700, '#aa0')] } }), 50);
    });
    document.addEventListener('mc:apply', e => {
      const d = JSON.parse(e.detail);
      if (d.id !== 'as') return;
      window.__applied.push(d);
      setTimeout(() => send('mc:applied', { id: 'as', run: d.run, ok: true, sent: 1 + (d.extras || []).length, note: 'entered' }), 50);
    });
    send('mc:provider', { id: 'as', name: 'Art Station', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  const card = k => page.locator(`#mc-root .mc-ax-c[data-ax="${k}"]`);
  await card('Discogs#3').waitFor();
  const st = () => page.evaluate(() => [...document.querySelectorAll('#mc-root .mc-ax-c')].map(c => ({ k: c.dataset.ax, on: c.classList.contains('on'), sel: c.classList.contains('sel'),
    pill: (c.querySelector('.mc-ax-pill') || {}).textContent || '', cmt: (c.querySelector('.mc-ax-ctx') || {}).textContent || '' })));
  const exec = () => page.locator('#mc-root [data-act="exec"]').textContent();
  let s = await st();
  check(s.length === 4 && s.every(x => !x.on && x.pill === '＋ type'), `four images, none taken in or typed (${JSON.stringify(s)})`);
  check(await page.locator('#mc-root .mc-ax-g').count() === 2 && /Amazon/.test(await page.locator('#mc-root .mc-ax-gh').first().textContent()), 'one row per store, Amazon first');
  check(await card('Discogs#1').locator('.mc-ax-dup').textContent() === '= Amazon 1', 'the same picture as the best front says so');
  check(await exec() === 'Execute (1)', `only the front counts (${await exec()})`);

  // a right-click takes the image in; a click shows it full screen, and leaves it as it was
  await card('Amazon#2').locator('.mc-ax-img').click({ button: 'right' });
  check((await st())[0].on, 'a right-click takes the image in');
  check(await exec() === 'Execute (2)', `and it counts (${await exec()})`);
  await card('Amazon#2').locator('.mc-ax-img').click();
  check(await page.locator('#mc-cover').count() === 1 && /Amazon 2/.test(await page.locator('#mc-cover .mc-cov-t').textContent()), 'a click shows it full screen');
  await page.keyboard.press('Escape');
  check(await page.locator('#mc-cover').count() === 0 && (await st())[0].on && await page.locator('#mc-root').count() === 1, 'Esc closes the full screen; the image stays taken in');

  // the type picker: a tick types it and takes it in; right-click sets only that type and closes
  await card('Discogs#2').locator('.mc-ax-pill').click();
  const pop = page.locator('#mc-ax-pop');
  await pop.waitFor();
  check(await pop.locator('label').count() === 18, 'Art Station\'s types, in two columns');
  await pop.locator('label', { hasText: 'Back' }).click();
  s = await st();
  check(s[2].on && s[2].pill === 'Back', `ticking Back types it and takes it in (${JSON.stringify(s[2])})`);
  await pop.locator('label', { hasText: 'Medium' }).click({ button: 'right' });
  s = await st();
  check(s[2].pill === 'Medium' && await pop.count() === 0, `right-click: only Medium, the picker closed (${JSON.stringify(s[2])})`);

  // the comment: ✎, Enter moves to the next image, Esc saves and keeps Mission Control open
  await card('Amazon#2').hover();
  // the ✎ shows on hover (the #mc-root rule that hid it outranked the :hover one)
  const shown = await until(() => card('Amazon#2').evaluate(c => getComputedStyle(c.querySelector('.mc-ax-pen')).opacity), v => v === '1');
  check(shown === '1', `the card's ✎ shows on hover (opacity ${shown})`);
  await card('Amazon#2').locator('.mc-ax-pen').click();
  await page.keyboard.type('Disc 1');
  await page.keyboard.press('Enter');
  check(await until(() => page.evaluate(() => document.activeElement && document.activeElement.classList.contains('mc-ax-cin') && document.activeElement.closest('.mc-ax-c').dataset.ax), v => v === 'Discogs#1') === 'Discogs#1', 'Enter moves to the next image\'s comment');
  await page.keyboard.type('x');
  await page.keyboard.press('Escape');
  s = await st();
  check(s[0].cmt === 'Disc 1' && s[1].cmt === 'x' && s[1].on, `both comments kept; a comment takes its image in (${JSON.stringify(s.slice(0, 2))})`);
  check(await page.locator('#mc-root').count() === 1, 'Esc in a comment doesn\'t close Mission Control');

  // right-drag from a taken-in image leaves out every one it passes; a right-click takes one back in
  const box = async k => { const b = await card(k).locator('.mc-ax-img').boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const [x1, y1] = await box('Discogs#1'), [x3, y3] = await box('Discogs#3');
  await page.mouse.move(x1, y1);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move((x1 + x3) / 2, y1, { steps: 4 });
  await page.mouse.move(x3, y3, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  s = await st();
  check(s.filter(x => x.k.startsWith('Discogs')).every(x => !x.on) && s[0].on, `right-drag leaves the three Discogs images out (${JSON.stringify(s)})`);
  check(await page.locator('#mc-root .mc-ax-b[data-act^="ax-sel"]').count() === 0, 'no selection bar');
  // a store's take all in, and then leave all out
  const gb = page.locator('#mc-root .mc-ax-gb[data-p="Discogs"]');
  check(await gb.textContent() === 'take all in', `Discogs' row offers take all in (${await gb.textContent()})`);
  await gb.click();
  s = await st();
  check(s.filter(x => x.k.startsWith('Discogs')).every(x => x.on) && await gb.textContent() === 'leave all out', `take all in takes the three in (${JSON.stringify(s)})`);
  await gb.click();
  s = await st();
  check(s.filter(x => x.k.startsWith('Discogs')).every(x => !x.on) && s[0].on, `leave all out leaves them out, Amazon's stays (${JSON.stringify(s)})`);
  await card('Discogs#2').locator('.mc-ax-img').click({ button: 'right' });
  await card('Discogs#2').locator('.mc-ax-pill').click();
  await pop.locator('label', { hasText: 'Booklet' }).click({ button: 'right' });
  s = await st();
  check(s[2].on && s[2].pill === 'Booklet', `Discogs 2 taken back in, typed Booklet (${JSON.stringify(s[2])})`);
  await page.screenshot({ path: 'test-results/mc-772-more-images.png' });

  // Execute sends the taken in, with their types and comments
  check(await exec() === 'Execute (3)', `the front and two images (${await exec()})`);
  await page.click('#mc-root [data-act="exec"]');
  const sent = await until(() => page.evaluate(() => window.__applied[0] || null), Boolean);
  console.log(JSON.stringify(sent && sent.extras));
  check(JSON.stringify(sent && sent.extras) === JSON.stringify([{ key: 'Amazon#2', types: [], comment: 'Disc 1' }, { key: 'Discogs#2', types: ['Booklet'], comment: '' }]), `extras sent (${JSON.stringify(sent && sent.extras)})`);
  check(sent && JSON.stringify(sent.keys) === '["Amazon"]', 'with the front\'s source');
  await until(() => page.locator('#mc-root .mc-ax-c.done').count(), n => n === 2);
  check(await page.locator('#mc-root .mc-ax-c.done').count() === 2 && await exec() === 'Execute', 'the entered show as entered and leave the count');

  // full screen, Enter writes the comment; Enter again keeps it and goes to the next image that takes one (the entered
  // Discogs 2 is passed); Esc stops writing, then closes
  await card('Discogs#1').locator('.mc-ax-img').click();
  await page.locator('#mc-cover').waitFor();
  await page.keyboard.press('Enter');
  check(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('mc-cov-cin')), 'Enter in full screen opens the comment');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Label A');
  await page.keyboard.press('Enter');
  check(/Discogs 3/.test(await page.locator('#mc-cover .mc-cov-t').textContent()) && await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('mc-cov-cin')), 'Enter goes to the comment of the next image, past the entered one');
  await page.keyboard.type('Label B');
  await page.keyboard.press('Escape');
  check(await page.locator('#mc-cover').count() === 1 && await page.locator('#mc-cover .mc-cov-ctx').textContent() === 'Label B', 'Esc stops writing and keeps the full screen');
  await page.keyboard.press('Escape');
  s = await st();
  check(await page.locator('#mc-cover').count() === 0 && s[1].cmt === 'Label A' && s[3].cmt === 'Label B' && s[3].on, `the comments are on the cards, and take the image in (${JSON.stringify(s)})`);
});
