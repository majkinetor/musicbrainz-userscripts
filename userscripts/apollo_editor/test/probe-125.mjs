// #125 verification: on a disc-ID-locked release Apollo must NOT show add-tracks / drag handle /
// remove buttons (and the guards must block the ops); on a normal release it must show them.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://musicbrainz.org';
const LOCKED = '13c412f7-e2e9-4ee9-a8d3-d7d7096c64d3';
const UNLOCKED = '51bdb849-5dfc-40c0-9fcb-f49fe7395cc7';

async function check(ctx, scriptCode, mbid, label) {
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/release/${mbid}/edit`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { try { const ms = window.MB.releaseEditor.rootField.release().mediums(); return ms.length && ms.some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
  await page.addScriptTag({ content: scriptCode });
  await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 15000 });
  await page.evaluate(() => { window.__apolloEditor.hideMirror(); window.__apolloEditor.openPanel(); });
  await page.waitForSelector('#tc-panel .tc-mirror tbody tr', { timeout: 60000 });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const p = document.getElementById('tc-panel');
    const u = v => (typeof v === 'function' ? v() : v);
    const med0 = u(window.MB.releaseEditor.rootField.release().mediums())[0];
    return {
      hasToc: (() => { try { return med0.hasToc(); } catch (e) { return 'ERR'; } })(),
      addRow: p.querySelectorAll('.tc-addrow').length,
      dragHandles: p.querySelectorAll('.tc-drag').length,
      removeButtons: p.querySelectorAll('.tc-trackacts .rm').length,
      rows: p.querySelectorAll('.tc-mirror tbody tr[data-tk]').length,
      // guards: calling the API on a locked medium must no-op
      addBlocked: (() => { const before = u(med0.tracks()).length; try { window.__apolloEditor.addTracks(0, 1); } catch (e) {} return u(med0.tracks()).length === before; })(),
    };
  });
  await page.close();
  return { label, mbid, ...r };
}

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1400, height: 1000 } });
const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
const locked = await check(ctx, scriptCode, LOCKED, 'LOCKED');
const unlocked = await check(ctx, scriptCode, UNLOCKED, 'UNLOCKED');
await ctx.close();
console.log(JSON.stringify({ locked, unlocked }, null, 2));
const pass = locked.hasToc === true && locked.addRow === 0 && locked.dragHandles === 0 && locked.removeButtons === 0 && locked.addBlocked === true
  && unlocked.hasToc === false && unlocked.addRow >= 1 && unlocked.dragHandles >= 1 && unlocked.removeButtons >= 1;
console.log(pass ? '\n✅ PASS' : '\n❌ FAIL');
process.exit(pass ? 0 : 1);
