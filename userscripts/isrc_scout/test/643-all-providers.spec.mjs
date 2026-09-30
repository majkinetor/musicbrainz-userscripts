// #643: "All" in the per-track provider menu — the row's ISRC checked on every provider available
// for the release at once, a verdict chip on the row, a comparison popover on click, and
// SoundExchange only as the tiebreaker (asked last, only where the others disagree, and stopped at
// a captcha with every other result kept).
//
// Random Access Memories (fixtures/ws-458.json.gz: production's data on the sandbox). The providers
// are live; SoundExchange is answered with its captcha reply, so its part is the same every run.
import { test, check, until, answerGm } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });
const RAM = '5000a285-b67e-4cfc-b54b-2b98f1810d2e';

async function pickAll(page) {
  await page.locator('#ii-tbody tr[data-idx="0"] .ii-sxprov').click();
  await page.locator('#ii-prov-menu .ii-prov-item', { hasText: 'All' }).click();
  return page.evaluate(() => document.querySelector('#ii-tbody tr[data-idx="0"] .ii-sx').textContent.trim());
}
const chip = (page, i) => page.evaluate(i => { const el = document.querySelector(`#ii-tbody tr[data-idx="${i}"] .ii-lookup`); return el ? { text: el.textContent.trim(), cls: el.className, title: el.title } : null; }, i);
const pop = page => page.evaluate(() => [...document.querySelectorAll('#ii-all-pop .ii-all-line')].map(l => ({ name: l.querySelector('.ii-all-name').textContent, isrc: l.querySelector('.ii-all-isrc').textContent, state: l.className.replace(/.*ii-all-/, ''), use: !!l.querySelector('.ii-all-use') })));

