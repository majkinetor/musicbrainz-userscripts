// #554 (vzell, part 2): "Maybe even automatically paste the URL directly when
// it's not malformed and in the clipboard when clicking the 'By URL' link"
//
// majkinetor declined it, asked for it, then corrected its shape three times.
// The final word: "CTRL v works, but button not - it should work the same as
// doing CTRL v but with the click. It now opens an edit box and shows the
// message to use ctrl v. So, make paste URL behave the same as CTRL v and
// remove edit as nobody will type URL."
//
// So there is no input anywhere any more, and two ways in that do the same
// thing: Ctrl+V on the gallery, and the "Paste URL" button.
//
// Chromium can actually grant clipboard-read, so this drives the real API rather
// than a stub. Nothing is ever uploaded: every write endpoint is asserted unused.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.AS_SRC || resolve(HERE, '..', 'art_station.user.js'), 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const RELEASE = 'https://musicbrainz.org/release/55530bc0-97ec-4256-97fc-e6058958c251/cover-art';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: !process.argv.includes('--headed'), viewport: { width: 1500, height: 1000 },
});
await ctx.grantPermissions(['clipboard-write'], { origin: 'https://musicbrainz.org' });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posted = [];
const allPosts = [];
page.on('request', r => {
  if (r.method() !== 'POST' && r.method() !== 'PUT') return;
  allPosts.push(r.method() + ' ' + r.url());
  /* ⚠ Only WRITES count. A first version counted every POST and reported 2
     "uploads" that were MusicBrainz's own telemetry — the same mistake the #566
     fixture made when it counted cover-art thumbnails as uploads. */
  if (/\/ws\/2\/|\/cover-art-archive\/|archive\.org|\/edit\/|\/ws\/js\/edit/i.test(r.url())) posted.push(r.method() + ' ' + r.url());
});

await page.goto(RELEASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.addScriptTag({ content: code });
const booted = await page.waitForSelector('.as-src', { timeout: 25000 }).then(() => true).catch(() => false);
ck(booted, 'fixture: Art Station mounted its toolbar (otherwise nothing below means anything)');
if (!booted) { await ctx.close(); console.log(`\n${fail} FAILED`); process.exit(1); }

const setClip = t => page.evaluate(v => navigator.clipboard.writeText(v), t);
// open the Source popover, press "Paste URL", and report what that ONE click did.
// `.as-src-url-inp` no longer exists — the lookups for it stay so the checks can
// assert its ABSENCE rather than silently passing on a selector that matches
// nothing either way.
const pressPasteUrl = async () => {
  await page.evaluate(() => { document.querySelectorAll('.as-pop').forEach(p => p.remove()); if (window.__asTest) window.__asTest.lastSource = null; });
  await page.click('.as-src');
  await page.waitForSelector('.as-src-url-btn', { timeout: 10000 });
  const label = await page.evaluate(() => document.querySelector('.as-src-url-btn').textContent.trim());
  await page.click('.as-src-url-btn');
  await page.waitForTimeout(900);           // the clipboard read is async
  return page.evaluate((lbl) => {
    const i = document.querySelector('.as-src-url-inp');
    return {
      label: lbl,
      popoverGone: !document.querySelector('.as-src-pop'),
      boxShown: !!document.querySelector('.as-src-hd.open'),
      value: i ? i.value : null,
      focused: !!i && document.activeElement === i,
      sourced: (window.__asTest && window.__asTest.lastSource) || null,
    };
  }, label);
};

/* ── 1. the button is Ctrl+V with a click ──────────────────────────────────
   majkinetor: "it should work the same as doing CTRL v but with the click…
   remove edit as nobody will type URL". So: no box anywhere, and the click
   imports. */
ck(!/as-src-url-inp/.test(code), 'the URL input is gone from the markup');
ck(!/class="as-src-url-inp"/.test(code) && !/\.as-src-url-inp\{/.test(code),
  'and so is its styling — nothing is left to unroll');

await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://musicbrainz.org' });
const URL1 = 'https://www.example.com/artwork/front-3000.jpg';
await setClip(URL1);
const r1 = await pressPasteUrl();
console.log('\nclick with a URL on the clipboard →', JSON.stringify(r1));
ck(r1.label === 'Paste URL', `the control is called "Paste URL" (${JSON.stringify(r1.label)})`);
ck(r1.sourced === URL1, `one click imports the clipboard URL (${JSON.stringify(r1.sourced)})`);
ck(r1.popoverGone, 'the panel closes — nothing is left on screen');
ck(!r1.boxShown && r1.value === null, 'and no box is shown at any point');

/* ── 2. Ctrl+V does the same, including while the panel is open ────────────
   The box that used to catch a paste inside the panel is gone, so the
   page-level handler has to cover that case now. */
const anywhere = await page.evaluate(async () => {
  document.querySelectorAll('.as-pop').forEach(p => p.remove());
  if (window.__asTest) window.__asTest.lastSource = null;
  const dt = new DataTransfer();
  dt.setData('text', 'https://www.example.com/anywhere.jpg');
  document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 350));
  return (window.__asTest && window.__asTest.lastSource) || null;
});
ck(anywhere === 'https://www.example.com/anywhere.jpg', `Ctrl+V on the gallery imports (${JSON.stringify(anywhere)})`);

const withPanel = await page.evaluate(async () => {
  if (window.__asTest) window.__asTest.lastSource = null;
  document.querySelector('.as-src').click();
  await new Promise(r => setTimeout(r, 500));
  const hadPanel = !!document.querySelector('.as-src-pop');
  const dt = new DataTransfer();
  dt.setData('text', 'https://www.example.com/with-panel.jpg');
  document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 350));
  return { hadPanel, sourced: (window.__asTest && window.__asTest.lastSource) || null, panelGone: !document.querySelector('.as-src-pop') };
});
ck(withPanel.hadPanel, 'fixture: the source panel was open');
ck(withPanel.sourced === 'https://www.example.com/with-panel.jpg',
  `Ctrl+V works with the panel open too (${JSON.stringify(withPanel.sourced)})`);
ck(withPanel.panelGone, 'and the panel closes behind it');

// …but a paste aimed at a real field is still left alone
const notStolen = await page.evaluate(async () => {
  if (window.__asTest) window.__asTest.lastSource = null;
  const inp = document.createElement('input');
  document.body.appendChild(inp); inp.focus();
  const dt = new DataTransfer();
  dt.setData('text', 'https://www.example.com/typed-into-a-field.jpg');
  inp.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 300));
  const v = (window.__asTest && window.__asTest.lastSource) || null;
  inp.remove();
  return v;
});
ck(notStolen === null, `a paste aimed at some other input is left alone (${JSON.stringify(notStolen)})`);

/* ── 3. nothing usable → nothing happens, and it says so ───────────────────── */
for (const [what, clip] of [
  ['plain text', 'Psych Funk Sa-Re-Ga!'],
  ['a non-http scheme', 'javascript:alert(1)'],
]) {
  await setClip(clip);
  const r = await pressPasteUrl();
  ck(r.sourced === null, `${what}: starts no import`);
  ck(!r.boxShown, `${what}: and still shows no box — it is a toast, not a form`);
}

ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
console.log('\nPOSTs seen:', allPosts.length, '- writes among them:', posted.length);
if (allPosts.length) console.log('  ' + allPosts.slice(0, 4).map(u => u.slice(0, 110)).join('\n  '));
ck(posted.length === 0, `nothing was uploaded or submitted at any point (${posted.length})`);
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
