// #643: "All" in the per-track provider menu — the row's ISRC checked on every provider available
// for the release at once, SoundExchange included, a verdict chip on the row and the comparison as
// a tooltip beside it (a click pins it). SoundExchange is asked last on a right-click and stopped at
// a captcha with every other result kept. Guests don't count as a mismatch, in All and in a single
// provider's lookup alike.
//
// Random Access Memories (fixtures/ws-458.json.gz: production's data on the sandbox). The providers
// are live; SoundExchange is answered with its captcha reply, so its part is the same every run.
import { test, check, until, answerGm } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });
const RAM = '5000a285-b67e-4cfc-b54b-2b98f1810d2e';

async function pickProv(page, name) {
  await page.locator('#ii-tbody tr[data-idx="0"] .ii-sxprov').click();
  await page.locator('#ii-prov-menu .ii-prov-item', { hasText: name }).first().click();
  return page.evaluate(() => document.querySelector('#ii-tbody tr[data-idx="0"] .ii-sx').textContent.trim());
}
const row = i => `#ii-tbody tr[data-idx="${i}"]`;
const chip = (page, i) => page.evaluate(sel => { const el = document.querySelector(sel + ' .ii-lookup'); return el ? { text: el.textContent.trim(), cls: el.className } : null; }, row(i));
const readPop = page => page.evaluate(() => {
  const p = document.querySelector('#ii-all-pop'); if (!p) return null;
  return { pinned: p.classList.contains('pinned'), picks: [...p.querySelectorAll('.ii-all-pick')].map(b => b.dataset.isrc),
    lines: [...p.querySelectorAll('.ii-all-line')].map(l => ({ mark: l.querySelector('.ii-all-mark').textContent, name: l.querySelector('.ii-all-name').textContent,
      text: l.querySelector('.ii-all-note').textContent, isrc: (l.querySelector('.ii-all-note .ii-all-isrc') || {}).textContent || '', state: l.className.replace(/.*ii-all-/, ''), use: !!l.querySelector('.ii-all-use') })) };
});
// hover a row's verdict: its comparison shows as a tooltip
async function hoverPop(page, i) {
  await page.locator(row(i) + ' .ii-lookup').hover();
  return until(() => readPop(page), p => p && p.lines.length >= 2 && p.lines.every(l => l.state !== 'pending'), { timeout: 60000 });
}
const box = (page, sel) => page.locator(sel).boundingBox();

