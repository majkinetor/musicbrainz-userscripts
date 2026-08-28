// #547 (majkinetor): "Here, we show no links, and do not show aliases. I think
// we should be consistent and report only what is present, without those -
// placeholders as they are just spam." — with a screenshot of 41 queued
// recordings all reading "no links — —", one of them visibly carrying an alias
// chip in its own detail row. And: "We should also remove '0 links' from
// workers and write there whats it doing instead."
//
// Two separate surfaces, so two halves. Every case is driven through the real
// renderer on a real page and read back out of the DOM — never through a string
// helper that the shipped UI might not actually call.
//
// Read-only: nothing is submitted, and every POST is aborted and asserted at
// zero.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_deleteValue = k => s.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posted = [];
await page.route(() => true, route => {
  if (route.request().method() === 'POST') { posted.push(route.request().url()); return route.abort(); }
  return route.continue();
});

for (let a = 1; ; a++) {
  try { await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 4) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1200);
await page.addScriptTag({ content: code });
await page.waitForTimeout(600);
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 15000 });
await page.waitForTimeout(400);

/* ── half one: the queue row summary ───────────────────────────────────────
   His screenshot's exact case is `alias` — a row carrying an alias and nothing
   else, which summarised as "no links — —" while showing the alias chip right
   underneath it. */
const M = '00000000-0000-0000-0000-0000000000';
const mk = (n, over) => Object.assign({
  id: 'f' + n, entityType: 'recording', mbid: M + String(n).padStart(2, '0'), name: 'Row ' + n,
  urls: [], note: '', disambiguation: '', isrcs: [], video: false, aliases: [], cover: [],
  coverExistingCount: null, urlResults: null, status: 'queued', error: '',
}, over);

const cases = [
  ['empty', {}],
  ['alias', { aliases: [{ name: 'Affairs Of Today', locale: 'en', primary: true }] }],
  ['aliases x2', { aliases: [{ name: 'A' }, { name: 'B', locale: 'de' }] }],
  ['blank alias only', { aliases: [{ name: '   ' }] }],
  ['disambiguation', { disambiguation: 'live' }],
  ['isrc', { isrcs: ['USAB11200001'] }],
  ['isrcs x2', { isrcs: ['USAB11200001', 'USAB11200002'] }],
  ['video', { video: true }],
  ['alias + isrc + video', { aliases: [{ name: 'X' }], isrcs: ['USAB11200003'], video: true }],
  ['one link', { urls: [{ url: 'https://example.com/a', linkTypeId: null }] }],
  ['one link + alias', { urls: [{ url: 'https://example.com/a', linkTypeId: null }], aliases: [{ name: 'X' }] }],
  ['two links + alias', { urls: [{ url: 'https://example.com/a' }, { url: 'https://example.com/b' }], aliases: [{ name: 'X' }] }],
  ['cover', { entityType: 'release', cover: [{ url: 'https://example.com/c.jpg', candidates: [], type: 'Front', comment: '' }] }],
  ['cover, already has one', { entityType: 'release', coverExistingCount: 2, cover: [{ url: 'https://example.com/c.jpg', candidates: [], type: 'Front', comment: '' }] }],
];

const summaries = await page.evaluate((rows) => {
  const t = window.__falconTest;
  t.setQueue(rows.map(r => r.item));
  return [...document.querySelectorAll('#falcon-queue-list .falcon-row')].map(row => {
    // the summary is the flexible cell between the entity link and the status
    const cells = [...row.firstElementChild.children];
    const cell = cells.find(c => c.tagName === 'SPAN' && getComputedStyle(c).flexGrow === '1');
    return { text: cell ? cell.textContent.trim() : null, title: cell ? cell.getAttribute('title') || '' : null,
             italic: cell ? getComputedStyle(cell).fontStyle === 'italic' : false,
             link: cell ? !!cell.querySelector('a') : false };
  });
}, cases.map(([name, over], i) => ({ name, item: mk(i, over) })));

console.log('');
cases.forEach(([name], i) => console.log(`  ${name.padEnd(24)} -> ${JSON.stringify(summaries[i] && summaries[i].text)}`));
console.log('');

const at = n => summaries[cases.findIndex(c => c[0] === n)];
const allText = summaries.map(s => (s && s.text) || '').join(' | ');

