// Shared setup for Platform Check's specs.
import { replayWs, answerGm, onSandbox, sandboxAs, SANDBOX } from '../../../dev/test/harness.mjs';

// Opens Platform Check on a release page on test.musicbrainz.org.
//   release   the PRODUCTION mbid (its sandbox copy when there is one)
//   replay    a fixture file: MusicBrainz's answers and every provider's (Spotify, Discogs,
//             Bandcamp, the search engines…) come from it, recorded once from the live
//             sites (RECORD_WS=1), so a spec sees the same candidates every run
//   links     { drop: RegExp, add: [url…] }: the release's links as the spec needs them,
//             taken off (or put on) the page and the web-service reply alike
//   storage   localStorage entries to seed (Platform Check's cache and queue live there);
//             every other pc:* entry is cleared first, so no earlier run's cache answers
//   settle    wait until every scan has finished (default true)
// Returns the replay (or null), for done().
export async function openPc(page, inject, { release, replay = null, links = null, storage = {}, settle = true, before = null } = {}) {
  const ws = replay ? await replayWs(page, replay, { as: sandboxAs(release), web: true, trim }) : null;
  // Apple's token (#627) is cached in localStorage across runs: without one, every run asks for
  // it the same way, so a recording made here replays anywhere (a fresh CI profile too)
  if (replay) await page.context().addInitScript(() => { try { localStorage.removeItem('mbtools:apple-token'); } catch (e) {} });
  if (links) editLinks(page.context(), ws, links);
  if (before) await before();   // after the replay: an answerGm registered here is asked first
  for (let a = 1; ; a++) {
    try { await page.goto(`${SANDBOX}/release/${onSandbox(release)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) throw e; await page.waitForTimeout(4000); }
  }
  await page.waitForSelector('#sidebar', { timeout: 30000 });
  // links are edited once MusicBrainz has hydrated the page: a node taken out before
  // that is a hydration error (React #418); a link is dropped by losing its href
  if (links) await page.waitForLoadState('load');
  await page.evaluate(({ storage, links }) => {
    Object.keys(localStorage).filter(k => k.startsWith('pc:')).forEach(k => localStorage.removeItem(k));
    for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    if (!links) return;
    if (links.drop) { const re = new RegExp(links.drop.source, links.drop.flags); document.querySelectorAll('a[href]').forEach(a => { if (re.test(a.href)) a.removeAttribute('href'); }); }
    for (const href of links.add || []) {
      const a = document.createElement('a'); a.href = href; a.textContent = new URL(href).hostname;
      document.querySelector('#sidebar ul.external_links, #sidebar')?.appendChild(a);
    }
  }, { storage, links: links && { drop: links.drop && { source: links.drop.source, flags: links.drop.flags }, add: links.add } });
  await inject('platform_check');   // no @run-at: document-end, as a manager runs it
  await page.waitForSelector('#mb-pc-panel', { state: 'attached', timeout: 30000 });
  if (settle) await scansDone(page);
  return ws;
}

// What a recording keeps of a reply: of SoundCloud's 3 MB web-player script, only the
// public client_id Platform Check reads from it.
function trim(key, body) {
  // Apple's token (#627): the page names the web player's script, and the script carries the token.
  // Kept: that name, and a stand-in token of the same shape (the amp-api replies are keyed by URL).
  // (the one the script picks: -legacy first, as appleToken() looks for it)
  if (/^https:\/\/music\.apple\.com\/us\/browse/.test(key)) return (body.match(/\/assets\/index-legacy~[a-z0-9]+\.js/i) || body.match(/\/assets\/index~[a-z0-9]+\.js/i) || [''])[0];
  if (/^https:\/\/music\.apple\.com\/assets\/index/.test(key)) return 'eyJrecorded' + 'x'.repeat(100);
  if (/^https:\/\/a-v2\.sndcdn\.com\/assets\//.test(key)) return (body.match(/client_id\s*[:=]\s*"[a-zA-Z0-9]{20,40}"/) || [''])[0];
  return body;
}

// Waits until the ↻ button stops spinning: every scan has reported.
export const scansDone = (page, timeout = 120000) =>
  page.waitForFunction(() => { const b = document.getElementById('mb-refresh-btn'); return b && !b.classList.contains('pc-scanning') && /All scans completed/.test(document.getElementById('mb-finder-log-panel')?.textContent || ''); }, null, { timeout });

// One provider row, as the panel shows it.
export const row = (page, p) => page.evaluate(p => {
  const r = document.getElementById('row-' + p), ico = document.getElementById('ico-' + p);
  return {
    exists: !!r, cls: r ? r.className : '', icon: ico ? ico.textContent.trim() : null,
    url: document.getElementById('mb-online-' + p)?.href || null,
    value: document.getElementById('val-' + p)?.textContent.trim() || '', valueTitle: document.getElementById('val-' + p)?.title || '',
    master: document.getElementById('master-' + p)?.title || '',
    blocked: !!r?.classList.contains('pc-blocked'), clickable: !!(ico && ico.onclick),
  };
}, p);

// The diagnostic log's text.
export const logText = page => page.evaluate(() => document.getElementById('mb-finder-log-panel')?.innerText || '');

// A cache entry Platform Check wrote for this page's release.
export const cached = (page, p) => page.evaluate(p => {
  const id = location.pathname.split('/')[2];
  try { return JSON.parse(localStorage.getItem(`pc:cache:v2:${p}:${id}`) || 'null'); } catch (e) { return null; }
}, p);

// Keeps the release's web-service reply in step with the page's links.
function editLinks(context, ws, { drop, add = [] }) {
  answerGm(context, async ({ url, method }) => {
    if (method !== 'GET' || !/\/ws\/2\/release\/[0-9a-f-]{36}\?/.test(url)) return null;
    const a = ws ? await ws.answer(url) : await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'mb-userscripts-tests/1.0' } }).then(async r => ({ status: r.status, body: await r.text() }));
    try {
      const j = JSON.parse(a.body);
      j.relations = (j.relations || []).filter(x => !(drop && x.url && drop.test(x.url.resource)));
      add.forEach(resource => j.relations.push({ 'target-type': 'url', url: { resource } }));
      return { status: a.status, body: JSON.stringify(j) };
    } catch (e) { return a; }
  });
}
