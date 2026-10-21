// pristine(): every kind it makes is really made on the sandbox, with its defaults and with a
// field the caller sets, and the web service reads it back. A MusicBrainz form that changes
// breaks here first, not in a spec that only needed an entity to work on.
import { test, check, pristine, mbJson, SANDBOX } from './harness.mjs';

const read = (kind, mbid) => mbJson(`${SANDBOX}/ws/2/${kind}/${mbid}?fmt=json`);

test('pristine makes a new entity of every kind, defaults or fields given', { tag: ['@sandbox', '@login'] }, async ({ page }) => {
  test.setTimeout(300_000);
  const rel = await pristine(page, 'release');
  const r = await read('release', rel.mbid);
  check(r.title === rel.name && r.status === 'Official', `a release, with its defaults (${JSON.stringify([r.title, r.status])})`);
  check(/^[0-9a-f-]{36}$/.test(rel.releaseGroup) && rel.recordings.length === 1, `and its release group and one recording (${JSON.stringify(rel)})`);

  const rec = await pristine(page, 'recording', { 'mediums.0.track.0.name': 'Given title' });
  check((await read('recording', rec.mbid)).title === 'Given title', 'a recording, a field set by the caller (through its release)');
  const rg = await pristine(page, 'release-group');
  check((await read('release-group', rg.mbid)).id === rg.mbid && rg.release !== rel.mbid, 'a release group, with a release of its own');
  const alone = await pristine(page, 'standalone-recording', { length: '201000' });
  const a = await mbJson(`${SANDBOX}/ws/2/recording/${alone.mbid}?inc=artist-credits+releases&fmt=json`);
  const by = (await mbJson(`${SANDBOX}/ws/2/release/${rel.mbid}?inc=artist-credits&fmt=json`))['artist-credit'][0].artist;
  check(a.title === alone.name && a.length === 201000 && !a.releases.length, `a standalone recording, its length given (${JSON.stringify([a.title, a.length, a.releases.length])})`);
  check(a['artist-credit'][0].artist.id === by.id && /^Pristine artist/.test(by.name), `both credit the run's own artist (${by.name})`);

  for (const [kind, fields, want] of [
    ['artist', { type_id: '2' }, j => j.type === 'Group'],
    ['label', {}, () => true],
    ['work', {}, () => true],
    ['place', {}, () => true],
    ['event', {}, () => true],
    ['series', {}, j => j.type === 'Release series'],
  ]) {
    const e = await pristine(page, kind, fields);
    const j = await read(kind, e.mbid);
    const named = j.name || j.title;   // a work has a title
    check(named === e.name && want(j), `a ${kind} (${JSON.stringify([named, j.type])})`);
  }
  let refused = '';
  try { await pristine(page, 'area'); } catch (e) { refused = String(e); }
  check(/can't create areas/.test(refused), `an area is refused up front (${refused})`);
});
