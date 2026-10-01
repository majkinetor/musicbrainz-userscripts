// #650: First Contact's platform-neutral helpers — the feat. clause, the artist credit and the
// release editor's seed parameters.
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

const fns = () => loadFunctions('first_contact', ['splitFeat', 'normName', 'toCredit', 'creditFromTitle', 'guessScript', 'seedParams']);

test('a feat. clause leaves the title and names the featured artists', { tag: ['@unit', '@critical'] }, async () => {
  const { splitFeat } = await fns();
  const cases = [
    ['Get Lucky (feat. Pharrell Williams and Nile Rodgers)', 'Get Lucky', ['Pharrell Williams', 'Nile Rodgers']],
    ['Song [ft. A & B]', 'Song', ['A', 'B']],
    ['Track (feat. Malcolm X)', 'Track', ['Malcolm X']],
    ['Song featuring C, D and E', 'Song', ['C', 'D', 'E']],
    ['Song (Remix) (feat. X)', 'Song (Remix)', ['X']],
    ['Plain Title', 'Plain Title', []],
    ['Feather (Live)', 'Feather (Live)', []],
  ];
  for (const [input, title, feat] of cases) {
    const r = splitFeat(input);
    check(r.title === title && JSON.stringify(r.feat) === JSON.stringify(feat), `"${input}" → "${r.title}" / ${JSON.stringify(r.feat)}, wanted "${title}" / ${JSON.stringify(feat)}`);
  }
});

test('contributors become a credit: mains joined, then feat.', { tag: ['@unit', '@critical'] }, async () => {
  const { creditFromTitle } = await fns();
  const dp = { name: 'Daft Punk', url: 'https://www.deezer.com/artist/27' };
  const pw = { name: 'Pharrell Williams', url: 'https://www.deezer.com/artist/103' };
  const nr = { name: 'Nile Rodgers', url: 'https://www.deezer.com/artist/7207' };
  const text = c => c.map(a => a.name + a.join).join('');

  const lucky = creditFromTitle([dp, pw, nr], ['Pharrell Williams', 'Nile Rodgers']);
  check(text(lucky) === 'Daft Punk feat. Pharrell Williams & Nile Rodgers', `Get Lucky credit: ${text(lucky)}`);
  check(lucky.every(a => a.url), 'every artist keeps its platform link');

  check(text(creditFromTitle([dp, pw, nr], [])) === 'Daft Punk, Pharrell Williams & Nile Rodgers', 'three mains');
  const extra = creditFromTitle([dp], ['Somebody Else']);
  check(text(extra) === 'Daft Punk feat. Somebody Else' && !extra[1].url, `a featured name the platform did not list is still credited, without a link: ${text(extra)}`);
  const onlyFeat = creditFromTitle([pw], ['Pharrell Williams']);
  check(text(onlyFeat) === 'Pharrell Williams', `never a credit that starts with feat.: ${text(onlyFeat)}`);
});

test('the script guess is Latn only for all-Latin titles', { tag: ['@unit'] }, async () => {
  const { guessScript } = await fns();
  check(guessScript(['Random Access Memories', 'Café Ölé']) === 'Latn', 'Latin with diacritics');
  check(guessScript(['Random', 'ランダム']) === null, 'mixed scripts are left to the editor');
  check(guessScript(['123']) === null, 'no letters, no guess');
});

test('the seed carries the release editor parameters', { tag: ['@unit', '@critical'] }, async () => {
  const { seedParams } = await fns();
  const rel = {
    title: 'Album', credit: [{ name: 'A', join: ' feat. ' }, { name: 'B', join: '' }],
    types: ['Album', 'Compilation'], status: 'official', packaging: 'None', script: 'Latn', barcode: '0123',
    date: { year: 2020, month: 5, day: null }, country: 'XW', labels: [{ name: 'L', catno: '' }],
    urls: [{ url: 'https://www.deezer.com/album/1', linkType: 85 }],
    mediums: [{ format: 'Digital Media', name: '', tracks: [{ title: 'T1', lengthMs: 61000, credit: [{ name: 'A', join: '' }] }] }],
  };
  const p = seedParams(rel, 'note');
  const get = k => p.filter(([n]) => n === k).map(([, v]) => v);
  check(get('name')[0] === 'Album', 'name');
  check(JSON.stringify(get('type')) === '["Album","Compilation"]', `types: ${get('type')}`);
  check(get('artist_credit.names.0.join_phrase')[0] === ' feat. ' && get('artist_credit.names.1.name')[0] === 'B', 'release credit');
  check(get('events.0.date.year')[0] === '2020' && get('events.0.date.month')[0] === '5' && !get('events.0.date.day').length, 'date without a day');
  check(get('events.0.country')[0] === 'XW', 'country');
  check(get('labels.0.name')[0] === 'L' && !get('labels.0.catalog_number').length, 'label, empty catno left out');
  check(get('urls.0.link_type')[0] === '85', 'link type');
  check(get('mediums.0.track.0.name')[0] === 'T1' && get('mediums.0.track.0.length')[0] === '61000' && get('mediums.0.track.0.number')[0] === '1', 'track');
  check(get('mediums.0.track.0.artist_credit.names.0.name')[0] === 'A', 'track credit');
  check(get('edit_note')[0] === 'note', 'edit note');
});