test('#643: All — agreement, a disputed ISRC with [use], and SoundExchange only as the tiebreaker', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  let sx = 0;
  const ws = await openScout(page, inject, {
    release: RAM, replay: new URL('./fixtures/ws-458.json.gz', import.meta.url),
    // an album provider too (Apple, read once), so a wrong ISRC meets the album's own at the track's place
    edit: j => { if (!(j.relations || []).some(x => /music.apple.com/.test(x.url?.resource || ''))) (j.relations = j.relations || []).push({ url: { resource: 'https://music.apple.com/us/album/random-access-memories/617154241' } }); },
    before: () => answerGm(page.context(), ({ url }) => (/isrc-api\.soundexchange\.com/.test(url) ? (sx++, { status: 202, body: '{"searchCaptcha":true}' }) : null)),
  });
  check(await pickAll(page) === 'All', 'the menu offers All, and the row buttons say so');

  // track 1, its own ISRC: every provider agrees, SoundExchange isn't asked
  await page.locator('#ii-tbody tr[data-idx="0"] .ii-sx').click();
  const agree = await until(() => chip(page, 0), c => c && /^✓ \d+\/\d+/.test(c.text), { timeout: 60000 });
  console.log('agree', JSON.stringify(agree));
  check(/ii-all-chip ok/.test(agree.cls) && +agree.text.match(/\/(\d+)/)[1] >= 2, `track 1: a green verdict from at least two providers (${agree.text})`);
  check(sx === 0, `…and SoundExchange is not asked when they agree (${sx} requests)`);
  await page.locator('#ii-tbody tr[data-idx="0"] .ii-lookup').click();
  const lines1 = await until(() => pop(page), l => l.length >= 2);
  check(lines1.filter(l => l.state !== 'fail').every(l => l.state === 'ok') && lines1.filter(l => l.state === 'ok').length >= 2, `the comparison lists each provider; all that could answer say ✓ (${JSON.stringify(lines1)})`);
  await page.keyboard.press('Escape');
  check(await page.locator('#ii-all-pop').count() === 0, 'Escape closes it');

  // track 1 with track 2's ISRC typed in: the providers dispute it, SoundExchange is asked (captcha)
  await page.fill('#ii-tbody tr[data-idx="0"] .ii-input', 'USQX91300102');
  await page.locator('#ii-tbody tr[data-idx="0"] .ii-sx').click();
  const dispute = await until(() => chip(page, 0), c => c && /^[⚠–]/.test(c.text) && /⛔|SoundExchange: (ok|song|none)/.test(c.title), { timeout: 60000 });
  console.log('dispute', JSON.stringify(dispute));
  check(/^⚠/.test(dispute.text), `a disputed ISRC gets an amber verdict (${dispute.text})`);
  check(sx >= 1 && /⛔/.test(dispute.text), `…SoundExchange is asked as the tiebreaker, and its captcha is shown on the chip (${sx} requests, ${dispute.text})`);
  await page.locator('#ii-tbody tr[data-idx="0"] .ii-lookup').click();
  const lines2 = await until(() => pop(page), l => l.length >= 2);
  console.log('lines', JSON.stringify(lines2));
  const diff = lines2.find(l => l.state === 'differs' && l.use);
  check(lines2.some(l => l.state === 'song' || l.state === 'differs'), `the comparison shows who disagrees (${lines2.map(l => l.name + ':' + l.state).join(', ')})`);
  check(lines2.some(l => l.name === 'SoundExchange' && l.state === 'blocked'), 'SoundExchange\'s line says it stopped at a captcha');
  check(!!diff, `the album provider has another ISRC at track 1's place, with [use] (${JSON.stringify(lines2)})`);
  if (diff) {
    check(diff.isrc === 'USQX91300101', `an album provider has track 1's own ISRC at its place (${diff.name} ${diff.isrc})`);
    await page.locator('#ii-all-pop .ii-all-use').first().click();
    check(await page.inputValue('#ii-tbody tr[data-idx="0"] .ii-input') === 'USQX91300101', '[use] puts it in the row');
  }

  // right-click: every track; SoundExchange only for the unsettled ones, and it stops at the captcha
  // two tracks with each other's ISRC: both need the tiebreaker; SoundExchange answers the first with its captcha
  await page.fill('#ii-tbody tr[data-idx="1"] .ii-input', 'USQX91300103');
  await page.fill('#ii-tbody tr[data-idx="2"] .ii-input', 'USQX91300102');
  await page.locator('#ii-tbody tr[data-idx="0"] .ii-input').focus();
  // leaving those fields runs All on them: SoundExchange's captcha on the first makes All leave it alone for the second
  await until(async () => [await chip(page, 1), await chip(page, 2)], c => c.every(x => x && /ii-all-chip/.test(x.cls) && !/⏳/.test(x.text)), { timeout: 60000 });
  const t2 = await chip(page, 2);
  check(/not asked — SoundExchange is blocked/.test(t2.title), `after a captcha, leaving a field doesn't ask SoundExchange again (${t2.title.split('\n').find(l => /SoundExchange/.test(l))})`);
  const before = sx;
  await page.locator('#ii-tbody tr[data-idx="0"] .ii-sx').click({ button: 'right' });
  const all = await until(() => page.evaluate(() => [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-lookup.ii-all-chip')].map(e => e.textContent.trim())), a => a.length >= 13 && a.every(t => !/⏳/.test(t)), { timeout: 120000 });
  console.log('all', JSON.stringify(all), 'sx', sx - before);
  for (let i = 0; i < all.length; i++) if (/⚠/.test(all[i])) console.log('warnrow', i + 1, JSON.stringify((await chip(page, i)).title));
  check(all.length === 13, `every track gets a verdict (${all.length})`);
  check(sx - before === 1, `SoundExchange is asked once, for the first disputed track, and its captcha stops it (${sx - before})`);
  const t3 = await chip(page, 2);
  check(/not asked — SoundExchange stopped at a captcha/.test(t3.title) && /⛔/.test(t3.text), `the other disputed track says SoundExchange wasn't asked, and why (${t3.text})`);
  check(all.filter(t => /^✓/.test(t)).length === 11, `the eleven untouched tracks agree without SoundExchange (${all.join(' ')})`);
  await ws.done();
});
