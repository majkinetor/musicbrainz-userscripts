// #710: the bundle's @match is the union of its members', and every member's body used to start on every
// page in that union; only its own URL check kept it out where its standalone copy never runs. The build
// now gates each body with the member's own @match / @include / @exclude / @noframes.
//
// The unit spec reads the patterns as a manager does. The sandbox specs mark the first line of every
// member's body and read which ones started: on a recording page only the members whose own @match
// covers it, on a release page every member that matches /release/.
import { readFileSync } from 'node:fs';
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';
import { matchPatternSource, includeSource, urlRules, runsHere } from '../match.mjs';

const meta = src => [...src.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/)[1].matchAll(/^\/\/\s*@(\S+)(?:\s+(.*?))?\s*$/gm)].map(m => [m[1], m[2] || '']);
const MEMBERS = readFileSync(new URL('../members.txt', import.meta.url), 'utf8').split(/\r?\n/).map(l => l.replace(/#.*/, '').trim()).filter(Boolean);
const ownMeta = n => { for (const f of [`../../${n}/dist/${n}.user.js`, `../../${n}/${n}.user.js`]) { try { return meta(readFileSync(new URL(f, import.meta.url), 'utf8')); } catch (e) { /* next */ } } throw new Error(`no build for ${n}`); };
const expected = url => MEMBERS.filter(n => runsHere(urlRules(ownMeta(n)), url, false));

test('patterns read as a manager reads them', { tag: ['@unit', '@critical'] }, async () => {
  const m = (p, url) => new RegExp(matchPatternSource(p)).test(url);
  check(m('https://*.musicbrainz.org/*', 'https://musicbrainz.org/'), '*.host covers the bare host');
  check(m('https://*.musicbrainz.org/*', 'https://test.musicbrainz.org/release/x'), '*.host covers a subdomain');
  check(!m('https://*.musicbrainz.org/*', 'https://evilmusicbrainz.org/'), 'but not a host that only ends the same');
  check(!m('https://*.musicbrainz.org/*', 'http://musicbrainz.org/'), 'https only means https');
  check(m('*://*.musicbrainz.org/release/*', 'http://musicbrainz.org/release/x'), '* scheme is http too');
  check(m('https://*.musicbrainz.org/release/add*', 'https://musicbrainz.org/release/add?artist=1'), 'the query counts as path');
  check(!m('https://*.musicbrainz.org/release/*/edit', 'https://musicbrainz.org/release/x/edit?y'), 'no trailing * → no query');
  check(m('https://*.musicbrainz.org/release/*/edit', 'https://musicbrainz.org/release/x/edit'), 'exact path end');
  check(!m('https://*.musicbrainz.org/release/*', 'https://www.beatport.com/release/x/1'), 'a path guard alone would pass this one; the host keeps it out');
  check(m('https://www.youtube.com/playlist*', 'https://www.youtube.com/playlist?list=OL'), 'a path prefix');
  check(m('https://tidal.com/*', 'https://tidal.com:443/album/1'), 'a port is allowed');
  check(new RegExp(includeSource('https://example.com/a*')).test('https://example.com/abc'), '@include glob');
  check(new RegExp(includeSource('/^https:\\/\\/x\\.org\\//')).test('https://x.org/y'), '@include /regex/');
  const rules = urlRules([['match', 'https://*.musicbrainz.org/*'], ['exclude-match', 'https://*.musicbrainz.org/doc/*'], ['noframes', '']]);
  check(runsHere(rules, 'https://musicbrainz.org/release/x#top', false), 'a match, the #hash ignored');
  check(!runsHere(rules, 'https://musicbrainz.org/doc/x', false), '@exclude-match wins');
  check(!runsHere(rules, 'https://musicbrainz.org/release/x', true), '@noframes keeps it out of a frame');
  check(runsHere(urlRules([]), 'https://anything.example/', false), 'no patterns: runs wherever the bundle does');
});

// every member's first line pushes its name to window.__stRan
const mark = code => code.replace(/\/\/ ===== (\w+) [^\n]*\n[\s\S]*?try \{ \(function\(\)\{\n/g, (m, n) => `${m}(window.__stRan = window.__stRan || []).push(${JSON.stringify(n)});\n`);

test.use({ gm: { name: 'String Theory' } });

for (const [what, path] of [['a recording page', '/recording/2bea9225-3cee-4a23-b8f3-cd705bed3d06'], ['a release page', '/release/ec116461-5b0d-4c98-bb44-a4de5de63076']]) {
  test(`on ${what} only the members whose own @match covers it start`, { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
    const logs = []; page.on('console', m => logs.push(m.text()));
    await page.goto(`${SANDBOX}${path}`, { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory', { transform: mark });
    const want = expected(page.url()).sort();
    const ran = (await until(() => page.evaluate(() => (window.__stRan || []).slice()), r => r.length >= want.length, { timeout: 30000 })).sort();
    check(JSON.stringify(ran) === JSON.stringify(want), `started: ${ran.join(', ')} — expected ${want.join(', ')}`);
    const left = MEMBERS.filter(n => !want.includes(n));
    if (left.length) check(logs.some(l => l.includes('not for this page') && left.every(n => l.includes(n))), `the console names the ones left out (${left.join(', ')})`);
  });
}
