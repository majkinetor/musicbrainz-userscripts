// #672: the handoff says what the platform is (badge, name, artist link type) and, on each link
// MB may store in other forms, all of them, so Apollo needs no change for a new provider.
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

const fns = () => loadFunctions('first_contact', ['APPLE_STOREFRONTS', 'AMAZON_TLDS', 'DEEZER', 'BANDCAMP', 'DISCOGS', 'APPLE', 'TIDAL', 'QOBUZ', 'BEATPORT', 'SPOTIFY', 'YTMUSIC', 'VOLUMO', 'HDTRACKS', 'SOUNDCLOUD', 'AMAZON', 'AUDIOMACK', 'PROVIDERS', 'handoffFor']);
const rel = (credit, labels = []) => ({ url: 'https://example.com/album/1', title: 'T', barcode: '', credit, labels, mediums: [{ tracks: [{ title: 'One', isrc: null, url: null, credit }] }] });

test('every provider says what Apollo needs to know about it', { tag: ['@unit', '@critical'] }, async () => {
  const { PROVIDERS } = await fns();
  const abbrs = PROVIDERS.map(p => p.abbr);
  check(PROVIDERS.every(p => typeof p.abbr === 'string' && p.abbr.length >= 2), `every provider has a badge (${JSON.stringify(abbrs)})`);
  check(new Set(abbrs).size === abbrs.length, 'no two providers share a badge');
  check(PROVIDERS.every(p => p.artistLinkType == null || Number.isInteger(p.artistLinkType)), 'an artist link type is an MB link type id');
});

test('the handoff carries the platform and the forms of each link', { tag: ['@unit', '@critical'] }, async () => {
  const { DEEZER, APPLE, QOBUZ, AMAZON, AUDIOMACK, DISCOGS, handoffFor } = await fns();

  const dz = handoffFor(rel([{ name: 'Daft Punk', join: '', url: 'https://www.deezer.com/artist/27' }]), DEEZER, 't');
  check(dz.v === 2 && dz.platform.abbr === 'dz' && dz.platform.name === 'Deezer' && dz.platform.artistLinkType === undefined, `Deezer: badge and name, MB types its links (${JSON.stringify(dz.platform)})`);
  check(dz.credit[0].urlForms === undefined && dz.mediums[0].tracks[0].credit[0].urlForms === undefined, 'a link MB stores only as it is carries no forms');

  const am = handoffFor(rel([{ name: 'Daft Punk', join: '', url: 'https://music.apple.com/us/artist/daft-punk/5468295' }]), APPLE, 't');
  const f = am.credit[0].urlForms;
  check(am.platform.artistLinkType === 978, 'Apple Music: a streaming page');
  check(f && f[0] === 'https://music.apple.com/us/artist/daft-punk/5468295' && f.includes('https://music.apple.com/us/artist/5468295') && f.includes('https://music.apple.com/fr/artist/5468295') && f.length > 10, `Apple Music: without the slug, in other storefronts too (${f && f.length} forms)`);
  check(JSON.stringify(am.mediums[0].tracks[0].credit[0].urlForms) === JSON.stringify(f), 'a track credit carries them too');

  const qz = handoffFor(rel([{ name: 'Daft Punk', join: '', url: 'https://www.qobuz.com/fr-fr/interpreter/daft-punk/36819' }]), QOBUZ, 't');
  check(qz.platform.artistLinkType === 176 && qz.credit[0].urlForms.includes('https://open.qobuz.com/artist/36819'), 'Qobuz: purchase for download, also as open.qobuz.com');

  const amz = handoffFor(rel([{ name: 'Daft Punk', join: '', url: 'https://music.amazon.com/artists/B001E8WS3O' }], [{ name: 'L', catno: '', url: 'https://music.amazon.com/labels/x' }]), AMAZON, 't');
  check(amz.platform.abbr === 'amz' && amz.credit[0].urlForms.includes('https://music.amazon.fr/artists/B001E8WS3O'), 'Amazon Music: on its other domains too');
  check(amz.labels[0].urlForms === undefined, 'a label link that has no other forms carries none');

  check(handoffFor(rel([]), AUDIOMACK, 't').platform.artistLinkType === 194, 'Audiomack: free streaming');
  check(handoffFor(rel([]), DISCOGS, 't').platform.abbr === 'disc' && handoffFor(rel([]), DISCOGS, 't').platform.artistLinkType === 180, 'Discogs: its own artist link type');
});
