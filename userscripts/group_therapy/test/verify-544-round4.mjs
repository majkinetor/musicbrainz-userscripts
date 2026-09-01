// #544 round 4 (majkinetor), four text-parser UX items:
//
//   1. right-clicking (+) closes the search popup at once and marks the row
//      "creating …", which resolves to the entity when the background tab
//      commits — so a run of names can be fired off without babysitting tabs
//   2. a disambiguation in the search results must not read as part of the name
//   3. the entity popup sat on the viewport edge, under the scrollbar
//   4. the role picker's ✕ was glued to the title instead of the top right
//
// Runs against test.musicbrainz.org and never submits: every POST to /edit is
// aborted and asserted zero. GM_openInTab is mocked, so item 1's "background
// tab" is simulated by posting the create's own token back over the same
// BroadcastChannel the real created page uses — no entity is created here.
// (live-544-background-tab-closes.mjs already proves the real round trip.)
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'group_therapy.user.js'), 'utf8');
const SHOTS = resolve(HERE, 'logs'); await mkdir(SHOTS, { recursive: true });

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const NL = String.fromCharCode(10);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1100 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_openInTab = (u, o) => { window.__gtOpened = { u, o }; window.__gtClosed = false; return { close() { window.__gtClosed = true; }, closed: false }; };
  window.GM_info = { script: { name: 'Group Therapy', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
for (let a = 1; ; a++) {
  try { await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 4) throw e; console.log('goto retry ' + a); await page.waitForTimeout(5000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4500);
let posts = 0;
await page.route(() => true, route => {
  const r = route.request();
  if (r.method() === 'POST' && /\/edit/.test(r.url())) { posts++; return route.abort(); }
  return route.continue();
});
await page.addScriptTag({ content: code });
await page.waitForTimeout(800);

const openParser = async () => {
  if (await page.locator('.gt-tp').count()) return;
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /text parser/i.test(x.textContent || ''));
    if (b) b.click();
  });
  await page.waitForSelector('.gt-tp', { timeout: 15000 });
  await page.waitForTimeout(400);
};
const setText = async (text, pat) => {
  await page.evaluate(({ text, pat }) => {
    const ta = document.querySelector('.gt-tp textarea');
    if (ta) { ta.value = text; ta.dispatchEvent(new Event('input', { bubbles: true })); }
    const p = document.querySelector('.gt-tp-pat');
    if (p) { p.value = pat; p.dispatchEvent(new Event('input', { bubbles: true })); }
  }, { text, pat });
  await page.waitForTimeout(800);
};
// open the entity picker on the Nth row (0-based)
const openEntityPicker = async (n) => page.evaluate(i => {
  const rows = [...document.querySelectorAll('.gt-tp-tbl tbody tr')];
  const btns = [...rows[i].querySelectorAll('button.gt-tp-search')];
  const b = btns[btns.length - 1];
  if (!b) return false;
  b.click(); return true;
}, n);
// Dismissing a popover installs a one-shot capture handler that SWALLOWS the
// next click (#305, so dismissing can't activate what's underneath). A test that
// dismisses and then clicks would have that click eaten — spend it on a dummy.
const dismissPopover = async () => {
  await page.evaluate(async () => {
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));   // eaten by the swallower
    await new Promise(r => setTimeout(r, 150));
  });
};

await openParser();

// ── 1. background create: popup closes, row says "creating …", then resolves ──
// TWO lines share the same unresolvable name, to prove the resolution is bulk:
// "creating…" must appear on both, and both must flip together.
const NAME = 'Zzq Unresolvable Person Xyzzy';
await setText(`Producer: ${NAME}${NL}Mixer: ${NAME}${NL}Guitar: Someone Else Entirely`, 'R: E');
ck(await openEntityPicker(0), 'an unresolved row offers an entity search button');
await page.waitForSelector('.gt-tp-apop', { timeout: 8000 }).catch(() => {});
ck(await page.locator('.gt-tp-apop').count() > 0, 'the entity picker opens (otherwise nothing below proves anything)');

