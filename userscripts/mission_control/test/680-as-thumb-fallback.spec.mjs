// #680: a cover still in an open edit has no Cover Art Archive thumbnails yet (its -250 404s; only the
// original exists), so the Cover art card's thumbnail stayed blank while a click showed the cover. A
// thumbnail that fails now falls back to the full image, and keeps it across repaints. A stand-in AS
// answers the probe; its thumbnail URL is a 404 page on the sandbox. Nothing is written.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's

test('#680: a cover thumbnail that 404s shows the full image', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = c.height = 40; const g = c.getContext('2d'); g.fillStyle = '#c00'; g.fillRect(0, 0, 40, 40);
    const full = c.toDataURL('image/png'), gone = location.origin + '/static/no-such-cover-250.jpg';
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    window.__send = send; window.__full = full;
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail); window.__run = d.run;
      const cur = { id: 1, w: 1400, h: 1400, bytes: 328000, thumb: gone, full };
      setTimeout(() => send('mc:findings', { id: 'as', run: d.run, findings: [{ key: 'beatport', name: 'Beatport', url: 'https://www.beatport.com/release/x/1', state: 'unsure', why: 'not larger' }],
        best: { provider: 'Beatport', w: 1400, h: 1400, bytes: 328000, of: 1, thumb: gone, full, larger: false, replace: false, current: cur } }), 50);
    });
    send('mc:provider', { id: 'as', name: 'Art Station', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  const img = page.locator('#mc-root [data-card="as"] .mc-cov img');
  await img.waitFor();
  await page.waitForFunction(() => { const i = document.querySelector('#mc-root [data-card="as"] .mc-cov img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 10_000 });
  const src = await img.getAttribute('src');
  check(src.startsWith('data:image/png'), `the thumbnail fell back to the full image (${src.slice(0, 40)})`);
  // a repaint keeps the loaded image: no new request for the 404
  await page.evaluate(() => { window.__mark = document.querySelector('#mc-root [data-card="as"] .mc-cov img'); window.__mark.__kept = true; });
  await page.evaluate(() => window.__send('mc:findings', { id: 'as', run: window.__run, summary: 'again', findings: [{ key: 'beatport', name: 'Beatport', url: 'https://www.beatport.com/release/x/2', state: 'unsure', why: 'not larger' }],
    best: { provider: 'Beatport', w: 1400, h: 1400, bytes: 328000, of: 1, thumb: location.origin + '/static/no-such-cover-250.jpg', full: window.__full, larger: false, replace: false,
      current: { id: 1, w: 1400, h: 1400, bytes: 328000, thumb: location.origin + '/static/no-such-cover-250.jpg', full: window.__full } } }));
  await page.waitForTimeout(500);
  check(await page.evaluate(() => { const i = document.querySelector('#mc-root [data-card="as"] .mc-cov img'); return !!(i && i.__kept && i.naturalWidth > 0); }), 'after a repaint the same loaded image is still there');
  await page.locator('#mc-root [data-card="as"]').screenshot({ path: 'test-results/mc-680-as-thumb-fallback.png' });
});
