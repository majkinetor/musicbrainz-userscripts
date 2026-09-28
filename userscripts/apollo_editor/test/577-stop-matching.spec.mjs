// #577 (majkinetor): "Tracklist and recording matching can't be stopped, unlike all others
// (GT work matching etc.)". For the length of a pass, Match becomes Stop, in the tracklist
// and in the Recordings pane — clickable, where it used to be disabled. A stopped pass
// says so, and keeps everything it had matched: stopping is not undoing.
// (#545's "the button shows the run is going" is this: it reads Stop while it runs.)
//
// A seeded 24-track release, so a pass lasts long enough to interrupt; nothing is submitted.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm, toTab } from './ap.mjs';

test.use({ gm: apolloGm() });
const seed = { name: 'Apollo #577 stop-matching fixture', 'artist_credit.names.0.name': 'Various Artists', 'mediums.0.format': 'CD' };
for (let i = 0; i < 24; i++) {
  seed[`mediums.0.track.${i}.name`] = 'Fixture Track ' + (i + 1);
  seed[`mediums.0.track.${i}.artist_credit.names.0.name`] = ['Miles Davis', 'John Coltrane', 'Bill Evans', 'Herbie Hancock'][i % 4] + ' ' + (i + 1);
  seed[`mediums.0.track.${i}.length`] = String(180000 + i * 1000);
}
const matched = page => page.evaluate(() => window.__apolloEditor.model.tracks.reduce((n, t) => n + t.slots.filter(s => s.committed || s.gid).length, 0));
const label = (page, sel) => page.evaluate(sel => { const b = document.querySelector(sel); return b ? { text: b.textContent.trim(), disabled: b.disabled, stopping: b.classList.contains('tc-stopping') } : null; }, sel);
const click = (page, sel) => page.evaluate(sel => document.querySelector(sel)?.click(), sel);   // not page.click: a disabled button would hang it
const backToMatch = (page, sel) => page.waitForFunction(sel => /Match/.test(document.querySelector(sel)?.textContent || ''), sel, { timeout: 45000 }).then(() => true).catch(() => false);

test('the tracklist pass can be stopped, and keeps what it matched', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const submitted = await openApollo(page, inject, { seed, tab: 'tracklist' });
  const btn = '#tc-bar [data-act="match"], #tc-hdr [data-act="match"]';
  await page.waitForSelector(btn, { timeout: 20000 });
  const idle = await label(page, btn);
  check(/Match/.test(idle.text) && !idle.disabled, `at rest: Match (${idle.text})`);
  await click(page, btn);
  const running = await until(() => label(page, btn), l => /Stop/.test(l.text));
  check(/Stop/.test(running.text) && !running.disabled && running.stopping, `running: Stop, clickable (${JSON.stringify(running)})`);
  const before = await matched(page);
  await click(page, btn);
  const t0 = Date.now(), ended = await backToMatch(page, btn), took = Date.now() - t0;
  check(ended && took < 40000, `stopped: back to Match ${took} ms later (the request in flight finishes first)`);
  check(await matched(page) >= before, `nothing matched before the stop is lost (${before} → ${await matched(page)})`);
  check(/stopped/i.test(await page.textContent('#tc-bar')), 'it says it stopped');
  await click(page, btn);
  check(/Stop/.test((await until(() => label(page, btn), l => /Stop/.test(l.text))).text), 'and a new pass starts: the stop is not latched');
  await click(page, btn);
  await backToMatch(page, btn);
  check(submitted.length === 0, 'nothing submitted');
});

test('the Recordings pass can be stopped', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const submitted = await openApollo(page, inject, { seed, tab: 'tracklist' });
  // the tracklist's own matching has finished
  await page.waitForFunction(() => { const m = window.__apolloEditor.model; return m && m.tracks.length && m.tracks.every(t => t.slots.every(s => !s._pending)); }, null, { timeout: 120000 }).catch(() => {});
  await page.evaluate(() => {
    [...document.querySelectorAll('a')].find(a => /^\s*Recordings\s*$/.test(a.textContent) || (a.getAttribute('href') || '').includes('recordings'))?.click();
    try { window.__apolloEditor.showRecMirror(); } catch (e) {}
  });
  // attached, not visible: MusicBrainz shows no Recordings tab for a new release; the pane
  // and its button are still the real ones
  const btn = '#tc-recwrap .tc-rec-am';
  await page.waitForSelector(btn, { state: 'attached', timeout: 25000 });
  const idle = await label(page, btn);
  check(/Match/.test(idle.text) && !idle.disabled, `at rest: Match (${idle.text})`);
  await click(page, btn);
  const running = await until(() => label(page, btn), l => l && /Stop/.test(l.text));
  check(running && /Stop/.test(running.text) && !running.disabled, `running: Stop, clickable (${JSON.stringify(running)})`);
  await click(page, btn);
  check(await backToMatch(page, btn), 'stopped: back to Match');
  const status = await page.evaluate(() => document.querySelector('#tc-recwrap .tc-rec-amstatus')?.textContent.trim() || '');
  check(/stopped/i.test(status), `the status says it stopped, not as if it finished (${status})`);
  check(submitted.length === 0, 'nothing submitted');
});
