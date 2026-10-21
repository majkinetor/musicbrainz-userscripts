// #784: after a clean Execute, Art Station's gallery in Mission Control's card closes its Enter edit dialog (the frame
// stayed over the whole window with it) and shows what the archive now holds: nothing staged, so the card and
// Execute have nothing more from it (they still said "4 gallery changes"). A real edit on the sandbox: the archive
// cover's comment, so nothing is uploaded; the best front's source row is left out. The release is pristine,
// made for the run (#795), linked to discogs.com/release/1118432 (Journey Inwards: front and back), its back in
// the archive.
import { test, check, until, requireLogin, pristine, pristineCover } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control', values: { 'mc.settings': JSON.stringify({ v: 2, reloadAfter: false }) } }, pageErrors: ['MB is not defined'] });


test('#784: a clean Execute closes the gallery\'s dialog and leaves nothing staged', { tag: ['@sandbox', '@web', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 900 });
  const { mbid: RELEASE } = await pristine(page, 'release', { 'urls.0.url': 'https://www.discogs.com/release/1118432', 'urls.0.link_type': '76' });
  await pristineCover(page, RELEASE, { types: ['Back'] });
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('art_station');
  page.on('frameattached', async f => {
    await f.waitForLoadState('domcontentloaded').catch(() => {});
    if (/mc_frame=/.test(f.url())) await inject('art_station', { target: f }).catch(e => console.log('frame inject: ' + e.message));
  });
  await page.waitForFunction(() => window.__mcTest.found().as);
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.locator('#mc-root #mc-as-slot').waitFor({ timeout: 200_000 });
  const frameOf = () => page.frames().find(f => /mc_frame=/.test(f.url()));
  const fr = frameOf();
  await fr.waitForSelector('.as-card:not(.new) .as-thumb', { timeout: 60_000 });
  // the best front left out
  const ticked = () => page.evaluate(() => [...document.querySelectorAll('#mc-root [data-card="as"] .mc-pick .mc-tick')].filter(t => t.textContent.trim()).length);
  await until(() => page.evaluate(() => document.querySelectorAll('#mc-root [data-card="as"] .mc-pick .mc-tick').length), Boolean);
  while (await ticked()) { await page.locator('#mc-root [data-card="as"] .mc-pick .mc-tick', { hasText: '✓' }).first().click(); await page.waitForTimeout(300); }
  // the archive cover's comment changed in the gallery
  const comment = 'mc784 ' + Date.now();
  await fr.evaluate(() => { const c = document.querySelector('.as-card:not(.new):not(.del)'); (c.querySelector('.as-pencil') || c.querySelector('.as-cmt-text')).click(); });
  const inp = fr.locator('.as-card:not(.new) .as-cmt').first();
  await inp.fill(comment);
  await inp.press('Tab');
  const exec = () => page.locator('#mc-root [data-act="exec"]').textContent();
  const n = await until(exec, v => v === 'Execute (1)');
  const plan = await until(() => page.locator('#mc-root .mc-ax-plan').textContent().catch(() => ''), v => /Edit/.test(v) && !/Add/.test(v));
  check(n === 'Execute (1)' && /Edit/.test(plan) && !/Add/.test(plan), `the comment alone counts, nothing is uploaded (${n}; ${plan})`);
  if (/Add/.test(plan)) return;   // never a second upload: after a release's first, signing answers 500 for a long while
  await page.click('#mc-root [data-act="exec"]');
  const applied = await until(() => page.evaluate(() => { const a = document.querySelector('#mc-root [data-card="as"] .mc-applied'); return a ? a.className + ' · ' + a.textContent : ''; }), v => /ok|err|fail/.test(v), { timeout: 180_000 });
  console.log('applied: ' + applied);
  check(/\bok\b/.test(applied), `Art Station entered it (${applied})`);
  // the frame back over the slot, not the whole window; a fresh one, not sourcing again, with nothing staged
  const geo = () => page.evaluate(() => {
    const s = document.getElementById('mc-as-slot'), f = document.querySelector('iframe[src*="mc_frame="]');
    if (!s || !f) return { ok: false };
    if (s.getBoundingClientRect().top > innerHeight - 100 || s.getBoundingClientRect().top < 0) s.scrollIntoView({ block: 'start' });
    const a = s.getBoundingClientRect(), b = f.getBoundingClientRect();
    return { ok: true, src: f.getAttribute('src'), slot: [Math.round(a.left), Math.round(a.top), Math.round(a.width)], frame: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] };
  });
  const g = await until(geo, v => v.ok && !/mc_source=/.test(v.src) && v.frame.slice(0, 3).join() === v.slot.join(), { timeout: 60_000 });
  console.log(JSON.stringify(g));
  check(g.ok && !/mc_source=/.test(g.src) && g.frame.slice(0, 3).join() === g.slot.join() && g.frame[2] < 1400, `a fresh gallery lies over the slot (${JSON.stringify(g)})`);
  const fr2 = await until(() => { const f = frameOf(); return f && !/mc_source=/.test(f.url()) ? f : null; }, Boolean);
  await fr2.waitForSelector('#as-root .as-card', { timeout: 60_000 });
  const inFrame = await until(() => fr2.evaluate(c => ({ dialog: !!document.querySelector('#as-commit'), staged: document.querySelectorAll('.as-card.new').length, cmt: [...document.querySelectorAll('.as-cmt-text')].some(x => x.textContent.trim() === c) }), comment), v => v.cmt, { timeout: 60_000 });
  check(!inFrame.dialog && !inFrame.staged && inFrame.cmt, `no dialog, nothing staged, the new comment in the archive (${JSON.stringify(inFrame)})`);
  const after = await until(() => page.evaluate(() => ({ plan: !!document.querySelector('#mc-root .mc-ax-plan'), exec: document.querySelector('#mc-root [data-act="exec"]').textContent })), v => !v.plan);
  console.log(JSON.stringify(after));
  check(!after.plan && !/\(\d/.test(after.exec), `the card has nothing more from the gallery (${JSON.stringify(after)})`);
  await page.screenshot({ path: 'test-results/mc-784-after-execute.png' });
});
