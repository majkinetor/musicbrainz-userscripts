// #709: a release without a barcode gets one through Mission Control. PC offers each barcode the
// platforms report as a finding (kind 'barcode'). It is taken in (new) only when a link the release
// already has reports it, with the release's track count and medium; the rest are unsure, a wrong
// check digit is withheld, and a barcode pasted by hand wins. Apply hands it to Falcon on the release
// item (Falcon types it into the editor, #713), with a line in the edit note. A stand-in Falcon
// takes the batch: nothing is submitted.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Platform Check' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // sandbox copy of "Bad Boys!" (dev/test/sandbox-copies.json)
const LINKED = '826194657451', OTHER = '012345678905', BAD = '012345678900';

test('#709: the barcodes MC can add, and apply hands one to Falcon', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('platform_check', { waitFor: '__pcTest680' });
  await page.evaluate(() => window.__pcTest680.pcScan());
  // the fakes below go into PC's cache, in the profile every spec shares: put it back afterwards
  const snap = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => /^pc:/.test(k)).map(k => [k, localStorage.getItem(k)])));
  const restore = () => page.evaluate(snap => { Object.keys(localStorage).filter(k => /^pc:/.test(k)).forEach(k => localStorage.removeItem(k)); Object.entries(snap).forEach(([k, v]) => localStorage.setItem(k, v)); }, snap);
  try {
    const r = await page.evaluate(({ mbid, LINKED, OTHER, BAD }) => {
      const t = window.__pcTest680, n = parseInt(t.mbDataGet(mbid).mbTracks, 10), fmt = t.mbFormat();
      t.setOwnBarcode(null); t.clearFound();
      // the release's own Discogs (linked) reports one barcode; an unlinked Deezer another; Tidal a wrong one
      t.cacheSet(mbid, 'discogs', { url: 'https://www.discogs.com/release/1', tracks: n, format: fmt, source: 'MB rels', barcode: LINKED });
      t.cacheSet(mbid, 'deezer', { url: 'https://www.deezer.com/album/1', tracks: n, source: 'search', barcode: OTHER });
      t.cacheSet(mbid, 'tidal', { url: 'https://tidal.com/album/1', tracks: n, source: 'search', barcode: BAD });
      t.pcNoteFoundBarcode('discogs', LINKED, fmt); t.pcNoteFoundBarcode('deezer', OTHER, null); t.pcNoteFoundBarcode('tidal', BAD, null);
      const plain = t.pcMcBarcodeFindings();
      // a linked Discogs with fewer tracks is not sure
      t.cacheSet(mbid, 'discogs', { url: 'https://www.discogs.com/release/1', tracks: n - 2, format: fmt, source: 'MB rels', barcode: LINKED });
      const short = t.pcMcBarcodeFindings();
      t.cacheSet(mbid, 'discogs', { url: 'https://www.discogs.com/release/1', tracks: n, format: fmt, source: 'MB rels', barcode: LINKED });
      t.pcSetPastedBarcode(OTHER);
      const pasted = t.pcMcBarcodeFindings();
      t.pcSetPastedBarcode(null);
      t.setOwnBarcode('111111111117');
      const own = t.pcMcBarcodeFindings();
      t.setOwnBarcode(null);
      return { plain, short, pasted, own };
    }, { mbid: RELEASE, LINKED, OTHER, BAD });
    console.log(JSON.stringify(r, null, 1));
    const by = (xs, c) => xs.find(x => x.code === c) || {};
    check(by(r.plain, LINKED).state === 'new' && by(r.plain, LINKED).key === `barcode:${LINKED}` && /from Discogs \(linked\)/.test(by(r.plain, LINKED).why), 'the linked Discogs\'s barcode is taken in');
    check(by(r.plain, OTHER).state === 'unsure' && /^from Deezer · digital, the release is CD$/.test(by(r.plain, OTHER).why), 'an unlinked platform\'s is unsure, and a digital one on a CD says so');
    check(by(r.plain, BAD).state === 'withheld' && /wrong check digit/.test(by(r.plain, BAD).why), 'a wrong check digit is withheld');
    check(r.short.every(x => x.state !== 'new'), 'a linked match with another track count is not sure');
    check(r.pasted[0].code === OTHER && r.pasted[0].state === 'new' && r.pasted.filter(x => x.state === 'new').length === 1, 'a pasted barcode wins, and only it is new');
    check(r.own.length === 0, 'a release with a barcode is offered none');

    // apply: the barcode goes to Falcon on the release item, alone or with links
    const got = await page.evaluate(({ mbid, LINKED }) => new Promise(res => {
      const out = [];
      document.addEventListener('falcon:run', e => { out.push(JSON.parse(e.detail)); document.dispatchEvent(new CustomEvent('falcon:import-ok')); });
      document.addEventListener('mc:applied', e => { out.push({ applied: JSON.parse(e.detail) }); res(out); });
      document.dispatchEvent(new CustomEvent('mc:apply', { detail: JSON.stringify({ id: 'pc', run: 'r1', release: mbid, keys: [`barcode:${LINKED}`], mc: 't' }) }));
    }), { mbid: RELEASE, LINKED });
    console.log(JSON.stringify(got, null, 1));
    const item = got[0].items && got[0].items[0];
    check(item && item.entityType === 'release' && item.barcode === LINKED && item.urls.length === 0, 'Falcon gets a release item with the barcode and no links');
    check(/Added barcode 826194657451, from Discogs \(linked\)/.test(got[0].note), 'the edit note says where the barcode came from');
    check(got[1].applied.ok && got[1].applied.note === 'the barcode sent to Falcon', `MC is told (${got[1].applied.note})`);
  } finally { await restore(); }
});
