// #145: after toggling Apollo ↔ the original editor, the next tab shown must not flash
// the stale UI. The takeover was re-applied only by a 500 ms watcher; a tab click now
// re-applies it on the next animation frame, before paint. Apollo's tracklist must be
// right on frame 1.
//   A: Apollo on, on Recordings → off → Tracklist: the stale Apollo table is gone.
//   B: Apollo off, on Recordings → on → Tracklist: Apollo's table is there.
import { test, check, until, idle } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('the tracklist is right on the first frame after a toggle', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { release: '60e810ef-7ef1-4e90-8482-ab4653802786' });
  await page.evaluate(() => {
    window.__t = {
      clickTab: key => document.querySelector(`#release-editor ul.ui-tabs-nav a[href="#${key}"]`)?.click(),
      on: () => window.__apolloEditor.apolloOn,
      toggle: () => document.querySelector('#tc-launch .tc-launch-lbl').click(),
      mirror: () => !!document.getElementById('tc-mirror-wrap'),
      clickAndSample: (key, frames) => new Promise(res => {
        const samples = [];
        document.querySelector(`#release-editor ul.ui-tabs-nav a[href="#${key}"]`).click();
        let i = 0;
        const step = () => { samples.push(!!document.getElementById('tc-mirror-wrap')); if (++i > frames) return res(samples); requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }),
    };
  });
  const ensureOn = async on => { if ((await page.evaluate(() => window.__t.on())) !== on) { await page.evaluate(() => window.__t.toggle()); await until(() => page.evaluate(() => window.__t.on()), v => v === on); await idle(page); } };
  const scenario = async on => {
    await ensureOn(on);
    await page.evaluate(() => window.__t.clickTab('recordings'));
    await until(() => page.evaluate(() => !!document.querySelector('#release-editor ul.ui-tabs-nav li.ui-tabs-active a[href="#recordings"]')));
    await idle(page);
    // read at once after the toggle: well inside the old 500 ms watcher
    await page.evaluate(() => window.__t.toggle());
    const pre = await page.evaluate(() => window.__t.mirror());
    const frames = await page.evaluate(() => window.__t.clickAndSample('tracklist', 8));
    return { pre, frame1: frames[1] ?? frames[0] };
  };
  const a = await scenario(true);
  check(a.pre === true && a.frame1 === false, `A: toggled off, the stale table is gone by frame 1 (${JSON.stringify(a)})`);
  const b = await scenario(false);
  check(b.pre === false && b.frame1 === true, `B: toggled on, the table is there by frame 1 (${JSON.stringify(b)})`);
});
