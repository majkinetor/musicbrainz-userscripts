// #543 (majkinetor): "When multiple URLs are pasted, in (+) line, Apollo should
// add them all at once … Find out only links, no matter where they are, so they
// could be intermingled with text", plus "Automatically select most appropriate
// link type (same mechanism as PC)".
//
// Both of his examples are used verbatim: the "Bandcamp: <url>\nSpotify: <url>"
// block from the issue, and the inline markdown one.
//
// Runs against test.musicbrainz.org's real release editor and never submits:
// every POST is aborted and asserted zero. Links staged in the editor are
// discarded when the page closes — nothing is entered.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_info = { script: { name: 'Apollo', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));

// ── the extractor, on his own examples ──────────────────────────────────────
for (let a = 1; ; a++) {
  try { await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 4) throw e; console.log('goto retry ' + a); await page.waitForTimeout(5000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(5000);
const posted = [];
await page.route(() => true, route => {
  const r = route.request();
  if (r.method() === 'POST') { posted.push(r.url()); return route.abort(); }
  return route.continue();
});
// Only a POST that WRITES counts. The release editor also POSTs
// /ws/js/edit/preview as the form changes (it renders the "what will this edit
// do" panel) and MB's pages beacon to /__meb_verify — neither creates anything.
// The submit is /ws/js/edit/create, or a form post to the entity's /edit.
const mbPosts = () => posted.filter(u => /\/ws\/js\/edit\/create|musicbrainz\.org\/release\/[0-9a-f-]{36}\/edit(?:[?#]|$)/.test(u));
await page.addScriptTag({ content: code });
await page.waitForTimeout(800);

// majkinetor: "Make a hint show that it can be multiple links." MB's own
// placeholder is "Add link", which advertises nothing.
const hint = await page.waitForFunction(() => {
  const i = [...document.querySelectorAll('#external-links-editor input[type=url]')].find(x => !x.value);
  return i && i.placeholder !== 'Add link' ? i.placeholder : null;
}, null, { timeout: 20000 }).then(h => h.jsonValue()).catch(() => null);
console.log('add-link placeholder: ' + JSON.stringify(hint));
ck(hint === 'Paste one or more links', 'the (+) row says several links can be pasted, not just "Add link"');

// ── the hint must not cost the collapsed [+] row ────────────────────────────
// majkinetor, after the hint landed: "But its always shown now, it doesn't
// collapse to (+) and draws over button". Six CSS rules were keyed on MB's own
// placeholder TEXT (input[placeholder^="Add"]), so renaming it un-matched every
// one of them. They key on :placeholder-shown now — "this input has no value",
// which is what the add row actually is — but the only way to know that keeps
// working is to measure it.
const collapsed = await page.evaluate(() => {
  const i = [...document.querySelectorAll('#external-links-editor input[type=url]')].find(x => !x.value);
  return { riOn: document.body.classList.contains('tc-ri-on'), w: Math.round(i.getBoundingClientRect().width) };
});
console.log('add row at rest: ' + JSON.stringify(collapsed));
ck(collapsed.riOn, 'Apollo\'s release-info view is on (these rules are scoped to it)');
ck(collapsed.w <= 40, `the add row is collapsed to a [+] button when idle (${collapsed.w}px)`);

const expanded = await page.evaluate(async () => {
  const bar = document.querySelector('#tc-ri-toolbar');
  // this sandbox release has no committed links, so the Check-links toolbar is
  // hidden by an inline style; clear it so the CSS rule under test decides.
  const before = bar ? (bar.style.display = '', getComputedStyle(bar).display) : null;
  const i = [...document.querySelectorAll('#external-links-editor input[type=url]')].find(x => !x.value);
  i.focus();
  await new Promise(z => setTimeout(z, 250));
  const ir = i.getBoundingClientRect();
  const after = bar ? getComputedStyle(bar).display : null;
  const br = bar ? bar.getBoundingClientRect() : null;
  const overlaps = bar && after !== 'none' && !(br.right < ir.left || br.left > ir.right || br.bottom < ir.top || br.top > ir.bottom);
  i.blur();
  return { w: Math.round(ir.width), toolbarIdle: before, toolbarFocused: after, overlaps: !!overlaps };
});
console.log('add row focused: ' + JSON.stringify(expanded));
ck(expanded.w > collapsed.w * 3, `and expands to a real input on focus (${collapsed.w} → ${expanded.w}px)`);
ck(expanded.toolbarIdle !== 'none', 'the Check-links toolbar is visible when the row is idle');
ck(expanded.toolbarFocused === 'none', 'and gets out of the way while the row is focused');
ck(!expanded.overlaps, 'so it never draws over the input');

const BC = 'https://digthiswayrecords.bandcamp.com/album/musical-breed-save-the-little-children';
const SP = 'https://open.spotify.com/album/3ibDwnUIydFebHj3pNW9WR';
const ex = await page.evaluate(({ BC, SP }) => {
  const f = window.__apolloEditor.alExtractUrls;
  const NL = String.fromCharCode(10);
  return {
    labelled: f(`Bandcamp: ${BC}${NL}Spotify: ${SP}`),
    markdown: f(`Available on [Bandcamp](${BC}) & [Spotify](${SP})`),
    trailingPunct: f(`see ${SP}, and ${BC}.`),
    dupes: f(`${SP} ${SP}`),
    none: f('no links here at all'),
    notAUrl: f('http://'),
  };
}, { BC, SP });
console.log('labelled block  → ' + JSON.stringify(ex.labelled));
console.log('markdown inline → ' + JSON.stringify(ex.markdown));
ck(ex.labelled.length === 2 && ex.labelled[0] === BC && ex.labelled[1] === SP, 'his labelled example yields exactly the two urls');
ck(ex.markdown.length === 2 && ex.markdown[0] === BC && ex.markdown[1] === SP, 'and so does the markdown one — the closing paren is not swallowed');
ck(ex.trailingPunct.length === 2 && ex.trailingPunct[0] === SP && ex.trailingPunct[1] === BC, 'trailing comma/full stop are trimmed — ' + JSON.stringify(ex.trailingPunct));
ck(ex.dupes.length === 1, 'the same url twice in one paste is one link');
ck(ex.none.length === 0 && ex.notAUrl.length === 0, 'prose and a bare scheme yield nothing');

// ── the real editor: paste the block into the (+) input ─────────────────────
// A row holds its url in an <input> while the editor is open; <a.url> only
// appears once MB has rendered it as a committed link. Count either.
const ROW_URL = `(r => { const a = r.querySelector('a.url'); if (a) return a.href; const i = r.querySelector('input[type=url]'); return (i && i.value) || ''; })`;
const countUrlRows = () => page.evaluate(`[...document.querySelectorAll('#external-links-editor tr.external-link-item')].map(${ROW_URL}).filter(Boolean).length`);
const before = await countUrlRows();   // the (+) row is empty, so it does not count
console.log('link rows before: ' + before);
const addInput = '#external-links-editor input[type=url]';
await page.waitForSelector(addInput, { timeout: 20000 });
await page.evaluate(({ BC, SP }) => {
  const NL = String.fromCharCode(10);
  const input = [...document.querySelectorAll('#external-links-editor input[type=url]')].find(i => !i.value);
  input.focus();
  const dt = new DataTransfer();
  dt.setData('text', `Bandcamp: ${BC}${NL}Spotify: ${SP}`);
  input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}, { BC, SP });
await page.waitForFunction(n => [...document.querySelectorAll('#external-links-editor tr.external-link-item')]
  .map(r => { const a = r.querySelector('a.url'); if (a) return a.href; const i = r.querySelector('input[type=url]'); return (i && i.value) || ''; })
  .filter(Boolean).length >= n + 2, before, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);

const after = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#external-links-editor tr.external-link-item')];
  return rows.map(r => {
    const a = r.querySelector('a.url') || r.querySelector('input[type=url]');
    const sib = r.nextElementSibling;
    const sel = sib && sib.classList.contains('relationship-item') ? sib.querySelector('select.link-type') : null;
    const opt = sel && sel.selectedOptions[0];
    const url = a ? (a.href || a.value || '') : '';
    return { url: url || null, type: opt ? opt.textContent.trim() : (sel ? '(blank)' : null) };
  }).filter(x => x.url);
});
console.log('link rows after:');
after.forEach(r => console.log('   ' + (r.type || '—').padEnd(24) + r.url));
ck(after.length === before + 2, `both urls were added in one paste (${before} → ${after.length})`);
ck(after.some(r => r.url.includes('bandcamp.com')), 'the Bandcamp url is there');
ck(after.some(r => r.url.includes('open.spotify.com')), 'the Spotify url is there');

// #543 point 1: MB leaves Bandcamp's type blank; PC's table fills it.
const bc = after.find(r => r.url.includes('bandcamp.com'));
console.log('bandcamp row type: ' + JSON.stringify(bc && bc.type));
ck(bc && bc.type && bc.type !== '(blank)', 'the Bandcamp link type is set rather than left blank (which would block the editor\'s submit)');
ck(bc && /stream/i.test(bc.type), 'and it is the stream-for-free type PC prefers — ' + JSON.stringify(bc && bc.type));
// Spotify is one MB classifies itself; we must not have overridden it
const sp = after.find(r => r.url.includes('open.spotify.com'));
console.log('spotify row type : ' + JSON.stringify(sp && sp.type));
// When MB is sure of the type it renders NO <select.link-type> at all (there is
// nothing to choose), which reads as null here. The thing that must not happen
// is "(blank)": a required select left unfilled, which blocks the editor.
ck(sp && sp.type !== '(blank)', 'MusicBrainz\'s own choice for Spotify is left alone, not overridden or blanked');

console.log('POSTs seen: ' + JSON.stringify(posted));
ck(mbPosts().length === 0, `no edit was submitted (${mbPosts().length} POSTs, excluding MusicBrainz's own /__meb_verify beacon)`);
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
