// The harness's production write guard, proven (#625). Every write here targets a
// path that does not exist on musicbrainz.org, so even a hole in the guard could
// only ever produce a 404 — never an edit.
import { test, expect } from './harness.mjs';

const PROBE = 'https://musicbrainz.org/__mbu_harness_selftest__';
test.use({ prodWrites: 'block' });

test('page-level writes to production are refused before they leave', { tag: ['@prod', '@unit'] }, async ({ page, blockedWrites }) => {
  // a stub at a production URL: the page is "on" musicbrainz.org without loading MusicBrainz
  await page.route(u => u.href.startsWith(PROBE), r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><form method="post" action="/__mbu_harness_selftest__/form"><button>go</button></form>' }));
  await page.goto(PROBE + '/page');
  const out = await page.evaluate(async () => {
    const res = {};
    res.fetch = await fetch('/__mbu_harness_selftest__/fetch', { method: 'POST', body: 'x' }).then(() => 'sent', e => 'refused: ' + e.message);
    res.xhr = await new Promise(ok => { const x = new XMLHttpRequest(); x.open('PUT', '/__mbu_harness_selftest__/xhr'); try { x.send('x'); ok('sent'); } catch (e) { ok('refused: ' + e.message); } });
    res.beacon = navigator.sendBeacon('/__mbu_harness_selftest__/beacon', 'x') ? 'sent' : 'refused';
    res.get = await fetch('/__mbu_harness_selftest__/get').then(r => 'read ' + r.status, e => 'failed: ' + e.message);
    return res;
  });
  await page.click('button');   // a real form submit
  await page.evaluate(() => document.querySelector('form').submit());   // and the scripted one
  await page.waitForTimeout(300);
  expect(out.fetch).toMatch(/^refused/);
  expect(out.xhr).toMatch(/^refused/);
  expect(out.beacon).toBe('refused');
  expect(out.get, 'reads are never touched').toBe('read 200');
  expect(page.url(), 'neither form submit navigated').toBe(PROBE + '/page');
  expect(blockedWrites.map(w => w.via).sort()).toEqual(['beacon', 'fetch', 'form', 'form', 'xhr']);
});

test('a write the page layer cannot see is aborted on the network', { tag: ['@prod', '@unit'] }, async ({ page, blockedWrites }) => {
  // A worker's fetch is invisible to the page-level wrappers; the route catches the
  // write-only endpoints (here a nonexistent one under /ws/js/edit/).
  await page.route(u => u.href.startsWith(PROBE), r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><p>stub</p>' }));
  await page.goto(PROBE + '/worker');
  const res = await page.evaluate(() => new Promise(ok => {
    const src = "fetch('https://musicbrainz.org/ws/js/edit/__mbu_harness_selftest__', { method: 'POST', body: '{}' }).then(r => postMessage('sent ' + r.status), e => postMessage('failed: ' + e.message));";
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = e => ok(e.data);
  }));
  expect(res).toMatch(/^failed/);
  expect(blockedWrites.map(w => w.via)).toEqual(['network']);
});

test('the sandbox may be written to', { tag: ['@sandbox', '@unit'] }, async ({ page, blockedWrites }) => {
  await page.route(u => u.hostname === 'test.musicbrainz.org', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><p>stub</p>' }));
  await page.goto('https://test.musicbrainz.org/__mbu_harness_selftest__');
  const res = await page.evaluate(() => fetch('/__mbu_harness_selftest__/post', { method: 'POST', body: 'x' }).then(r => 'sent ' + r.status, e => 'refused: ' + e.message));
  expect(res).toBe('sent 200');
  expect(blockedWrites).toEqual([]);
});
