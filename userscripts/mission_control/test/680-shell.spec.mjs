// #680 Mission Control: the shell on a release page. It opens from the corner
// launcher, reads the tracklist from the page (no request), and the sidebar
// toggles and the Fusion/CH modes change what is on screen and persist.
// Read only: nothing is submitted.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // sandbox copy of "Bad Boys!" (dev/test/sandbox-copies.json)

test('#680: MC shell — launcher, track matrix, sidebars, modes', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });

  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  check(await page.locator('#mc-launch').isHidden(), 'corner launchers hidden while MC is open');
  const rows = await page.locator('#mc-root .mc-tbl tbody tr[data-i]').count();
  const pageRows = await page.locator('#content table.medium tbody tr a[href*="/recording/"]').count();
  check(rows > 0 && rows === pageRows, `matrix has a row per track (${rows} of ${pageRows})`);
  // the title is the release's own: not what other scripts append to the h1 (ISRC Scout's "ISRC ✓ 12/12")
  const h1Link = await page.evaluate(() => document.querySelector('.releaseheader h1 a[href*="/release/"]').textContent.trim());
  check((await page.locator('#mc-root .mc-ttl').textContent()) === h1Link, 'header title = the h1 link');
  // the release group's versions, from the page header's "see all versions" link
  const ver = await page.evaluate(() => {
    const va = [...document.querySelectorAll('.releaseheader .subheader a')].find(a => /version/i.test(a.textContent));
    const mc = document.querySelector('#mc-root .mc-art .mc-ver');
    return { page: va ? va.textContent.trim() : null, href: va && va.href, mc: mc ? mc.textContent : null, mcHref: mc && mc.href };
  });
  console.log('versions', JSON.stringify(ver));
  const n = ver.page && (ver.page.match(/\d+/) || [])[0];
  check(ver.page ? ver.mc === '(' + (n ? n + (n === '1' ? ' version' : ' versions') : 'all versions') + ')' && ver.mcHref === ver.href : ver.mc === null, `header shows the RG versions (${JSON.stringify(ver)})`);
  // a short window must not squeeze the track list (flex items shrink by default:
  // a long Platforms card cut it to 3 rows); the centre pane scrolls instead
  await page.setViewportSize({ width: 1600, height: 450 });
  const clipped = await page.locator('#mc-root .mc-center > .mc-sect').first().evaluate(s => s.scrollHeight - s.clientHeight);
  check(clipped <= 1, `the track list isn't clipped in a short window (${clipped}px hidden)`);
  await page.setViewportSize({ width: 1600, height: 1000 });
  // Art Station's best cover: the same image as the current front is not a comparison
  const cover = await page.evaluate(() => {
    const best = { provider: 'Discogs', w: 600, h: 600, bytes: 60416, of: 1, larger: false, replace: false };
    const box = h => { const d = document.createElement('div'); d.innerHTML = h; return { text: d.textContent, figs: d.querySelectorAll('.mc-best-c').length }; };
    return { same: box(window.__mcTest.bestHtml(Object.assign({ current: { w: 600, h: 600, bytes: 60416 } }, best))),
             smaller: box(window.__mcTest.bestHtml(Object.assign({ current: { w: 600, h: 600, bytes: 70000 } }, best))) };
  });
  check(cover.same.figs === 1 && /Already the best cover/.test(cover.same.text) && /same image as the best found \(Discogs\)/.test(cover.same.text), `best cover = current front: one figure, "already the best" (${JSON.stringify(cover.same)})`);
  check(cover.smaller.figs === 2 && /Not larger than the current front/.test(cover.smaller.text), `a different image of the same size is still compared (${JSON.stringify(cover.smaller)})`);
  check(await page.locator('#mc-root .mc-hdr .mc-steps .mc-step').count() === 5, 'a step per provider, in the header');
  check(await page.locator('#mc-root .mc-steps .mc-par .mc-step').count() === 2, 'IS and AS side by side, in parallel');

  // #680 round 4: one header row: the release (no cover), ↻ and the steps on one line, Execute, ⚙, ✕;
  // no footer, no Dry run, no Probe or Auto button
  const row = await page.evaluate(() => {
    const h = document.querySelector('#mc-root .mc-hdr');
    const kids = [...h.children].map(c => c.className);
    const mid = el => { const r = el.getBoundingClientRect(); return Math.round(r.top + r.height / 2); };
    const rings = [...h.querySelectorAll('.mc-ring')].map(mid);
    const off = [...h.querySelectorAll('.mc-ring')].map(r => { const a = r.getBoundingClientRect(), b = r.querySelector('img').getBoundingClientRect(); return Math.round(Math.abs((a.left + a.width / 2) - (b.left + b.width / 2)) + Math.abs((a.top + a.height / 2) - (b.top + b.height / 2))); });
    const fmt = h.querySelector('.mc-fmt'); return { fmt: fmt ? fmt.title : null, ring: getComputedStyle(h.querySelector('.mc-ring')).borderTopWidth, kids, rings, off, cover: !!h.querySelector('.mc-cover'), foot: !!document.querySelector('#mc-root .mc-foot'), dry: !!document.querySelector('#mc-root [data-act="dry"]'), auto: !!document.querySelector('#mc-root [data-act="auto"]'), probe: document.querySelectorAll('#mc-root .mc-steps .mc-re[data-act="probe"]').length };
  });
  check(JSON.stringify(row.kids) === '["mc-fmt","mc-rel","mc-steps","mc-act"]', `header: format, release, steps, actions (${JSON.stringify(row.kids)})`);
  check(row.fmt === await page.evaluate(() => document.querySelector('#sidebar dd.format').textContent.trim()), `the format icon carries the release's format in its tooltip (${row.fmt})`);
  check(row.ring === '0px', `no ring around a provider's icon (${row.ring})`);
  check(!row.cover && !row.foot && !row.dry && !row.auto && row.probe === 1, `no cover, footer, Dry run or Auto; ↻ probes (${JSON.stringify(row)})`);
  check(Math.max(...row.rings) - Math.min(...row.rings) <= 1, `the rings sit on one line, the parallel ones too (${row.rings})`);
  check(Math.max(...row.off) <= 1, `each icon is centred in its ring (${row.off})`);
  check(await page.locator('#mc-root [data-act="exec"]').textContent() === 'Execute' && await page.locator('#mc-root [data-act="exec"]').isDisabled(), 'Execute, off with nothing ticked');
  // Auto probe is in ⚙
  check(!(await page.evaluate(() => window.__mcTest.settings())).autoProbe, 'Auto probe is off by default');
  await page.click('#mc-root [data-act="cfg"]');
  await page.locator('.mc-cfg input[data-k="autoProbe"]').check();
  check((await page.evaluate(() => window.__mcTest.settings())).autoProbe === true, 'ticking it in ⚙ stores it');
  await page.locator('.mc-cfg input[data-k="autoProbe"]').uncheck();
  check((await page.evaluate(() => window.__mcTest.settings())).autoProbe === false, 'and unticking');
  await page.keyboard.press('Escape');
  await page.locator('.mc-cfg').waitFor({ state: 'detached' });

  // inspector follows the selected row
  await page.locator('#mc-root .mc-tbl tbody tr[data-i]').first().locator('td.ttl').click();
  check(/^Track /.test(await page.locator('#mc-root .mc-insp-t').textContent()), 'inspector shows the selected track');

  // the order sidebar hides with its ×, and a click on the steps brings it back (and hides it again)
  await page.click('#mc-root [data-close="left"]');
  check(await page.locator('#mc-root .mc-side.left').isHidden(), 'order sidebar hidden');
  check((await page.evaluate(() => window.__mcTest.settings())).left === false, 'left=false stored');

  // CH off drops its column and its step
  const heads = () => page.locator('#mc-root .mc-tbl th').allTextContents();
  check((await heads()).some(h => h.includes('Credits')), 'credits column present');
  await page.click('#mc-root .mc-step[data-step="fusion"]');
  check(await page.locator('#mc-root .mc-side.left').isVisible(), 'a click on the steps shows the sidebar');
  await page.click('#mc-root .mc-step[data-step="pc"]');
  check(await page.locator('#mc-root .mc-side.left').isHidden(), 'and another hides it');
  await page.click('#mc-root .mc-steps .mc-arrow >> nth=0');
  check(await page.locator('#mc-root .mc-side.left').isVisible(), 'anywhere on the steps');
  await page.click('#mc-root .mc-seg[data-mode="ch"] button[data-v="off"]');
  check(!(await heads()).some(h => h.includes('Credits')), 'credits column gone with CH off');
  check(await page.locator('#mc-root .mc-stage.off[data-p="ch"]').count() === 1, 'CH step marked off');
  check(await page.locator('#mc-root .mc-step.off[data-step="ch"]').count() === 1, 'and dimmed in the steps');

  // #680 C: a step says what its provider is doing and for how long, and turns amber when it goes quiet.
  // A stand-in Art Station answers nothing at first, then a step, then its findings.
  const step = async () => page.locator('#mc-root .mc-step[data-step="as"]').evaluate(n => ({ cls: n.className, say: n.querySelector('i').textContent, mark: n.querySelector('sup').hidden ? '' : n.querySelector('sup').textContent }));
  check((await step()).say === 'not installed', `a provider not on the page says so (${JSON.stringify(await step())})`);
  // the steps stay put whatever they say (changing words moved them, distracting)
  const places = () => page.evaluate(() => [...document.querySelectorAll('#mc-root .mc-step')].map(n => Math.round(n.getBoundingClientRect().left)).join(','));
  // nor does Execute's label (its count, "Executing…"): the button is as wide as its longest
  const exW = await page.evaluate(() => { const b = document.querySelector('#mc-root [data-act="exec"]'), was = b.textContent;
    const w = ['Execute', 'Execute (9)', 'Execute (99)', 'Executing…'].map(s => { b.textContent = s; return Math.round(b.getBoundingClientRect().width); }); b.textContent = was; return w; });
  check(new Set(exW).size === 1, `Execute keeps one width whatever it says (${exW})`);
  const at = await places();
  await page.evaluate(() => {
    window.__mcTest.setStall(1500);
    document.addEventListener('mc:probe', e => { window.__asRun = JSON.parse(e.detail).run; });
    document.dispatchEvent(new CustomEvent('mc:provider', { detail: JSON.stringify({ id: 'as', name: 'Art Station', version: 1, capabilities: ['probe'] }) }));
  });
  check((await step()).say === 'not probed', 'connected, it waits for Probe');
  await page.click('#mc-root [data-act="probe"]');
  check(/\bbusy\b/.test((await step()).cls), 'probing: busy');
  const quiet = await until(step, s => /\bstalled\b/.test(s.cls), { timeout: 5000 });
  check(/^no word for \d+ s · starting$/.test(quiet.say) && quiet.mark === '!', `no word: stalled, with the time (${JSON.stringify(quiet)})`);
  const send = (type, d) => page.evaluate(([type, d]) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(Object.assign({ id: 'as', run: window.__asRun }, d)) })), [type, d]);
  await page.evaluate(() => window.__mcTest.setStall(8000));   // room for the seconds to show (from 2 s)
  await send('mc:progress', { state: 'busy', note: 'finding the best cover' });
  const busy = await step();
  check(/\bbusy\b/.test(busy.cls) && busy.say === 'finding the best cover', `a progress note: busy again, saying the step (${JSON.stringify(busy)})`);
  const ticking = await until(step, s => / · \d+ s$/.test(s.say), { timeout: 4000 });
  check(/^finding the best cover · \d+ s$/.test(ticking.say), `the seconds count up while it works (${ticking.say})`);
  await send('mc:findings', { release: await page.evaluate(() => window.__mcTest.release().mbid || ''), findings: [{ key: 'cover:1', state: 'new' }, { key: 'cover:2', state: 'linked' }] });
  // the header pulse is opacity on a layer (the compositor's, smooth on a busy page); its answer doesn't
  // cut it off mid-pulse (that flashed): it ends where a cycle does, within one
  const pulse = await page.evaluate(() => { const h = document.querySelector('#mc-root .mc-hdr'); const a = h.getAnimations({ subtree: true }).find(x => x.animationName === 'mc-busy-pulse');
    return { on: h.classList.contains('mc-busy'), layer: a && a.effect.pseudoElement, props: a ? [...new Set(a.effect.getKeyframes().flatMap(k => Object.keys(k).filter(p => !['offset', 'computedOffset', 'easing', 'composite'].includes(p))))] : [] }; });
  check(pulse.on && pulse.layer === '::after' && JSON.stringify(pulse.props) === '["opacity"]', `the header pulses on its ::after, in opacity only (${JSON.stringify(pulse)})`);
  check(await places() === at, `a long step and its ticking seconds move no step (${at} → ${await places()})`);
  const found = await step();
  check(await page.locator('#mc-root .mc-hdr.mc-busy').count() === 1, 'the answer does not cut the pulse off');
  check(!(await until(() => page.locator('#mc-root .mc-hdr.mc-busy').count(), n => n === 0, { timeout: 4000 })), 'it fades out within a cycle');
  check(/\badd\b/.test(found.cls) && found.say === '1 new' && found.mark === '1', `findings: what there is to add, counted on the ring (${JSON.stringify(found)})`);
  check(await places() === at, `nor does the answer (${at} → ${await places()})`);

  await page.screenshot({ path: 'test-results/mc-680-shell.png' });
  await page.locator('#mc-root .mc-hdr').screenshot({ path: 'test-results/mc-680-header.png' });
  await page.keyboard.press('Escape');
  check(await page.locator('#mc-root').count() === 0, 'Esc closes');
  check(await page.locator('#mc-launch').isVisible(), 'launcher back after closing');
});
