// #680: Platform Check's card groups the release's links by barcode, a lane each (variant B of
// the round-5 mockup): the release's own first in green, then the others by size, then the
// platforms that gave none under an empty barcode. Barcodes are shown in one form, leading zeros
// aside, as PC compares them: 0730167335256 and 730167335256 are one barcode, shown as 730167335256.
// What a lane is (the release's, not the release's, empty) is in its barcode's tooltip. A lane is
// one line of platform icons that toggle one by one, with take all in; a click opens it into rows.
// The release's barcode is not in the card header. A stand-in PC answers the probe with the
// platforms of Eddie Harris's "For Bird and Bags".
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's

test('#680: links grouped by barcode, a lane each', { tag: ['@sandbox'] }, async ({ page, inject }) => {
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
        { key: 'tidal2', icon: 'tidal', name: 'Tidal', url: 'https://tidal.com/album/214316434', state: 'withheld', why, barcode: '730167335256' },
        { key: 'apple', name: 'Apple', url: 'https://music.apple.com/us/album/for-bird-and-bags/1868545067', state: 'withheld', why: 'barcode not confirmed' },
        { key: 'qobuz', name: 'Qobuz', url: 'https://www.qobuz.com/gb-en/album/x/abc', state: 'withheld', why, barcode: '0886443927087' },
        { key: 'discogs', name: 'Discogs', url: 'https://www.discogs.com/release/8846789', state: 'linked', barcode: '081227946025' },   // the release's own Discogs: a ✓ in the release's lane
        { key: 'discogs-master', icon: 'discogs', name: 'Discogs master', url: 'https://www.discogs.com/master/669461', state: 'new', entity: { type: 'release_group' } },
        { key: 'tidal', name: 'Tidal', url: 'https://tidal.com/album/214316433', state: 'linked', barcode: '730167335256' },   // linked, in its barcode's lane too
        { key: 'spotify', name: 'Spotify', state: 'none' }] }), 50);
    });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-bcl');

  const card = page.locator('#mc-root .mc-sect:has([data-card="pc"])');
  const lanes = () => card.locator('.mc-bcl').evaluateAll(ls => ls.map(l => ({
    bc: l.querySelector('.mc-bc').innerText, c: getComputedStyle(l.querySelector('.mc-bc')).color, t: l.querySelector('.mc-bc').title,
    icons: [...l.querySelectorAll('.mc-ti')].map(i => i.dataset.key), on: [...l.querySelectorAll('.mc-ti.on')].map(i => i.dataset.key),
    all: (l.querySelector('.mc-all') || {}).textContent || '', pill: (l.querySelector('.mc-pill') || {}).textContent || '', open: l.classList.contains('open') })));
  let L = await lanes();
  console.log(JSON.stringify(L, null, 1));
  check(L.length === 4, `four lanes: the release's, two others, not confirmed (${L.length})`);
  check(L[0].bc === '081227946025' && L[0].t === "The release's barcode" && L[0].on.length === 0 && L[0].pill === 'linked' && L[0].all === '', "the release's lane leads, with its linked Discogs");
  check(await card.locator('.mc-bcl').nth(0).locator('.mc-ti.linked:not(.mc-pick)').count() === 1, 'the linked Discogs is a ✓ icon, not a toggle');
  const ok = await page.evaluate(() => { const s = document.createElement('span'); s.className = 'mc-bc'; s.style.setProperty('--bc', 'var(--mbu-ok)'); document.querySelector('#mc-root .mc-bcl').append(s); const c = getComputedStyle(s).color; s.remove(); return c; });
  check(L[0].c === ok, `the release's is green (${L[0].c})`);
  check(L[1].bc === '730167335256' && L[1].t === "Not the release's barcode" && L[1].icons.join() === 'bandcamp,deezer,tidal2,' && L[1].pill === 'withheld', 'the biggest other lane next: one barcode with or without its leading 0, shown in one form: 12 digits');
  check(L[2].bc === '886443927087' && L[2].icons.join() === 'qobuz', 'then the smaller one');
  check(L[3].bc.trim() === '' && L[3].t.startsWith('Empty barcode') && L[3].icons.join() === 'apple', 'the platforms without a barcode last, under an empty barcode');
  const w = await card.locator('.mc-bcl .mc-bc').evaluateAll(cs => cs.map(c => Math.round(c.getBoundingClientRect().width)));
  check(Math.abs(w[3] - w[1]) <= 2, `the empty barcode is as wide as a 12-digit one (${w})`);
  check(new Set(L.map(l => l.c)).size === 4, 'one colour per lane');
  check(await card.locator('.mc-sect-h .mc-bc, .mc-hbc').count() === 0, "no barcode in the card header");
  check(await card.locator('.mc-line:has-text("Discogs master")').count() === 1 && await card.locator('.mc-bcl .mc-ti[data-key="discogs-master"]').count() === 0, 'the Discogs master is a row of its own, out of the lanes');

  // an icon toggles one link; take all in takes the rest, a second click leaves them all out
  await card.locator('.mc-ti[data-key="deezer"]').click();
  L = await lanes();
  check(L[1].on.join() === 'deezer' && L[1].all.includes('1 of 3'), `an icon takes one in (${L[1].all})`);
  await card.locator('.mc-bcl').nth(1).locator('.mc-all').click();
  L = await lanes();
  check(L[1].on.length === 3 && L[1].all.includes('all taken in'), 'take all in takes the lane in');
  check((await page.evaluate(() => window.__mcTest.picked().pc)).sort().join() === 'bandcamp,deezer,discogs-master,tidal2', 'and Execute gets them');
  await card.locator('.mc-bcl').nth(1).locator('.mc-all').click();
  L = await lanes();
  check(L[1].on.length === 0 && L[1].all === 'take all in', 'a second click leaves them all out');
  check(L[0].pill === 'linked' && (await page.evaluate(() => window.__mcTest.picked().pc)).join() === 'discogs-master', 'the rest are untouched');

  // a click on the lane opens it into rows; the 12-digit form is noted, the reason isn't repeated
  check(await card.locator('.mc-line.mc-in').count() === 0, 'lanes start folded');
  await card.locator('.mc-bcl').nth(1).locator('.mc-bc').click();
  const rows = await card.locator('.mc-line.mc-in').evaluateAll(rs => rs.map(r => ({ t: r.querySelector('.t').textContent, s: r.textContent })));
  console.log(JSON.stringify(rows));
  check(rows.length === 4 && rows.map(r => r.t).join() === 'Bandcamp,Deezer,Tidal,Tidal' && rows[3].s.includes('linked'), 'the lane opens into its rows, the linked one last with its pill');
  check(rows.every(r => !r.s.includes('differs')), 'the lane says the reason; the rows don\'t repeat it');
  await card.locator('.mc-line.mc-in').nth(0).click();
  check((await lanes())[1].on.join() === 'bandcamp', 'a row toggles as before');
  await card.screenshot({ path: 'test-results/mc-680-pc-barcodes.png' });
  await card.locator('.mc-bcl').nth(1).locator('.mc-bc').click();
  check(await card.locator('.mc-line.mc-in').count() === 0, 'a second click folds it');
});

