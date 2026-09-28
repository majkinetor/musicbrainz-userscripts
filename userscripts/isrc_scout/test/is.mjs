// Shared setup for ISRC Scout's specs.
import { replayWs, answerGm, onSandbox, sandboxAs, SANDBOX } from '../../../dev/test/harness.mjs';

export { onSandbox };

// A release on the sandbox with ten tracks, each with its ISRC: for specs about the
// dialog itself, where which release it is doesn't matter.
export const ANY_RELEASE = 'bef3dc66-8cfc-4ff1-9053-0d0a5f30f2b3';

// Opens ISRC Scout on a release page on the sandbox.
//   release   the PRODUCTION mbid (the sandbox copy is used when there is one)
//   replay    a fixture file: the release's web-service reads come from production
//             (replayWs), so ISRCs and links are production's, not the sandbox's
//   edit      (json, url) => void: adjusts the release's reply before ISRC Scout sees it
//             (a link since removed from MusicBrainz, ISRCs hidden to leave rows empty…)
//   open      click the button and wait for the tracklist (default true)
// Returns the replay (or null), for its answer() and done().
export async function openScout(page, inject, { release = ANY_RELEASE, replay = null, edit = null, before = null, open = true } = {}) {
  const sandboxId = onSandbox(release);
  const ws = replay ? await replayWs(page, replay, { as: sandboxAs(release) }) : null;
  if (edit) editRelease(page.context(), ws, edit);
  if (before) await before();   // after the replay, before the page: an answerGm registered here is asked first
  await inject('isrc_scout', { atStart: true, target: page });   // @run-at document-start, as a manager runs it
  for (let a = 1; ; a++) {
    try { await page.goto(`${SANDBOX}/release/${sandboxId}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) throw e; await page.waitForTimeout(4000); }
  }
  await page.waitForSelector('#ii-btn', { state: 'attached', timeout: 30000 });
  if (!open) return ws;
  await page.waitForFunction(() => { const s = document.getElementById('ii-btn-status'); return s && s.textContent.trim() !== '⏳'; }, null, { timeout: 45000 }).catch(() => {});
  await page.evaluate(() => document.getElementById('ii-btn').click());
  await page.waitForSelector('#ii-modal.open', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('#ii-tbody tr[data-idx]').length > 0, null, { timeout: 45000 });
  await page.waitForFunction(() => /Release "/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
  return ws;
}

// Adjusts the release's web-service reply (replayed, or the sandbox's own when ws is
// null). Registered after the replay, so it is asked first.
function editRelease(context, ws, edit) {
  answerGm(context, async ({ url, method }) => {
    if (method !== 'GET' || !/\/ws\/2\/release\/[0-9a-f-]{36}/.test(url)) return null;
    const a = ws ? await ws.answer(url) : await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'mb-userscripts-tests/1.0' } }).then(async r => ({ status: r.status, body: await r.text() }));
    try { const j = JSON.parse(a.body); edit(j, url); return { status: a.status, body: JSON.stringify(j) }; } catch (e) { return a; }
  });
}

// A stub release page, no network: for specs of ISRC Scout's functions, through its test
// hooks. The release lookup gets a 404.
export async function openStub(page, context, inject) {
  const url = `${SANDBOX}/release/aaaaaaaa-0000-0000-0000-000000000000`;
  await context.route(url, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><body><div id="content"><h1>Stub release</h1></div></body>' }));
  answerGm(context, ({ url: u }) => (/\/ws\/2\//.test(u) ? { status: 404, body: '{"error":"Not Found"}' } : null));
  await inject('isrc_scout', { atStart: true });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

// The log pane's text.
export const logText = page => page.evaluate(() => document.getElementById('ii-log-out')?.textContent || '');
