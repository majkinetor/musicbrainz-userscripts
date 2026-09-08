// #566 follow-up (majkinetor, with a screenshot): "The message doesn't fit and
// moves buttons around. Set it as a window footer. Also, change defaults to
// 10/10 and enable the option by default."
//
// His screenshot shows the auto-repeat line sharing the button row: clipped to
// "… 1 fail…", with "Dry run" and "Make votable" pushed onto two lines each,
// which moved Close and Repeat sideways — under a pointer already on its way to
// them. So two things are checked here.
//
// LAYOUT — the note now has its own row under the buttons:
//   · it is not inside .as-cm-f any more;
//   · a long message is not clipped;
//   · and showing it does not move the buttons, which is the actual complaint.
//
// DEFAULTS — 10/10 and on. Raising the defaults alone would reach nobody who
// already has settings stored (save() persists every key), so the migration is
// checked too: old values move, deliberate ones survive.
//
// Nothing is uploaded and no edit is created: every POST is aborted.
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.AS_SRC || resolve(HERE, '..', 'art_station.user.js');
const code = await readFile(SRC, 'utf8');
const SHOTS = resolve(HERE, 'logs'); await mkdir(SHOTS, { recursive: true });
const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// One browser per stored-settings scenario: the migration runs once, at load.
async function withStored(seed, fn) {
  const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
    { headless: !process.argv.includes('--headed'), viewport: { width: 1500, height: 1000 } });
  await ctx.addInitScript(s => {
    const store = new Map(s ? [['artstation:settings', JSON.stringify(s)]] : []);
    window.__gmStore = store;
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_info = { script: { name: 'Art Station', version: 't' } };
  }, seed);
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const posted = [];
  await page.route(() => true, r => (r.request().method() === 'POST' ? (posted.push(r.request().url()), r.abort()) : r.continue()));
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/add-cover-art`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForSelector('#as-root', { state: 'attached', timeout: 20000 }).catch(() => {});
  await page.addScriptTag({ content: code });
  await page.waitForSelector('#as-root', { state: 'attached', timeout: 20000 });
  await page.waitForTimeout(700);
  const out = await fn(page, errs, posted);
  await ctx.close();
  return out;
}

const readSettings = page => page.evaluate(() => {
  const raw = window.__gmStore.get('artstation:settings');
  return raw ? JSON.parse(raw) : null;
});
const readPanel = async page => {
  await page.click('#as-setup-btn');
  await page.waitForSelector('#as-setup', { timeout: 5000 });
  return page.evaluate(() => ({
    checked: document.querySelector('.as-setup-autorepeat').checked,
    min: document.querySelector('.as-setup-ar-min').value,
    times: document.querySelector('.as-setup-ar-times').value,
  }));
};

// ── 1. a fresh install ──────────────────────────────────────────────────────
console.log('--- fresh install ---');
await withStored(null, async page => {
  const p = await readPanel(page);
  ck(p.checked === true, `on by default (checkbox ${p.checked})`);
  ck(p.min === '10' && p.times === '10', `N=M=10 by default (got ${p.min}/${p.times})`);
});

// ── 2. someone who already has the old defaults stored ──────────────────────
console.log('--- stored old defaults (the case a default change cannot reach) ---');
await withStored({ autoRepeat: false, autoRepeatMin: 20, autoRepeatTimes: 20, tile: 200 }, async page => {
  const p = await readPanel(page);
  ck(p.checked === true, `migrated to on (checkbox ${p.checked})`);
  ck(p.min === '10' && p.times === '10', `migrated to 10/10 (got ${p.min}/${p.times})`);
  const s = await readSettings(page);
  ck(s && s.autoRepeatMin === 10 && s.autoRepeat === true, 'and the migration is persisted, not just displayed');
  ck(s && s.tile === 200, 'while unrelated settings are left alone');
});

// ── 3. someone who chose their own numbers ──────────────────────────────────
console.log('--- stored deliberate values ---');
await withStored({ autoRepeat: true, autoRepeatMin: 30, autoRepeatTimes: 7 }, async page => {
  const p = await readPanel(page);
  ck(p.min === '30' && p.times === '7', `a deliberate 30/7 survives the migration (got ${p.min}/${p.times})`);
});

// ── 4. the layout complaint ─────────────────────────────────────────────────
console.log('--- commit window footer ---');
await withStored(null, async (page, errs, posted) => {
  // Stage a file and open the commit window. The note's own text does not matter
  // here — what is under test is where it sits and what it does to the buttons —
  // so it is shown directly rather than by failing a real upload, which
  // verify-566 already covers end to end.
  const opened = await page.evaluate(async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
    const dt = new DataTransfer(); dt.items.add(new File([png], 'footer-probe.png', { type: 'image/png' }));
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 100)); if (!document.querySelector('.as-commit')?.disabled) break; }
    document.querySelector('.as-commit').click();
    for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 100)); if (document.querySelector('#as-commit .as-cm-ar')) return true; }
    return false;
  });
  ck(opened, 'fixture: the commit window opened and carries an auto-repeat slot');
  if (!opened) return;

  const geom = await page.evaluate(() => {
    const q = s => document.querySelector(s);
    const el = q('#as-commit .as-cm-ar'), row = q('#as-commit .as-cm-f');
    const box = b => { const r = b.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const btns = () => [...document.querySelectorAll('#as-commit .as-cm-f .as-btn')].map(box);
    const labels = () => [...document.querySelectorAll('#as-commit .as-cm-f label')].map(box);
    const before = { btns: btns(), labels: labels(), rowH: box(row).h };
    // The longest thing it ever says, from arSchedule's own template, shown the
    // way arNote shows it.
    el.className = 'as-cm-ar on';
    el.textContent = 'Auto-repeat: attempt 10/10 in 1m00s · 9m48s of 10m used · 12 failing';
    const after = { btns: btns(), labels: labels(), rowH: box(row).h };
    return {
      insideRow: row.contains(el),
      clipped: el.scrollWidth > el.clientWidth + 1,
      noteBelow: box(el).y >= box(row).y + box(row).h - 1,
      before, after,
    };
  });
  ck(!geom.insideRow, 'the note is no longer a child of the button row');
  ck(geom.noteBelow, 'it sits below the buttons, as its own window footer');
  ck(!geom.clipped, 'a full-length message is not clipped');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ck(same(geom.before.btns, geom.after.btns),
    'showing it does not move the buttons\n      before ' + JSON.stringify(geom.before.btns) + '\n      after  ' + JSON.stringify(geom.after.btns));
  ck(same(geom.before.labels, geom.after.labels), 'and does not reflow the Dry run / Make votable labels onto two lines');
  await page.locator('#as-commit .as-cm-box').screenshot({ path: resolve(SHOTS, 'i566b-footer.png') }).catch(() => {});
  ck(!posted.some(u => /ws\/js\/edit\/create/.test(u)), `no edit was submitted (${posted.length} POST(s), all aborted)`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
});

console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
