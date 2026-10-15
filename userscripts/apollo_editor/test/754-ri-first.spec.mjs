// #754: Release information's artist and labels are matched first, before the Tracklist's pass
// (which waits for them), with a spinner where each badge will land meanwhile. And the Label
// picker stays open while the Tracklist matches: every Tracklist re-render used to remove all
// open search popups, Release information's included, so it shut the moment it opened.
//
// Sandbox data: Ninja Tune and Pharrell Williams are the only ones of their name; two labels are
// named "Warp", so it stays unset and its picker lists both.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm, matchDone } from './ap.mjs';

const ARTISTS = ['Aphex Twin', 'Squarepusher', 'Autechre', 'Four Tet', 'Portishead', 'Goldfrapp'];
const seed = { name: 'Apollo 754 release info first', 'artist_credit.names.0.name': 'Pharrell Williams', 'labels.0.name': 'Warp', 'labels.1.name': 'Ninja Tune', 'mediums.0.format': 'Digital Media' };
ARTISTS.forEach((a, i) => { seed[`mediums.0.track.${i}.name`] = 'Song ' + i; seed[`mediums.0.track.${i}.artist_credit.names.0.name`] = a; });
const log = page => page.evaluate(() => window.__apolloEditor.logMarkdown());

test.describe('release information first', () => {
  test.use({ gm: apolloGm({ autoMatch: true }) });

  test('Release information is matched before the Tracklist, with spinners meanwhile', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
    // hold Release information's name lookups until the spinners are checked
    let release; const held = new Promise(r => { release = r; });
    await page.route(/\/ws\/2\/(label|artist)\?/, async r => { await held; return r.continue(); });
    await openApollo(page, inject, { seed });
    const spin = await until(() => page.evaluate(() => ({ lab: document.querySelectorAll('.tc-ri-lab .tc-ri-spin').length, art: document.querySelectorAll('.tc-ri-rb .tc-ri-spin').length })), v => v.lab === 2 && v.art === 1);
    check(spin.lab === 2 && spin.art === 1, `a spinner by both labels and the artist while they are matched: ${JSON.stringify(spin)}`);
    check(!/\] track \d+: /.test(await log(page)), 'the Tracklist has matched nothing yet: it waits for Release information');
    release();
    await page.unroute(/\/ws\/2\/(label|artist)\?/);

    await matchDone(page);
    const lines = (await log(page)).split('\n');
    const ri = lines.findIndex(l => /Release information matched in/.test(l)), tl = lines.findIndex(l => /\] track \d+: /.test(l));
    console.log(lines.filter(l => /Label|release artist|Release information|\] track \d+: /.test(l)).join('\n'));
    check(ri >= 0 && tl > ri, `Release information is matched before the first track (lines ${ri}, ${tl})`);
    const after = await page.evaluate(() => ({ spins: document.querySelectorAll('.tc-ri-spin').length, labels: window.MB.releaseEditor.rootField.release().labels().map(l => (l.label() || {}).gid || null), badges: [...document.querySelectorAll('.tc-ri-lab .tc-badge, .tc-ri-rb .tc-badge')].map(b => b.textContent) }));
    check(after.spins === 0, `no spinner left once matched: ${JSON.stringify(after)}`);
    check(!after.labels[0] && after.labels[1], `"Warp" stays unset, "Ninja Tune" is linked: ${JSON.stringify(after.labels)}`);
    check(after.badges.length === 2, `the badges in the spinners' place: ${JSON.stringify(after.badges)}`);
  });

  test('the Label picker stays open while the Tracklist matches', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openApollo(page, inject, { seed });
    const running = await until(() => page.evaluate(() => /Stop/.test((document.querySelector('#tc-bar [data-act="match"]') || {}).textContent || '')), Boolean, { timeout: 60000 });
    check(running, 'the Tracklist pass is running');
    await page.evaluate(() => { window.__popGone = 0; new MutationObserver(ms => ms.forEach(m => m.removedNodes.forEach(n => { if (n.classList && n.classList.contains('tc-labpop')) window.__popGone++; }))).observe(document.body, { childList: true }); });
    await page.locator('#label-0').click();
    const rows = await until(() => page.locator('.tc-labpop .tc-acrow[data-i]').count(), n => n >= 2);
    check(rows >= 2, `the picker lists the labels named Warp (${rows})`);
    await matchDone(page);
    const st = await page.evaluate(() => ({ gone: window.__popGone, rows: document.querySelectorAll('.tc-labpop .tc-acrow[data-i]').length, focus: document.activeElement && document.activeElement.id, tracks: window.__apolloEditor.model.tracks.filter(t => t.slots.every(s => s.committed)).length }));
    check(st.tracks > 0, `the Tracklist matched meanwhile: ${JSON.stringify(st)}`);
    check(st.gone === 0 && st.rows >= 2 && st.focus === 'label-0', `the picker was never closed by it: ${JSON.stringify(st)}`);
  });
});
