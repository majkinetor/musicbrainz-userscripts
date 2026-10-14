// #741: Mission Control enters the cover in a hidden frame of the cover-art page. A failed upload there now goes
// through the page's own auto-repeat, and each attempt is told to Mission Control ({ type: 'progress' }); the
// frame answers 'entered' once auto-repeat gives up, with retry: true, so Mission Control can offer to try again.
// A second 'enter' (that Retry, or a second Execute) carries Mission Control's line in the edit note once: it
// was appended again each time.
//
// The frame is a real add-cover-art page in an iframe of the release page; the file is a staged 1×1 PNG and
// every POST is aborted at the network (nothing is uploaded). Auto-repeat is cut to 2 attempts, 300 ms apart.
import { test, check, until, requireLogin, idle, SANDBOX } from '../../../dev/test/harness.mjs';
import { RELEASE, blockPosts } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

const TOKEN = 'mc741';
const quick = code => code
  .replace('function arDelayMs(attempt) {', 'function arDelayMs(attempt) { return 300;')
  .replace('const arTimes = () =>', 'const arTimes = () => 2 || ');

test('#741: the frame repeats a failed upload, tells Mission Control, and answers with retry', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(180_000);
  const posts = await blockPosts(page);
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.evaluate(t => {
    window.__got = [];
    window.addEventListener('message', e => { if (e.data && e.data.mcAs === 1 && e.data.token === t) window.__got.push(e.data); });
    const f = document.createElement('iframe'); f.id = 'mcf'; f.style.cssText = 'width:1200px;height:900px';
    f.src = `/release/${location.pathname.split('/')[2]}/add-cover-art?mc_frame=${t}`;
    document.body.appendChild(f);
  }, TOKEN);
  const frame = await until(async () => { const h = await page.$('#mcf'); const f = h && await h.contentFrame(); return f && /add-cover-art/.test(f.url()) ? f : null; });
  await frame.waitForLoadState('domcontentloaded');
  await idle(frame);
  await inject('art_station', { target: frame, transform: quick });
  await frame.waitForSelector('#as-root', { timeout: 20000 });

  // stage a file in the frame, then Mission Control's 'enter', twice
  await frame.evaluate(async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
    const dt = new DataTransfer(); dt.items.add(new File([png], 'mc741.png', { type: 'image/png' }));
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 100)); if (!document.querySelector('.as-commit')?.disabled) break; }
  });
  const enter = () => page.evaluate(t => document.getElementById('mcf').contentWindow.postMessage({ mcAs: 1, token: t, type: 'enter', note: 'Via Mission Control vtest: x' }, location.origin), TOKEN);
  await enter();
  const first = await until(() => page.evaluate(() => window.__got.find(m => m.type === 'entered') || null), Boolean, { timeout: 120_000 });
  const progress = await page.evaluate(() => window.__got.filter(m => m.type === 'progress').map(m => m.note));
  console.log(JSON.stringify({ first, progress, posts: posts.length }));
  check(first && first.ok === false && first.retry === true && !!first.gaveUp, `the frame answers once auto-repeat gives up, with retry (${JSON.stringify(first)})`);
  check(progress.some(n => /repeating in/.test(n)) && progress.some(n => /attempt 1 of 2/.test(n)), `each attempt is told (${JSON.stringify(progress)})`);
  check(posts.length >= 2, `the upload was tried again (${posts.length} attempts, none reached the network)`);

  await page.evaluate(() => { window.__got = []; });
  await enter();
  await until(() => page.evaluate(() => window.__got.find(m => m.type === 'entered') || null), Boolean, { timeout: 120_000 });
  const note = await frame.evaluate(() => (document.querySelector('.as-cm-note, textarea.as-cm-note, .as-commit-note textarea') || {}).value || '');
  console.log('note: ' + JSON.stringify(note));
  check((note.match(/Via Mission Control/g) || []).length === 1, `a second enter carries Mission Control's line once (${JSON.stringify(note)})`);
});