const afterRightClick = await page.evaluate(async () => {
  const plus = document.querySelector('.gt-tp-plus');
  plus.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 400));
  return {
    popupOpen: !!document.querySelector('.gt-tp-apop'),
    opened: window.__gtOpened ? window.__gtOpened.u : null,
    active: window.__gtOpened ? window.__gtOpened.o.active : null,
    creating: [...document.querySelectorAll('.gt-tp-creating')].map(e => e.textContent.trim()),
    // one line or two: the label used to wrap in the narrow entity column.
    // Measured by HEIGHT vs line-height — a Range over an inline-block with
    // overflow:hidden reports its clipped rects, not how many lines were drawn.
    creatingLines: (() => {
      const e = document.querySelector('.gt-tp-creating');
      if (!e) return 0;
      const lh = parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.2;
      return Math.max(1, Math.round(e.getBoundingClientRect().height / lh));
    })(),
    rows: [...document.querySelectorAll('.gt-tp-tbl tbody tr')].map(r => (r.innerText || '').replace(/\s+/g, ' ').trim()),
  };
});
console.log('after right-click +: ' + JSON.stringify({ popupOpen: afterRightClick.popupOpen, active: afterRightClick.active, creating: afterRightClick.creating }));
ck(!!afterRightClick.opened && afterRightClick.active === false, 'right-click + still opens the create tab in the background');
ck(!afterRightClick.popupOpen, '#1: the search popup closes immediately — no waiting on the tab');
ck(afterRightClick.creating.length === 2, 'and BOTH rows with that name say "creating…" (' + afterRightClick.creating.length + ')');
ck(/^creating\s*“Zzq/i.test(afterRightClick.creating[0] || ''), 'the placeholder names what is being created — ' + JSON.stringify(afterRightClick.creating[0] || ''));
ck(afterRightClick.creatingLines === 1, 'and fits on one line in the narrow entity column (' + afterRightClick.creatingLines + ')');
ck(!/creating/i.test(afterRightClick.rows[2] || ''), 'the unrelated third row is untouched');
await page.locator('.gt-tp').screenshot({ path: resolve(SHOTS, 'i544r4-creating.png') }).catch(() => {});

// meanwhile the parser must still be usable — that is the entire point
ck(await openEntityPicker(2), 'another row can be worked on while the create is in flight');
await page.waitForTimeout(400);
ck(await page.locator('.gt-tp-apop').count() > 0, 'its picker opens normally');
await dismissPopover();

// now let the "background tab" report the created MBID, exactly as the real
// created page does: same channel, the token out of the create URL it opened.
const resolved = await page.evaluate(async ({ gid }) => {
  const u = new URL(window.__gtOpened.u, location.origin);
  const token = u.searchParams.get('x_gtcreate');
  const ch = new BroadcastChannel('gt-entity-created');
  ch.postMessage({ token, kind: 'artist', gid });
  for (let i = 0; i < 80 && document.querySelector('.gt-tp-creating'); i++) await new Promise(r => setTimeout(r, 100));
  return {
    token,
    stillCreating: document.querySelectorAll('.gt-tp-creating').length,
    tabClosed: window.__gtClosed === true,
    rows: [...document.querySelectorAll('.gt-tp-tbl tbody tr')].map(r => (r.innerText || '').replace(/\s+/g, ' ').trim()),
  };
}, { gid: '82ca9599-5a15-4ff5-90d5-59ac8afaf5c7' });
console.log('after the tab reports back: ' + JSON.stringify({ stillCreating: resolved.stillCreating, tabClosed: resolved.tabClosed, rows: resolved.rows.slice(0, 2) }));
ck(!!resolved.token, 'the create URL carried a token to answer on');
ck(resolved.stillCreating === 0, '#1: "creating…" clears once the entity lands');
ck(resolved.tabClosed, 'and the opener closes the background tab');
ck(/もちこまめ/.test(resolved.rows[0] || '') && /もちこまめ/.test(resolved.rows[1] || ''),
  'BOTH rows resolved to the new entity, not just the one the picker was opened from');

