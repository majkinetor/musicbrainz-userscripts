// #560 (majkinetor): "Uploading PDF booklet of 50-100MB fails in AS due to
// timeout (currently visible as IA is slow) while it passes in native uploader.
// Let's make timeout configurable in minutes, and make default double the current
// value."
//
// The upload POST to the Internet Archive had a hardcoded `xhr.timeout = 300000`.
// It is a setting now, defaulting to 10 minutes.
//
// The assertion that matters is the value actually reaching the live XHR — not
// what the settings object holds — so an XMLHttpRequest spy records `timeout` at
// send() time and the real commit path is driven to produce one.
//
// Nothing is uploaded and no edit is created: every POST is aborted at the network
// layer and asserted zero. Runs on test.musicbrainz.org.
import { test, check, requireLogin, SANDBOX, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Art Station' } });

test('the upload timeout is a setting, and reaches the upload request', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }, testInfo) => {
  const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
  const OLD_TIMEOUT_MS = 300000;   // what it was hardcoded to before this change

  await context.addInitScript(() => {
    // record what every XHR is actually configured with, at send() time
    window.__xhrs = [];
    const RealOpen = XMLHttpRequest.prototype.open, RealSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u, ...rest) { this.__m = m; this.__u = u; return RealOpen.call(this, m, u, ...rest); };
    XMLHttpRequest.prototype.send = function (...a) { window.__xhrs.push({ method: this.__m, url: this.__u, timeout: this.timeout }); return RealSend.apply(this, a); };
  });
  let posts = 0; const postUrls = []; let hangUploads = false;
  await page.route(() => true, route => {
    const r = route.request();
    if (r.method() === 'POST' && !/__meb_verify/.test(r.url())) {
      posts++; postUrls.push(r.url());
      // hold the request open instead of failing it, so ontimeout is what fires
      if (hangUploads && /mbid-/.test(r.url())) return;   // never settled — the XHR must time out on its own
      return route.abort();
    }
    return route.fallback();
  });
  await page.goto(`${SANDBOX}/release/${RELEASE}/add-cover-art`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.waitForTimeout(600);
  await inject('art_station');
  await page.waitForSelector('#as-root', { timeout: 20000 });
  await page.waitForTimeout(600);

  // ── the setup control ───────────────────────────────────────────────────────
  await page.click('#as-setup-btn');
  await page.waitForSelector('#as-setup', { timeout: 5000 });
  const ui = await page.evaluate(() => {
    const inp = document.querySelector('.as-setup-uptimeout');
    if (!inp) return { missing: true };
    return { missing: false, value: inp.value, min: inp.min, max: inp.max, type: inp.type, label: (inp.closest('.as-setup-opt') || {}).textContent.trim(), title: (inp.closest('.as-setup-opt') || {}).title };
  });
  console.log('setup control: ' + JSON.stringify(ui));
  check(!ui.missing, '#560: setup has an upload-timeout control');
  check(!ui.missing && ui.type === 'number' && /minutes/i.test(ui.label || ''), 'it is a number of MINUTES — ' + JSON.stringify(ui.label));
  check(!ui.missing && ui.value === '10', `#560: the default is 10 minutes — double the old ${OLD_TIMEOUT_MS / 60000} (got ${ui.value})`);
  await attachShot(testInfo, page.locator('#as-setup'), 'i560-setup');

  // ── clamping, so a silly value can't abort every upload instantly ───────────
  const clamped = await page.evaluate(async () => {
    const inp = document.querySelector('.as-setup-uptimeout');
    const set = v => { inp.value = String(v); inp.dispatchEvent(new Event('change', { bubbles: true })); return inp.value; };
    return { zero: set(0), empty: set(''), huge: set(9999), neg: set(-5), ok: set(20) };
  });
  console.log('clamping: ' + JSON.stringify(clamped));
  check(clamped.zero === '10' && clamped.empty === '10' && clamped.neg === '10', 'a zero/empty/negative box falls back to the default, not to "abort instantly"');
  check(clamped.huge === '120', 'and an absurd value is capped (' + clamped.huge + ')');
  check(clamped.ok === '20', 'a sensible value is kept as typed');

  // ── the value actually reaches the live XHR ────────────────────────────────
  await page.evaluate(() => { document.getElementById('as-setup').remove(); });
  // stage a real (tiny) file the way a drop does, then drive the real commit
  const staged = await page.evaluate(async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
    const file = new File([png], 'booklet-probe.png', { type: 'image/png' });
    const dt = new DataTransfer(); dt.items.add(file);
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 100)); if (!document.querySelector('.as-commit')?.disabled) break; }
    return !document.querySelector('.as-commit')?.disabled;
  });
  check(staged, 'fixture: a file staged, so there is something to upload (otherwise no XHR is produced)');

  const runCommit = async () => page.evaluate(async () => {
    window.__xhrs.length = 0;
    const c = document.querySelector('.as-commit');
    c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));   // right-click = start immediately
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (window.__xhrs.some(x => x.method === 'POST')) break;
    }
    return window.__xhrs.slice();
  });

  const at20 = await runCommit();
  console.log('XHRs at 20 min: ' + JSON.stringify(at20));
  const up20 = at20.find(x => x.method === 'POST');
  check(!!up20, 'the commit produced an upload XHR to measure');
  check(!!up20 && up20.timeout === 20 * 60000, `#560: the setting reaches the live XHR (${up20 && up20.timeout} ms for 20 min)`);
  check(!!up20 && up20.timeout !== OLD_TIMEOUT_MS, 'and is no longer the hardcoded 5 minutes');

  // back to the default and re-measure, so the first result can't be a coincidence
  // close the commit window first: it covers the setup button
  await page.evaluate(() => { document.querySelector('#as-commit .as-cm-cancel')?.click(); document.getElementById('as-commit')?.remove(); document.getElementById('as-setup')?.remove(); });
  await page.click('#as-setup-btn');
  await page.waitForSelector('.as-setup-uptimeout', { timeout: 5000 });
  await page.evaluate(() => { const i = document.querySelector('.as-setup-uptimeout'); i.value = '10'; i.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('as-setup').remove(); });
  await page.waitForTimeout(300);
  const at10 = await runCommit();
  const up10 = at10.find(x => x.method === 'POST');
  console.log('XHR at 10 min: ' + JSON.stringify(up10));
  check(!!up10 && up10.timeout === 10 * 60000, `#560: changing the setting changes the XHR (${up10 && up10.timeout} ms for 10 min)`);

  // ── and the failure message says what to do about it ───────────────────────
  // Aborting makes the XHR fail as a network error, which never reaches ontimeout —
  // so for this one check the upload POST is left HANGING and the timeout is set to
  // its 1-minute minimum. Slow on purpose: this is the only way to see the real
  // user-facing text rather than assert that a string exists in the source.
  hangUploads = true;
  await page.evaluate(() => { document.querySelector('#as-commit .as-cm-cancel')?.click(); document.getElementById('as-commit')?.remove(); document.getElementById('as-setup')?.remove(); });
  await page.click('#as-setup-btn');
  await page.waitForSelector('.as-setup-uptimeout', { timeout: 5000 });
  await page.evaluate(() => { const i = document.querySelector('.as-setup-uptimeout'); i.value = '1'; i.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('as-setup').remove(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const c = document.querySelector('.as-commit');
    if (c) c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  });
  const timedOut = await page.waitForFunction(
    () => /timed out after \d+ min/i.test(document.body.innerText),
    null, { timeout: 100000 }).then(() => true).catch(() => false);
  const shown = await page.evaluate(() => {
    const m = document.body.innerText.match(/IA upload timed out[^\n]*/i);
    return m ? m[0] : '(not shown)';
  });
  console.log('timeout message: ' + JSON.stringify(shown));
  check(timedOut, '#560: a hung upload really does hit the configured timeout (1 min)');
  check(/timed out after 1 min/i.test(shown), 'the message names the limit that was hit — ' + JSON.stringify(shown));
  check(/setup|⚙/i.test(shown), 'and points at the setting, instead of just saying "timed out"');
  await attachShot(testInfo, page, 'timeout message');

  console.log('POSTs seen (all aborted): ' + JSON.stringify(postUrls.slice(0, 4)));
  check(posts > 0, `the upload POST really left the page (${posts.length}) — and was aborted before the network`);
  check(!postUrls.some(u => /musicbrainz\.org\/release\/.*add-cover-art/.test(u) && !/ws\/js/.test(u)), 'no MusicBrainz edit was submitted');
});
