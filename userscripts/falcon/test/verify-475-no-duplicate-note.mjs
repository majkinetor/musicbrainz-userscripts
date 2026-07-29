// #475 (majkinetor): "The edit notes repeat the line 'Matched recording while
// importing <release> with Harmony'".
//
// Root cause: buildSeedEditUrl() puts item.note into the edit_note query
// param, and MB's OWN page rendering seeds the textarea with it natively
// before fillAndSubmit ever runs — for BOTH the worker path and the
// openInTab manual-review path, since both navigate through the same seed
// url. editNoteText() then built a second block that pushed harmonyNote
// (= item.note) in AGAIN, and setEditNote() appends its text after whatever
// is already in the box — so the Harmony line ended up twice.
//
// Fix: editNoteText() no longer re-inserts harmonyNote; it only adds
// Falcon's own attribution header + bulk-added summary, since the Harmony
// line is already there from MB's native seeding.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(400);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });

const HARMONY_NOTE = 'Matched recording while importing https://musicbrainz.org/release/20b03c7d-9e8a-42b9-8a96-bcc9564de034 with Harmony';

// buildSeedEditUrl still seeds edit_note — that part is correct and unchanged;
// MB's own rendering is what consumes it to pre-fill the textarea.
const seedUrl = await page.evaluate((note) => window.__falconTest.buildSeedEditUrl({
  entityType: 'recording', mbid: 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7', note,
  urls: [{ url: 'https://tidal.com/track/120024260', linkTypeId: '979' }],
}), HARMONY_NOTE);
const seededNote = new URL(seedUrl).searchParams.get('edit-recording.edit_note');
ck(seededNote === HARMONY_NOTE, 'buildSeedEditUrl still seeds edit_note from item.note (unchanged behaviour)');

// Simulate what the page looks like right after MB's native seeding has run:
// a textarea already containing the Harmony note, exactly once.
const result = await page.evaluate((note) => {
  document.body.insertAdjacentHTML('beforeend', '<textarea class="edit-note"></textarea>');
  const ta = document.querySelector('textarea.edit-note');
  const setVal = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setVal.call(ta, note);   // <- what MB's native edit_note seeding leaves behind
  const results = [{ url: 'https://tidal.com/track/120024260', ok: true }];
  const text = window.__falconTest.editNoteText(results);
  const noteSet = window.__falconTest.setEditNote(document, window, text);
  return { noteSet, finalValue: ta.value };
}, HARMONY_NOTE);
console.log('final textarea value:\n' + result.finalValue);

ck(result.noteSet, 'setEditNote reports success');
const occurrences = result.finalValue.split(HARMONY_NOTE).length - 1;
ck(occurrences === 1, `the Harmony line appears exactly once in the final note (got ${occurrences})`);
ck(/Bulk-added via the Falcon queue:/.test(result.finalValue), "Falcon's own bulk-added summary is still present");
ck(/Falcon v.*by majkinetor/.test(result.finalValue), "Falcon's own attribution header is still present");

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
