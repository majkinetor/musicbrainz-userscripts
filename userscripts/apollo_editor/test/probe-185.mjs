// Probe #185 — expand-all collapsed media.
// Opens the maintainer's example multi-medium release edit page, injects the
// script, and verifies: (a) the Tracklist native expand arrows get the new
// right-click tooltip, (b) the Recordings collapsed-medium button shows the new
// "left click … right click to expand all" message, (c) right-clicking an
// expand arrow expands ALL collapsed media.
//
// Needs the shared logged-in profile (.pw-profile).

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE        = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const HEADED      = process.argv.includes('--headed');
const ORIGIN      = 'https://musicbrainz.org';
const RELEASE     = 'ad3cbf65-3b63-4cc8-a82a-aa018f1fe67a';

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG_DIR = resolve(HERE, 'logs', '185-' + stamp);
const log = (...a) => console.log('[probe-185]', ...a);

async function main() {
  await mkdir(LOG_DIR, { recursive: true });
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !HEADED, viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 1.5,
  });
  ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });

  const page = ctx.pages()[0] || await ctx.newPage();
  const consoleLines = [];
  page.on('console', m => consoleLines.push(`${m.type().padEnd(7)} ${m.text()}`));
  page.on('pageerror', e => consoleLines.push(`[pageerror] ${e.name}: ${e.message}`));

  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('Not logged in in .pw-profile.'); await ctx.close(); process.exit(3); }

  log('opening release edit page…');
  await page.goto(`${ORIGIN}/release/${RELEASE}/edit`, { waitUntil: 'domcontentloaded' });
  const ready = await page.waitForFunction(() => {
    try { const e = window.MB && window.MB.releaseEditor; return e && e.rootField && e.rootField.release && e.rootField.release(); } catch { return false; }
  }, null, { timeout: 120000 }).then(() => true).catch(() => false);
  log('editor ready?', ready);

  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(3000);

  const mediumCount = await page.evaluate(() => {
    const u = v => { try { return typeof v === 'function' ? v() : v; } catch { return undefined; } };
    try { return (u(window.MB.releaseEditor.rootField.release().mediums) || []).length; } catch { return -1; }
  });
  log('medium count:', mediumCount);

  // (a) Tracklist expand arrows: count + check tooltip wired by the script
  const tl = await page.evaluate(() => {
    const arrows = [...document.querySelectorAll('fieldset.advanced-medium button.icon.expand-medium')];
    return { count: arrows.length, titled: arrows.filter(b => /right click: expand all/i.test(b.title || '')).length, sampleTitle: arrows[0] ? arrows[0].title : null };
  });
  log('tracklist collapsed arrows:', tl.count, '| with new tooltip:', tl.titled, '|', JSON.stringify(tl.sampleTitle));

  // (c) right-click one arrow → expand all collapsed tracklist media
  let expandedAfter = null;
  if (tl.count > 0) {
    await page.evaluate(() => {
      const b = document.querySelector('fieldset.advanced-medium button.icon.expand-medium');
      b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(4000);
    expandedAfter = await page.evaluate(() => document.querySelectorAll('fieldset.advanced-medium button.icon.expand-medium').length);
    log('tracklist collapsed arrows after right-click expand-all:', expandedAfter, '(expect 0)');
  }

  // (b) Recordings tab: switch to it and read the collapsed-medium button text
  let recMsg = null;
  try {
    await page.evaluate(() => {
      const links = [...document.querySelectorAll('.ui-tabs-nav a, a, button')];
      const t = links.find(a => /^\s*Recordings\s*$/i.test(a.textContent || ''));
      if (t) t.click();
    });
    await page.waitForTimeout(2500);
    recMsg = await page.evaluate(() => {
      const b = document.querySelector('.tc-recmed-exp');
      return b ? { text: b.textContent, title: b.title } : null;
    });
    log('recordings collapsed button:', JSON.stringify(recMsg));
  } catch (e) { log('rec tab probe failed:', e.message); }

  await page.screenshot({ path: resolve(LOG_DIR, 'editor.png'), fullPage: false }).catch(() => {});
  await writeFile(resolve(LOG_DIR, 'console.log'), consoleLines.join('\n'));

  const fatal = consoleLines.filter(l => l.startsWith('[pageerror]'));
  log('pageerrors:', fatal.length);
  fatal.slice(0, 5).forEach(l => console.log('   ', l));

  const pass = tl.count >= 0 && (tl.count === 0 || tl.titled === tl.count) && (tl.count === 0 || expandedAfter === 0)
    && (!recMsg || /right click to expand all/i.test(recMsg.text));
  log('RESULT:', pass ? 'PASS' : 'CHECK', '— artifacts in', LOG_DIR);

  if (!HEADED) await ctx.close();
  else log('headed — leaving open; Ctrl-C to exit');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
