// #613 follow-up (majkinetor, with a screenshot of Calypsoul 70): "why i didn't get
// +alias here?" "St. Maarten's The Rolling Tones" was matched automatically (its Discogs
// name is also its MusicBrainz name) but credited on the release as "The Rolling Tones",
// which the MusicBrainz artist doesn't carry. "+ alias" was only offered after a manual
// pick; now an automatic match offers it too, when this run's lookups already know the
// artist's aliases (never for a cached row, so "it came back after adding" can't recur).
//
// test.musicbrainz.org, read-only. A runs the preflight resolver through the test hook;
// B imports the release from Discogs up to its review table, and "Start import" is never
// pressed. The web-service answers are production's (fixtures/ws-613-alias-auto-match.json.gz,
// RECORD_WS=1 to refresh). B clears this profile's Credit Hoarder cache first, so the
// row is a fresh match.
import { test, check, replayWs } from '../../../dev/test/harness.mjs';
import { withShim, openEditor } from './ch.mjs';

const REL = '51df3142-ff64-4ad1-bc67-37bf2767b9d7';     // Calypsoul 70 (Discogs release 1955521)
const TONES = '57088b56-4658-4269-a104-caa44183773d';   // St. Maarten's The Rolling Tones, no aliases
test.use({ gm: false });

test('an automatic match credited under another name offers "+ alias"', { tag: ['@sandbox', '@login', '@web'] }, async ({ page, inject }) => {
  test.setTimeout(15 * 60_000);
  const posts = []; page.on('request', r => { if (r.method() === 'POST' && /musicbrainz\.org\//.test(r.url())) posts.push(r.url()); });
  await openEditor(page, REL);
  const ws = await replayWs(page, new URL('./fixtures/ws-613-alias-auto-match.json.gz', import.meta.url));
  // fresh matches: drop this profile's cache before the script opens it
  await page.evaluate(() => new Promise(res => { const q = indexedDB.deleteDatabase('mblink'); q.onsuccess = q.onerror = q.onblocked = () => res(); }));
  await inject('credit_hoarder', { waitFor: '__creditHoarder', transform: withShim });

  // ── A. the resolver and the button rule ──
  const A = await page.evaluate(async ([tones]) => {
    const C = window.__creditHoarder;
    const context = await C.buildReleaseContext({});
    const run = async ent => (await C.resolveAll([ent], { kindOf: C.ARTIST_KIND, bypassIdb: true, context })).allResults[0];
    const anv = await run({ name: "St. Maarten's The Rolling Tones", anv: 'The Rolling Tones', resource_url: '' });
    const own = await run({ name: "St. Maarten's The Rolling Tones", resource_url: '' });
    const pick = r => ({ id: (r.mbUrl || '').split('/').pop(), name: r.mbName, aliases: r.mbAliases });
    return {
      anv: { type: anv.type, via: anv.logEntry && anv.logEntry.via, gid: pick(anv).id, aliases: anv.mbAliases, wants: C.wantsAliasButton('artist', pick(anv), anv.displayName) },
      own: C.wantsAliasButton('artist', pick(own), own.displayName),
      held: C.wantsAliasButton('artist', { id: tones, name: "St. Maarten's The Rolling Tones", aliases: ['The Rolling Tones'] }, 'The Rolling Tones'),
    };
  }, [TONES]);
  check(A.anv.type === 'resolved' && A.anv.gid === TONES, `"The Rolling Tones" (Discogs name "St. Maarten's The Rolling Tones") resolves on its own (via ${A.anv.via})`);
  check(Array.isArray(A.anv.aliases), `…and the match knows the artist's aliases without another request (${JSON.stringify(A.anv.aliases)})`);
  check(A.anv.wants === true, '…so "+ alias" is wanted: the credited name is neither its name nor an alias');
  check(A.own === false, 'credited under its own name: no "+ alias"');
  check(A.held === false, 'credited under a name it already has as an alias: no "+ alias"');

  // ── B. the real review table ──
  const icon = page.locator('.discogs-bar .discogs-src-ico[data-src="Discogs"]');
  if (await icon.count()) await icon.first().click(); else await page.locator('.discogs-bar .discogs-src-ico').first().click();
  const started = await page.locator('button', { hasText: /^Start import/i }).first().waitFor({ state: 'visible', timeout: 10 * 60_000 }).then(() => true, () => false);
  check(started, 'the review table rendered (Start import is not pressed)');
  const B = await page.evaluate(() => {
    const tr = [...document.querySelectorAll('tr')].find(t => /The Rolling Tones/.test(t.textContent) && /St\. Maarten's The Rolling Tones/.test(t.textContent));
    const btn = tr && tr.querySelector('.discogs-add-alias');
    return tr ? { alias: btn ? btn.textContent.trim() : null, title: btn ? btn.title.split('\n')[0] : '' } : null;
  });
  check(B && B.alias === '+ alias', `the automatically matched row offers "+ alias" (${B && (B.alias || 'no button')})`);
  check(B && /Add "The Rolling Tones" as an alias of St\. Maarten's The Rolling Tones/.test(B.title), `…to add the credited name ("${B && B.title}")`);
  check(posts.length === 0, `nothing was POSTed to MusicBrainz (${posts.length})`);
  await ws.done();
});
