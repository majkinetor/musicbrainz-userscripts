// #290: Apollo's nav bar mirrors MusicBrainz's "modification pending" mark. MusicBrainz
// wraps the release title in <span class="mp"> when the release has open edits; Apollo
// hides that header, so its own release name carries the same highlight (the theme's
// warning background) — or none.
//
// Whether a sandbox release has open edits is not ours to keep stable, so the page is
// given the mark (or has it taken away) before Apollo loads.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });
const REL = '89efad71-65d2-4f96-bc55-d69ad147bae2';

for (const pending of [true, false]) {
  test(`${pending ? 'open edits: the name is highlighted' : 'no open edits: no highlight'}`, { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openApollo(page, inject, {
      release: REL,
      before: () => page.evaluate(pending => {
        const h1 = document.querySelector('.releaseheader h1');
        h1.querySelectorAll('.mp').forEach(s => s.replaceWith(...s.childNodes));
        if (pending) { const a = h1.querySelector('a') || h1; const mp = document.createElement('span'); mp.className = 'mp'; a.parentNode.insertBefore(mp, a); mp.appendChild(a); }
      }, pending),
    });
    await page.waitForSelector('#tc-nav-title .tc-nav-title-name', { timeout: 30000 });
    await page.waitForTimeout(900);   // a nav sync tick
    const s = await page.evaluate(() => ({
      native: !!document.querySelector('.releaseheader h1 .mp'),
      marked: !!document.getElementById('tc-nav-title')?.classList.contains('tc-nav-title-pending'),
      bg: getComputedStyle(document.querySelector('#tc-nav-title .tc-nav-title-name')).backgroundColor,
      warn: (() => { const d = document.createElement('span'); d.style.background = 'var(--mbu-warn-bg)'; document.getElementById('tc-nav-title').appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; })(),
    }));
    check(s.native === pending, `the page ${pending ? 'has' : 'has no'} the mark`);
    check(s.marked === pending, `Apollo's release name ${pending ? 'is' : 'is not'} marked`);
    if (pending) check(s.bg === s.warn && s.bg !== 'rgba(0, 0, 0, 0)', `in the warning colour (${s.bg})`);
  });
}
