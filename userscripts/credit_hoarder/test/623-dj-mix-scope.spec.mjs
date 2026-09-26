// #623 (sweep, C1): a Discogs "DJ Mix" credit that doesn't cover every track became a
// RELEASE-level DJ-mixer — "tracks 1–3 of a 12-track CD" came out as "mixed the
// release". The scope was meant to ride along as a legacy jQuery "attribute" (a
// function clicking the old dialog's medium selector), which the dispatcher can't
// read (extractFnValue → null), so it was dropped and the credit went release-wide.
//
// Now a DJ credit is release-level only when it covers every track; otherwise it
// stays a track credit, which the per-track path turns into recording
// relationships. Pure module code, imported straight from src/ (CH_SRC_DIR=<old src>
// runs it against an older copy).
import { test, check } from '../../../dev/test/harness.mjs';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = process.env.CH_SRC_DIR || resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');

test('a partial DJ Mix credit is not turned into a release-wide one', { tag: ['@unit', '@critical'] }, async () => {
  const { convertPotentialDJMixers } = await import(pathToFileURL(resolve(SRC, 'mappers.js')).href);
  const T = (position) => ({ type_: 'track', position, title: 'T' + position });
  const cd12 = () => Array.from({ length: 12 }, (_, i) => T(String(i + 1)));
  const twoCd = () => [{ type_: 'heading', position: '', title: 'CD1' }, ...[1, 2, 3].map(n => T('1-' + n)), { type_: 'heading', position: '', title: 'CD2' }, ...[1, 2, 3].map(n => T('2-' + n))];
  const run = (tracklist, tracks) => {
    const dj = { name: 'DJ X', role: 'DJ Mix', tracks };
    const json = { tracklist, extraartists: [dj] };
    const out = convertPotentialDJMixers(json);
    return { releaseLevel: out.length, kept: json.extraartists.includes(dj), attrs: out.map(o => (o.attributes || []).length) };
  };

  const partial = run(cd12(), '1 to 3');
  check(partial.releaseLevel === 0 && partial.kept, `tracks 1–3 of 12: no release-level DJ-mixer; the credit stays for the tracks (${JSON.stringify(partial)})`);
  const whole = run(cd12(), '1 to 12');
  check(whole.releaseLevel === 1 && !whole.kept && whole.attrs[0] === 0, `all 12 tracks: one release-level DJ-mixer (${JSON.stringify(whole)})`);
  const oneDisc = run(twoCd(), '1-1 to 1-3');
  check(oneDisc.releaseLevel === 0 && oneDisc.kept, `all of CD1 but not CD2: not release-wide either (${JSON.stringify(oneDisc)})`);
  const both = run(twoCd(), '1-1 to 1-3, 2-1 to 2-3');
  check(both.releaseLevel === 1 && !both.kept, `both discs: release-level (${JSON.stringify(both)})`);
});
