// #740: the catalog numbers the matched platforms give (Beatport, Discogs). A platform's row shows its catalog number
// after its label; a button next to the barcode's lists the ones for a label the release has without one (matched by
// name: "Artoffact" is "Artoffact Records"; "AOF 146" and "AOF146" are one), and "use" queues it with the links. Mission
// Control gets them as findings with the lanes they are in. A link added with + fills it in the release editor, in its
// label's row. The platforms are stand-ins: every other site answers 404, and the platforms' results are set by hand.
import { test, check, until, answerGm, functionSource, loadFunctions, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Platform Check' } });

const RELEASE = '9d290316-dcd3-4d7e-a62b-392ab2396f27';   // "Rushing Pictures": label Artoffact Records, no catalog number
const LABEL = '25364892-b3e9-4692-bcbe-018fc26b9256';

test('#740: Beatport gives its catalog number', { tag: ['@unit'] }, async () => {
  const { pcCatnosBeatport } = await loadFunctions('platform_check', ['pcCatnosBeatport']);
  check(JSON.stringify(pcCatnosBeatport({ catalog_number: ' AOF 146 ', label: { name: 'Artoffact' } })) === JSON.stringify([{ label: 'Artoffact', catno: 'AOF 146' }]), 'its catalog number, for its label');
  check(pcCatnosBeatport({ catalog_number: '', label: { name: 'Artoffact' } }) === null && pcCatnosBeatport({ catalog_number: 'X' }) === null, 'none without a number or a label');
});

test('#740: the platforms\' catalog numbers: row, list, use, Mission Control', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
  test.setTimeout(120_000);
  answerGm(context, ({ url }) => /musicbrainz\.org|wikidata/.test(url) ? null : { status: 404, body: '' });
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await page.evaluate(r => { localStorage.removeItem('pc:picked-catno:' + r); localStorage.removeItem('pc:pending-catno:' + r); }, RELEASE);
  await inject('platform_check', { waitFor: '__pcTest680' });
  await page.evaluate(() => window.__pcTest680.scanDone());

  const set = await page.evaluate(({ r }) => {
    const t = window.__pcTest680;
    // Beatport: linked on the release (so its catalog number is sure); Discogs writes it without the space
    t.cacheSet(r, 'beatport', { url: 'https://www.beatport.com/release/rushing-pictures/740', tracks: 5, year: '2008', label: 'Artoffact', source: 'MB rels', barcode: '628070635924', catnos: [{ label: 'Artoffact', catno: 'AOF 146' }] });
    t.cacheSet(r, 'discogs', { url: 'https://www.discogs.com/release/740', tracks: 5, year: '2008', label: 'Artoffact Records', source: 'search', barcode: null, catnos: [{ label: 'Artoffact Records', catno: 'AOF146' }, { label: 'Some Distributor', catno: 'SD 1' }] });
    t.updateRow('beatport', { url: 'https://www.beatport.com/release/rushing-pictures/740', mbTracks: 5, remoteTracks: 5, year: '2008', label: 'Artoffact', source: 'MB rels', barcode: '628070635924' });
    t.updateRow('discogs', { url: 'https://www.discogs.com/release/740', mbTracks: 5, remoteTracks: 5, year: '2008', label: 'Artoffact Records', source: 'search' });
    return { found: t.pcFoundCatnos(), mc: t.pcMcCatnoFindings([]) };
  }, { r: RELEASE });
  console.log(JSON.stringify(set));
  check(set.found.length === 1 && set.found[0].label.mbid === LABEL && set.found[0].platforms.sort().join() === 'beatport,discogs' && set.found[0].catno === 'AOF 146' && set.found[0].sure,
    'one entry: "AOF 146" and "AOF146" are one, for the release\'s Artoffact Records; a label the release hasn\'t is left out; sure (Beatport is linked)');
  const f = set.mc[0];
  check(set.mc.length === 1 && f.key === `catno:${LABEL}:AOF 146` && f.kind === 'catno' && f.state === 'new' && JSON.stringify(f.barcodes.sort()) === JSON.stringify(['', '628070635924']),
    `Mission Control gets it with the lanes it is in (${JSON.stringify(f)})`);
  const row = (await page.locator('#label-beatport').textContent()).trim();
  check(row === 'Artoffact · AOF 146', `the row shows it after the label (${row})`);

  // the button lists it; use queues it for its label
  const btn = page.locator('#mb-found-cat');
  check(await btn.isVisible() && (await btn.textContent()).trim() === '1', 'a button counts it');
  await btn.click();
  const pop = page.locator('#pc-cat-pop');
  await pop.waitFor();
  const txt = (await pop.textContent()).replace(/\s+/g, ' ');
  check(/Catalog numbers on the platforms/.test(txt) && /AOF 146s*use/.test(txt) && /for Artoffact Records/.test(txt) && /✓ from links like this release/.test(txt), `its list (${txt})`);
  await page.screenshot({ path: 'test-results/pc-740-catno-list.png', clip: await pop.boundingBox().then(b => ({ x: b.x - 260, y: b.y - 60, width: b.width + 280, height: b.height + 80 })) });
  await pop.locator('.pc-bc-opt').first().click();
  check((await page.locator('#mb-picked-cat').textContent()).trim() === 'AOF 146 ×' && !(await btn.isVisible()), 'use: the chip shows it, and the button goes');
  const pending = await page.evaluate(r => { window.__pcTest680.pcQueuePickedCatnos(); return JSON.parse(localStorage.getItem('pc:pending-catno:' + r) || 'null'); }, RELEASE);
  check(JSON.stringify(pending) === JSON.stringify([{ mbid: LABEL, name: 'Artoffact Records', catno: 'AOF 146' }]), `it goes with the links (${JSON.stringify(pending)})`);
  await page.locator('#mb-picked-cat').click();
  check(!(await page.locator('#mb-picked-cat').isVisible()) && await btn.isVisible(), 'the chip removes it');
});

test('#740: a link added with + fills the catalog number in the release editor', { tag: ['@sandbox', '@login'] }, async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`${SANDBOX}/release/${RELEASE}/edit`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { try { return MB.releaseEditor.rootField.release().labels().length > 0; } catch (e) { return false; } }, null, { timeout: 60_000 });
  const src = await functionSource('platform_check', ['pcFillCatnos']);
  const out = await page.evaluate(async ({ src, r, l }) => {
    localStorage.setItem('pc:pending-catno:' + r, JSON.stringify([{ mbid: l, name: 'Artoffact Records', catno: 'AOF 146' }, { mbid: '00000000-0000-0000-0000-000000000740', name: 'No Such Label', catno: 'X 1' }]));
    const fill = new Function('pcMark', src + '; return pcFillCatnos;')(() => {});
    const done = await fill(r);
    const row = MB.releaseEditor.rootField.release().labels().find(x => x.label() && x.label().gid === l);
    return { done, field: document.getElementById('catno-0').value, ko: row.catalogNumber(), staged: MB.releaseEditor.allEdits().length, left: localStorage.getItem('pc:pending-catno:' + r) };
  }, { src, r: RELEASE, l: LABEL });
  console.log(JSON.stringify(out));
  check(out.done.length === 1 && out.done[0].catno === 'AOF 146', 'it fills the one for the label the release has, and skips one it hasn\'t');
  check(out.field === 'AOF 146' && out.ko === 'AOF 146' && out.staged >= 1, 'the editor holds it, as an edit to make');
  check(out.left === null, 'the queue is used once');
});
