import { test, check, until, settled, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true }, pageErrors: ["reading 'querySelectorAll'"] });

const REL = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda', KEY = 'ws:release/' + REL + '?inc=';
const on = page => page.evaluate(() => document.documentElement.hasAttribute('data-mbu-dock') || !!document.querySelector('#app .hero, #app h1'));
const title = page => page.locator('#app h1').first().innerText().catch(() => '');
// the release's kept answer, once it has been checked since this page loaded (a run before this one may have kept it)
const checked = page => page.evaluate(key => new Promise(ok => {
  const q = indexedDB.open('eh-kept', 1);
  q.onsuccess = () => { const g = q.result.transaction('a').objectStore('a').getAll(); g.onsuccess = () => ok(g.result.find(e => e.k.startsWith(key) && e.at > performance.timeOrigin) || null); };
  q.onerror = () => ok(null);
}), KEY);

async function open(page, inject) {
  await settled(page);
  await inject('event_horizon');
  if (!(await until(() => on(page), v => v))) await page.locator('#eh-launch').click();
  await until(() => title(page), t => !!t);
}

// #847: a page seen before draws from its kept answers; Back asks MusicBrainz's API for nothing it has checked under a minute ago
test('Back draws from kept answers without asking again', { tag: ['@sandbox'] }, async ({ page, inject }, testInfo) => {
  const asked = [];
  page.on('request', q => { if (q.url().includes('/ws/2/')) asked.push(q.url()); });
  await page.goto(`https://test.musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await open(page, inject);
  const t = await title(page);
  check(!!t, 'the release shows');
  check(!!(await until(() => checked(page), v => v)), 'its answer is kept, and checked');
  await page.locator('#app a[href*="/artist/"]').first().click();
  check((await until(() => page.evaluate(() => location.pathname), p => p.startsWith('/artist/'))).startsWith('/artist/'), 'on the artist');
  await until(() => title(page), x => x && x !== t);
  const n = asked.length;
  await page.goBack();
  check(await until(() => title(page), x => x === t) === t, 'Back shows the release');
  await until(() => page.evaluate(() => !document.querySelector('#app .sk-st')), v => v);
  check(asked.slice(n).filter(u => u.includes('release/' + REL)).length === 0, 'without asking for the release again: ' + asked.slice(n).join(' '));
  await attachShot(testInfo, page, 'back');
});

// #847: a kept answer MusicBrainz has since changed shows first, and the page redraws with the new one once it's checked
test('a changed answer redraws the page', { tag: ['@sandbox'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await open(page, inject);
  const t = await title(page);
  const e = await until(() => checked(page), v => v);
  check(!!e, 'its answer is kept, and checked');
  if (!e) return;
  // the kept release gets another title and an old date, as if MusicBrainz's had changed since (the profile persists:
  // a vote in an earlier spec voids entries older than it)
  await page.evaluate(e => new Promise(ok => { const r = JSON.parse(e.t); r.title = 'Kept long ago'; e.t = JSON.stringify(r); e.at = Date.now() - 600000; localStorage.removeItem('eh.kept.drop');
    const q = indexedDB.open('eh-kept', 1); q.onsuccess = () => { q.result.transaction('a', 'readwrite').objectStore('a').put(e).onsuccess = () => ok(); }; }), e);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await open(page, inject);
  check(/Kept long ago/.test(await until(() => title(page), x => /Kept long ago/.test(x))), 'the kept title shows first');
  check(await until(() => title(page), x => x === t) === t, 'then MusicBrainz\'s, once checked');
  await attachShot(testInfo, page, 'redrawn');
});

// #847: a page being drawn leads the shared gate, so other scripts' background requests wait; it lets go once all is in
test('a page leads the gate while it loads, and lets go after', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await page.evaluate(() => { window.__leads = new Set(); setInterval(() => { try { const s = JSON.parse(localStorage.getItem('mbu:mb-gate') || '{}'); if (s.lead) window.__leads.add(s.lead); } catch (e) {} }, 20); });
  await open(page, inject);
  check(!!(await until(() => checked(page), v => v)), 'the page is all in, and checked');
  const r = await page.evaluate(() => ({ seen: [...window.__leads], now: JSON.parse(localStorage.getItem('mbu:mb-gate') || '{}').lead || '' }));
  check(r.seen.some(x => x.startsWith('eh')), 'it led while loading: ' + r.seen.join(' '));
  check(r.now === '', 'and let go after: ' + r.now);
});

// #847: CAA's cover address redirects twice, uncached, so a page drawn from kept answers waited on its cover; the cover is kept too
test('a release seen before draws its kept cover', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  const THRILLER = '359c3b04-6354-42fa-8438-11393b1e46a3';
  const cover = () => page.evaluate(() => (document.querySelector('#app img[data-relcover]') || {}).src || '');
  const kept = () => page.evaluate(id => new Promise(ok => { const q = indexedDB.open('eh-kept', 1);
    q.onsuccess = () => { const g = q.result.transaction('a').objectStore('a').getAllKeys(IDBKeyRange.bound('cov:' + id, 'cov:' + id + '￿')); g.onsuccess = () => ok(g.result.length); }; q.onerror = () => ok(0); }), THRILLER);
  await page.goto(`https://test.musicbrainz.org/release/${THRILLER}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await open(page, inject);
  check(await until(kept, n => n > 0, 20000) > 0, 'its cover is kept');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await open(page, inject);
  check((await until(cover, u => u.startsWith('blob:'))).startsWith('blob:'), 'and drawn from the kept image on the next visit');
});
