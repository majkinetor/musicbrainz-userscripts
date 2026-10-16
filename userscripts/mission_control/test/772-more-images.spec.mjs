// #772: Art Station's card offers the stores' other images (best.extras), taken in, typed and commented as in
// Art Station: a click on the image takes it in, the type pill opens the picker (right-click a type: only that
// one), ✎ the comment (Enter: the next one; Esc saves, and doesn't close MC), right-drag selects. Nothing starts
// taken in. Execute sends the taken in to AS as mc:apply's extras, and they show as entered after.
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

  // a click on the image takes it in
  await card('Amazon#2').locator('.mc-ax-img').click();
  check((await st())[0].on, 'a click takes the image in');
  check(await exec() === 'Execute (2)', `and it counts (${await exec()})`);

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
  await card('Amazon#2').locator('.mc-ax-pen').click();
  await page.keyboard.type('Disc 1');
  await page.keyboard.press('Enter');
  check(await until(() => page.evaluate(() => document.activeElement && document.activeElement.classList.contains('mc-ax-cin') && document.activeElement.closest('.mc-ax-c').dataset.ax), v => v === 'Discogs#1') === 'Discogs#1', 'Enter moves to the next image\'s comment');
  await page.keyboard.type('x');
  await page.keyboard.press('Escape');
  s = await st();
  check(s[0].cmt === 'Disc 1' && s[1].cmt === 'x' && s[1].on, `both comments kept; a comment takes its image in (${JSON.stringify(s.slice(0, 2))})`);
  check(await page.locator('#mc-root').count() === 1, 'Esc in a comment doesn\'t close Mission Control');

  // right-drag selects; the selection's Leave out, Type
  const box = async k => { const b = await card(k).locator('.mc-ax-img').boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const [x1, y1] = await box('Discogs#1'), [x3, y3] = await box('Discogs#3');
  await page.mouse.move(x1, y1);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move((x1 + x3) / 2, y1, { steps: 4 });
  await page.mouse.move(x3, y3, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  s = await st();
  check(s.filter(x => x.sel).map(x => x.k).join() === 'Discogs#1,Discogs#2,Discogs#3', `right-drag selects the three Discogs images (${s.filter(x => x.sel).map(x => x.k)})`);
  check(/3 selected/.test(await page.locator('#mc-root .mc-ax-h').textContent()), 'the selection bar says how many');
  await page.click('#mc-root [data-act="ax-sel-leave"]');
  s = await st();
  check(s.filter(x => x.k.startsWith('Discogs')).every(x => !x.on), 'Leave out leaves the selection out');
  await page.click('#mc-root [data-act="ax-sel-type"]');
  await pop.locator('label', { hasText: 'Booklet' }).click({ button: 'right' });
  s = await st();
  check(s.filter(x => x.k.startsWith('Discogs')).every(x => x.on && x.pill === 'Booklet'), `Type on the selection types and takes in each (${JSON.stringify(s)})`);
  await page.click('#mc-root [data-act="ax-sel-none"]');
  await card('Discogs#1').locator('.mc-ax-img').click();
  await card('Discogs#3').locator('.mc-ax-img').click();
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
});