// ── 2. disambiguation is styled apart from the name ─────────────────────────
await setText(`Producer: Fiona${NL}Guitar: Someone Else Entirely`, 'R: E');
ck(await openEntityPicker(0), 'the picker reopens for the disambiguation check');
await page.waitForSelector('.gt-tp-apop', { timeout: 8000 }).catch(() => {});
await page.evaluate(() => { const q = document.querySelector('.gt-tp-q'); q.value = 'Fiona'; q.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForFunction(() => document.querySelectorAll('.gt-tp-apop .gt-tp-res').length > 0, null, { timeout: 20000 }).catch(() => {});
const disamb = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.gt-tp-apop .gt-tp-res')];
  const withD = rows.find(r => r.querySelector('.gt-tp-disamb'));
  if (!withD) return { none: true, rows: rows.length };
  const n = withD.querySelector('.gt-tp-resname'), d = withD.querySelector('.gt-tp-disamb');
  const cs = e => { const s = getComputedStyle(e); return { size: s.fontSize, style: s.fontStyle, color: s.color, weight: s.fontWeight }; };
  return { none: false, rows: rows.length, name: n.textContent, disamb: d.textContent, nameCss: cs(n), disambCss: cs(d) };
});
console.log('disambiguation: ' + JSON.stringify(disamb));
ck(!disamb.none, 'at least one result carries a disambiguation (' + disamb.rows + ' results)');
if (!disamb.none) {
  ck(!/\(/.test(disamb.name), '#2: the name element holds ONLY the name — ' + JSON.stringify(disamb.name));
  ck(disamb.disambCss.style === 'italic', 'the disambiguation is italic and the name is not (' + disamb.nameCss.style + ')');
  ck(disamb.disambCss.color !== disamb.nameCss.color, 'and a different colour');
  ck(parseFloat(disamb.disambCss.size) < parseFloat(disamb.nameCss.size), 'and smaller (' + disamb.disambCss.size + ' vs ' + disamb.nameCss.size + ')');
}
await page.locator('.gt-tp-apop').screenshot({ path: resolve(SHOTS, 'i544r4-disamb.png') }).catch(() => {});

// ── 3. the popup must not sit under the scrollbar ───────────────────────────
// The reported case is a maximized parser in a window that HAS a classic
// scrollbar: the anchor sits hard against the right edge, and the old clamp
// measured against window.innerWidth, which includes the scrollbar.
//
// ⚠ Headless Chromium always reports a ZERO-width scrollbar (overlay
// scrollbars; --disable-features=OverlayScrollbar and ::-webkit-scrollbar both
// measured 0), so the scrollbar cannot simply be created here. It is emulated
// further down by overriding clientWidth — which tests the thing that actually
// changed: that the clamp reads clientWidth and not innerWidth.
await dismissPopover();
await page.setViewportSize({ width: 900, height: 800 });
await page.waitForTimeout(400);
const geo = await page.evaluate(async () => {
  const mx = [...document.querySelectorAll('.gt-tp .gt-cons-x')].find(b => b.textContent.includes('⛶'));
  if (mx) mx.click();                                        // maximize → entity column against the right edge
  await new Promise(r => setTimeout(r, 500));
  const rows = [...document.querySelectorAll('.gt-tp-tbl tbody tr')];
  const btns = [...rows[1].querySelectorAll('button.gt-tp-search')];
  const anchorBtn = btns[btns.length - 1];
  anchorBtn.click();
  await new Promise(r => setTimeout(r, 900));
  const pop = document.querySelector('.gt-tp-apop');
  if (!pop) return { missing: true };
  const p = pop.getBoundingClientRect(), anchor = anchorBtn.getBoundingClientRect();
  const clientW = document.documentElement.clientWidth;
  return {
    missing: false,
    popLeft: Math.round(p.left), popRight: Math.round(p.right), popTop: Math.round(p.top), popBottom: Math.round(p.bottom), popW: Math.round(p.width),
    anchorLeft: Math.round(anchor.left), anchorRight: Math.round(anchor.right),
    clientW, clientH: document.documentElement.clientHeight,
    innerW: window.innerWidth, scrollbar: window.innerWidth - clientW,
  };
});
console.log('popup geometry: ' + JSON.stringify(geo));
ck(!geo.missing, 'the popup opened with the parser maximized');
if (!geo.missing) {
  ck(geo.anchorLeft > geo.clientW * 0.5, 'the anchor really is in the right half — the reported case (' + geo.anchorLeft + ' of ' + geo.clientW + ')');
  ck(geo.popRight <= geo.clientW - 12, '#3: the popup keeps a visible gap from the right edge (' + (geo.clientW - geo.popRight) + 'px)');
  ck(geo.popRight <= geo.anchorRight + 2, 'it right-aligns to the anchor rather than overflowing past it');
  ck(geo.popLeft >= 12 && geo.popTop >= 12, 'it is clear of the top and left edges too');
  ck(geo.popBottom <= geo.clientH, 'and does not run off the bottom');
}
// The scrollbar half of the fix, emulated: make clientWidth 15px narrower than
// innerWidth (what a classic scrollbar does) and re-trigger a reposition. The
// old clamp used innerWidth, so it would place the popup INSIDE that 15px strip;
// the new one must stay clear of it.
const sb = await page.evaluate(async () => {
  const SB = 15, inner = window.innerWidth;
  Object.defineProperty(document.documentElement, 'clientWidth', { get: () => inner - SB, configurable: true });
  const q = document.querySelector('.gt-tp-q');
  q.value = 'Fio'; q.dispatchEvent(new Event('input', { bubbles: true }));   // any input re-runs reposition
  await new Promise(r => setTimeout(r, 2500));
  const pop = document.querySelector('.gt-tp-apop');
  const p = pop.getBoundingClientRect();
  const anchor = document.querySelector('.gt-tp-tbl tbody tr:nth-child(2) button.gt-tp-search');
  const ar = anchor ? anchor.getBoundingClientRect() : null;
  const out = {
    popRight: Math.round(p.right), popW: Math.round(p.width), inner, clientW: document.documentElement.clientWidth,
    // what the OLD clamp (innerWidth, 8px margin) would have produced
    oldRight: Math.round(Math.min(ar ? ar.left : 0, inner - p.width - 8) + p.width),
  };
  delete document.documentElement.clientWidth;
  return out;
});
console.log('with a 15px scrollbar emulated: ' + JSON.stringify(sb));
ck(sb.clientW === sb.inner - 15, 'clientWidth really was narrowed (' + sb.clientW + ' vs innerWidth ' + sb.inner + ')');
ck(sb.oldRight > sb.clientW, 'the OLD clamp would have run under that scrollbar (' + sb.oldRight + ' > ' + sb.clientW + ') — so this is not a vacuous check');
ck(sb.popRight <= sb.clientW - 12, '#3: the new clamp stays clear of it (' + sb.popRight + ' ≤ ' + (sb.clientW - 12) + ')');
await page.screenshot({ path: resolve(SHOTS, 'i544r4-popup-pos.png') }).catch(() => {});

// ── 4. the role picker's ✕ sits top-right ───────────────────────────────────
await dismissPopover();
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.gt-tp-tbl tbody tr')];
  const b = [...rows[1].querySelectorAll('button.gt-tp-search')][0];
  if (b) b.click();
});
await page.waitForSelector('.gt-role-pick', { timeout: 8000 }).catch(() => {});
const xGeo = await page.evaluate(() => {
  const hdr = document.querySelector('.gt-role-pick .gt-cons-hdr');
  if (!hdr) return { missing: true };
  const x = hdr.querySelector('.gt-cons-x'), title = hdr.querySelector('.gt-cons-title');
  if (!x || !title) return { missing: true, why: 'no ✕ or no titled span' };
  const h = hdr.getBoundingClientRect(), xr = x.getBoundingClientRect(), t = title.getBoundingClientRect();
  // the ✕ is pushed right by the title span's `flex:1` — so what proves the fix
  // is that the title BOX spans the header (it used to be shrink-to-fit, leaving
  // the ✕ glued to the end of the words), and the ✕ ends up at the right edge.
  // scrollWidth on a flex:1 span is its own box width, not the text's — measure
  // the text itself with a Range, or the comparison below is width vs width.
  const rng = document.createRange(); rng.selectNodeContents(title);
  const textW = Math.round(rng.getBoundingClientRect().width);
  return { missing: false, gapToRight: Math.round(h.right - xr.right), titleBoxW: Math.round(t.width), titleTextW: textW, hdrW: Math.round(h.width) };
});
console.log('role picker ✕: ' + JSON.stringify(xGeo));
ck(!xGeo.missing, 'the role picker header has a titled span and a ✕');
if (!xGeo.missing) {
  ck(xGeo.gapToRight <= 20, '#4: the ✕ is pinned to the right edge of the header (' + xGeo.gapToRight + 'px from it)');
  ck(xGeo.titleBoxW > xGeo.hdrW * 0.6, 'the title span now spans the header rather than shrink-wrapping (' + xGeo.titleBoxW + ' of ' + xGeo.hdrW + 'px)');
  ck(xGeo.titleBoxW > xGeo.titleTextW + 40, 'so the ✕ is well clear of the title text (' + xGeo.titleTextW + 'px of text in a ' + xGeo.titleBoxW + 'px box)');
}
await page.locator('.gt-role-pick').screenshot({ path: resolve(SHOTS, 'i544r4-rolex.png') }).catch(() => {});

ck(posts === 0, 'nothing was submitted (' + posts + ' POSTs to /edit)');
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
console.log(fail ? `FAIL (${fail})` : 'PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
