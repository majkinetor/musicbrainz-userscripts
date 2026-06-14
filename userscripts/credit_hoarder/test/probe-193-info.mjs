// Probe #193 — Tidal release-level "Additional Credits" (Info tab).
// African Space Craft has EMPTY per-track credits; everything is release-level.
// Render tidal.com/album/<id>/credits anonymously, dump both the Credits-tab
// album-level section and the Info-tab "Additional Credits": role labels,
// names, and whether each name links to /artist/<id> (resolution quality).

import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE   = dirname(fileURLToPath(import.meta.url));
const ALBUM  = process.argv.find(a => /^\d+$/.test(a)) || '73397990';
const HEADED = process.argv.includes('--headed');
const LOG_DIR = resolve(HERE, 'logs', '193-info');
const log = (...a) => console.log('[probe-193]', ...a);

async function dumpTab(page, label) {
  return await page.evaluate(() => {
    const txt = el => (el?.getAttribute?.('title') || el?.textContent || '').trim();
    // Generic credit-block scan: a "role" label (data-uppercase or all-caps
    // small label) followed by name(s). Capture surrounding structure.
    const out = { blocks: [], sampleHtml: '' };
    // Find uppercase role labels anywhere on the page.
    const labels = [...document.querySelectorAll('[data-uppercase]')];
    for (const lab of labels) {
      const role = txt(lab);
      if (!role) continue;
      // climb to a reasonable container, then collect anchors / name nodes after the label
      let box = lab.parentElement;
      for (let i = 0; i < 3 && box && box.querySelectorAll('a,[title]').length === 0; i++) box = box.parentElement;
      const scope = box || lab.parentElement;
      const anchors = [...scope.querySelectorAll('a')].map(a => ({
        text: txt(a), href: a.getAttribute('href') || '',
        artistId: (a.getAttribute('href') || '').match(/\/artist\/(\d+)/)?.[1] || null,
      }));
      const titled = [...scope.querySelectorAll('[title]')].map(e => txt(e)).filter(Boolean);
      out.blocks.push({ role, anchors, titled, scopeTag: scope.tagName, scopeClass: scope.className });
    }
    out.sampleHtml = (document.querySelector('[data-uppercase]')?.closest('section,div[class]')?.outerHTML || '').slice(0, 2000);
    return out;
  });
}

async function main() {
  await mkdir(LOG_DIR, { recursive: true });
  const ctx = await chromium.launchPersistentContext(resolve(LOG_DIR, 'ctx'), {
    headless: !HEADED, viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 1,
    locale: 'en-US', extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') log('console.error', m.text()); });

  const url = `https://tidal.com/album/${ALBUM}/credits`;
  log('goto', url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  try { await page.waitForSelector('[data-test="album-info-item"],[data-uppercase]', { timeout: 30000 }); }
  catch { log('nothing rendered (login wall? geo?)'); }
  await page.waitForTimeout(2000);

  // Dismiss cookie consent (localized) — click any accept-ish button.
  try {
    const btn = page.locator('button', { hasText: /Accept|Prihvati|Prihvať|Agree|Slažem/i }).first();
    if (await btn.count()) { await btn.click({ timeout: 4000 }); log('consent dismissed'); await page.waitForTimeout(800); }
  } catch (e) { log('consent dismiss skipped', e.message); }

  // Tab strip (localized): grab the role tab labels for reference.
  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll('[role="tab"],a,button')].map(e => (e.textContent||'').trim())
      .filter(t => t && t.length < 20 && /[A-Za-zČĆŠŽ]/.test(t)).slice(0, 40));
  log('clickable labels (sample):', JSON.stringify(tabs.slice(0, 20)));

  const creditsDump = await dumpTab(page, 'credits');
  await writeFile(resolve(LOG_DIR, 'credits-tab.json'), JSON.stringify(creditsDump, null, 2));
  log('credits-tab blocks:', creditsDump.blocks.length);

  // Click the Info tab — English "Info" or Serbian "Informacije", else the
  // 2nd role=tab in the credits tablist.
  let infoClicked = false;
  try {
    let info = page.locator('[role="tab"],a,button', { hasText: /^(Info|Informacije|Informacie|Información)$/i }).first();
    if (!(await info.count())) info = page.locator('[role="tab"]').nth(1);
    if (await info.count()) { await info.click({ timeout: 5000 }); infoClicked = true; await page.waitForTimeout(2500); }
  } catch (e) { log('Info click failed', e.message); }
  log('Info tab clicked:', infoClicked);
  await writeFile(resolve(LOG_DIR, 'info-body.txt'), await page.evaluate(() => document.body.innerText));

  const infoDump = await dumpTab(page, 'info');
  await writeFile(resolve(LOG_DIR, 'info-tab.json'), JSON.stringify(infoDump, null, 2));
  log('info-tab blocks:', infoDump.blocks.length);

  await page.screenshot({ path: resolve(LOG_DIR, 'page.png'), fullPage: true });

  // Summary: distinct roles + whether anchors carry artist ids
  const summarize = (d, name) => {
    const roles = {};
    for (const b of d.blocks) {
      const ids = b.anchors.filter(a => a.artistId).length;
      const total = b.anchors.length;
      roles[b.role] = roles[b.role] || { withId: 0, total: 0, names: new Set() };
      roles[b.role].withId += ids; roles[b.role].total += total;
      b.anchors.forEach(a => a.text && roles[b.role].names.add(a.text));
      b.titled.forEach(t => roles[b.role].names.add(t));
    }
    log(`=== ${name} ===`);
    for (const [r, v] of Object.entries(roles))
      log(`  ${r.padEnd(24)} ids ${v.withId}/${v.total}  names: ${[...v.names].slice(0,4).join(', ')}`);
  };
  summarize(creditsDump, 'CREDITS TAB');
  summarize(infoDump, 'INFO TAB');

  log('artifacts in', LOG_DIR);
  await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