ck(!/no links/i.test(allText), 'no row says "no links" any more');
ck(!/\u2014 \u2014/.test(allText), 'and the "— —" placeholder is gone');
ck(at('empty').text === '', 'a genuinely empty row says nothing at all');
ck(at('alias').text === 'alias', 'his exact case — an alias-only row now says "alias" — ' + JSON.stringify(at('alias').text));
ck(at('aliases x2').text === '2 aliases', 'and two of them are counted — ' + JSON.stringify(at('aliases x2').text));
ck(at('blank alias only').text === '', 'a whitespace-only alias is not something present (it is never submitted either)');
ck(at('disambiguation').text === 'disambiguation', 'disambiguation on its own');
ck(at('isrc').text === 'ISRC', 'one ISRC');
ck(at('isrcs x2').text === '2 ISRCs', 'two ISRCs are counted — ' + JSON.stringify(at('isrcs x2').text));
ck(at('video').text === 'video', 'video — which the summary never mentioned before');
ck(at('alias + isrc + video').text === 'ISRC + video + alias', 'and they combine in a fixed order — ' + JSON.stringify(at('alias + isrc + video').text));
ck(at('one link').link && /example\.com\/a/.test(at('one link').text), 'a single link is still shown as the link itself');
ck(/\+ alias/.test(at('one link + alias').text), 'with its extras appended — ' + JSON.stringify(at('one link + alias').text));
ck(at('two links + alias').text === '2 links + alias', 'and several links collapse to a count — ' + JSON.stringify(at('two links + alias').text));
ck(at('cover').text === 'cover', 'a cover-only release row says "cover"');
ck(at('cover, already has one').text === 'cover \u26a0', 'flagged when the release already has cover art — ' + JSON.stringify(at('cover, already has one').text));
ck(/already has 2 cover images/.test(at('cover, already has one').title || ''), 'and the warning still explains itself on hover — ' + JSON.stringify(at('cover, already has one').title));
ck(!summaries.some(s => s.italic), 'nothing is rendered in the old greyed-out italic "nothing here" style');

/* ── half two: the worker card header ───────────────────────────────────── */
const phases = await page.evaluate(() => {
  const t = window.__falconTest;
  const card = t.spawnWorkerCard();
  const read = () => card.querySelector('.falcon-worker-lbl').textContent;
  const item = { id: 'w1', entityType: 'recording', mbid: 'x', name: 'Gitari na congo', urls: [], aliases: [], cover: [], isrcs: [], status: 'active', error: '' };
  const seen = {};
  t.updateWorkerLabel(card, item, 'loading edit page'); seen.load = read();
  t.workerPhase(card, 'waiting for the seeded rows'); seen.settle = read();
  t.workerPhase(card, 'filling and submitting the edit'); seen.fill = read();
  t.workerPhase(card, 'alias 2 of 3'); seen.alias = read();
  t.updateWorkerLabel(card, null); seen.idle = read();
  // a retired card must keep its last state, and a late callback must not
  // resurrect it — that is what the guard in workerPhase is for
  t.updateWorkerLabel(card, item, 'cover art');
  const frozen = read();
  card.dataset.retired = '1';
  t.workerPhase(card, 'this must not appear');
  seen.retired = read(); seen.frozenWas = frozen;
  return seen;
});
console.log('');
console.log('worker header: ' + JSON.stringify(phases, null, 1));

ck(!/link\(s\)/.test(Object.values(phases).join(' ')), 'the worker header never says "0 link(s)" again');
ck(phases.load === 'Gitari na congo \u2014 loading edit page', 'it says what the worker is doing — ' + JSON.stringify(phases.load));
ck(phases.settle === 'Gitari na congo \u2014 waiting for the seeded rows', 'and follows it through the run');
ck(phases.fill === 'Gitari na congo \u2014 filling and submitting the edit', 'through the submit');
ck(phases.alias === 'Gitari na congo \u2014 alias 2 of 3', 'counting aliases as they go — ' + JSON.stringify(phases.alias));
ck(phases.idle === 'idle', 'and goes back to idle when the item is done');
ck(phases.retired === phases.frozenWas, 'a retired card keeps its frozen label — a late phase callback cannot overwrite it');

console.log('');
console.log('POSTs: ' + JSON.stringify(posted.filter(u => /musicbrainz/.test(u))));
ck(posted.filter(u => /musicbrainz/.test(u)).length === 0, 'nothing was submitted');
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
