// #784: MusicBrainz takes a reorder only when it lists every image of the release: one that leaves an image out
// ("the images have changed") gets the form back as a 200, which Art Station counted as done. So after Mission
// Control's uploads, with the old front marked for removal (an edit still open for votes), no reorder went in.
// The reorder lists every image, the ones marked for removal last. Its POST is captured and aborted.
import { test, check, until, requireLogin, SANDBOX, idle } from '../../../dev/test/harness.mjs';
import { RELEASE } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test('#784: a reorder lists every image, the ones marked for removal last', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const posts = [];
  await page.route(/\/(remove|reorder)-cover-art(\/\d+)?(\?|$)/, r => {
    if (r.request().method() !== 'POST') return r.fallback();
    posts.push({ url: r.request().url(), body: [...new URLSearchParams(r.request().postData() || '')] });
    return r.abort();
  });
  await page.goto(`${SANDBOX}/release/${RELEASE}/cover-art`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page); await idle(page);
  await inject('art_station');
  await page.waitForSelector('#as-root .as-card', { timeout: 20000 }); await idle(page);

  // the first cover marked for removal, the second and third swapped
  const want = await page.evaluate(() => {
    const m = window.__asTest.mc.model().filter(x => !x._new).sort((a, b) => a.order - b.order);
    m[0]._del = true;
    [m[1].order, m[2].order] = [m[2].order, m[1].order];
    window.__asTest.mc.render();
    const kept = m.filter(x => !x._del).sort((a, b) => a.order - b.order).map(x => String(x.id));
    return { ids: kept.concat(String(m[0].id)), n: m.length };
  });
  await until(() => page.evaluate(() => !document.querySelector('.as-commit')?.disabled), Boolean);
  await page.evaluate(() => document.querySelector('.as-commit').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  const ro = await until(() => posts.find(p => /reorder-cover-art/.test(p.url)) || null, Boolean, { timeout: 60000 });
  const ids = ro ? ro.body.filter(([k]) => /\.artwork\.\d+\.id$/.test(k)).map(([, v]) => v) : [];
  console.log(JSON.stringify({ want, ids }));
  check(ids.length === want.n, `every image is listed (${ids.length} of ${want.n})`);
  check(JSON.stringify(ids) === JSON.stringify(want.ids), 'in the gallery\'s order, the one marked for removal last');
  // the aborted POST shows as failed, not done
  const st = await until(() => page.evaluate(() => [...document.querySelectorAll('.as-cm-op')].find(r => /Reorder/.test(r.textContent))?.querySelector('.as-cm-st')?.textContent || ''), v => v === '❌');
  check(st === '❌', `a reorder MusicBrainz didn't take shows as failed (${st})`);
});
