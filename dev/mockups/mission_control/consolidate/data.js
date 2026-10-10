// Mock data for the consolidation mockups (#702): one album read from nine platforms.
// Fictional numbers; the disagreements are the kinds real platforms produce.
window.MOCK = {
  source: { p: 'bandcamp', url: 'mocky.bandcamp.com/album/music-will-explain' },
  // barcode lanes, as MC's Release links card groups them
  lanes: [
    { barcode: '659457250430', own: true, ps: ['bandcamp', 'apple', 'deezer', 'tidal', 'spotify', 'qobuz', 'audiomack'] },
    { barcode: '659457250416', note: 'Discogs: 12" vinyl, another release', ps: ['discogs'] },
    { barcode: '', note: 'no barcode shown: matched by title and track count', ps: ['ytmusic', 'amazonmusic'] },
  ],
  // platform -> read state
  read: {
    bandcamp: ['done', 'source · 13 tracks'], apple: ['done', '12 tracks · ISRCs'], deezer: ['done', '12 tracks · ISRCs'],
    tidal: ['done', '12 tracks · ISRCs'], spotify: ['done', '12 tracks'], qobuz: ['done', '12 tracks'],
    audiomack: ['done', '12 tracks · ISRCs'], ytmusic: ['done', '12 tracks'], amazonmusic: ['busy', 'reading…'],
    discogs: ['off', 'other barcode: not read'],
  },
  fields: [
    { k: 'Title', vals: [
      { v: 'Music Will Explain (Choir Music Vol. 1)', ps: ['bandcamp', 'apple', 'deezer', 'tidal', 'qobuz', 'audiomack'], pick: 1 },
      { v: 'Music Will Explain', ps: ['spotify', 'ytmusic'] } ] },
    { k: 'Artist', vals: [
      { v: 'Mocky', ps: ['bandcamp', 'apple', 'deezer', 'tidal', 'spotify', 'qobuz', 'audiomack', 'ytmusic'], pick: 1, links: 7 } ] },
    { k: 'Date', vals: [
      { v: '2024-03-15', ps: ['apple', 'deezer', 'tidal', 'spotify', 'qobuz', 'audiomack'], pick: 1 },
      { v: '2024-03-14', ps: ['bandcamp'], why: 'Bandcamp: the day it went up' },
      { v: '2024', ps: ['ytmusic'] } ] },
    { k: 'Label', vals: [
      { v: 'Heavy Sheet Music', ps: ['bandcamp', 'apple', 'deezer', 'qobuz'], pick: 1, links: 2 },
      { v: 'Mocky', ps: ['spotify', 'audiomack'], why: 'from the ℗ line' },
      { v: 'Heavy Sheet Music / Warner Chappell', ps: ['tidal'], why: 'from the ℗ line' } ] },
    { k: 'Cat. no.', vals: [ { v: 'HSM012', ps: ['bandcamp'], pick: 1 } ] },
    { k: 'Type', vals: [
      { v: 'Album', ps: ['apple', 'deezer', 'spotify', 'tidal', 'ytmusic', 'audiomack'], pick: 1 },
      { v: '— (guessed Album)', ps: ['bandcamp', 'qobuz'] } ] },
    { k: 'Barcode', vals: [ { v: '659457250430', ps: ['bandcamp', 'apple', 'deezer', 'tidal', 'spotify', 'qobuz', 'audiomack'], pick: 1 } ] },
    { k: 'Script', vals: [ { v: 'Latin', ps: [], det: '100 % of titles', pick: 1 } ] },
    { k: 'Language', vals: [ { v: 'English', ps: [], det: '91 % confidence', pick: 1 } ] },
  ],
  // each track: groups of platforms that agree; g[0] is the majority
  tracks: [
    { n: 1, g: [{ t: 'Walking (Theme)', len: '0:31', isrc: 'US2572504001', ps: 'all' }] },
    { n: 2, g: [{ t: 'Just a Little Lovin’', len: '3:25', isrc: 'US2572504002', ps: 'all' }] },
    { n: 3, g: [{ t: 'Infinite Vibrations', len: '3:42', isrc: 'US2572504003', ps: 'all' }] },
    { n: 4, open: 1, g: [
      { t: 'Walking', len: '2:45', isrc: 'US2572504004', ps: ['apple', 'deezer', 'tidal', 'spotify', 'qobuz', 'audiomack', 'ytmusic'] },
      { t: 'Walking', len: '2:47', isrc: '', ps: ['bandcamp'], diff: ['len'], why: '+2 s: Bandcamp’s file has the count-in' } ] },
    { n: 5, g: [{ t: 'Today Years Old', len: '3:43', isrc: 'US2572504005', ps: 'all' }] },
    { n: 6, g: [
      { t: 'Choir Beat', len: '3:38', isrc: 'US2572504006', ps: ['apple', 'tidal', 'audiomack', 'bandcamp', 'spotify', 'qobuz', 'ytmusic'] },
      { t: 'Choir Beat', len: '3:38', isrc: 'US2572504066', ps: ['deezer'], diff: ['isrc'] } ] },
    { n: 7, g: [{ t: 'Music Will Explain', len: '3:19', isrc: 'US2572504007', ps: 'all' }] },
    { n: 8, g: [
      { t: '1000 Goodbyes', len: '2:57', isrc: 'US2572504008', ps: ['bandcamp', 'deezer', 'tidal', 'qobuz', 'audiomack'] },
      { t: '1,000 Goodbyes', len: '2:57', isrc: 'US2572504008', ps: ['apple', 'spotify', 'ytmusic'], diff: ['t'] } ] },
    { n: 9, g: [{ t: 'Animal Noises', len: '3:15', isrc: 'US2572504009', ps: 'all' }] },
    { n: 10, g: [
      { t: 'Music Will Explain (reprise)', len: '0:24', isrc: 'US2572504010', ps: ['bandcamp', 'qobuz', 'audiomack'] },
      { t: 'Music Will Explain (Reprise)', len: '0:24', isrc: 'US2572504010', ps: ['apple', 'deezer', 'tidal', 'spotify', 'ytmusic'], diff: ['t'], pick: 1 } ] },
    { n: 11, g: [{ t: 'Wiggle Room', len: '4:13', isrc: 'US2572504011', ps: 'all' }] },
    { n: 12, g: [{ t: 'The Outer Limits', len: '2:51', isrc: 'US2572504012', ps: 'all' }] },
    { n: 13, only: 1, g: [{ t: 'Choir Beat (Demo)', len: '2:02', isrc: '', ps: ['bandcamp'], why: 'bonus track, Bandcamp download only' }] },
  ],
  all: ['bandcamp', 'apple', 'deezer', 'tidal', 'spotify', 'qobuz', 'audiomack', 'ytmusic'],
  names: { bandcamp: 'Bandcamp', apple: 'Apple Music', deezer: 'Deezer', tidal: 'Tidal', spotify: 'Spotify', qobuz: 'Qobuz', audiomack: 'Audiomack',
    ytmusic: 'YouTube Music', amazonmusic: 'Amazon Music', discogs: 'Discogs', musicbrainz: 'MusicBrainz' },
};
// icon helper: the real ST-ICONS marks (icons.js, generated by build.mjs)
window.I = (k, s = 14) => (window.ST_ICONS && ST_ICONS[k] ? ST_ICONS[k].replace('<svg', `<svg width="${s}" height="${s}" class="ic"`) : `<span class="ic">${k[0]}</span>`);
window.Is = (ps, s = 13) => (ps === 'all' ? MOCK.all : ps).map(p => `<span title="${MOCK.names[p]}">${I(p, s)}</span>`).join('');
