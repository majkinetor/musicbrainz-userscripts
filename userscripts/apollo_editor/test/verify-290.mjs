// Verifies #290: Apollo's zen toolbar MIRRORS MB's native "modification pending"
// mark — MB wraps the release title in <span class="mp"> (gold #ffdd99) when the
// entity has open edits; zen hides that header, so the release name in our
// toolbar must carry the same highlight (present on entrance, no staging needed).
//
//   node test/verify-290.mjs [--headed]
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
// c3c2fb19 (Cambodian Rocks) has open edits → native .mp present; 89efad71 has none.
const WITH_MP = 'c3c2fb19-b1ac-4c83-9133-ee83073f6ad0';
const NO_MP   = '89efad71-65d2-4f96-bc55-d69ad147bae2';
const GOLD = 'rgb(255, 221, 153)';

const main = async () => {
  const code = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

  async function load(mbid) {
    await page.goto(`${ORIGIN}/release/${mbid}/edit`, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
    await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
    await page.addScriptTag({ content: code });
    await page.waitForSelector('#tc-nav-title .tc-nav-title-name', { timeout: 30000 });
    await page.waitForTimeout(900);   // let a syncNav tick run
    return page.evaluate(() => {
      const nt = document.getElementById('tc-nav-title');
      const name = document.querySelector('#tc-nav-title .tc-nav-title-name');
      return {
        nativeMp: !!document.querySelector('.releaseheader h1 .mp'),
        pendingClass: !!nt && nt.classList.contains('tc-nav-title-pending'),
        bg: name ? getComputedStyle(name).backgroundColor : null,
      };
    });
  }

  // release WITH a pending edit → native .mp present → Apollo highlighted (on entrance)
  let s = await load(WITH_MP);
  console.log('with-mp:', JSON.stringify(s));
  check(s.nativeMp, 'release has the native .mp mark (open edit present)');
  check(s.pendingClass === s.nativeMp, 'Apollo MIRRORS the native state (pending class === native .mp)');
  if (s.nativeMp) check(s.bg === GOLD, `release name carries the native gold #ffdd99 (${s.bg})`);

  // release WITHOUT pending edits → no .mp → not highlighted
  s = await load(NO_MP);
  console.log('no-mp:', JSON.stringify(s));
  check(s.pendingClass === s.nativeMp, 'Apollo MIRRORS the native state (no .mp → not highlighted)');
  check(!s.pendingClass, 'release name NOT highlighted when there is no pending edit');

  console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
  await ctx.close();
  process.exit(fail ? 1 : 0);
};
main().catch(e => { console.error(e); process.exit(2); });