// A release without a barcode (Namito, Stone Flower) showed the empty-barcode lane twice: once as
// the release's own, once for the platforms that gave none.
test('#680: a release without a barcode has one empty-barcode lane', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, barcode: null, findings: [
        { key: 'bandcamp', name: 'Bandcamp', url: 'https://solselectas.bandcamp.com/album/stone-flower', state: 'withheld', why: 'barcode not confirmed' },
        { key: 'apple', name: 'Apple', url: 'https://music.apple.com/us/album/stone-flower-single/1460686797', state: 'withheld', why: 'barcode not confirmed' },
        { key: 'deezer', name: 'Deezer', url: 'https://www.deezer.com/album/94575752', state: 'withheld', why: 'barcode differs from the release\'s', barcode: '853565702496' },
        { key: 'beatport', name: 'Beatport', url: 'https://www.beatport.com/release/stone-flower/2576581', state: 'linked', barcode: '853565702496' }] }), 50);
    });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-bcl');
  const L = await page.locator('#mc-root [data-card="pc"] .mc-bcl').evaluateAll(ls => ls.map(l => ({ bc: l.querySelector('.mc-bc').innerText.trim(), keys: [...l.querySelectorAll('.mc-ti')].map(i => i.dataset.key || 'linked') })));
  console.log(JSON.stringify(L));
  check(L.length === 2, `two lanes, not three (${L.length})`);
  check(L[0].bc === '853565702496' && L[0].keys.join() === 'deezer,linked', 'the platforms\' barcode first');
  check(L[1].bc === '' && L[1].keys.join() === 'bandcamp,apple', 'one empty-barcode lane, last');
});
