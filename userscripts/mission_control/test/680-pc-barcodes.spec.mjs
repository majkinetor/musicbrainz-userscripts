// #680: Platform Check's card shows the barcodes in a column of their own, one colour per
// barcode, with the release's own named above the rows and green. Leading zeros aside, as PC
// compares them: 0730167335256 and 730167335256 are one barcode. A stand-in PC answers the
// probe with the platforms of Eddie Harris's "For Bird and Bags" as PC found them.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's

test('#680: barcodes in a column, one colour each', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    const why = 'barcode differs from the release\'s';
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, barcode: '0081227946025', findings: [
        { key: 'bandcamp', name: 'Bandcamp', url: 'https://eddieharrismusic.bandcamp.com/album/for-bird-and-bags', state: 'withheld', why, barcode: '0730167335256' },
        { key: 'deezer', name: 'Deezer', url: 'https://www.deezer.com/album/291098232', state: 'withheld', why, barcode: '730167335256' },
        { key: 'apple', name: 'Apple', url: 'https://music.apple.com/us/album/for-bird-and-bags/1868545067', state: 'withheld', why: 'barcode not confirmed' },
        { key: 'qobuz', name: 'Qobuz', url: 'https://www.qobuz.com/gb-en/album/x/abc', state: 'withheld', why, barcode: '0886443927087' },
        { key: 'discogs', name: 'Discogs', url: 'https://www.discogs.com/release/8846789', state: 'new', barcode: '081227946025' },
        { key: 'spotify', name: 'Spotify', state: 'none' }] }), 50);
    });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-bc');

  const chips = await page.locator('#mc-root [data-card="pc"] .mc-bc').evaluateAll(xs => xs.map(x => ({
    b: x.textContent, k: x.textContent.replace(/^0+/, ''), c: getComputedStyle(x).color, rel: !!x.closest('.mc-bcrel'),
    row: (x.closest('.mc-line') || {}).querySelector?.('.t')?.textContent || '' })));
  console.log(chips.map(x => `${x.rel ? 'release' : x.row}: ${x.b} ${x.c}`).join('\n'));
  const color = k => chips.find(x => x.k === k).c;
  check(chips.length === 5 && chips[0].rel && chips[0].b === '0081227946025', 'the release\'s barcode first, then one per platform that gave one (Apple gave none)');
  check(new Set(chips.filter(x => x.k === '730167335256').map(x => x.c)).size === 1 && chips.filter(x => x.k === '730167335256').length === 2, 'Bandcamp\'s and Deezer\'s are one barcode, one colour');
  check(chips.find(x => x.row === 'Discogs').c === chips[0].c, 'Discogs gives the release\'s barcode: its colour');
  check(new Set([color('81227946025'), color('730167335256'), color('886443927087')]).size === 3, 'three barcodes, three colours');
  // set as the chip sets it: a colour through a custom property computes as color(srgb …)
  const ok = await page.evaluate(() => { const s = document.createElement('span'); s.className = 'mc-bc'; s.style.setProperty('--bc', 'var(--mbu-ok)'); document.querySelector('#mc-root .mc-bcrel').append(s); const c = getComputedStyle(s).color; s.remove(); return c; });
  check(chips[0].c === ok, `the release's is green (${chips[0].c})`);
  // the column lines up: every chip in a row starts at the same x
  const xs = await page.locator('#mc-root [data-card="pc"] .mc-line .mc-bccol').evaluateAll(cs => cs.map(c => Math.round(c.getBoundingClientRect().left)));
  check(new Set(xs).size === 1, `one column (${xs})`);
  await page.locator('#mc-root [data-card="pc"]').screenshot({ path: 'test-results/mc-680-pc-barcodes.png' });
});
