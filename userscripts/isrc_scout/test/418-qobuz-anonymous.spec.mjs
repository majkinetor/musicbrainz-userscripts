// #418: a Qobuz ISRC import works without a Platform Check login. album/get is gated by
// country, not by session, so ISRC Scout tries it anonymously first and falls back to
// the shared session token.
//
//   A. anonymous works (chaban's case): no token, 200 → the 13 ISRCs import, the call
//      carries no X-User-Auth-Token, no login is asked for.
//   B. blocked in this country, no token (the old #353 case): 404 → the error explains
//      the country part and points at the Platform Check login.
//   C. logged in: the session token is preferred, one call, no anonymous probe first.
//   D. a stale session in a served country: the token call 401s → anonymous, delivered.
//
// test.musicbrainz.org, with production's data for Move Positive (it links Qobuz and
// has all 13 ISRCs), from fixtures/ws-418.json.gz. Qobuz is answered from
// fixture-418-albumget.json (the real response from the #418 HAR).
import { readFileSync } from 'node:fs';
import { test, check, answerGm } from '../../../dev/test/harness.mjs';
import { openScout, logText } from './is.mjs';

const ALBUM_GET = readFileSync(new URL('./fixture-418-albumget.json', import.meta.url), 'utf8');
const REPLAY = new URL('./fixtures/ws-418.json.gz', import.meta.url);
test.use({ gm: { name: 'ISRC Scout' } });

async function run(page, context, inject, { anon, token = 200, withToken = false }) {
  const calls = [];
  answerGm(context, ({ url, headers }) => {
    if (!/qobuz\.com\/api\.json/.test(url)) return null;
    const auth = headers && headers['X-User-Auth-Token'];
    calls.push({ url, auth });
    const status = auth ? token : anon;
    return { status, body: status === 200 ? ALBUM_GET : `{"status":"error","code":${status},"message":"stub"}` };
  });
  // Platform Check's shared session, or none
  await page.addInitScript(t => { if (t) localStorage.setItem('mbtools:qobuz', JSON.stringify({ token: t })); else localStorage.removeItem('mbtools:qobuz'); }, withToken ? 'fake-session-token' : '');
  const ws = await openScout(page, inject, { release: 'bb10044f-d50e-4d76-b3cc-ec7edd1a9704', replay: REPLAY });
  await page.waitForTimeout(800);
  await page.click('#ii-qz-all');
  await page.waitForFunction(() => /Qobuz album|Qobuz failed|Qobuz \d+/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => localStorage.removeItem('mbtools:qobuz'));
  await ws.done();
  return { log: await logText(page), albumGets: calls.filter(c => /album\/get/.test(c.url)) };
}

test('A: anonymous album/get imports the ISRCs, with no login', { tag: ['@sandbox', '@critical'] }, async ({ page, context, inject }) => {
  const r = await run(page, context, inject, { anon: 200 });
  check(r.albumGets.length === 1 && !r.albumGets[0].auth, `one album/get, without a session token (${JSON.stringify(r.albumGets)})`);
  check(/Qobuz album "Move Positive": 13 track/i.test(r.log), '13 tracks came back');
  check(!/not logged in|sign in to Qobuz/i.test(r.log), 'no login is asked for');
  const done = r.log.match(/Qobuz done — (\d+) filled, (\d+) already present/);
  check(done && +done[1] + +done[2] === 13, `all 13 accounted for (${done && done[0]})`);
});

test('B: blocked in this country with no token, the error says so', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
  const r = await run(page, context, inject, { anon: 404 });
  check(/countries Qobuz serves/i.test(r.log), 'the error explains the country part');
  check(/sign in to Qobuz in Platform Check/i.test(r.log), 'and points at the Platform Check login');
});

test('C: logged in, the session token is used, with no anonymous probe', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
  const r = await run(page, context, inject, { anon: 404, token: 200, withToken: true });
  check(r.albumGets.length === 1 && r.albumGets[0].auth === 'fake-session-token', `one album/get, with the token (${JSON.stringify(r.albumGets)})`);
  check(/Qobuz album "Move Positive": 13 track/i.test(r.log), 'the 13 tracks came back');
});

test('D: a stale session falls back to anonymous, and says the session is stale', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
  const r = await run(page, context, inject, { anon: 200, token: 401, withToken: true });
  check(r.albumGets.length === 2 && r.albumGets[0].auth === 'fake-session-token' && !r.albumGets[1].auth, `the token call, then the anonymous one (${JSON.stringify(r.albumGets)})`);
  check(/Qobuz album "Move Positive": 13 track/i.test(r.log), 'the anonymous call delivered');
  check(/re-login in Platform Check/i.test(r.log), 'the stale session is reported');
});
