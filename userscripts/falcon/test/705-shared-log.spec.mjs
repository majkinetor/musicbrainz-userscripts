// #705 (majkinetor): "Falcon doesn't use shared log, lets add it. Make workers tags."
// The Log tab is the shared activity log mounted in the panel: a filter chip per
// worker, the debug switch in its toolbar, the run summary kept as a table, and the
// past runs in its session list. Nothing is submitted: the edit POST is answered here.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, frames, settled, attachShot, mbNoise } from '../../../dev/test/harness.mjs';

// the script brings its own GM stand-ins, as the other log specs do
test.use({ gm: false });

test('#705: the Log tab is the shared log, with a chip per worker', { tag: ['@sandbox', '@login'] }, async ({ context, page }, testInfo) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const errs = []; page.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
  await page.route('**/artist/*/edit*', async (route, request) => {
    if (request.method() === 'POST') { const m = request.url().match(/\/artist\/([0-9a-f-]{36})\/edit/); return route.fulfill({ status: 302, headers: { Location: `https://test.musicbrainz.org/artist/${m[1]}` } }); }
    return route.fallback();
  });
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
  await requireLogin(page);
  await page.evaluate(() => { try { Object.keys(localStorage).filter(k => k.startsWith('falcon:')).forEach(k => localStorage.removeItem(k)); } catch (e) {} });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });
  await page.click('#falcon-launcher');

  // two items on two workers, so two worker chips
  await page.evaluate(() => {
    window.__falconTest.setQueue([
      { id: 'a', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/shared-log-1', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
      { id: 'b', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/shared-log-2', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
    ]);
    window.__falconTest.cfg.workers = 2;
  });
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 90000 }).catch(() => {});
  await settled(page);
  await page.click('#falcon-tab-log');
  await frames(page);

  const r = await page.evaluate(() => {
    const host = document.getElementById('falcon-body-log'), list = host.querySelector('.mbu-log-list');
    const pre = host.querySelector('.mbu-log-pre .mbu-log-m');
    return {
      mounted: !!host.querySelector('.mbu-logemb .mbu-logpop-h'),
      floating: !!document.getElementById('mbu-logpop'),
      debug: !!host.querySelector('.mbu-logpop-h .mbu-log-dbg input'),
      chips: [...host.querySelectorAll('.mbu-log-fb[data-cat]')].map(b => b.textContent),
      tagged: [...list.querySelectorAll('.mbu-log-li')].filter(d => d.querySelector('.mbu-log-c').textContent === 'w1').length,
      summaryCat: pre ? pre.parentElement.querySelector('.mbu-log-c').textContent : null,
      summary: pre ? pre.textContent : null, ws: pre ? getComputedStyle(pre).whiteSpace : null,
      preH: pre ? Math.round(pre.getBoundingClientRect().height) : 0, preLines: pre ? pre.textContent.split('\n').length : 0,
      bar: (() => { const h = host.querySelector('.mbu-logpop-h'), hr = h.getBoundingClientRect(), kids = [...h.children].filter(c => c.offsetParent); return { h: Math.round(hr.height), out: kids.filter(c => c.getBoundingClientRect().right > hr.right + 1).map(c => c.className) }; })(),
      height: Math.round(list.getBoundingClientRect().height),
      kept: window.__falconTest.Log.isKept(),
    };
  });
  console.log(JSON.stringify(r, null, 1));
  check(r.mounted && !r.floating, 'the shared viewer sits in the Log tab, not in a floating window');
  check(r.debug, 'the shared log’s own debug switch is in its toolbar');
  check(r.chips.includes('w1') && r.chips.includes('w2'), `each worker is a filter chip (${r.chips.join(', ')})`);
  check(r.tagged > 0, `a worker's lines carry its tag (${r.tagged} w1 lines)`);
  check(!!r.summary && /\n/.test(r.summary) && /entity +status/.test(r.summary) && r.ws === 'pre', `the run summary keeps its table (${JSON.stringify((r.summary || '').slice(0, 80))}, ${r.ws})`);
  check(r.summaryCat === 'run' && r.chips.includes('run'), `the run summary is in the run category (${r.summaryCat}; ${r.chips.join(', ')})`);
  check(r.preH >= r.preLines * 12, `every line of the table shows (${r.preH}px for ${r.preLines} lines)`);
  check(r.bar.h < 44 && !r.bar.out.length, `the toolbar is one row, nothing pushed out (${JSON.stringify(r.bar)})`);
  check(r.height > 100,`the log fills the tab (${r.height}px)`);
  check(r.kept, 'a run that started its workers is kept');

  await page.click('#falcon-body-log .mbu-log-fb[data-cat="w2"]');
  const only = await page.evaluate(() => [...document.querySelectorAll('#falcon-body-log .mbu-log-li')].filter(d => getComputedStyle(d).display !== 'none').map(d => d.querySelector('.mbu-log-c').textContent));
  check(only.length > 0 && only.every(c => c === 'w2'), `the w2 chip shows only w2's lines (${only.length})`);
  await page.click('#falcon-body-log .mbu-log-fb[data-cat="w2"]');
  await attachShot(testInfo, page.locator('#falcon-panel'), 'log tab');

  // the debug switch still decides whether debug lines are recorded
  await page.uncheck('#falcon-body-log .mbu-log-dbg input');
  const dbgOff = await page.evaluate(() => { const n = window.__falconTest.Log.entries().length; window.__falconTest.dbg('[w1]', 'step'); return window.__falconTest.Log.entries().length - n; });
  await page.check('#falcon-body-log .mbu-log-dbg input');
  const dbgOn = await page.evaluate(() => { const n = window.__falconTest.Log.entries().length; window.__falconTest.dbg('[w1]', 'step'); return window.__falconTest.Log.entries().length - n; });
  check(dbgOff === 0 && dbgOn === 1, `debug off records no debug lines, on records them (${dbgOff}, ${dbgOn})`);

  check(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
});
