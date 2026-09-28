// Shared setup for Art Station's specs.
import { requireLogin, SANDBOX } from '../../../dev/test/harness.mjs';

// A sandbox release with four cover-art images (served from beta.coverartarchive.org).
export const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';

// The links of a production release with several art platforms ("Hazy Dreams",
// bafa58c1). The sandbox release has none; serveLinks() answers Art Station's
// url-rels lookup with these, so the release looks linked to them.
export const LINKS = [
  'https://open.spotify.com/album/0qDSYwC4IXSxnwymBnc56L',
  'https://soundcloud.com/mogwaa-music/sets/hazy-dreams-2',
  'https://www.deezer.com/album/433647837',
  'https://music.apple.com/gb/album/1684317655',
  'https://www.beatport.com/release/hazy-dreams/4106629',
  'https://tidal.com/album/291079319',
];
export const serveLinks = (page, links = LINKS, release = RELEASE) =>
  page.route(u => u.hostname === 'test.musicbrainz.org' && u.pathname === `/ws/2/release/${release}` && /url-rels/.test(u.search),
    r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ relations: links.map(u => ({ 'target-type': 'url', url: { resource: u } })) }) }));

// Aborts, and records, every POST (uploads to the Internet Archive and edits alike),
// except MusicBrainz's "Verifying your browser" check.
export async function blockPosts(page) {
  const posts = [];
  await page.route(() => true, route => {
    const r = route.request();
    if (r.method() !== 'POST' || /\/__meb_verify$/.test(new URL(r.url()).pathname)) return route.fallback();
    posts.push(r.url());
    return route.abort();
  });
  return posts;
}

// Art Station on the sandbox release: 'cover-art' (read-only) or 'add-cover-art'
// (logged in). before() runs on the page before the script is injected.
export async function openArtStation(page, inject, { path = 'cover-art', release = RELEASE, transform, before } = {}) {
  for (let a = 1; ; a++) {
    try { await page.goto(`${SANDBOX}/release/${release}/${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) throw e; await page.waitForTimeout(4000); }
  }
  if (path.startsWith('add')) await requireLogin(page);
  await page.waitForTimeout(500);
  if (before) await before();
  await inject('art_station', { transform });
  await page.waitForSelector('#as-root', { timeout: 20000 });
  await page.waitForTimeout(500);
}