test('#643: All — agreement, a disputed ISRC with [use], the tooltip, SoundExchange stopped at a captcha', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  let sx = 0;
  const ws = await openScout(page, inject, {
    release: RAM, replay: new URL('./fixtures/ws-458.json.gz', import.meta.url),
    // an album provider too (Apple, read once), so a wrong ISRC meets the album's own at the track's place
    edit: j => { if (!(j.relations || []).some(x => /music.apple.com/.test(x.url?.resource || ''))) (j.relations = j.relations || []).push({ url: { resource: 'https://music.apple.com/us/album/random-access-memories/617154241' } }); },
    before: () => answerGm(page.context(), ({ url }) => (/isrc-api\.soundexchange\.com/.test(url) ? (sx++, { status: 202, body: '{"searchCaptcha":true}' }) : null)),
  });

  // a single provider's lookup: Tidal titles track 5 "Instant Crush (feat. Julian Casablancas)" — the
  // guest clause is no mismatch there either
  await pickProv(page, 'Tidal');
  await page.locator(row(4) + ' .ii-sx').click();
  const tidal = await until(() => chip(page, 4), c => c && /^[✓⚠✗]/.test(c.text), { timeout: 60000 });
  check(/ii-lookup ok/.test(tidal.cls) && /Instant Crush/.test(tidal.text), `Tidal's "Instant Crush (feat. …)" is track 5, not another song (${tidal.cls}: ${tidal.text})`);

  check(await pickProv(page, 'All') === 'All', 'the menu offers All, and the row buttons say so');

  // track 1, its own ISRC: every provider agrees; SoundExchange is asked too (here: its captcha)
  await page.locator(row(0) + ' .ii-sx').click();
  const agree = await until(() => chip(page, 0), c => c && /^✓ \d+\/\d+/.test(c.text) && /⛔/.test(c.text), { timeout: 60000 });
  console.log('agree', JSON.stringify(agree));
  check(/ii-all-chip ok/.test(agree.cls) && +agree.text.match(/\/(\d+)/)[1] >= 2, `track 1: a green verdict from at least two providers (${agree.text})`);
  check(sx === 1, `…and SoundExchange is asked along with them (${sx} requests)`);
  const p1 = await hoverPop(page, 0);
  console.log('pop1', JSON.stringify(p1));
  check(!p1.pinned, 'hovering the verdict shows the comparison, unpinned');
  check(p1.lines.filter(l => l.state !== 'fail' && l.name !== 'SoundExchange').every(l => l.state === 'ok' && l.mark === '✓'), `each line starts with its verdict; all that could answer say ✓ (${p1.lines.map(l => l.mark + l.name).join(', ')})`);
  check(p1.lines.some(l => l.name === 'SoundExchange' && l.state === 'blocked'), 'SoundExchange\'s line says it met a captcha');
  check(p1.picks.length === 1 && p1.picks[0] === 'USQX91300101', `the header lists the one ISRC they all have (${p1.picks})`);
  check(p1.lines.some(l => l.name === 'Apple' && l.text.startsWith('📍')), `an album provider's "at this track's place" is an icon (${(p1.lines.find(l => l.name === 'Apple') || {}).text})`);
  // beside the chip: the All buttons and the verdicts below stay free to hover
  const pb = await box(page, '#ii-all-pop'), free = [row(0) + ' .ii-lookup', row(1) + ' .ii-sx', row(1) + ' .ii-sxprov', row(2) + ' .ii-sx'];
  const hit = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const covered = []; for (const sel of free) if (hit(pb, await box(page, sel))) covered.push(sel);
  check(!covered.length, `the tooltip covers neither the verdict nor the All buttons below (${covered.join(', ') || 'none'})`);
  // leaving it closes it; hovering a row's All button shows that row's
  await page.locator(row(1) + ' .ii-input').hover();
  await until(() => readPop(page), p => p === null, { timeout: 3000 });
  check(true, 'moving away closes the tooltip');
  await page.locator(row(0) + ' .ii-sx').hover();
  check(!!(await until(() => readPop(page), p => p !== null, { timeout: 3000 })), 'hovering the row\'s All button shows it too');
  // a click pins it: it stays when the mouse leaves, Escape closes it
  await page.locator(row(0) + ' .ii-lookup').click();
  await page.locator(row(3) + ' .ii-input').hover();
  await page.waitForTimeout(400);
  const pinned = await readPop(page);
  check(pinned && pinned.pinned, 'a click pins it: it stays after the mouse leaves');
  // [copy]: the comparison as Markdown
  await page.evaluate(() => { window.__md = null; navigator.clipboard.writeText = t => { window.__md = t; return Promise.resolve(); }; });
  await page.locator('#ii-all-pop .ii-all-copy').click();
  const md = await page.evaluate(() => window.__md);
  console.log('md', md);
  check(md && /^\*\*Track 1\*\*/.test(md) && /\| Provider \| ISRC \| Result \|/.test(md) && /\| ✓ \| Deezer \| `USQX91300101` \|/.test(md), 'copy puts the comparison on the clipboard as a Markdown table');
  await page.keyboard.press('Escape');
  check(await page.locator('#ii-all-pop').count() === 0, 'Escape closes it');

  // track 1 with track 2's ISRC typed in: the providers dispute it
  await page.fill(row(0) + ' .ii-input', 'USQX91300102');
  await page.locator(row(0) + ' .ii-sx').click();
  const dispute = await until(() => chip(page, 0), c => c && /^[⚠–]/.test(c.text) && /⛔/.test(c.text), { timeout: 60000 });
  console.log('dispute', JSON.stringify(dispute));
  check(/^⚠/.test(dispute.text), `a disputed ISRC gets an amber verdict (${dispute.text})`);
  check(sx === 2, `a click asks SoundExchange again after its captcha (${sx} requests)`);
  const p2 = await hoverPop(page, 0);
  console.log('pop2', JSON.stringify(p2));
  const diff = p2.lines.find(l => l.state === 'differs' && l.use);
  check(p2.lines.some(l => l.mark === '⚠' || l.mark === '✗'), `the comparison shows who disagrees (${p2.lines.map(l => l.mark + l.name).join(', ')})`);
  check(!!diff && diff.isrc === 'USQX91300101' && diff.text.startsWith('📍'), `an album provider has track 1's own ISRC at its place, with [use] (${JSON.stringify(diff)})`);
  check(p2.picks.includes('USQX91300101') && p2.picks.includes('USQX91300102'), `the header lists both ISRCs (${p2.picks})`);
  // a click on an ISRC in the header shows only the providers that have it
  await page.locator('#ii-all-pop .ii-all-pick[data-isrc="USQX91300101"]').click();
  const only = await readPop(page);
  check(only.lines.length >= 1 && only.lines.every(l => l.isrc === 'USQX91300101'), `a click on an ISRC shows only its providers (${only.lines.map(l => l.name).join(', ')})`);
  await page.locator('#ii-all-pop .ii-all-use').first().click();
  check(await page.inputValue(row(0) + ' .ii-input') === 'USQX91300101', '[use] puts it in the row');

  // two tracks with each other's ISRC; leaving the fields runs All on them — SoundExchange is still
  // blocked from the click above, so it isn't poked on every field you leave
  await page.fill(row(1) + ' .ii-input', 'USQX91300103');
  await page.fill(row(2) + ' .ii-input', 'USQX91300102');
  await page.locator(row(0) + ' .ii-input').focus();
  await until(async () => [await chip(page, 1), await chip(page, 2)], c => c.every(x => x && /ii-all-chip/.test(x.cls) && !/⏳/.test(x.text)), { timeout: 60000 });
  const sxOf = p => (p.lines.find(l => l.name === 'SoundExchange') || {}).text || '';
  const t2 = await hoverPop(page, 2);
  check(sx === 2 && /not asked — SoundExchange is blocked/.test(sxOf(t2)), `after a captcha, leaving a field doesn't ask SoundExchange again (${sx}: ${sxOf(t2)})`);

  // right-click: every track, then SoundExchange one track at a time — its captcha stops it
  const before = sx;
  await page.locator(row(0) + ' .ii-sx').click({ button: 'right' });
  const all = await until(() => page.evaluate(() => [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-lookup.ii-all-chip')].map(e => e.textContent.trim())), a => a.length >= 13 && a.every(t => !/⏳/.test(t)) && a.every(t => /⛔/.test(t)), { timeout: 120000 });
  console.log('all', JSON.stringify(all), 'sx', sx - before);
  check(all.length === 13, `every track gets a verdict (${all.length})`);
  check(sx - before === 1, `SoundExchange is asked once, for the first track, and its captcha stops it (${sx - before})`);
  const t3 = await hoverPop(page, 2);
  check(/not asked — SoundExchange stopped at a captcha/.test(sxOf(t3)), `the other tracks say SoundExchange wasn't asked, and why (${sxOf(t3)})`);
  check(all.filter(t => /^✓/.test(t)).length === 11, `the eleven untouched tracks agree — feat. clauses and guest lists included (${all.join(' ')})`);
  await ws.done();
});
