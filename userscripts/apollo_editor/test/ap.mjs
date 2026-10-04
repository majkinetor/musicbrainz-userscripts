// Shared setup for Apollo's specs. Everything runs in the release editor on
// test.musicbrainz.org, logged in; nothing is submitted unless a spec says so.
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SANDBOX, requireLogin, onSandbox, settled, frames } from '../../../dev/test/harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SETTINGS = 'apolloEditor.settings.v1';

// The GM shim with Apollo's settings: test.use({ gm: apolloGm({ autoMatchRec: true }) }).
// GM_xmlhttpRequest never answers (the dead-link check and the length parser's page
// fetch are the only users), unless a spec asks for more.
export const apolloGm = (settings = null, extra = {}) =>
  ({ name: 'Apollo Editor', xhr: 'none', values: settings ? { [SETTINGS]: JSON.stringify(settings) } : {}, ...extra });

// A seed as an importer posts it: { field: value | [values] }, or a saved import's
// { fields: [[field, value], …] }, from test/fixtures/<name>.json.
export async function seedOf(name) {
  const j = JSON.parse(await readFile(resolve(HERE, 'fixtures', name + '.json'), 'utf8'));
  if (!Array.isArray(j.fields)) return j;
  const o = {};
  for (const [k, v] of j.fields) o[k] = k in o ? [].concat(o[k], v) : v;
  return o;
}

// Opens the release editor with Apollo in it.
//   seed      /release/add fields (an object, or a fixture name): a new release, never saved
//   release   an existing release's editor, by its production MBID (its sandbox copy when
//             there is one) or a sandbox MBID
//   tab       'tracklist' | 'recordings' | … : Apollo's tab to open once it is in
//   before    run after the page has loaded, before Apollo is injected
// Returns what the page submitted (always empty unless the spec lets submissions
// through with submit: true): every /ws/js/edit/create is stopped here.
export async function openApollo(page, inject, { seed, release, tab = null, before = null, submit = false, settle = true } = {}) {
  const submitted = [];
  if (!submit) await page.route(/\/ws\/js\/edit\/create/, r => { submitted.push(r.request().url()); return r.abort(); });
  if (seed) {
    const params = typeof seed === 'string' ? await seedOf(seed) : seed;
    await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
    await requireLogin(page);
    await page.evaluate(params => {
      const f = document.createElement('form'); f.method = 'POST'; f.action = '/release/add'; f.style.display = 'none';
      const add = (n, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = v; f.appendChild(i); };
      for (const [k, v] of Object.entries(params)) Array.isArray(v) ? v.forEach(x => add(k, x)) : add(k, v);
      document.body.appendChild(f); f.submit();
    }, params);
    await page.waitForURL(/\/release\/add/, { timeout: 60000 });
  } else {
    await page.goto(`${SANDBOX}/release/${onSandbox(release)}/edit`, { waitUntil: 'domcontentloaded' });
    await requireLogin(page);
  }
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  // MusicBrainz binds late and wipes early writes: Apollo goes in once the model is
  // loaded, the network is quiet and the page has nothing left queued
  if (settle) await settled(page);
  if (before) await before();
  await inject('apollo_editor', { waitFor: '__apolloEditor' });
  if (tab) await toTab(page, tab);
  return submitted;
}

// Until Apollo's matching pass has ended: its button is back from Stop to Match, and
// either nothing is left to match or the pass has logged its summary. (The button says
// Match before a pass starts too, and slots that cannot resolve stay pending for good.)
export const matchDone = page => page.waitForFunction(() => {
  const A = window.__apolloEditor, b = document.querySelector('#tc-bar [data-act="match"], #tc-hdr [data-act="match"]');
  if (!A || !b || /Stop/.test(b.textContent)) return false;
  if (A.settings && A.settings.autoMatch === false) return true;   // no pass runs by itself
  const m = A.model;
  if (m && m.tracks.length && m.tracks.every(t => t.slots.every(s => !s._pending))) return true;
  return /tracklist match: \d+|matching stopped/.test(A.logMarkdown ? A.logMarkdown() : '');
}, null, { timeout: 120000 }).catch(() => {});

// Apollo's own tab bar.
export async function toTab(page, name) {
  await page.evaluate(name => {
    const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(x => x.textContent.trim().toLowerCase().startsWith(name));
    if (b) b.click();
  }, name.toLowerCase());
  if (/^track/i.test(name)) await page.waitForSelector('.tc-mirror:not(.tc-ri-mirror)', { state: 'attached', timeout: 30000 });   // not the release artist's (#652)
  await settled(page);   // the tab has loaded what it shows (a medium's tracks) and rendered
  await frames(page);
}

// MusicBrainz's own release model, read in the page.
export const mbTracks = (page, mi = 0) => page.evaluate(mi => window.MB.releaseEditor.rootField.release().mediums()[mi].tracks().map(t => ({
  name: t.name(), length: t.length(), data: !!t.isDataTrack(), rec: (t.recording() || {}).gid || null,
  artists: (t.artistCredit().names || []).map(n => n.name),
})), mi);
