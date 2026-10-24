// ==UserScript==
// @name         First Contact
// @namespace    https://musicbrainz.org/
// @version      2026.10.24.232707
// @description  Import a release into MusicBrainz from the platform's album page with one click: the release editor opens with the title, tracklist, artists, date, label, barcode and link filled in. Each artist's platform link is handed to Apollo Editor for matching. A second button sends the album to Harmony instead. By default the album page is also saved on the Internet Archive (it sends each imported URL to archive.org; off in the settings), and the edit note links the snapshot. Platforms: Deezer, Bandcamp, Discogs, Apple Music, Tidal, Qobuz, Beatport, Spotify, YouTube Music, Volumo, HDtracks, SoundCloud, Amazon Music, Audiomack, 7digital, Ototoy, mora, Melon, Bugs, Presto Music.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+Cjx0aXRsZT5GaXJzdCBDb250YWN0PC90aXRsZT4KPGxpbmVhckdyYWRpZW50IGlkPSJmYy1kIiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjYmFlNmZkIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMzhiZGY4Ii8+PC9saW5lYXJHcmFkaWVudD48cmFkaWFsR3JhZGllbnQgaWQ9ImZjLWIiIGN4PSIuMzUiIGN5PSIuMyIgcj0iLjgiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2ZmZjdjYyIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2Y2YzQzMSIvPjwvcmFkaWFsR3JhZGllbnQ+PHBhdGggZD0iTTUwIDQyIEw3OCA0MiBMMTA0IDExMiBMMjQgMTEyIFoiIGZpbGw9IiNmNmM0MzEiIG9wYWNpdHk9Ii45Ii8+PHBhdGggZD0iTTU2IDQyIEw3MiA0MiBMODggMTEyIEw0MCAxMTIgWiIgZmlsbD0iI2ZkZTY4YSIgb3BhY2l0eT0iLjciLz48ZWxsaXBzZSBjeD0iNjQiIGN5PSIxMTQiIHJ4PSI0MiIgcnk9IjgiIGZpbGw9IiMxZTIzNDYiIHN0cm9rZT0iI2M5Y2RmMiIgc3Ryb2tlLXdpZHRoPSIzIi8+PGVsbGlwc2UgY3g9IjY0IiBjeT0iMTEzIiByeD0iMjYiIHJ5PSI0LjIiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2Y2YzQzMSIgc3Ryb2tlLXdpZHRoPSIyLjQiLz48cGF0aCBkPSJNNDIgMjggQTIyIDE4IDAgMCAxIDg2IDI4IFoiIGZpbGw9InVybCgjZmMtZCkiIHN0cm9rZT0iI2M5Y2RmMiIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTUwLjM2IDE5LjkgQTE1LjM5OTk5OTk5OTk5OTk5OSAxMy41IDAgMCAxIDYxLjggMTEuOCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIuNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIuOSIvPjxlbGxpcHNlIGN4PSI2NCIgY3k9IjMyIiByeD0iNTYiIHJ5PSIxMiIgZmlsbD0iIzFlMjM0NiIgc3Ryb2tlPSIjYzljZGYyIiBzdHJva2Utd2lkdGg9IjMiLz48ZWxsaXBzZSBjeD0iNjQiIGN5PSI0MCIgcng9IjIyIiByeT0iNiIgZmlsbD0idXJsKCNmYy1iKSIgc3Ryb2tlPSIjYzljZGYyIiBzdHJva2Utd2lkdGg9IjIuNCIvPjxjaXJjbGUgY3g9IjIyIiBjeT0iMzEiIHI9IjQiIGZpbGw9IiNmNmM0MzEiLz48Y2lyY2xlIGN4PSI0MCIgY3k9IjMxIiByPSI0IiBmaWxsPSIjZjZjNDMxIi8+PGNpcmNsZSBjeD0iODgiIGN5PSIzMSIgcj0iNCIgZmlsbD0iI2Y2YzQzMSIvPjxjaXJjbGUgY3g9IjEwNiIgY3k9IjMxIiByPSI0IiBmaWxsPSIjZjZjNDMxIi8+PHBhdGggZD0iTTY0IDU4IEw4NCA2OS41IEw4NCA5Mi41IEw2NCAxMDQgTDQ0IDkyLjUgTDQ0IDY5LjUgWiIgZmlsbD0iIzdiNGZkNiIvPjxwYXRoIGQ9Ik02NCA1OCBMODQgNjkuNSBMNjQgODEgTDQ0IDY5LjUgWiIgZmlsbD0iIzliNzJlYSIvPjxwYXRoIGQ9Ik02MCA3MiBMNzQgNjkgTDc0IDg5IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMy40IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTYwIDcyIEw2MCA5MiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjMuNCIvPjxlbGxpcHNlIGN4PSI1NiIgY3k9IjkyIiByeD0iNC42IiByeT0iMy42IiBmaWxsPSIjZmZmIi8+PGVsbGlwc2UgY3g9IjcwIiBjeT0iODkiIHJ4PSI0LjYiIHJ5PSIzLjYiIGZpbGw9IiNmZmYiLz4KPC9zdmc+Cg==
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/first_contact/README.md
// @match        https://www.deezer.com/*
// @match        https://*.bandcamp.com/album/*
// @match        https://www.discogs.com/*
// @match        https://music.apple.com/*
// @match        https://tidal.com/*
// @match        https://listen.tidal.com/*
// @match        https://www.qobuz.com/*/album/*
// @match        https://www.beatport.com/*
// @match        https://open.spotify.com/*
// @match        https://music.youtube.com/*
// @match        https://www.youtube.com/playlist*
// @match        https://volumo.com/*
// @match        https://www.hdtracks.com/*
// @match        https://soundcloud.com/*
// @match        https://audiomack.com/*
// @match        https://*.7digital.com/artist/*
// @match        https://ototoy.jp/_/default/p/*
// @match        https://mora.jp/package/*
// @match        https://www.melon.com/album/detail.htm*
// @match        https://music.bugs.co.kr/album/*
// @match        https://www.allmusic.com/album/release/*
// @match        https://music.amazon.com/*
// @match        https://music.amazon.co.uk/*
// @match        https://music.amazon.de/*
// @match        https://music.amazon.fr/*
// @match        https://music.amazon.it/*
// @match        https://music.amazon.es/*
// @match        https://music.amazon.ca/*
// @match        https://music.amazon.co.jp/*
// @match        https://music.amazon.com.au/*
// @match        https://music.amazon.com.br/*
// @match        https://music.amazon.com.mx/*
// @match        https://www.prestomusic.com/classical/products/*
// @match        https://www.prestomusic.com/jazz/products/*
// @match        https://streaming.prestomusic.com/*
// @match        https://music.amazon.in/*
// @match        https://*.musicbrainz.org/release/*
// @noframes
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_openInTab
// @grant        unsafeWindow
// @grant        window.close
// @connect      api.deezer.com
// @connect      api.discogs.com
// @connect      music.apple.com
// @connect      amp-api.music.apple.com
// @connect      itunes.apple.com
// @connect      auth.tidal.com
// @connect      openapi.tidal.com
// @connect      api.beatport.com
// @connect      api-partner.spotify.com
// @connect      spclient.wg.spotify.com
// @connect      music.youtube.com
// @connect      volumo.com
// @connect      hdtracks.azurewebsites.net
// @connect      soundcloud.com
// @connect      a-v2.sndcdn.com
// @connect      api-v2.soundcloud.com
// @connect      api.audiomack.com
// @connect      api.7digital.com
// @connect      us.7digital.com
// @connect      js-cdn.7digital.com
// @connect      music.amazon.com
// @connect      na.mesk.skill.music.a2z.com
// @connect      web.archive.org
// @connect      musicbrainz.org
// @connect      beta.musicbrainz.org
// @connect      test.musicbrainz.org
// @connect      bandcamp.com
// @connect      cf.mora.jp
// @connect      m2.melon.com
// @connect      music.bugs.co.kr
// @connect      tivomusicapi-staging-elb.digitalsmiths.net
// ==/UserScript==

(function () {
'use strict';
// one copy per page: with String Theory and a standalone install both on, the newer one runs (#653)
if (!mbuClaim('first_contact', 'First Contact')) return;

const VERSION = (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version) || '?';
const SCRIPT = 'first_contact';
const NAME = 'First Contact';
const HOMEPAGE = 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/first_contact/README.md';
const ON_MB = /(^|\.)musicbrainz\.org$/.test(location.hostname);
const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="18" height="18" aria-hidden="true">'
    + '<path d="M50 44 L78 44 L104 112 L24 112 Z" fill="#f6c431"/>'
    + '<ellipse cx="64" cy="114" rx="42" ry="8" fill="#1e2346" stroke="#c9cdf2" stroke-width="3"/>'
    + '<path d="M40 26 A24 18 0 0 1 88 26 Z" fill="#1e2346" stroke="#c9cdf2" stroke-width="3"/>'
    + '<ellipse cx="64" cy="32" rx="56" ry="13" fill="#1e2346" stroke="#c9cdf2" stroke-width="3"/>'
    + '<circle cx="38" cy="32" r="4.4" fill="#fff"/><circle cx="64" cy="34" r="4.4" fill="#fff"/><circle cx="90" cy="32" r="4.4" fill="#fff"/>'
    + '<path d="M64 58 L84 69.5 L84 92.5 L64 104 L44 92.5 L44 69.5 Z" fill="#7b4fd6"/>'
    + '<path d="M60 72 L74 69 L74 89 M60 72 L60 92" fill="none" stroke="#fff" stroke-width="3.4"/>'
    + '<ellipse cx="56" cy="92" rx="4.6" ry="3.6" fill="#fff"/><ellipse cx="70" cy="89" rx="4.6" ry="3.6" fill="#fff"/></svg>';

// MusicBrainz's special-purpose artists that a platform names verbatim.
const VARIOUS_ARTISTS_MBID = '89ad4ac3-39f7-470e-963a-56509c546377';

// Handoffs (the platform links of every credited artist) wait in GM storage for the release
// editor tab. They are small; a day is plenty for a tab that was opened and left.
const HANDOFF_PREFIX = 'fc.handoff.';
// A seed waiting for the editor's tab (sendSeed), pruned with the handoffs
const SEED_PREFIX = HANDOFF_PREFIX + 'seed.';
// majkinetor: "handoff probably shouldn't spam the settings?" — every import left its handoff in
// the script's storage for a day. Now the release editor takes it out once it has it (keeping a
// copy for that tab, so a reload still finds it), and one that was never picked up (the editor
// never opened) goes after an hour.
const HANDOFF_TTL_MS = 3600 * 1000;
const SERVERS = ['musicbrainz.org', 'beta.musicbrainz.org', 'test.musicbrainz.org'];
// #799: the Harmony instances Send to Harmony can open
const HARMONY_HOSTS = ['harmony.pulsewidth.org.uk', 'harmony.mybrainz.dev'];

/* ── activity log: the shared window and buffer (mbuLog, in the ST-UI block below) ── */
const Log = mbuLog({ name: NAME, version: VERSION, header: NAME + ' — activity log', key: 'fc.logwin', before: () => injectStyle() });
Log.info(mbuStartupInfo(NAME));
mbuToast.log = (kind, msg) => (kind === 'warn' ? Log.warn(msg) : kind === 'ok' ? Log.ok(msg) : Log.info(msg));

function settings() {
    const stored = GM_getValue('fc.settings', {}) || {};
    // #736: the archive.org keys moved to mbu.archive, shared with Apollo Editor; keys already set there win
    if ('iaKey' in stored || 'iaSecret' in stored) {
        const k = mbaKeysStored();
        if (!k.iaKey && !k.iaSecret && (stored.iaKey || stored.iaSecret)) mbaSetKeys(stored.iaKey, stored.iaSecret);
        delete stored.iaKey; delete stored.iaSecret;
        GM_setValue('fc.settings', stored);
    }
    const s = Object.assign({ server: 'musicbrainz.org', iconOnly: false, gearHidden: false, closeAfter: false, harmony: true, harmonyHost: HARMONY_HOSTS[0], consolidate: true, archive: true, check: 'import' }, stored);
    if (!SERVERS.includes(s.server)) s.server = 'musicbrainz.org';
    if (!HARMONY_HOSTS.includes(s.harmonyHost)) s.harmonyHost = HARMONY_HOSTS[0];
    // the option that showed ⚙︎ only on hover became Hide the settings button: who had it on keeps ⚙︎ out of sight
    if ('gearOnHover' in s) { if (!('gearHidden' in (GM_getValue('fc.settings', {}) || {}))) s.gearHidden = !!s.gearOnHover; delete s.gearOnHover; }
    return s;
}
function saveSettings(s) { GM_setValue('fc.settings', s); }

/* ── network ─────────────────────────────────────────────────────────────── */

// #828: what the manager knows about a failed request (status, its error text, where a redirect led), for the message
function gmFailDetail(url, r) {
    if (!r) return '';
    const bits = [];
    if (r.status) bits.push(`HTTP ${r.status}${r.statusText ? ' ' + r.statusText : ''}`);
    if (r.error) bits.push(String(r.error));
    if (r.finalUrl && r.finalUrl !== url) bits.push(`redirected to ${r.finalUrl}`);
    return bits.length ? ': ' + bits.join(' · ') : '';
}

// A GET through the manager (no CORS): the response text, or throws. `headers` add to the request;
// an error carries the HTTP status (`e.status`) for a caller that retries on one.
// `cookies`: send the browser's cookies for that site (a Cloudflare clearance), which an anonymous request lacks.
function gmText(url, headers, cookies) {
    const t0 = Date.now();
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET', url, headers: Object.assign({ Accept: 'application/json' }, headers || {}), timeout: 20000, anonymous: !cookies,
            onload: r => {
                Log.debug(`GET ${url} → ${r.status}, ${(r.responseText || '').length} b in ${Date.now() - t0} ms`);
                if (r.status < 200 || r.status >= 300) return reject(Object.assign(new Error(`HTTP ${r.status}${r.statusText ? ' ' + r.statusText : ''} for ${url}${r.finalUrl && r.finalUrl !== url ? ` (redirected to ${r.finalUrl})` : ''}`), { status: r.status }));
                resolve(r.responseText || '');
            },
            onerror: r => { Log.debug(`${url} failed: ${JSON.stringify({ status: r && r.status, statusText: r && r.statusText, error: r && r.error, finalUrl: r && r.finalUrl })}`); reject(new Error(`network error for ${url}${gmFailDetail(url, r)}`)); },
            ontimeout: () => reject(new Error(`timeout for ${url} (no answer in 20 s)`)),
        });
    });
}
async function gmJson(url, headers) {
    const text = await gmText(url, headers);
    try { return JSON.parse(text); } catch (e) { throw new Error(`bad JSON from ${url}: ${e.message}`); }
}

// A form POST through the manager: the parsed JSON answer, or throws.
function gmPostJson(url, body, headers) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'POST', url, data: body, timeout: 20000, anonymous: true,
            headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, headers || {}),
            onload: r => {
                Log.debug(`POST ${url} → ${r.status}`);
                let j = null; try { j = JSON.parse(r.responseText || 'null'); } catch (e) { /* not JSON */ }
                if (r.status < 200 || r.status >= 300) return reject(Object.assign(new Error(`HTTP ${r.status} for ${url}${j && j.error ? ': ' + j.error : ''}`), { status: r.status }));
                resolve(j);
            },
            onerror: r => { Log.debug(`${url} failed: ${JSON.stringify({ status: r && r.status, statusText: r && r.statusText, error: r && r.error, finalUrl: r && r.finalUrl })}`); reject(new Error(`network error for ${url}${gmFailDetail(url, r)}`)); },
            ontimeout: () => reject(new Error(`timeout for ${url} (no answer in 20 s)`)),
        });
    });
}

// Run fn over items with at most `limit` in flight; results keep the input order.
async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
}

/* ── shared parsing helpers (platform-neutral) ───────────────────────────── */

// A "(feat. A and B)" / "[ft. A & B]" / "feat. A, B" clause in a title. Returns the title
// without it and the featured names, in order.
function splitFeat(title) {
    const s = String(title || '');
    const re = /\s*[([]\s*(?:feat\.?|ft\.?|featuring)\s+([^)\]]+)[)\]]|(?:^|\s+)(?:feat\.?|ft\.?|featuring)\s+(.+)$/i;
    const m = s.match(re);
    if (!m) return { title: s.trim(), feat: [] };
    const names = (m[1] || m[2]).split(/\s*(?:,|&|\band\b)\s*/i).map(n => n.trim()).filter(Boolean);
    return { title: (s.slice(0, m.index) + s.slice(m.index + m[0].length)).replace(/\s{2,}/g, ' ').trim(), feat: names };
}

// #702: a page read headless for Mission Control is a fetched document, not this tab's; it carries
// the origin it was fetched from (fcOrigin), which the page readers use in place of location.origin
const originOf = doc => (doc && doc.fcOrigin) || location.origin;
const normName = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[\s.'’]+/g, ' ').trim();

// Artist list → MB artist credit: mains joined "A, B & C", then " feat. " and the featured
// ones the same way. Each entry keeps the platform link for Apollo.
function toCredit(mains, feats) {
    const join = (list, last) => list.map((a, i) => Object.assign({}, a, { join: i === list.length - 1 ? last : i === list.length - 2 ? ' & ' : ', ' }));
    const m = join(mains, feats.length ? ' feat. ' : '');
    const f = join(feats, '');
    return m.concat(f);
}

// Split a platform's flat contributor list into mains and featured by the title's feat. clause.
function creditFromTitle(contributors, featNames) {
    const featSet = new Set(featNames.map(normName));
    const mains = [], feats = [];
    for (const c of contributors) (featSet.has(normName(c.name)) ? feats : mains).push(c);
    // a featured name the platform didn't list as a contributor still belongs in the credit
    for (const n of featNames) if (!feats.some(c => normName(c.name) === normName(n))) feats.push({ name: n });
    if (!mains.length && feats.length) mains.push(feats.shift());   // never a credit that starts with " feat."
    return toCredit(mains, feats);
}

// The primary type a release looks like, after murdos's fnGuessReleaseType (mbimport.js,
// github.com/murdos/musicbrainz-userscripts), most confident first:
//   1. an "EP" / "E.P." token in the title;
//   2. "Single" ending the title ("Song - Single", "Song (Single)") — or anywhere in it, within
//      8 tracks and 50 minutes (it's common English, so it needs the guard);
//   3. every track the same song once versions are taken off ("Song", "Song (Remix)",
//      "Song (Instrumental)") → Single;
//   4. by size: 7+ tracks or over 30 minutes → Album; up to 7 minutes → Single; else EP from
//      2 tracks up. Without every length: 1 track Single, 3–6 EP, 7+ Album, 2 left open.
// Returns { type: 'Album' | 'EP' | 'Single' | null, why, explicit } — explicit when the title
// says so, which then outranks a platform that calls everything an album.
const TYPE_VERSION_MARKER = /\b(?:a ?cap+el+a|acoustic|alt(?:ernate)?|bootleg|clean|club|demo|dirty|dub|edit|explicit|extended|instrumental|karaoke|live|mix|mono|original|radio|remaster(?:ed)?|remix|rework|short|slowed|sped[ -]up|stereo|version|vip|vocal)\b/i;
// (the brackets are { / } escapes so the test harness's brace matching reads the function whole)
function normTrackTitle(title) {
    return String(title || '').normalize('NFKC').toLocaleLowerCase()
        .replace(/\s*[([\x7B]([^\])\x7D]*?)[\])\x7D]/g, (m, inner) => (TYPE_VERSION_MARKER.test(inner) ? '' : m))
        .replace(/\s*[-–—:]\s*([^\n]*)$/, (m, tail) => (TYPE_VERSION_MARKER.test(tail) ? '' : m))
        .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function guessReleaseType(title, tracks) {
    const n = tracks.length;
    if (!n) return { type: null, why: 'no tracks' };
    const t = String(title || '');
    const lengths = tracks.map(x => x.lengthMs);
    const ms = lengths.every(l => l > 0) ? lengths.reduce((a, l) => a + l, 0) : NaN;
    const min = ms / 60000;
    if (/(?:^|[\s([\-–])E\.?P\b\.?/i.test(t)) return { type: 'EP', why: 'the title says EP', explicit: true };
    if (/[\s([\-–]single\s*[)\]]?$/i.test(t)) return { type: 'Single', why: 'the title ends in Single', explicit: true };
    if (/\bsingle\b/i.test(t) && n <= 8 && !(min > 50)) return { type: 'Single', why: 'the title says Single', explicit: true };
    if (n >= 2) {
        const norm = tracks.map(x => normTrackTitle(x.title));
        if (norm[0] && norm.every(x => x === norm[0])) return { type: 'Single', why: `every track is "${norm[0]}" in another version` };
    }
    if (!Number.isFinite(ms)) {
        if (n === 1) return { type: 'Single', why: 'one track' };
        if (n >= 3 && n <= 6) return { type: 'EP', why: `${n} tracks` };
        if (n >= 7) return { type: 'Album', why: `${n} tracks` };
        return { type: null, why: 'two tracks without lengths' };
    }
    if (n >= 7) return { type: 'Album', why: `${n} tracks` };
    if (min > 30) return { type: 'Album', why: `${Math.round(min)} minutes` };
    if (min < 1) return { type: null, why: 'under a minute' };
    if (min <= 7) return { type: 'Single', why: `${n} track(s), ${min.toFixed(1)} minutes` };
    if (n >= 2) return { type: 'EP', why: `${n} tracks, ${Math.round(min)} minutes` };
    return { type: null, why: `one track of ${Math.round(min)} minutes` };
}

// Latn when every letter in the titles is Latin; nothing otherwise (left for the editor).
// #650 (majkinetor): "fail to add multiple labels 'Crystal Method / Geffen'". A platform that has
// one label field writes two labels in it with " / " between them (Apple, Qobuz). Only a spaced
// slash splits: "AC/DC Records" is one name. A split label loses the platform's link, which is
// the combined name's page, not either label's.
function splitLabels(labels) {
    const out = [];
    for (const l of labels || []) {
        const parts = String(l.name || '').split(/\s+\/\s+/).map(x => x.trim()).filter(Boolean);
        if (parts.length < 2) { out.push(l); continue; }
        Log.info(`label "${l.name}" is ${parts.length} labels: ${parts.join(' | ')}`);
        parts.forEach(name => out.push({ name, catno: l.catno || '' }));
    }
    return out;
}

// A label from a copyright line, for a platform that has no label field (Tidal, #650: "This tidal
// release didn't add label (Outpost Recordings)"). "℗ 2020 Outpost Recordings" → Outpost Recordings;
// "℗ 2013 Daft Life Limited under exclusive license to Columbia Records, a Division of Sony Music
// Entertainment" → Columbia Records, the label the release came out on. Anything that doesn't read
// as one name (several years and owners, "All rights reserved" alone) gives none.
function labelFromCopyright(text) {
    let t = String(text || '').trim();
    if (!t) return null;
    t = t.replace(/^(?:\(?[℗©]\)?|\([pc]\))\s*/i, '').replace(/^(?:\d{4}\s*(?:[-–,]\s*\d{4}\s*)?)+/, '').trim();
    const lic = t.match(/\bunder (?:exclusive )?licen[cs]e to\s+(.+)$/i);
    if (lic) t = lic[1];
    t = t.replace(/,\s*(?:a|an)\s+(?:division|label|imprint|company)\b.*$/i, '').replace(/\.?\s*all rights reserved\.?$/i, '').replace(/[.,;\s]+$/, '').trim();
    if (!t || t.length > 60 || /[℗©]|\b\d{4}\b/.test(t) || /^(?:all rights reserved|under licen[cs]e)/i.test(t)) return null;
    return t;
}

// #650 (majkinetor): "lets make FC annotation also per platform (enable by default)". Kept as the
// platforms it is turned off on ({ platformName: true }), so a new platform starts on. The old
// one-for-all setting (off by default) is dropped once: every platform starts on.
const ANNOTATION_OFF_KEY = 'fc.annotation.off';
function annotationOn(name) {
    const s = GM_getValue('fc.settings', {}) || {};
    if (Object.prototype.hasOwnProperty.call(s, 'annotation')) {
        delete s.annotation;
        GM_setValue('fc.settings', s);
        Log.info('Annotation from the platform\'s notes is now per platform, on everywhere to start with');
    }
    return !(GM_getValue(ANNOTATION_OFF_KEY, {}) || {})[name];
}
function setAnnotationOn(name, on) {
    const all = Object.assign({}, GM_getValue(ANNOTATION_OFF_KEY, {}) || {});
    if (on) delete all[name]; else all[name] = true;
    GM_setValue(ANNOTATION_OFF_KEY, all);
}

// #650 (majkinetor): "we should add annotations (should be optional) from all providers (Qobuz
// above has it, BC almost always has it, Discogs has notes etc.)". A platform's notes as plain
// text: its HTML's breaks and paragraphs become lines, the rest of the markup goes.
function notesText(...parts) {
    const one = x => {
        let t = String(x || '');
        if (/<[a-z][^>]*>|&[a-z#0-9]+;/i.test(t)) {
            t = t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:p|div|li|h\d)>/gi, '\n\n');
            const d = document.createElement('textarea');
            d.innerHTML = mbuHtml(t.replace(/<[^>]+>/g, ''));
            t = d.value;
        }
        return t.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    };
    return parts.map(one).filter(Boolean).join('\n\n') || null;
}

// A compilation a platform credits to one of its artists (#650: Spotify credits "African Pearls -
// Guinée - Cultural Revolution" to Bembeya Jazz National, who plays 2 of its 25 tracks). When the
// release's artists are on fewer than half the tracks and the tracks have five or more artists,
// it is Various Artists, as MusicBrainz credits a compilation. Returns why, or null.
function variousArtistsWhy(rel) {
    if (!rel.credit.length || rel.credit.some(c => c.mbid === VARIOUS_ARTISTS_MBID)) return null;
    const tracks = [].concat(...rel.mediums.map(m => m.tracks)).filter(t => !t.placeholder);   // an empty track (#684) is no song
    if (tracks.length < 5) return null;
    const mains = new Set(rel.credit.map(c => normName(c.artistName || c.name)));
    const on = tracks.filter(t => (t.credit || []).some(c => mains.has(normName(c.artistName || c.name)))).length;
    const artists = new Set([].concat(...tracks.map(t => (t.credit || []).slice(0, 1).map(c => normName(c.artistName || c.name)))));
    if (on * 2 >= tracks.length || artists.size < 5) return null;
    return `${rel.credit.map(c => c.name).join(', ')} on ${on} of ${tracks.length} tracks, ${artists.size} track artists`;
}

function guessScript(texts) {
    const letters = texts.join(' ').replace(/[^\p{L}]/gu, '');
    if (!letters) return null;
    return /^[\p{Script=Latin}]+$/u.test(letters) ? 'Latn' : null;
}

// The storefronts and domains MusicBrainz may store an Apple Music or Amazon Music artist link
// under (the album page doesn't say which); see the providers' urlForms.
const APPLE_STOREFRONTS = ['us', 'gb', 'fr', 'de', 'jp', 'ca', 'au', 'nl', 'se', 'it', 'es', 'br', 'mx', 'pl', 'kr', 'be', 'ch', 'at', 'dk', 'no', 'fi', 'nz'];
const AMAZON_TLDS = ['com', 'co.uk', 'de', 'fr', 'it', 'es', 'ca', 'co.jp', 'com.au', 'com.br', 'com.mx', 'in'];

/* ── providers ───────────────────────────────────────────────────────────────
   One object per platform. Kept deliberately thin: recognise the album page, fetch the
   release and return it in First Contact's model. Everything MusicBrainz-specific (the
   seed, the handoff) is shared code below; matching is Apollo's.

   Model:
     { source, url, title, credit:[Credit], types:[primary, ...secondary], status, packaging,
       date:{year,month,day}, country, barcode, labels:[{name, catno}], urls:[{url, linkType}],
       mediums:[{ format, name, tracks:[{ title, lengthMs, isrc, url, credit:[Credit] }] }],
       missing?:{ of, count, at:['disc.pos'] } }   (tracks the album has but the platform didn't give)
     Credit = { name, url?, mbid?, join }
*/

const DEEZER = {
    id: 'deezer',
    name: 'Deezer',
    abbr: 'dz',
    host: /^www\.deezer\.com$/,
    albumId(loc) { const m = loc.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?album\/(\d+)\/?$/i); return m ? m[1] : null; },
    albumUrl: id => `https://www.deezer.com/album/${id}`,
    // #659: the page is built in the browser, so its snapshot is near empty; the API answer FC reads is the evidence
    archiveApi: id => `https://api.deezer.com/album/${id}`,
    artistUrl: id => `https://www.deezer.com/artist/${id}`,
    TYPES: { album: ['Album'], ep: ['EP'], single: ['Single'], compile: ['Album', 'Compilation'] },
    VARIOUS: 5080,

    async fetchRelease(id, progress) {
        const album = await gmJson(`https://api.deezer.com/album/${id}`);
        if (album.error) throw new Error(`Deezer: ${album.error.message || album.error.type} (album ${id})`);
        Log.info(`Deezer album ${id}: "${album.title}" by ${(album.contributors || []).map(c => `${c.name} [${c.role}]`).join(', ') || album.artist?.name} · ${album.nb_tracks} track(s) · ${album.record_type} · ${album.release_date} · UPC ${album.upc || '—'} · label "${album.label || ''}"`);

        // the album's own tracks list is capped; page through the tracks endpoint
        const tracks = [];
        let next = `https://api.deezer.com/album/${id}/tracks?limit=100`;
        while (next) {
            const page = await gmJson(next);
            if (page.error) throw new Error(`Deezer: ${page.error.message || page.error.type} (tracks of ${id})`);
            tracks.push(...(page.data || []));
            next = page.next || null;
        }
        Log.info(`Deezer: ${tracks.length} track(s) listed${tracks.length !== album.nb_tracks ? ` (album says ${album.nb_tracks})` : ''}`);

        // Per-track contributors: the tracks list carries only the main artist. Deezer marks
        // featured artists "Main" too, so the title's feat. clause decides who is featured.
        let done = 0;
        const details = await mapLimit(tracks, 4, async t => {
            let d = null;
            for (let attempt = 0; attempt < 3 && !d; attempt++) {
                try {
                    const r = await gmJson(`https://api.deezer.com/track/${t.id}`);
                    if (r.error && r.error.code === 4) { Log.debug(`Deezer quota hit on track ${t.id}, retrying`); await new Promise(res => setTimeout(res, 1200)); continue; }
                    if (r.error) { Log.warn(`Deezer track ${t.id}: ${r.error.message || r.error.type}`); break; }
                    d = r;
                } catch (e) { Log.warn(`Deezer track ${t.id}: ${e.message}`); }
            }
            progress && progress(++done, tracks.length);
            return d;
        });

        const artistOf = c => ({ name: c.name, url: this.artistUrl(c.id), platformId: c.id });
        const mediums = [];
        tracks.forEach((t, i) => {
            const d = details[i] || {};
            // title_short has no version; title_version can repeat the feat. clause
            const short = splitFeat(t.title_short || t.title);
            const ver = splitFeat(t.title_version || '');
            const feat = short.feat.length ? short.feat : ver.feat;
            let title = short.title;
            if (ver.title && !/^\(?\s*original mix\s*\)?$/i.test(ver.title)) title += ' ' + ver.title;
            const contributors = (d.contributors && d.contributors.length ? d.contributors : [t.artist]).filter(Boolean).map(artistOf);
            const credit = creditFromTitle(contributors, feat);
            const disc = t.disk_number || d.disk_number || 1;
            while (mediums.length < disc) mediums.push({ format: 'Digital Media', name: '', tracks: [] });
            mediums[disc - 1].tracks.push({ title, lengthMs: (t.duration || 0) * 1000 || null, isrc: t.isrc || d.isrc || null, url: t.link || null, credit });
            Log.debug(`track ${disc}.${mediums[disc - 1].tracks.length}: "${title}" — ${credit.map(c => c.name + c.join).join('')} (${t.duration}s, ${t.isrc || 'no ISRC'})${d.contributors ? '' : ' [no track details: main artist only]'}`);
        });

        const at = splitFeat(album.title);
        const albumContribs = (album.contributors && album.contributors.length ? album.contributors : [album.artist]).filter(Boolean)
            .filter(c => c.role !== 'Featured' || at.feat.length).map(artistOf);
        let credit = creditFromTitle(albumContribs, at.feat);
        if (album.artist && album.artist.id === this.VARIOUS) credit = [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, url: this.artistUrl(this.VARIOUS), join: '' }];

        const [y, m, dd] = String(album.release_date || '').split('-').map(n => parseInt(n, 10));
        return {
            source: this.id,
            url: this.albumUrl(id),
            title: at.title,
            credit,
            types: this.TYPES[album.record_type] || [],
            status: 'official',
            packaging: 'None',
            date: { year: y || null, month: m || null, day: dd || null },
            country: 'XW',
            barcode: album.upc || null,
            labels: album.label ? [{ name: album.label, catno: '' }] : [],
            urls: [{ url: this.albumUrl(id), linkType: 85 }],   // 85 = stream for free
            mediums,
        };
    },
};

// Bandcamp: everything is on the album page itself (the tralbum JSON and the ld+json), so
// nothing is fetched. Only the artist's own page has a link: track artists on a label's
// compilation are names.
const BANDCAMP = {
    id: 'bandcamp',
    name: 'Bandcamp',
    abbr: 'bc',
    host: /(^|\.)bandcamp\.com$/,
    albumId(loc) { return /^\/album\/[^/]+\/?$/.test(loc.pathname) ? loc.pathname.replace(/\/$/, '') : null; },
    VARIOUS: /^various( artists)?$/i,

    // a "04 Mar 2011 00:00:00 GMT" date, read in UTC
    date(s) {
        const d = s ? new Date(s) : null;
        return d && !isNaN(d) ? { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() } : { year: null, month: null, day: null };
    },

    async fetchRelease(path, progress, doc) {
        doc = doc || document;
        const tEl = doc.querySelector('script[data-tralbum]');
        if (!tEl) throw new Error('Bandcamp: no album data on this page (tralbum)');
        const t = JSON.parse(tEl.dataset.tralbum);
        let ld = null;
        try { ld = JSON.parse((doc.querySelector('script[type="application/ld+json"]') || {}).textContent || 'null'); } catch (e) { Log.warn(`Bandcamp ld+json: ${e.message}`); }
        const cur = t.current || {};
        const url = (t.url || originOf(doc) + path).replace(/^http:/, 'https:');
        const by = ld && ld.byArtist ? { name: ld.byArtist.name, url: ld.byArtist['@id'] || null } : null;
        const pub = ld && ld.publisher ? { name: ld.publisher.name, url: ld.publisher['@id'] || null } : null;
        const albumArtist = t.artist || cur.artist || (by && by.name) || '';
        Log.info(`Bandcamp album "${cur.title}" by ${albumArtist} · ${(t.trackinfo || []).length} track(s) · released ${t.album_release_date || cur.release_date} · UPC ${cur.upc || '—'} · by ${by ? by.name + ' ' + (by.url || '(no page)') : '—'} · publisher ${pub ? pub.name + ' ' + (pub.url || '') : '—'}${t.album_is_preorder ? ' · PREORDER' : ''}`);

        let band = null;
        try { band = JSON.parse((doc.querySelector('script[data-band]') || {}).dataset?.band || 'null'); } catch (e) { Log.debug(`Bandcamp data-band: ${e.message}`); }
        // the account this page belongs to: an artist's own, or a label's
        const account = { name: (band && band.name) || (pub && pub.name) || '', url: (pub && pub.url) || originOf(doc) };
        Log.debug(`Bandcamp account: ${account.name} ${account.url}`);

        const isVarious = this.VARIOUS.test(albumArtist);
        // "Future Funk Squad, Omega Sparx, Stu Brootal, The Crystal Method" is four artists;
        // the account's own name is never split ("Earth, Wind & Fire" on its own page)
        const splitNames = s => normName(s) === normName(account.name) ? [s] : String(s).split(/\s*,\s*|\s+&\s+/).map(n => n.trim()).filter(Boolean);
        // a Bandcamp page for an artist: byArtist's own, or the account's when it is that artist's
        const linkFor = n => (by && by.url && normName(n) === normName(by.name)) ? by.url : normName(n) === normName(account.name) ? account.url : null;
        const artistsOf = s => splitNames(s).map(n => ({ name: n, url: linkFor(n) }));
        const albumArtists = isVarious ? [] : artistsOf(albumArtist);
        const at = splitFeat(cur.title || '');
        const credit = isVarious
            ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }]
            : creditFromTitle(albumArtists, at.feat);

        const tracks = (t.trackinfo || []).map((x, i) => {
            let title = x.title || '';
            const trackArtist = x.artist || null;
            // a compilation's track titles repeat the artist: "Michna - Triple Chrome Dipped"
            if (trackArtist && title.toLowerCase().startsWith(trackArtist.toLowerCase() + ' - ')) title = title.slice(trackArtist.length + 3);
            const tf = splitFeat(title);
            const mains = trackArtist && normName(trackArtist) !== normName(albumArtist)
                ? artistsOf(trackArtist)
                : isVarious ? [{ name: trackArtist || 'Various Artists' }] : albumArtists;
            const tc = creditFromTitle(mains, tf.feat);
            progress && progress(i + 1, t.trackinfo.length);
            return {
                title: tf.title,
                lengthMs: x.duration ? Math.round(x.duration * 1000) : null,
                isrc: null,
                url: x.title_link ? new URL(x.title_link, url).href : null,
                credit: tc,
            };
        });
        // #743: an album not out yet hides the lengths of its unreleased tracks (duration 0) on the page; Bandcamp's app
        // API (mobile/24/tralbum_details) still has them. They can change before the release: the edit note says so.
        let hiddenLengths = 0;
        const hidden = (t.trackinfo || []).map((x, i) => (!x.duration && x.unreleased_track) ? i : -1).filter(i => i >= 0);
        const bandId = (band && band.id) || cur.band_id;
        if (hidden.length && bandId && t.id) {
            try {
                const app = await gmJson(`https://bandcamp.com/api/mobile/24/tralbum_details?band_id=${bandId}&tralbum_id=${t.id}&tralbum_type=a`);
                const byNum = new Map((app.tracks || []).map(x => [x.track_num, x]));
                hidden.forEach(i => {
                    const d = byNum.get(t.trackinfo[i].track_num);
                    if (d && d.duration > 0) { tracks[i].lengthMs = Math.round(d.duration * 1000); hiddenLengths++; }
                });
                Log.warn(`Bandcamp hides ${hidden.length} track length(s) until the album is out (${t.album_release_date || 'no date'}): ${hiddenLengths} taken from Bandcamp's app data, which can change before the release`);
            } catch (e) { Log.warn(`Bandcamp hides ${hidden.length} track length(s) until the album is out; its app data didn't answer (${e.message}): they stay empty`); }
        }
        tracks.forEach((x, i) => Log.debug(`track ${i + 1}: "${x.title}" — ${x.credit.map(c => c.name + c.join).join('')} (${x.lengthMs ? x.lengthMs / 1000 + 's' : 'no length'})`));

        // a label account publishing someone else's album: that's the label. An account that
        // belongs to one of the credited artists is not.
        const label = pub && pub.name && (!by || !by.url || pub.url !== by.url)
            && normName(pub.name) !== normName(albumArtist) && !albumArtists.some(a => normName(a.name) === normName(pub.name)) ? pub.name : null;
        const streamable = t.hasAudio && (t.trackinfo || []).some(x => x.streaming);
        return {
            source: this.id,
            annotation: notesText(cur.about, cur.credits),   // the album's about and credits
            url,
            title: at.title,
            credit,
            types: [],   // Bandcamp doesn't say; the title's EP / Single, or one track, decide it (importCurrent)
            status: 'official',
            packaging: 'None',
            date: this.date(t.album_release_date || cur.release_date),
            country: 'XW',
            barcode: cur.upc || null,
            labels: label ? [{ name: label, catno: '' }] : [],
            // 74 = purchase for download, 85 = stream for free: both, on one URL, as MB allows
            urls: [{ url, linkType: 74 }].concat(streamable ? [{ url, linkType: 85 }] : []),
            mediums: [{ format: 'Digital Media', name: '', tracks }],
            hiddenLengths,
        };
    },
};

// Discogs: the public API (api.discogs.com/releases/<id>), no token. The mappings are those of
// murdos's Discogs importer (github.com/murdos/musicbrainz-userscripts): its country and media
// tables, LP = 12" vinyl, sides A/B → medium 1, C/D → 2, sub-tracks folded into their index track.
const DISCOGS_COUNTRIES = { Worldwide: "XW", Afghanistan: "AF", Albania: "AL", Algeria: "DZ", "American Samoa": "AS", Andorra: "AD", Angola: "AO", Anguilla: "AI", Antarctica: "AQ", "Antigua and Barbuda": "AG", Argentina: "AR", Armenia: "AM", Aruba: "AW", Australia: "AU", Austria: "AT", Azerbaijan: "AZ", Bahamas: "BS", Bahrain: "BH", Bangladesh: "BD", Barbados: "BB", "Barbados, The": "BB", Belarus: "BY", Belgium: "BE", Belize: "BZ", Benin: "BJ", Bermuda: "BM", Bhutan: "BT", Bolivia: "BO", Croatia: "HR", Botswana: "BW", "Bouvet Island": "BV", Brazil: "BR", "British Indian Ocean Territory": "IO", "Brunei Darussalam": "BN", Bulgaria: "BG", "Burkina Faso": "BF", Burundi: "BI", Cambodia: "KH", Cameroon: "CM", Canada: "CA", "Cape Verde": "CV", "Cayman Islands": "KY", "Central African Republic": "CF", Chad: "TD", Chile: "CL", China: "CN", "Christmas Island": "CX", "Cocos (Keeling) Islands": "CC", Colombia: "CO", Comoros: "KM", Congo: "CG", "Cook Islands": "CK", "Costa Rica": "CR", "Virgin Islands, British": "VG", Cuba: "CU", Cyprus: "CY", "Czech Republic": "CZ", Denmark: "DK", Djibouti: "DJ", Dominica: "DM", "Dominican Republic": "DO", Ecuador: "EC", Egypt: "EG", "El Salvador": "SV", "Equatorial Guinea": "GQ", Eritrea: "ER", Estonia: "EE", Ethiopia: "ET", "Falkland Islands (Malvinas)": "FK", "Faroe Islands": "FO", Fiji: "FJ", Finland: "FI", France: "FR", "French Guiana": "GF", "French Polynesia": "PF", "French Southern Territories": "TF", Gabon: "GA", Gambia: "GM", Georgia: "GE", Germany: "DE", Ghana: "GH", Gibraltar: "GI", Greece: "GR", Greenland: "GL", Grenada: "GD", Guadeloupe: "GP", Guam: "GU", Guatemala: "GT", Guinea: "GN", "Guinea-Bissau": "GW", Guyana: "GY", Haiti: "HT", "Virgin Islands, U.S.": "VI", Honduras: "HN", "Hong Kong": "HK", Hungary: "HU", Iceland: "IS", India: "IN", Indonesia: "ID", "Wallis and Futuna": "WF", Iraq: "IQ", Ireland: "IE", Israel: "IL", Italy: "IT", Jamaica: "JM", Japan: "JP", Jordan: "JO", Kazakhstan: "KZ", Kenya: "KE", Kiribati: "KI", Kuwait: "KW", Kyrgyzstan: "KG", "Lao People's Democratic Republic": "LA", Latvia: "LV", Lebanon: "LB", Lesotho: "LS", Liberia: "LR", "Libyan Arab Jamahiriya": "LY", Liechtenstein: "LI", Lithuania: "LT", Luxembourg: "LU", Montserrat: "MS", Macedonia: "MK", Madagascar: "MG", Malawi: "MW", Malaysia: "MY", Maldives: "MV", Mali: "ML", Malta: "MT", "Marshall Islands": "MH", Martinique: "MQ", Mauritania: "MR", Mauritius: "MU", Mayotte: "YT", Mexico: "MX", "Micronesia, Federated States of": "FM", Morocco: "MA", Monaco: "MC", Mongolia: "MN", Mozambique: "MZ", Myanmar: "MM", Namibia: "NA", Nauru: "NR", Nepal: "NP", Netherlands: "NL", "Netherlands Antilles": "AN", "New Caledonia": "NC", "New Zealand": "NZ", Nicaragua: "NI", Niger: "NE", Nigeria: "NG", Niue: "NU", "Norfolk Island": "NF", "Northern Mariana Islands": "MP", Norway: "NO", Oman: "OM", Pakistan: "PK", Palau: "PW", Panama: "PA", "Papua New Guinea": "PG", Paraguay: "PY", Peru: "PE", Philippines: "PH", Pitcairn: "PN", Poland: "PL", Portugal: "PT", "Puerto Rico": "PR", Qatar: "QA", Reunion: "RE", Romania: "RO", "Russian Federation": "RU", Russia: "RU", Rwanda: "RW", "Saint Kitts and Nevis": "KN", "Saint Lucia": "LC", "Saint Vincent and The Grenadines": "VC", Samoa: "WS", "San Marino": "SM", "Sao Tome and Principe": "ST", "Saudi Arabia": "SA", Senegal: "SN", Seychelles: "SC", "Sierra Leone": "SL", Singapore: "SG", Slovenia: "SI", "Solomon Islands": "SB", Somalia: "SO", "South Africa": "ZA", Spain: "ES", "Sri Lanka": "LK", Sudan: "SD", Suriname: "SR", Swaziland: "SZ", Sweden: "SE", Switzerland: "CH", "Syrian Arab Republic": "SY", Tajikistan: "TJ", "Tanzania, United Republic of": "TZ", Thailand: "TH", Togo: "TG", Tokelau: "TK", Tonga: "TO", "Trinidad & Tobago": "TT", Tunisia: "TN", Turkey: "TR", Turkmenistan: "TM", "Turks and Caicos Islands": "TC", Tuvalu: "TV", Uganda: "UG", Ukraine: "UA", "United Arab Emirates": "AE", UK: "GB", US: "US", "United States Minor Outlying Islands": "UM", Uruguay: "UY", Uzbekistan: "UZ", Vanuatu: "VU", "Vatican City State (Holy See)": "VA", Venezuela: "VE", "Viet Nam": "VN", "Western Sahara": "EH", Yemen: "YE", Zambia: "ZM", Zimbabwe: "ZW", Taiwan: "TW", "[Worldwide]": "XW", Europe: "XE", USSR: "SU", "East Germany (historical, 1949-1990)": "XG", Czechoslovakia: "XC", "Congo, Republic of the": "CD", Slovakia: "SK", "Bosnia & Herzegovina": "BA", "Korea (North), Democratic People's Republic of": "KP", "North Korea": "KP", "Korea (South), Republic of": "KR", "South Korea": "KR", Montenegro: "ME", "South Georgia and the South Sandwich Islands": "GS", "Palestinian Territory": "PS", Macao: "MO", "Timor-Leste": "TL", "<85>land Islands": "AX", Guernsey: "GG", "Isle of Man": "IM", Jersey: "JE", Serbia: "RS", "Saint Barthélemy": "BL", "Saint Martin": "MF", Moldova: "MD", Yugoslavia: "YU", "Serbia and Montenegro": "CS", "Côte d'Ivoire": "CI", "Heard Island and McDonald Islands": "HM", "Iran, Islamic Republic of": "IR", "Saint Pierre and Miquelon": "PM", "Saint Helena": "SH", "Svalbard and Jan Mayen": "SJ" };
const DISCOGS_MEDIA = { "8-Track Cartridge": "Cartridge", Acetate: "Acetate", "Acetate7\"": "7\" Acetate", "Acetate10\"": "10\" Acetate", "Acetate12\"": "12\" Acetate", Betamax: "Betamax", "Blu-ray": "Blu-ray", "Blu-ray-R": "Blu-ray", Cassette: "Cassette", CD: "CD", CDr: "CD-R", CDV: "CDV", "CD+G": "CD+G", Cylinder: "Wax Cylinder", DAT: "DAT", Datassette: "Other", DCC: "DCC", DVD: "DVD", DVDr: "DVD", "DVD-Audio": "DVD-Audio", "DVD-Video": "DVD-Video", "Edison Disc": "Vinyl", File: "Digital Media", "Flexi-disc": "Vinyl", "Floppy Disk": "Other", HDCD: "HDCD", "HD DVD": "HD-DVD", "HD DVD-R": "HD-DVD", Hybrid: "Other", Laserdisc: "LaserDisc", "Memory Stick": "USB Flash Drive", Microcassette: "Other", Minidisc: "MiniDisc", MVD: "Other", "Reel-To-Reel": "Reel-to-reel", SACD: "SACD", SelectaVision: "Other", Shellac: "Shellac", "Shellac7\"": "7\" Shellac", "Shellac10\"": "10\" Shellac", "Shellac12\"": "12\" Shellac", SVCD: "SVCD", UMD: "UMD", VCD: "VCD", VHS: "VHS", "Video 2000": "Other", Vinyl: "Vinyl", "Vinyl7\"": "7\" Vinyl", "Vinyl10\"": "10\" Vinyl", "Vinyl12\"": "12\" Vinyl", "Lathe Cut": "Phonograph record" };
const DISCOGS_PACKAGING = [[/cardboard|paper/, 'Cardboard/Paper Sleeve'], [/digi[\s\-‐]?pac?k/, 'Digipak'], [/keepcase/, 'Keep Case'], [/slimjewel/, 'Slim Jewel Case'], [/jewel/, 'Jewel Case'], [/gatefold|digisleeve/, 'Gatefold Cover']];
const DISCOGS = {
    id: 'discogs',
    name: 'Discogs',
    abbr: 'disc',
    artistLinkType: 180,   // MB's Discogs artist link
    host: /^(www\.)?discogs\.com$/,
    albumId(loc) { const m = loc.pathname.match(/^\/(?:[a-z]{2}\/)?release\/(\d+)(?:-[^/]*)?\/?$/i); return m ? m[1] : null; },
    // #736: discogs.com refuses archive.org (HTTP 403 to every save); its API doesn't
    archivePage: false,
    archiveApi: id => mbaSavable(`https://www.discogs.com/release/${id}`),
    VARIOUS: 194,
    NO_LABEL: 750,   // "Not On Label"

    noNum: n => String(n || '').replace(/ \(\d+\)$/, ''),
    // Discogs joins: "&", ",", "Feat.", "Vs", "And", "With", "x" → MB style
    join(j) {
        const t = String(j || '').trim();
        if (!t) return '';
        if (t === ',') return ', ';
        const k = t.toLowerCase().replace(/\.$/, '');
        const map = { feat: ' feat. ', featuring: ' feat. ', ft: ' feat. ', vs: ' vs. ', and: ' and ', with: ' with ', x: ' x ', '&': ' & ', '+': ' + ', '/': ' / ' };
        return map[k] || ` ${t} `;
    },
    artist(a) {
        if (a.id === this.VARIOUS) return { name: 'Various Artists', artistName: 'Various Artists', url: null, mbid: VARIOUS_ARTISTS_MBID };
        return {
            name: a.anv || this.noNum(a.name),
            artistName: this.noNum(a.name),
            url: a.id ? `https://www.discogs.com/artist/${a.id}` : null,
            mbid: null,
        };
    },
    credit(artists, featuring) {
        const out = (artists || []).map(a => Object.assign(this.artist(a), { join: this.join(a.join) }));
        if (out.length) out[out.length - 1].join = '';
        const feats = (featuring || []).filter(f => !out.some(o => o.url && o.url === this.artist(f).url));
        if (feats.length) {
            if (out.length) out[out.length - 1].join = ' feat. ';
            feats.forEach((a, i) => out.push(Object.assign(this.artist(a), { join: i === feats.length - 1 ? '' : i === feats.length - 2 ? ' & ' : ', ' })));
        }
        return out;
    },
    ms(d) { const p = String(d || '').split(':').map(Number); return p.length > 1 && p.every(n => Number.isFinite(n)) ? p.reduce((a, n) => a * 60 + n, 0) * 1000 : null; },

    async fetchRelease(id) {
        const r = await gmJson(`https://api.discogs.com/releases/${id}`);
        if (!r || !r.title) throw new Error(`Discogs: no release ${id}${r && r.message ? ` (${r.message})` : ''}`);
        Log.info(`Discogs release ${id}: "${r.title}" by ${(r.artists || []).map(a => a.name + (a.join ? ' ' + a.join : '')).join(' ')} · ${r.country || '—'} · ${r.released || '—'} · formats ${(r.formats || []).map(f => `${f.qty}×${f.name} [${(f.descriptions || []).join(', ')}]${f.text ? ' "' + f.text + '"' : ''}`).join(' + ')} · ${(r.tracklist || []).length} tracklist row(s)`);

        // formats → one MB format per medium, plus type, status, packaging
        const formats = [];
        let primary = null, status = 'official', packaging = null;
        const secondary = [];
        for (const f of r.formats || []) {
            let fmt = DISCOGS_MEDIA[f.name];
            for (const d of f.descriptions || []) {
                if (/7"|10"|12"/.test(d) && DISCOGS_MEDIA[f.name + d]) fmt = DISCOGS_MEDIA[f.name + d];
                if (/^(VCD|SVCD|CD\+G|HDCD|DVD-Audio|DVD-Video)$/.test(d) && DISCOGS_MEDIA[d]) fmt = DISCOGS_MEDIA[d];
                if (f.name === 'Vinyl' && d === 'LP') fmt = '12" Vinyl';
                if (f.name === 'CD' && d === 'Mini') fmt = '8cm CD';
                if (/Promo|Smplr/.test(d)) status = 'promotion';
                if (/Unofficial Release/.test(d)) status = 'bootleg';
                if (/Compilation/.test(d) && !secondary.includes('Compilation')) secondary.push('Compilation');
                if (/^Album/.test(d)) primary = primary || 'Album';
                if (/Single(?! Sided)/.test(d)) primary = 'Single';
                if (/^(EP|Mini-Album)$/.test(d)) primary = 'EP';
            }
            const text = String(f.text || '').toLowerCase().replace(/[\s-]/g, '');
            for (const [re, p] of DISCOGS_PACKAGING) if (!packaging && re.test(text)) packaging = p;
            if (fmt) for (let q = 0; q < (parseInt(f.qty, 10) || 1); q++) formats.push(fmt);
            else if (f.name !== 'Box Set' && f.name !== 'All Media') Log.warn(`Discogs format "${f.name}" has no MusicBrainz format`);
        }
        Log.debug(`formats → ${formats.join(', ') || 'none'} · type ${primary || '—'}${secondary.length ? ' + ' + secondary.join(' + ') : ''} · status ${status} · packaging ${packaging || '—'}`);

        // tracklist → mediums by position: "1-3" / "CD2-4" / "2.4" (medium-track), "A1" (sides,
        // two per medium), "1" (a number that starts over begins the next medium)
        const mediums = [];
        let heading = '', med = 1, last = 0, odd = false;
        const releaseCredit = this.credit(r.artists);
        // an index track (a work's title over its movements) is one track per movement when each has
        // its own position ("1", "2", "3" or "A1", "A2"), titled "Work: I. Allegro"; movements without
        // one or sharing a track ("3a", "3.b") are joined into one track, "Work: I. Allegro / II. Largo"
        const rows = [];
        for (const t of r.tracklist || []) {
            const subs = t.type_ === 'index' && t.sub_tracks ? t.sub_tracks.filter(x => x.type_ === 'track') : [];
            const poss = subs.map(x => String(x.position || '').trim());
            const own = subs.length > 1 && poss.every(p => p && !/\d\s*\.?\s*[a-z]$/i.test(p)) && new Set(poss).size === poss.length;
            if (own) {
                Log.debug(`index "${t.title}": ${subs.length} movements on their own tracks (${poss.join(', ')})`);
                subs.forEach(x => rows.push(Object.assign({}, x, {
                    title: (t.title ? t.title + ': ' : '') + (x.title || '[unknown]'),
                    artists: x.artists && x.artists.length ? x.artists : t.artists,
                    extraartists: (t.extraartists || []).concat(x.extraartists || []),
                })));
            } else rows.push(t);
        }
        for (const t of rows) {
            // a heading names the medium that follows: "CD 1 Routine" → "Routine"
            if (t.type_ === 'heading') { heading = String(t.title || '').replace(/^(?:CD|Disc|Disk|DVD|LP|Vinyl|Side)\s*\d+\s*[-:–.]?\s*/i, ''); continue; }
            if (t.type_ !== 'track' && t.type_ !== 'index') continue;
            let title = String(t.title || '').replace(/´/g, '’');
            let pos = t.position || '';
            let len = this.ms(t.duration);
            if (t.type_ === 'index' && t.sub_tracks) {
                const subs = t.sub_tracks.filter(x => x.type_ === 'track');
                if (!pos && subs[0]) pos = subs[0].position || '';
                if (subs.length) title += (title ? ': ' : '') + subs.map(x => x.title || '[unknown]').join(' / ');
                if (!len) { const sum = subs.reduce((a, x) => a + (this.ms(x.duration) || 0), 0); len = sum || null; }
            }
            if (!pos || /^(video|mp3)/i.test(pos)) { Log.debug(`skipped tracklist row "${title}" (position "${t.position}")`); continue; }
            let m;
            if ((m = pos.match(/^(?:[a-z]+)?(\d+)[.-](\d+)/i))) { med = +m[1]; last = +m[2]; }
            else if (/^[A-Z]\d*$/i.test(pos)) { med = (((32 | pos.charCodeAt(0)) - 97) >> 1) + 1; last++; }
            else if ((m = pos.match(/^(\d+)/))) { if (+m[1] <= last) med++; last = +m[1]; }
            else { odd = true; last++; }
            while (mediums.length < med) {
                mediums.push({ format: formats[mediums.length] || formats[formats.length - 1] || null, name: heading, tracks: [] });
                heading = '';
            }
            const feat = (t.extraartists || []).filter(e => /^Featuring\b/.test(e.role || ''));
            const credit = t.artists && t.artists.length ? this.credit(t.artists, feat) : feat.length ? this.credit(r.artists, feat) : releaseCredit;
            const medium = mediums[med - 1];
            const sided = /Vinyl|Cassette|Shellac|Acetate/.test(medium.format || '');
            medium.tracks.push({ title, lengthMs: len, isrc: null, url: null, credit, number: sided && /^[A-Z]+[.-]?\d*$/i.test(pos) ? pos : null });
            Log.debug(`track ${pos} → medium ${med}: "${title}" — ${credit.map(c => c.name + c.join).join('')}${len ? '' : ' (no length)'}`);
        }
        if (odd) Log.warn('Discogs: some track positions could not be read; check the medium split');
        const empty = mediums.filter(x => !x.tracks.length).length;
        if (empty) Log.warn(`Discogs: ${empty} medium(s) without tracks`);
        if (mediums.length === 1) mediums[0].name = '';

        // labels; the same label listed twice with its catalog number written two ways is kept once
        const seen = new Set(), labels = [];
        for (const l of r.labels || []) {
            const none = l.id === this.NO_LABEL;
            const name = none ? '[no label]' : this.noNum(l.name);
            const catno = /^none$/i.test(l.catno || '') ? '[none]' : (l.catno || '');
            const key = normName(name) + '|' + catno.replace(/[\s.-]/g, '').toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            labels.push({ name, catno, url: none ? null : `https://www.discogs.com/label/${l.id}`, mbid: none ? '157afde4-4bf5-4039-8ad2-5a15acc85176' : null });
        }
        const barcode = ((r.identifiers || []).find(i => i.type === 'Barcode' && i.value) || {}).value;
        const [y, mo, d] = String(r.released || '').split(/\D+/).map(n => parseInt(n, 10));
        const country = DISCOGS_COUNTRIES[r.country] || null;
        if (r.country && !country) Log.info(`Discogs country "${r.country}" is no single MusicBrainz country; left for you`);
        const url = `https://www.discogs.com/release/${id}`;
        return {
            source: this.id,
            annotation: notesText(r.notes),
            url,
            title: r.title,
            credit: releaseCredit,
            types: primary ? [primary].concat(secondary) : secondary.length ? ['Album'].concat(secondary) : [],
            status,
            packaging,
            date: { year: y || null, month: mo || null, day: d || null },
            country,
            barcode: barcode ? barcode.replace(/[^\dX]/gi, '') : null,
            labels,
            urls: [{ url, linkType: 76 }],   // 76 = discogs
            mediums,
        };
    },
};

// Apple Music: its own catalogue API (amp-api.music.apple.com), read with the bearer token the
// web player's public JS carries — the way Platform Check, ISRC Scout and Credit Hoarder read
// it (#627). Unlike the iTunes Search API it has the UPC, each track's ISRC, the label and every
// track artist's Apple id. The storefront is the page's (music.apple.com/<sf>/album/…).
const APPLE = {
    id: 'apple',
    name: 'Apple Music',
    abbr: 'am',
    artistLinkType: 978,   // streaming page: MB offers several for Apple Music
    // MB stores an Apple Music artist under any storefront, without the slug
    urlForms(url) {
        const m = url.match(/^https?:\/\/(?:music|itunes)\.apple\.com\/([a-z]{2})\/artist\/(?:[^/?#]+\/)?(?:id)?(\d+)/i);
        if (!m) return [];
        const cc = m[1].toLowerCase();
        return [cc, ...APPLE_STOREFRONTS.filter(c => c !== cc)].map(c => `https://music.apple.com/${c}/artist/${m[2]}`);
    },
    host: /^music\.apple\.com$/,
    albumId(loc) {
        const m = loc.pathname.match(/^\/([a-z]{2})\/album\/(?:[^/]+\/)?(\d+)\/?$/i);
        return m ? `${m[1].toLowerCase()}/${m[2]}` : null;
    },
    // #659: amp-api needs a token Wayback can't send; the public iTunes lookup has the same album and tracks
    archiveApi(id) { const [cc, n] = id.split('/'); return `https://itunes.apple.com/lookup?id=${n}&entity=song&country=${cc}`; },
    TOKEN_KEY: 'fc.apple-token',
    _tok: null,
    async token(fresh) {
        if (this._tok && !fresh) return this._tok;
        if (!fresh) {
            const c = GM_getValue(this.TOKEN_KEY, null);
            if (c && c.t && Date.now() - c.at < 12 * 3600e3) return (this._tok = c.t);
        }
        Log.info('Apple Music: fetching the web player\'s token');
        const home = await gmText('https://music.apple.com/us/browse', { Accept: 'text/html' });
        const asset = (home.match(/\/assets\/index-legacy~[a-z0-9]+\.js/i) || home.match(/\/assets\/index~[a-z0-9]+\.js/i) || [])[0];
        if (!asset) throw new Error('Apple Music: the web player\'s JS was not found');
        const js = await gmText('https://music.apple.com' + asset, { Accept: '*/*' });
        const tok = (js.match(/eyJ[A-Za-z0-9._-]{80,}/) || [])[0];
        if (!tok) throw new Error('Apple Music: no token in the web player\'s JS');
        GM_setValue(this.TOKEN_KEY, { t: tok, at: Date.now() });
        return (this._tok = tok);
    },
    // one amp-api read; a 401 is a rotated token: fetch a new one, once
    async amp(path) {
        for (let attempt = 0; ; attempt++) {
            const tok = await this.token(attempt > 0);
            try {
                return await gmJson(`https://amp-api.music.apple.com${path}${path.includes('?') ? '&' : '?'}l=en-US`, { Authorization: 'Bearer ' + tok, Origin: 'https://music.apple.com' });
            } catch (e) {
                if (e.status === 401 && attempt === 0) { Log.warn('Apple Music: the token was refused (401), fetching a new one'); continue; }
                throw e;
            }
        }
    },
    // "Daft Punk, Pharrell Williams & Nile Rodgers" → its names, each with the Apple artist of that
    // name when the song lists one
    artists(text, rel, sf) {
        const byName = new Map((rel || []).map(a => [normName(a.attributes && a.attributes.name), a]));
        const url = a => (a.attributes && a.attributes.url) || `https://music.apple.com/${sf}/artist/${a.id}`;
        const names = String(text || '').split(/\s*,\s*|\s+&\s+/).map(n => n.trim()).filter(Boolean);
        const out = names.map(n => { const a = byName.get(normName(n)); return { name: n, url: a ? url(a) : null }; });
        // a listed artist the text leaves out (rare) still belongs in the credit
        for (const a of rel || []) if (!out.some(o => normName(o.name) === normName(a.attributes && a.attributes.name))) out.push({ name: a.attributes ? a.attributes.name : String(a.id), url: url(a) });
        return out;
    },

    // the iTunes Store sells the album when its lookup gives a price (a streaming-only one has none):
    // then its link is also 'purchase for download'. Unknown (the lookup failed) leaves it out.
    async forSale(sf, id) {
        try {
            const r = await gmJson(`https://itunes.apple.com/lookup?id=${id}&country=${sf}`);
            const c = ((r && r.results) || []).find(x => x.wrapperType === 'collection');
            Log.debug(`Apple Music: iTunes Store price ${c ? (c.collectionPrice ?? 'none') + ' ' + (c.currency || '') : 'not listed'} for ${sf}/${id}`);
            return !!(c && c.collectionPrice > 0);
        } catch (e) { Log.warn(`Apple Music: the iTunes Store lookup failed (${e.message}), so its link is a streaming page only`); return false; }
    },

    async fetchRelease(key, progress) {
        const [sf, id] = key.split('/');
        const forSale = this.forSale(sf, id);
        const j = await this.amp(`/v1/catalog/${sf}/albums/${id}?include=tracks,artists&include[songs]=artists`);
        const a = j && j.data && j.data[0];
        if (!a) throw new Error(`Apple Music: no album ${id} in the "${sf}" storefront`);
        const at = a.attributes || {};
        Log.info(`Apple Music album ${sf}/${id}: "${at.name}" by ${at.artistName} · ${at.trackCount} track(s) · ${at.releaseDate} · UPC ${at.upc || '—'} · label "${at.recordLabel || ''}"${at.isSingle ? ' · single' : ''}${at.isCompilation ? ' · compilation' : ''}`);

        const items = (a.relationships.tracks.data || []).slice();
        for (let next = a.relationships.tracks.next; next;) {
            const page = await this.amp(next + (next.includes('include') ? '' : '&include[songs]=artists'));
            items.push(...(page.data || []));
            next = page.next || null;
        }
        const videos = items.filter(t => t.type !== 'songs');
        if (videos.length) Log.info(`Apple Music: ${videos.length} music video(s) left out`);
        const songs = items.filter(t => t.type === 'songs');

        const mediums = [];
        songs.forEach((t, i) => {
            const x = t.attributes || {};
            const tf = splitFeat(x.name || '');
            const listed = this.artists(x.artistName, t.relationships && t.relationships.artists && t.relationships.artists.data, sf);
            const credit = creditFromTitle(listed, tf.feat);
            const disc = x.discNumber || 1;
            while (mediums.length < disc) mediums.push({ format: 'Digital Media', name: '', tracks: [] });
            mediums[disc - 1].tracks.push({ title: tf.title, lengthMs: x.durationInMillis || null, isrc: x.isrc || null, url: x.url || null, credit, pos: +x.trackNumber || null });
            progress && progress(i + 1, songs.length);
            Log.debug(`track ${disc}.${x.trackNumber}: "${tf.title}" — ${credit.map(c => c.name + c.join).join('')} (${x.isrc || 'no ISRC'})`);
        });

        // #684: an album can have tracks the storefront doesn't offer (Eddie Harris, "Artist's Choice":
        // 24 tracks, 1.9, 2.1, 2.4 and 2.6 not offered). The API leaves them out and numbers around
        // them. An empty track holds each missing position, so every song keeps its number (1.10 stays
        // 1.10) and the missing ones are filled in where they belong; the import asks first (askMissing).
        const at0 = new Map();
        items.forEach(t => { const x = t.attributes || {}, d = x.discNumber || 1; (at0.get(d) || at0.set(d, new Set()).get(d)).add(+x.trackNumber); });
        const gaps = [];
        [...at0.keys()].sort((a, b) => a - b).forEach(d => { const s = at0.get(d); for (let n = 1; n < Math.max(...s); n++) if (!s.has(n)) gaps.push(d + '.' + n); });
        const lack = Math.max((at.trackCount || 0) - items.length, gaps.length);
        const missing = lack ? { of: items.length + lack, count: lack, at: gaps } : null;
        if (missing) Log.warn(`Apple Music: the album has ${missing.of} tracks, ${lack} not offered in the "${sf}" storefront${gaps.length ? ` (${gaps.join(', ')}): an empty track at each` : ''}`);
        for (const g of gaps) {
            const [d, n] = g.split('.').map(Number);
            while (mediums.length < d) mediums.push({ format: 'Digital Media', name: '', tracks: [] });
            mediums[d - 1].tracks.push({ title: '', lengthMs: null, isrc: null, url: null, credit: [], pos: n, placeholder: true });
        }
        if (gaps.length) mediums.forEach(m => m.tracks.sort((p, q) => (p.pos || 0) - (q.pos || 0)));

        // " - Single" / " - EP" is Apple's label for the release, not part of its title
        const suffix = (String(at.name || '').match(/\s+-\s+(Single|EP)$/) || [])[1];
        const af = splitFeat(String(at.name || '').replace(/\s+-\s+(Single|EP)$/, ''));
        const relArtists = a.relationships.artists && a.relationships.artists.data;
        const credit = /^various artists$/i.test(at.artistName || '')
            ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }]
            : creditFromTitle(this.artists(at.artistName, relArtists, sf), af.feat);
        const [y, m, d] = String(at.releaseDate || '').split('-').map(n => parseInt(n, 10));
        const url = (at.url || `https://music.apple.com/${sf}/album/${id}`).replace(/\?.*$/, '');
        return {
            source: this.id,
            annotation: notesText(at.editorialNotes && (at.editorialNotes.standard || at.editorialNotes.short)),
            url,
            title: af.title,
            credit,
            types: (suffix ? [suffix] : at.isSingle ? ['Single'] : []).concat(at.isCompilation ? ['Compilation'] : []),
            status: 'official',
            packaging: 'None',
            date: { year: y || null, month: m || null, day: d || null },
            country: 'XW',
            barcode: at.upc || null,
            labels: at.recordLabel ? [{ name: at.recordLabel, catno: '' }] : [],
            // 980 = streaming page (paid), 74 = purchase for download when the iTunes Store sells it
            urls: [{ url, linkType: 980 }].concat(await forSale ? [{ url, linkType: 74 }] : []),
            mediums,
            missing,
        };
    },
};

// Tidal: the official catalogue API (openapi.tidal.com/v2) with an app token from the
// client-credentials grant — no login — as ISRC Scout reads it. One request has the album, its
// tracks and every artist (include=artists,items,items.artists); longer albums page on. Tidal
// has no label field, only a copyright line, which names the label most of the time: the label is
// read from it (labelFromCopyright), and left for you when it doesn't read as one name.
const TIDAL = {
    id: 'tidal',
    name: 'Tidal',
    abbr: 'td',
    host: /^(listen\.)?tidal\.com$/,
    albumId(loc) { const m = loc.pathname.match(/^\/(?:browse\/)?album\/(\d+)\/?$/); return m ? m[1] : null; },
    CLIENT: 'cRhhDJDpYXXBn82U:K7UX40jDOZ5p4y4JMYZgoiwKi7jymTHWcLMb4gkewKs=',
    COUNTRIES: ['US', 'GB', 'DE'],
    TOKEN_KEY: 'fc.tidal-token',
    TYPES: { ALBUM: ['Album'], EP: ['EP'], SINGLE: ['Single'] },
    artistUrl: id => `https://tidal.com/artist/${id}`,
    async token() {
        const c = GM_getValue(this.TOKEN_KEY, null);
        if (c && c.t && Date.now() < c.exp - 60000) return c.t;
        Log.info('Tidal: fetching an app token');
        const j = await gmPostJson('https://auth.tidal.com/v1/oauth2/token', 'grant_type=client_credentials', { Authorization: 'Basic ' + btoa(this.CLIENT) });
        if (!j || !j.access_token) throw new Error('Tidal: no app token');
        GM_setValue(this.TOKEN_KEY, { t: j.access_token, exp: Date.now() + (j.expires_in || 14400) * 1000 });
        return j.access_token;
    },
    // one read; a 429 (Tidal throttles hard) waits as long as it says, three times at most
    async get(path) {
        for (let attempt = 0; ; attempt++) {
            try {
                return await gmJson('https://openapi.tidal.com/v2' + path, { Authorization: 'Bearer ' + await this.token(), Accept: 'application/vnd.api+json' });
            } catch (e) {
                if (e.status === 401 && attempt === 0) { GM_deleteValue(this.TOKEN_KEY); continue; }
                if (e.status !== 429 || attempt >= 3) throw e;
                const wait = 1000 * 2 ** attempt;
                Log.warn(`Tidal: throttled (429), retrying in ${wait / 1000} s`);
                await new Promise(r => setTimeout(r, wait));
            }
        }
    },
    secs(iso) { const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/); return m ? ((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)) : 0; },

    async fetchRelease(id, progress) {
        let j = null, cc = null;
        for (const c of this.COUNTRIES) {
            try { j = await this.get(`/albums/${id}?countryCode=${c}&include=artists,items,items.artists`); cc = c; break; }
            catch (e) { if (e.status !== 404) throw e; Log.info(`Tidal: album ${id} is not in the ${c} catalogue`); }
        }
        if (!j || !j.data) throw new Error(`Tidal: album ${id} is in none of the ${this.COUNTRIES.join(', ')} catalogues`);
        const a = j.data, at = a.attributes || {};
        const included = new Map();
        const keep = list => (list || []).forEach(x => included.set(x.type + ':' + x.id, x));
        keep(j.included);
        const refs = ((a.relationships.items || {}).data || []).slice();
        for (let next = ((a.relationships.items || {}).links || {}).next; next;) {
            const page = await this.get(next.replace(/^.*\/v2/, '') + (/[?&]include=/.test(next) ? '' : '&include=items,items.artists'));
            keep(page.included);
            refs.push(...(page.data || []));
            next = (page.links || {}).next || null;
        }
        Log.info(`Tidal album ${id} (${cc}): "${at.title}" · ${at.albumType} · ${refs.length} item(s) · ${at.releaseDate} · UPC ${at.barcodeId || '—'} · ${(at.copyright || {}).text || 'no copyright line'}`);

        const artist = r => { const x = included.get('artists:' + r.id); return { name: x && x.attributes ? x.attributes.name : String(r.id), url: this.artistUrl(r.id) }; };
        const mediums = [];
        let videos = 0;
        refs.forEach((r, i) => {
            if (r.type !== 'tracks') { videos++; return; }
            const t = included.get('tracks:' + r.id) || {};
            const x = t.attributes || {};
            const tf = splitFeat(x.title || '');
            let title = tf.title;
            const vf = splitFeat(x.version || '');
            if (vf.title) title += ` (${vf.title.replace(/^\((.*)\)$/, '$1')})`;
            const listed = ((t.relationships && t.relationships.artists && t.relationships.artists.data) || []).map(artist);
            const credit = creditFromTitle(listed, tf.feat.length ? tf.feat : vf.feat);
            const disc = (r.meta && r.meta.volumeNumber) || 1;
            while (mediums.length < disc) mediums.push({ format: 'Digital Media', name: '', tracks: [] });
            mediums[disc - 1].tracks.push({ title, lengthMs: this.secs(x.duration) * 1000 || null, isrc: x.isrc || null, url: `https://tidal.com/track/${r.id}`, credit });
            progress && progress(i + 1, refs.length);
            Log.debug(`track ${disc}.${r.meta && r.meta.trackNumber}: "${title}" — ${credit.map(c => c.name + c.join).join('')} (${x.isrc || 'no ISRC'})`);
        });
        if (videos) Log.info(`Tidal: ${videos} video(s) left out`);

        const af = splitFeat(at.title || '');
        const listed = ((a.relationships.artists || {}).data || []).map(artist);
        const credit = listed.length === 1 && /^various artists$/i.test(listed[0].name)
            ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }]
            : creditFromTitle(listed, af.feat);
        const [y, m, d] = String(at.releaseDate || '').split('-').map(n => parseInt(n, 10));
        const url = `https://tidal.com/album/${id}`;
        return {
            source: this.id,
            url,
            title: af.title,
            credit,
            types: this.TYPES[at.albumType] || [],
            status: 'official',
            packaging: 'None',
            date: { year: y || null, month: m || null, day: d || null },
            country: 'XW',
            barcode: at.barcodeId || null,
            labels: (lbl => (lbl ? [{ name: lbl, catno: '' }] : []))(labelFromCopyright((at.copyright || {}).text)),
            urls: [{ url, linkType: 980 }],   // 980 = streaming page (paid)
            mediums,
        };
    },
};

// Qobuz: the store page itself (www.qobuz.com/<cc-ll>/album/<slug>/<id>). Qobuz's API answers
// only from the countries it serves, but the store page is rendered in full everywhere, so
// nothing is fetched. The page's per-track artist is unreliable (Qobuz shows a member, like
// Thomas Bangalter on a Daft Punk track), so an album by one artist credits its main artists on
// every track, with the title's feat.; only a Various Artists album takes the track's artist.
const QOBUZ = {
    id: 'qobuz',
    name: 'Qobuz',
    abbr: 'qz',
    artistLinkType: 176,   // purchase music for download: MB offers several for Qobuz
    // MB stores a Qobuz artist also as open.qobuz.com
    urlForms(url) {
        const m = url.match(/^https?:\/\/(?:www\.)?qobuz\.com\/[a-z]{2}-[a-z]{2}\/interpreter\/[^/]+\/(\d+)/i);
        return m ? [`https://open.qobuz.com/artist/${m[1]}`] : [];
    },
    host: /^www\.qobuz\.com$/,
    albumId(loc) { return /^\/[a-z]{2}-[a-z]{2}\/album\/[^/]+\/[A-Za-z0-9]+\/?$/.test(loc.pathname) ? loc.pathname.replace(/\/$/, '') : null; },
    hms(t) { const p = String(t || '').trim().split(':').map(Number); return p.length > 1 && p.every(Number.isFinite) ? p.reduce((a, n) => a * 60 + n, 0) * 1000 : null; },
    text: el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : ''),

    async fetchRelease(path, progress, doc) {
        doc = doc || document;
        let album = null, product = null;
        for (const sc of doc.querySelectorAll('script[type="application/ld+json"]')) {
            try { const j = JSON.parse(sc.textContent); if (j['@type'] === 'MusicAlbum') album = j; if (j['@type'] === 'Product') product = j; } catch (e) { Log.debug(`Qobuz ld+json: ${e.message}`); }
        }
        const title = this.text(doc.querySelector('.album-meta__title .album-title')) || (album && album.name) || '';
        if (!title) throw new Error('Qobuz: no album on this page');
        const root = new URL(path, originOf(doc));
        const mains = [...doc.querySelectorAll('.album-meta__item')].filter(li => /^\s*Main artists?\s*:/i.test(li.textContent))
            .flatMap(li => [...li.querySelectorAll('a[href*="/interpreter/"]')])
            .map(a => ({ name: (a.getAttribute('title') || this.text(a)).trim(), url: new URL(a.getAttribute('href'), root).href }));
        const shown = this.text(doc.querySelector('.album-meta__title .artist-name'));
        const labelA = [...doc.querySelectorAll('.album-meta__item a[href*="/label/"]')][0];
        const label = this.text(labelA);
        const upc = String((product && product.sku) || '').replace(/\D/g, '');
        const box = doc.querySelector('#playerTracks');
        const nb = box ? parseInt(box.getAttribute('data-nbTracks'), 10) : NaN, shownN = box ? parseInt(box.getAttribute('data-nbTracksDisplayed'), 10) : NaN;
        Log.info(`Qobuz album ${path}: "${title}" by ${shown} · main artists ${mains.map(m => m.name).join(', ') || '—'} · label "${label}" · ${album && album.datePublished} · UPC ${upc || '—'} · ${nb} track(s)${shownN < nb ? `, ${shownN} on the page` : ''}`);
        if (shownN < nb) Log.warn(`Qobuz: the page lists only ${shownN} of ${nb} tracks; the rest are left out`);

        const various = /^various artists$/i.test(shown) || (mains.length === 1 && /^various artists$/i.test(mains[0].name));
        const albumArtists = mains.length ? mains : (shown ? [{ name: shown }] : []);
        // one row per real track: the page also renders empty copies of each row for its layout
        const rows = [...doc.querySelectorAll('#playerTracks div.track[data-track]')];
        const mediums = [];
        let disc = 1, last = 0;
        rows.forEach((row, i) => {
            const name = this.text(row.querySelector('.track__item--name'));
            const n = parseInt(this.text(row.querySelector('.track__item--number')), 10) || (last + 1);
            if (n <= last) disc++;   // numbering starts over: the next disc
            last = n;
            const tf = splitFeat(name);
            let credit;
            if (various) {
                const raw = this.text(row.querySelector('.track__item--artist'));
                const af = splitFeat(raw);
                credit = creditFromTitle(String(af.title).split(/\s*,\s*|\s+&\s+/).filter(Boolean).map(x => ({ name: x })), tf.feat.length ? tf.feat : af.feat);
            } else credit = creditFromTitle(albumArtists, tf.feat);
            while (mediums.length < disc) mediums.push({ format: 'Digital Media', name: '', tracks: [] });
            mediums[disc - 1].tracks.push({ title: tf.title, lengthMs: this.hms(this.text(row.querySelector('.track__item--duration'))), isrc: null, url: null, credit });
            progress && progress(i + 1, rows.length);
            Log.debug(`track ${disc}.${n}: "${tf.title}" — ${credit.map(c => c.name + c.join).join('')}`);
        });
        const af = splitFeat(title);
        const credit = various ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }] : creditFromTitle(albumArtists, af.feat);
        const [y, m, d] = String((album && album.datePublished) || '').split('-').map(x => parseInt(x, 10));
        const url = originOf(doc) + path;
        return {
            source: this.id,
            annotation: notesText((doc.querySelector('#description .album-block__text') || {}).innerHTML),   // the album review
            url,
            title: af.title,
            credit,
            types: [],
            status: 'official',
            packaging: 'None',
            date: { year: y || null, month: m || null, day: d || null },
            country: 'XW',
            barcode: /^\d{12,14}$/.test(upc) ? upc : null,
            labels: label ? [{ name: label, catno: '', url: labelA ? new URL(labelA.getAttribute('href'), root).href : null }] : [],
            urls: [{ url, linkType: 74 }],   // 74 = purchase for download
            mediums,
        };
    },
};

// Beatport: the release page's Next.js data (__NEXT_DATA__), the way Harmony reads it: the
// release, and its tracks in a second query. The site is a single-page app, so after an in-app
// navigation the page's data is stale and the release page is fetched again (same origin, so it
// passes the site's bot check). More than one page of tracks is read from Beatport's API with
// the anonymous token the page carries.
const BEATPORT = {
    id: 'beatport',
    name: 'Beatport',
    abbr: 'bp',
    host: /^www\.beatport\.com$/,
    albumId(loc) { const m = loc.pathname.match(/^\/(?:[a-z]{2}\/)?release\/[^/]+\/(\d+)\/?$/i); return m ? m[1] : null; },
    TYPES: { Album: ['Album'], EP: ['EP'], Single: ['Single'], Compilation: ['Album', 'Compilation'] },
    url: (kind, x) => `https://www.beatport.com/${kind}/${x.slug || '-'}/${x.id}`,
    withoutPage: true,   // #745: a headless read whose page is refused goes through Platform Check (nextData)

    // the page's __NEXT_DATA__ when it is this release's, else the release page fetched anew
    async nextData(id, doc) {
        const read = d => { const el = d.querySelector('script#__NEXT_DATA__'); return el ? JSON.parse(el.textContent) : null; };
        const here = read(doc || document);
        const rel = here && here.props && here.props.pageProps && here.props.pageProps.release;
        if (rel && String(rel.id) === String(id)) { Log.debug('Beatport: the page\'s own data is this release\'s'); return here; }
        Log.info(`Beatport: the page's data is ${rel ? 'release ' + rel.id : 'not a release'}; fetching release ${id}`);
        let html;
        if (doc && doc.fcRefused) {
            // #745: the album page was refused already (mcRead): Platform Check, without asking Cloudflare again
            const api = await this.viaPc(id);
            if (api) return api;
            throw new Error(`Beatport: its bot check refused the release page, and Platform Check ${api === null ? 'isn\'t logged in to Beatport' : 'didn\'t answer'}: open a Beatport page once in this browser, or log in to Beatport in Platform Check`);
        }
        if (doc && doc.fcOrigin) {
            // #745: a headless read (Mission Control's). The page is behind Cloudflare, which refuses a request without the
            // browser's clearance cookie (403, "Just a moment..."): sent with the cookies, and when that's refused too, the
            // release is read through Platform Check, which asks Beatport's API with your login. The API's answer is the
            // page's own data, so it is read the same way.
            try {
                html = await gmText(`https://www.beatport.com/release/-/${id}`, { Accept: 'text/html' }, true);
                if (/<title>Just a moment/i.test(html)) throw Object.assign(new Error('Beatport\'s bot check (Cloudflare)'), { status: 403 });
            } catch (e) {
                Log.warn(`Beatport: the release page was refused (${e.message}); asking Platform Check for it through Beatport's API`);
                const api = await this.viaPc(id);
                if (api) return api;
                throw new Error(`Beatport: its bot check refused the release page, and Platform Check ${api === null ? 'isn\'t logged in to Beatport' : 'didn\'t answer'}: open a Beatport page once in this browser, or log in to Beatport in Platform Check`);
            }
        } else {
            const r = await fetch(`${location.origin}/release/-/${id}`, { credentials: 'include' });
            if (!r.ok) throw new Error(`Beatport: HTTP ${r.status} for release ${id}`);
            html = await r.text();
        }
        const got = read(new DOMParser().parseFromString(html, 'text/html'));
        if (!got) throw new Error('Beatport: no __NEXT_DATA__ on the release page (bot check?)');
        return got;
    },

    // #745: the release through Platform Check (pc:beatport-release), in the page data's shape; null when Platform Check
    // isn't logged in to Beatport, undefined when it doesn't answer
    viaPc(id) {
        return new Promise(resolve => {
            const req = Math.random().toString(36).slice(2);
            const on = e => {
                let d = null; try { d = JSON.parse(e.detail); } catch (x) { return; }
                if (!d || d.req !== req) return;
                document.removeEventListener('pc:beatport-release-result', on); clearTimeout(t);
                if (!d.release) { Log.warn(`Beatport via Platform Check: ${d.error || 'nothing'}`); resolve(null); return; }
                Log.info(`Beatport via Platform Check: release ${id}, ${(d.tracks || []).length} track(s) from the API`);
                resolve({ props: { pageProps: { release: d.release, dehydratedState: { queries: [{ state: { data: { results: d.tracks || [], next: null, count: (d.tracks || []).length } } }] } } } });
            };
            const t = setTimeout(() => { document.removeEventListener('pc:beatport-release-result', on); Log.warn('Beatport via Platform Check: no answer in 30 s'); resolve(undefined); }, 30000);
            document.addEventListener('pc:beatport-release-result', on);
            document.dispatchEvent(new CustomEvent('pc:beatport-release', { detail: JSON.stringify({ id, req }) }));
        });
    },

    async fetchRelease(id, progress, doc) {
        const nd = await this.nextData(id, doc);
        const pp = nd.props.pageProps;
        const r = pp.release;
        if (!r) throw new Error(`Beatport: no release ${id} in the page data`);
        const q = ((pp.dehydratedState || {}).queries || []).map(x => x.state && x.state.data).find(d => d && Array.isArray(d.results) && d.results.some(t => t.release && String(t.release.id) === String(id)));
        if (!q) throw new Error('Beatport: no tracks in the page data');
        const results = q.results.slice();
        for (let next = q.next; next;) {
            const tok = pp.anonSession && pp.anonSession.access_token;
            if (!tok) { Log.warn(`Beatport: ${q.count} tracks but no token to read past ${results.length}`); break; }
            // the page names an internal host; the same path answers on the public one
            const page = await gmJson(next.replace(/^https?:\/\/[^/]+/, 'https://api.beatport.com'), { Authorization: 'Bearer ' + tok });
            results.push(...(page.results || []));
            next = page.next || null;
        }
        Log.info(`Beatport release ${id}: "${r.name}" by ${(r.artists || []).map(a => a.name).join(', ')} · type ${(r.type || {}).name} · ${r.track_count} track(s), ${results.length} read · ${r.new_release_date} · UPC ${r.upc || '—'} · label "${(r.label || {}).name}" ${r.catalog_number || ''}`);

        // release.tracks lists the track URLs last to first; a track it misses keeps the API's order
        const byUrl = new Map(results.map(t => [t.url, t]));
        const order = (r.tracks || []).slice().reverse().map(u => byUrl.get(u)).filter(Boolean);
        const tracks = order.length === results.length ? order : results;
        if (tracks !== order) Log.warn(`Beatport: the release's track list matched ${order.length} of ${results.length} tracks; using the API's order`);
        const artist = a => ({ name: a.name, url: this.url('artist', a) });
        const list = tracks.map((t, i) => {
            const tf = splitFeat(t.name || '');
            const title = tf.title + (t.mix_name && !/^original mix$/i.test(t.mix_name) ? ` (${t.mix_name})` : '');
            const credit = creditFromTitle((t.artists || []).map(artist), tf.feat);
            progress && progress(i + 1, tracks.length);
            Log.debug(`track ${i + 1}: "${title}" — ${credit.map(c => c.name + c.join).join('')} (${t.isrc || 'no ISRC'})`);
            return { title, lengthMs: t.length_ms || null, isrc: t.isrc || null, url: this.url('track', t), credit };
        });

        // Beatport credits every track artist to the release; many of them mean Various Artists
        const ra = r.artists || [];
        const af = splitFeat(r.name || '');
        const credit = ra.length > 4 || (ra.length === 1 && /^various artists$/i.test(ra[0].name))
            ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }]
            : creditFromTitle(ra.map(artist), af.feat);
        const [y, m, d] = String(r.new_release_date || r.publish_date || '').split('-').map(n => parseInt(n, 10));
        const url = this.url('release', r);
        return {
            source: this.id,
            annotation: notesText(r.desc),
            url,
            title: af.title,
            credit,
            types: this.TYPES[(r.type || {}).name] || [],
            status: 'official',
            packaging: 'None',
            date: { year: y || null, month: m || null, day: d || null },
            country: 'XW',
            barcode: r.upc || null,
            labels: r.label ? [{ name: r.label.name, catno: r.catalog_number || '', url: this.url('label', r.label) }] : [],
            // 74 = purchase for download, 980 = streaming page (paid)
            urls: [{ url, linkType: 74 }].concat(r.is_available_for_streaming ? [{ url, linkType: 980 }] : []),
            mediums: [{ format: 'Digital Media', name: '', tracks: list }],
        };
    },
};

// Spotify: the web player's own album query (api-partner.spotify.com, "getAlbum"). The player's
// token is refused by Spotify's public API, and the query needs the player's token, client token
// and the query's current id, so FC listens to the player's requests from the start (early) and
// replays the album query with what it heard. The barcode comes from the player's metadata service
// (spclient, the same token), which the album query doesn't have. No ISRCs.
const SPOTIFY = {
    id: 'spotify',
    name: 'Spotify',
    abbr: 'sp',
    host: /^open\.spotify\.com$/,
    albumId(loc) { const m = loc.pathname.match(/^\/(?:intl-[a-z-]+\/)?album\/([A-Za-z0-9]{22})\/?$/); return m ? m[1] : null; },
    TYPES: { ALBUM: ['Album'], SINGLE: ['Single'], EP: ['EP'], COMPILATION: ['Album', 'Compilation'] },
    // #650 (majkinetor: "Spotify fails" — the player's album query was never heard). The hook took
    // only fetch(url, init) with a string body: a Request object, an XHR, or a userscript manager
    // that starts the script after the player's first query all slipped past it. Now the token
    // comes from ANY authorised request of the player (fetch or XHR, Request or init), the query id
    // from its getAlbum when heard and a known one otherwise, and the log says what was heard.
    QUERY_URL: 'https://api-partner.spotify.com/pathfinder/v2/query',
    GETALBUM_HASH: '6a74b456cd1735c9193d9e8ec8cc5184cad7ce13572210315229db3975964361',   // the player's getAlbum id on 2026-10-01
    KEEP: ['authorization', 'client-token', 'app-platform', 'spotify-app-version', 'accept-language'],
    auth: null,        // { headers } of the player's last authorised request
    hash: null,        // getAlbum's query id, when the player's own getAlbum was heard
    seen: 0,           // requests to Spotify's APIs the hook saw (for the log)
    note(url, headers, body) {
        if (!/^https:\/\/[^/]*spotify\.com\//.test(url) || /open\.spotify\.com\//.test(url)) return;
        this.seen++;
        const h = {};
        for (const k of this.KEEP) if (headers[k]) h[k] = headers[k];
        if (h.authorization) {
            if (!this.auth) Log.debug(`Spotify: heard the player's token (${url.replace(/\?.*$/, '')}; ${Object.keys(h).join(', ')})`);
            this.auth = { headers: h };
        }
        if (typeof body === 'string' && /"getAlbum"/.test(body)) {
            try {
                const hash = JSON.parse(body).extensions.persistedQuery.sha256Hash;
                if (hash && hash !== this.hash) Log.debug(`Spotify: heard the player's album query (id ${hash.slice(0, 12)}…)`);
                if (hash) this.hash = hash;
            } catch (e) { Log.debug(`Spotify: an album query I couldn't read: ${e.message}`); }
        }
    },
    early() {
        const w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        const self = this;
        const lower = src => {
            const h = {};
            try {
                if (src && typeof src.forEach === 'function') src.forEach((v, k) => { h[String(k).toLowerCase()] = v; });
                else if (src) Object.keys(src).forEach(k => { h[k.toLowerCase()] = src[k]; });
            } catch (e) { /* unreadable headers */ }
            return h;
        };
        /* #817: in Firefox the script runs in a sandbox (exportFunction exists) and the page's own
           calls into a sandbox-wrapped fetch/XHR hand the player sandbox objects it may not read
           ("Permission denied to access property length"): the player stops. There only the
           in-page hook listens, which runs as the page's own code. */
        if (typeof exportFunction === 'function') {
            Log.debug('Spotify: sandboxed (Firefox): listening with the in-page hook only');
            this.inPage();
            return;
        }
        const origFetch = w.fetch;
        if (typeof origFetch === 'function') {
            const hook = function (input, init) {
                try {
                    const isReq = input && typeof input === 'object' && 'url' in input;
                    const url = String(isReq ? input.url : input || '');
                    const headers = Object.assign(isReq ? lower(input.headers) : {}, lower(init && init.headers));
                    const body = init && typeof init.body === 'string' ? init.body : null;
                    if (body !== null || !isReq) self.note(url, headers, body);
                    else if (/pathfinder/.test(url)) {
                        // a Request carries its body inside: read a copy, the page reads the original
                        self.note(url, headers, null);
                        input.clone().text().then(t => self.note(url, {}, t), () => {});
                    } else self.note(url, headers, null);
                } catch (e) { Log.debug(`Spotify hook (fetch): ${e.message}`); }
                return origFetch.apply(this, arguments);
            };
            w.fetch = typeof exportFunction === 'function' ? exportFunction(hook, w) : hook;
        }
        const XP = w.XMLHttpRequest && w.XMLHttpRequest.prototype;
        if (XP) {
            const oOpen = XP.open, oSet = XP.setRequestHeader, oSend = XP.send;
            const wrap = fn => (typeof exportFunction === 'function' ? exportFunction(fn, w) : fn);
            XP.open = wrap(function (method, url) { try { this.__fcUrl = String(url); this.__fcH = {}; } catch (e) { /* ignore */ } return oOpen.apply(this, arguments); });
            XP.setRequestHeader = wrap(function (k, v) { try { if (this.__fcH) this.__fcH[String(k).toLowerCase()] = v; } catch (e) { /* ignore */ } return oSet.apply(this, arguments); });
            XP.send = wrap(function (body) { try { if (this.__fcUrl) self.note(this.__fcUrl, this.__fcH || {}, typeof body === 'string' ? body : null); } catch (e) { Log.debug(`Spotify hook (XHR): ${e.message}`); } return oSend.apply(this, arguments); });
        }
        Log.debug(`Spotify: listening to the player's requests (fetch${XP ? ' and XHR' : ''}, document ${document.readyState})`);
        this.inPage();
    },
    /* majkinetor's log: "the hook saw 0 request(s) to Spotify's APIs", hooked while the document was
       still loading. His userscript manager runs the script in its own sandbox, where unsafeWindow's
       fetch isn't the page's: the hook above wraps a fetch the player never calls. So the same hook
       also goes into the page itself, as a script — Spotify's policy refuses inline scripts but
       allows blob: ones — and tells the userscript what it hears with a DOM event, which crosses
       the sandbox. In a manager that does share the page's window both hooks run; a request heard
       twice is the same request. */
    inPage() {
        const EV = 'first-contact:spotify-heard';
        document.addEventListener(EV, e => {
            try { const d = JSON.parse(e.detail); if (!this._fromPage) { this._fromPage = true; Log.debug('Spotify: the in-page hook is hearing the player'); } this.note(d.url, d.headers || {}, d.body); }
            catch (x) { Log.debug(`Spotify (in-page hook): ${x.message}`); }
        });
        const code = '(' + function (EV) {
            if (window.__fcSpotifyHook) return; window.__fcSpotifyHook = true;
            const tell = (url, headers, body) => { try { document.dispatchEvent(new CustomEvent(EV, { detail: JSON.stringify({ url: String(url), headers, body: typeof body === 'string' ? body : null }) })); } catch (e) { /* nothing to tell with */ } };
            const lower = src => { const h = {}; try { if (src && typeof src.forEach === 'function') src.forEach((v, k) => { h[String(k).toLowerCase()] = v; }); else if (src) Object.keys(src).forEach(k => { h[k.toLowerCase()] = src[k]; }); } catch (e) { /* unreadable */ } return h; };
            const spot = u => /^https:\/\/[^/]*spotify\.com\//.test(u) && !/open\.spotify\.com\//.test(u);
            const of = window.fetch;
            window.fetch = function (input, init) {
                try {
                    const isReq = input && typeof input === 'object' && 'url' in input;
                    const url = String(isReq ? input.url : input || '');
                    if (spot(url)) {
                        const headers = Object.assign(isReq ? lower(input.headers) : {}, lower(init && init.headers));
                        if (init && typeof init.body === 'string') tell(url, headers, init.body);
                        else { tell(url, headers, null); if (isReq && /pathfinder/.test(url)) input.clone().text().then(t => tell(url, {}, t), () => {}); }
                    }
                } catch (e) { /* never in the player's way */ }
                return of.apply(this, arguments);
            };
            const XP = XMLHttpRequest.prototype, oo = XP.open, os = XP.setRequestHeader, osd = XP.send;
            XP.open = function (m, u) { this.__fcU = String(u); this.__fcH = {}; return oo.apply(this, arguments); };
            XP.setRequestHeader = function (k, v) { if (this.__fcH) this.__fcH[String(k).toLowerCase()] = v; return os.apply(this, arguments); };
            XP.send = function (b) { try { if (this.__fcU && spot(this.__fcU)) tell(this.__fcU, this.__fcH || {}, typeof b === 'string' ? b : null); } catch (e) { /* never in the way */ } return osd.apply(this, arguments); };
        } + ')(' + JSON.stringify(EV) + ');';
        try {
            const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
            const el = document.createElement('script');
            let src = url;
            try {   // a page that enforces Trusted Types takes a script URL only from a policy
                if (window.trustedTypes && window.trustedTypes.createPolicy) src = window.trustedTypes.createPolicy('first-contact-' + Math.random().toString(36).slice(2, 7), { createScriptURL: x => x }).createScriptURL(url);
            } catch (e) { /* no policy: the plain URL */ }
            el.src = src;
            el.onload = () => { Log.debug('Spotify: the in-page hook is in'); el.remove(); URL.revokeObjectURL(url); };
            el.onerror = () => Log.warn('Spotify: the page refused the in-page hook');
            // at document-start there may be no <html> yet to put it in: wait for it
            const put = () => { const at = document.head || document.documentElement; if (at) { at.appendChild(el); return true; } return false; };
            if (!put()) new MutationObserver((m, o) => { if (put()) o.disconnect(); }).observe(document, { childList: true, subtree: true });
        } catch (e) { Log.warn(`Spotify: no in-page hook: ${e.message}`); }
    },
    post(body) {
        const url = this.QUERY_URL, headers = this.auth.headers;
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST', url, data: JSON.stringify(body), timeout: 20000, anonymous: true,
                headers: Object.assign({}, headers, { 'content-type': 'application/json;charset=UTF-8', accept: 'application/json' }),
                onload: r => {
                    Log.debug(`POST ${url} (getAlbum offset ${body.variables.offset}) → ${r.status}, ${(r.responseText || '').length} b`);
                    if (r.status < 200 || r.status >= 300) return reject(Object.assign(new Error(`Spotify: HTTP ${r.status} for the album query`), { status: r.status }));
                    try { resolve(JSON.parse(r.responseText)); } catch (e) { reject(new Error(`Spotify: bad JSON: ${e.message}`)); }
                },
                onerror: () => reject(new Error('Spotify: network error')),
                ontimeout: () => reject(new Error('Spotify: timeout')),
            });
        });
    },
    idOf: uri => String(uri || '').split(':').pop(),
    // base62 id → the 32-hex gid the metadata service names things by
    gidOf(id) {
        const A = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let n = 0n;
        for (const c of id) n = n * 62n + BigInt(A.indexOf(c));
        return n.toString(16).padStart(32, '0');
    },
    // majkinetor: "FC didn't get barcode" (album 0QPZBEO7W3gho2UiFBPJz2, UPC 881626542866). The
    // player's album query has none; its metadata service has the album's external ids (upc).
    // Optional: without it the import goes on, barcode empty.
    upc(id) {
        const url = `https://spclient.wg.spotify.com/metadata/4/album/${this.gidOf(id)}?market=from_token`;
        return new Promise(resolve => {
            GM_xmlhttpRequest({
                method: 'GET', url, timeout: 15000, anonymous: true,
                headers: Object.assign({}, this.auth.headers, { accept: 'application/json' }),
                onload: r => {
                    let upc = null;
                    try { upc = ((JSON.parse(r.responseText).external_id || []).find(x => /^upc$/i.test(x.type) && x.id) || {}).id || null; } catch (e) { /* not JSON: no barcode */ }
                    Log.debug(`GET ${url} → ${r.status}, ${(r.responseText || '').length} b, UPC ${upc || '—'}`);
                    resolve(upc && /^\d{8,14}$/.test(upc) ? upc : null);
                },
                onerror: () => { Log.warn('Spotify: no barcode (the metadata service could not be reached)'); resolve(null); },
                ontimeout: () => { Log.warn('Spotify: no barcode (the metadata service timed out)'); resolve(null); },
            });
        });
    },

    async fetchRelease(id, progress) {
        for (let i = 0; !this.auth && i < 50; i++) await new Promise(r => setTimeout(r, 100));
        Log.info(`Spotify: the hook saw ${this.seen} request(s) to Spotify's APIs; token ${this.auth ? 'heard' : 'not heard'}; album query id ${this.hash ? 'heard' : 'not heard, using the known one'}`);
        if (!this.auth) throw new Error(this.seen ? 'Spotify: the player\u2019s requests carried no token; reload the page and try again'
            : 'Spotify: no request of the player was heard. Your userscript manager may start First Contact too late on Spotify; reload the page, and if it persists, copy the log to #650');
        const hash = this.hash || this.GETALBUM_HASH;
        const page = offset => this.post({ variables: { uri: `spotify:album:${id}`, locale: '', offset, limit: 50 }, operationName: 'getAlbum', extensions: { persistedQuery: { version: 1, sha256Hash: hash } } });
        const upcP = this.upc(id);   // alongside the album query
        const first = await page(0);
        const a = first && first.data && first.data.albumUnion;
        if (!a || !a.name) throw new Error(`Spotify: no album ${id}${first && first.errors ? ': ' + JSON.stringify(first.errors).slice(0, 200) : ''}`);
        const items = (a.tracksV2.items || []).slice();
        while (items.length < a.tracksV2.totalCount) {
            const more = await page(items.length);
            const got = (((more.data || {}).albumUnion || {}).tracksV2 || {}).items || [];
            if (!got.length) break;
            items.push(...got);
        }
        Log.info(`Spotify album ${id}: "${a.name}" by ${a.artists.items.map(x => x.profile.name).join(', ')} · ${a.type} · ${items.length} of ${a.tracksV2.totalCount} track(s) · ${a.date && a.date.isoString} (${a.date && a.date.precision}) · label "${a.label || ''}" · UPC ${(await upcP) || '—'}`);

        const artist = x => ({ name: x.profile.name, url: `https://open.spotify.com/artist/${this.idOf(x.uri)}` });
        const mediums = [];
        items.forEach((it, i) => {
            const t = it.track || {};
            const tf = splitFeat(t.name || '');
            const credit = creditFromTitle(((t.artists || {}).items || []).map(artist), tf.feat);
            const disc = t.discNumber || 1;
            while (mediums.length < disc) mediums.push({ format: 'Digital Media', name: '', tracks: [] });
            mediums[disc - 1].tracks.push({ title: tf.title, lengthMs: (t.duration && t.duration.totalMilliseconds) || null, isrc: null, url: `https://open.spotify.com/track/${this.idOf(t.uri)}`, credit });
            progress && progress(i + 1, items.length);
            Log.debug(`track ${disc}.${t.trackNumber}: "${tf.title}" — ${credit.map(c => c.name + c.join).join('')}`);
        });

        const ra = a.artists.items || [];
        const af = splitFeat(a.name);
        const credit = ra.length === 1 && /^various artists$/i.test(ra[0].profile.name)
            ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }]
            : creditFromTitle(ra.map(artist), af.feat);
        const p = (a.date && a.date.precision) || '';
        const [y, m, d] = String((a.date && a.date.isoString) || '').slice(0, 10).split('-').map(n => parseInt(n, 10));
        const url = `https://open.spotify.com/album/${id}`;
        return {
            source: this.id,
            url,
            title: af.title,
            credit,
            types: this.TYPES[a.type] || [],
            status: 'official',
            packaging: 'None',
            date: { year: y || null, month: p === 'YEAR' ? null : m || null, day: p === 'DAY' ? d || null : null },
            country: 'XW',
            barcode: await upcP,
            labels: a.label ? [{ name: a.label, catno: '' }] : [],
            urls: [{ url, linkType: 85 }],   // 85 = stream for free
            mediums,
        };
    },
};

// YouTube Music: the API its own web player uses (youtubei/v1), which answers anonymous
// requests — as Platform Check and Credit Hoarder read it. The album page (browse MPREb_…) has
// the title, the kind (Album / EP / Single), the year, and each track with its artists' channels
// and length; an album playlist (OLAK5uy_…) names its album page. No label, barcode, ISRCs or
// full date: the player doesn't show them. YouTube Music lists a featured artist as a main
// one, so feat. comes from the title, as on Deezer.
const YTMUSIC = {
    id: 'ytmusic',
    name: 'YouTube Music',
    abbr: 'ytm',
    host: /^(?:music|www)\.youtube\.com$/,   // #679: an album playlist (OLAK5uy_) on www.youtube.com is the same album
    albumId(loc) {
        const b = loc.pathname.match(/^\/browse\/(MPREb_[\w-]+)\/?$/);
        if (b) return b[1];
        const l = loc.pathname === '/playlist' && String(loc.search || '').match(/[?&]list=(OLAK5uy_[\w-]+)/);
        return l ? 'list:' + l[1] : null;
    },
    API: 'https://music.youtube.com/youtubei/v1/',
    CLIENT: { clientName: 'WEB_REMIX', clientVersion: '1.20250101.01.00', hl: 'en', gl: 'US' },
    TYPES: { Album: ['Album'], EP: ['EP'], Single: ['Single'] },
    call(endpoint, body) {
        const url = `${this.API}${endpoint}?prettyPrint=false`;
        const t0 = Date.now();
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST', url, data: JSON.stringify(Object.assign({ context: { client: this.CLIENT } }, body)), timeout: 20000, anonymous: true,
                headers: { 'Content-Type': 'application/json' },
                onload: r => {
                    Log.debug(`POST ${url} ${body.browseId || ''} → ${r.status}, ${(r.responseText || '').length} b in ${Date.now() - t0} ms`);
                    if (r.status < 200 || r.status >= 300) return reject(new Error(`YouTube Music: HTTP ${r.status} for ${body.browseId}`));
                    try { resolve(JSON.parse(r.responseText)); } catch (e) { reject(new Error(`YouTube Music: bad JSON for ${body.browseId}`)); }
                },
                onerror: () => reject(new Error('YouTube Music: network error')),
                ontimeout: () => reject(new Error('YouTube Music: timeout')),
            });
        });
    },
    text: t => (t && t.runs ? t.runs.map(x => x.text).join('') : (t && t.simpleText) || ''),
    walk(o, fn) { if (!o || typeof o !== 'object') return; fn(o); for (const k in o) this.walk(o[k], fn); },
    // the artists a run list links: "Daft Punk, Pharrell Williams & Nile Rodgers", each with its channel
    artists(t) {
        return ((t && t.runs) || []).filter(r => {
            const b = r.navigationEndpoint && r.navigationEndpoint.browseEndpoint;
            return b && /^UC/.test(b.browseId || '');
        }).map(r => ({ name: r.text.trim(), url: `https://music.youtube.com/channel/${r.navigationEndpoint.browseEndpoint.browseId}` }));
    },
    hms(s) { const p = String(s || '').trim().split(':').map(Number); return p.length > 1 && p.every(Number.isFinite) ? p.reduce((a, n) => a * 60 + n, 0) * 1000 : null; },

    async fetchRelease(key, progress) {
        let id = key;
        if (/^list:/.test(key)) {
            const list = key.slice(5);
            const pl = await this.call('browse', { browseId: 'VL' + list });
            id = (JSON.stringify(pl).match(/"(MPREb_[\w-]+)"/) || [])[1];
            Log.info(`YouTube Music: playlist ${list} → album page ${id || 'none'}`);
            if (!id) throw new Error(`YouTube Music: playlist ${list} names no album`);
        }
        const j = await this.call('browse', { browseId: id });
        let h = null, shelf = null;
        this.walk(j, o => { if (!h && o.musicResponsiveHeaderRenderer) h = o.musicResponsiveHeaderRenderer; if (!shelf && o.musicShelfRenderer) shelf = o.musicShelfRenderer; });
        if (!h || !shelf) throw new Error(`YouTube Music: no album on ${id} (the page may have changed)`);
        const title = this.text(h.title);
        const sub = this.text(h.subtitle).split(' • ');   // "Album • 2013"
        const kind = sub[0] || '', year = parseInt(sub.find(s => /^\d{4}$/.test(s)) || '', 10) || null;
        const albumArtists = this.artists(h.straplineTextOne);
        const canon = (j.microformat && j.microformat.microformatDataRenderer && j.microformat.microformatDataRenderer.urlCanonical) || '';
        const list = (canon.match(/[?&]list=(OLAK5uy_[\w-]+)/) || [])[1];
        const rows = (shelf.contents || []).map(c => c.musicResponsiveListItemRenderer).filter(Boolean);
        Log.info(`YouTube Music album ${id}: "${title}" by ${this.text(h.straplineTextOne)} · ${kind} · ${year || 'no year'} · ${this.text(h.secondSubtitle)} · ${rows.length} row(s)${list ? ' · playlist ' + list : ''}`);

        const tracks = rows.map((r, i) => {
            const cols = (r.flexColumns || []).map(c => c.musicResponsiveListItemFlexColumnRenderer && c.musicResponsiveListItemFlexColumnRenderer.text);
            const name = this.text(cols[0]);
            const tf = splitFeat(name);
            const listed = this.artists(cols[1]);
            const credit = creditFromTitle(listed.length ? listed : albumArtists, tf.feat);
            const len = this.hms(this.text((((r.fixedColumns || [])[0] || {}).musicResponsiveListItemFixedColumnRenderer || {}).text));
            const vid = ((((cols[0] || {}).runs || [])[0] || {}).navigationEndpoint || {}).watchEndpoint;
            progress && progress(i + 1, rows.length);
            Log.debug(`track ${this.text(r.index) || i + 1}: "${tf.title}" — ${credit.map(c => c.name + c.join).join('')} (${len || '?'} ms)`);
            return { title: tf.title, lengthMs: len, isrc: null, url: vid && vid.videoId ? `https://music.youtube.com/watch?v=${vid.videoId}` : null, credit };
        });

        const af = splitFeat(title);
        const credit = /^various artists$/i.test(this.text(h.straplineTextOne))
            ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }]
            : creditFromTitle(albumArtists.length ? albumArtists : [{ name: this.text(h.straplineTextOne) }], af.feat);
        const url = list ? `https://music.youtube.com/playlist?list=${list}` : `https://music.youtube.com/browse/${id}`;
        return {
            source: this.id,
            annotation: notesText(this.text(h.description && h.description.musicDescriptionShelfRenderer && h.description.musicDescriptionShelfRenderer.description)),
            url,
            title: af.title,
            credit,
            types: this.TYPES[kind] || [],
            status: 'official',
            packaging: 'None',
            date: { year, month: null, day: null },
            country: 'XW',
            barcode: null,
            labels: [],
            urls: [{ url, linkType: 85 }],   // 85 = stream for free
            mediums: [{ format: 'Digital Media', name: '', tracks }],
        };
    },
};

// Volumo: its public API (volumo.com/api/v1), as ISRC Scout and Platform Check read it — no token.
// The album page is /album/<barcode>-<slug> (or /album/<id>); the barcode form asks
// /album_by_icpn, the id form /albums. Every track has its ISRC and every artist its Volumo id.
const VOLUMO = {
    id: 'volumo',
    name: 'Volumo',
    abbr: 'vo',
    artistLinkType: 176,   // MB doesn't recognise Volumo
    host: /^(www\.)?volumo\.com$/,
    albumId(loc) { const m = loc.pathname.match(/^\/album\/(\d+)(?:-[^/]*)?\/?$/); return m ? m[1] : null; },
    artist: a => ({ name: a.name, url: `https://volumo.com/artist/${a.id}` }),

    async fetchRelease(id, progress) {
        const j = await gmJson('https://volumo.com/api/v1' + (id.length >= 12 ? '/album_by_icpn/' : '/albums/') + id);
        const a = Array.isArray(j) ? j[0] : (j && (j.album || j));
        if (!a || !a.title) throw new Error(`Volumo: no album ${id}`);
        const list = a.tracks || [];
        Log.info(`Volumo album ${id}: "${a.title}" by ${(a.artists || []).map(x => x.name).join(', ')} · ${list.length} track(s) · ${a.original_release_date || a.release_start_at || 'no date'} · UPC ${a.icpn || '—'} · label "${(a.recordlabel || {}).name || ''}" ${a.catalog_number || ''}`);
        const mediums = [];
        list.forEach((t, i) => {
            const tf = splitFeat(t.title || '');
            const title = tf.title + (t.version && !/^original mix$/i.test(t.version) ? ` (${t.version})` : '');
            const credit = creditFromTitle((t.artists || []).map(this.artist).concat((t.featured_artists || []).map(this.artist)), tf.feat.length ? tf.feat : (t.featured_artists || []).map(x => x.name));
            const disc = t.disc_number || 1;
            while (mediums.length < disc) mediums.push({ format: 'Digital Media', name: '', tracks: [] });
            mediums[disc - 1].tracks.push({ title, lengthMs: Math.round(t.duration) || null, isrc: t.isrc || null, url: t.id ? `https://volumo.com/track/${t.id}` : null, credit });
            progress && progress(i + 1, list.length);
            Log.debug(`track ${i + 1}: "${title}" — ${credit.map(c => c.name + c.join).join('')} (${t.isrc || 'no ISRC'})`);
        });
        const ra = a.artists || [];
        const af = splitFeat(a.title);
        // a label's sampler credits every track artist to the release: many of them mean Various Artists
        const credit = ra.length > 4 || (ra.length === 1 && /^various artists$/i.test(ra[0].name))
            ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }]
            : creditFromTitle(ra.map(this.artist), af.feat);
        const [y, m, d] = String(a.original_release_date || a.release_start_at || '').slice(0, 10).split('-').map(n => parseInt(n, 10));
        const url = `https://volumo.com/album/${a.icpn || a.id}`;   // the slug-less form (Platform Check #202)
        return {
            source: this.id,
            annotation: notesText(a.description),
            url,
            title: af.title,
            credit,
            types: [],
            status: 'official',
            packaging: 'None',
            date: { year: y || null, month: m || null, day: d || null },
            country: 'XW',
            barcode: a.icpn || null,
            labels: a.recordlabel && a.recordlabel.name ? [{ name: a.recordlabel.name, catno: a.catalog_number || '' }] : [],
            urls: [{ url, linkType: 74 }],   // 74 = purchase for download
            mediums,
        };
    },
};

// HDtracks: its public API (hdtracks.azurewebsites.net/api/v1), as ISRC Scout reads it — one
// call has the album and every track with its ISRC. The site routes in the address's hash
// (www.hdtracks.com/#/album/<id>). HDtracks names artists only, with no artist pages.
const HDTRACKS = {
    id: 'hdtracks',
    name: 'HDtracks',
    abbr: 'hd',
    artistLinkType: 176,   // MB doesn't recognise HDtracks
    host: /^(www\.)?hdtracks\.com$/,
    albumId(loc) { const m = String(loc.hash || '').match(/^#\/album\/([a-f0-9]{24})\b/i) || loc.pathname.match(/^\/album\/([a-f0-9]{24})\/?$/i); return m ? m[1] : null; },
    API: 'https://hdtracks.azurewebsites.net/api/v1',

    async fetchRelease(id, progress) {
        const j = await gmJson(`${this.API}/album/${id}`);
        if (!j || !j.id) throw new Error(`HDtracks: no album ${id}`);   // an unknown id answers 200 with nothing in it
        const list = (j.tracks || []).slice().sort((a, b) => (a.discIndex || 1) - (b.discIndex || 1) || (a.index || 0) - (b.index || 0));
        Log.info(`HDtracks album ${id}: "${j.name}" by ${j.mainArtist} · ${list.length} track(s) · ${j.release || j.originalRelease || 'no date'} · UPC ${j.upc || '—'} · label "${j.label || ''}" · ${j.quality || ''}`);
        const names = text => String(text || '').split(/\s*,\s*|\s+&\s+/).filter(Boolean).map(name => ({ name }));
        const mediums = [];
        list.forEach((t, i) => {
            const tf = splitFeat(t.name || '');
            const credit = creditFromTitle(names(t.mainArtist || j.mainArtist), tf.feat);
            const disc = t.discIndex || 1;
            while (mediums.length < disc) mediums.push({ format: 'Digital Media', name: '', tracks: [] });
            mediums[disc - 1].tracks.push({ title: tf.title, lengthMs: t.duration ? Math.round(t.duration * 1000) : null, isrc: t.isrc || null, url: null, credit });
            progress && progress(i + 1, list.length);
            Log.debug(`track ${disc}.${t.index}: "${tf.title}" — ${credit.map(c => c.name + c.join).join('')} (${t.isrc || 'no ISRC'})`);
        });
        const af = splitFeat(j.name || '');
        const credit = /^various artists$/i.test(j.mainArtist || '')
            ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }]
            : creditFromTitle(names(j.mainArtist), af.feat);
        const [y, m, d] = String(j.release || j.originalRelease || '').slice(0, 10).split('-').map(n => parseInt(n, 10));
        const url = `https://www.hdtracks.com/#/album/${id}`;
        return {
            source: this.id,
            annotation: notesText(j.notes),
            url,
            title: af.title,
            credit,
            types: [],
            status: 'official',
            packaging: 'None',
            date: { year: y || null, month: m || null, day: d || null },
            country: 'XW',
            barcode: j.upc || null,
            labels: j.label ? [{ name: j.label, catno: '' }] : [],
            urls: [{ url, linkType: 74 }],   // 74 = purchase for download
            mediums,
        };
    },
};

// SoundCloud: its public API (api-v2.soundcloud.com) with the client id the web player's JS
// carries, as ISRC Scout reads it. A set (/<user>/sets/<slug>) is the release; a set the label
// distributed has each track's ISRC, the barcode and the label in the track's publisher data.
const SOUNDCLOUD = {
    id: 'soundcloud',
    name: 'SoundCloud',
    abbr: 'sc',
    host: /^soundcloud\.com$/,
    albumId(loc) { return /^\/[^/]+\/sets\/[^/]+\/?$/.test(loc.pathname) ? loc.pathname.replace(/\/$/, '') : null; },
    API: 'https://api-v2.soundcloud.com',
    CID_KEY: 'fc.soundcloud-cid',
    TYPES: { album: ['Album'], ep: ['EP'], single: ['Single'], compilation: ['Album', 'Compilation'] },
    async clientId(fresh) {
        const c = !fresh && GM_getValue(this.CID_KEY, null);
        if (c && c.id && Date.now() - c.at < 12 * 3600e3) return c.id;
        Log.info('SoundCloud: reading the web player\'s client id');
        const home = await gmText('https://soundcloud.com/discover', { Accept: 'text/html' });
        const assets = [...home.matchAll(/https:\/\/a-v2\.sndcdn\.com\/assets\/[^"']+\.js/g)].map(m => m[0]).reverse();
        for (const a of assets) {
            let js; try { js = await gmText(a, { Accept: '*/*' }); } catch (e) { continue; }
            const m = js.match(/client_id\s*[:=]\s*"([a-zA-Z0-9]{20,40})"/);
            if (m) { GM_setValue(this.CID_KEY, { id: m[1], at: Date.now() }); return m[1]; }
        }
        throw new Error('SoundCloud: no client id in the web player\'s JS');
    },
    async api(path) {
        for (let attempt = 0; ; attempt++) {
            const cid = await this.clientId(attempt > 0);
            try { return await gmJson(`${this.API}${path}${path.includes('?') ? '&' : '?'}client_id=${cid}`); }
            catch (e) { if ((e.status === 401 || e.status === 403) && attempt === 0) { Log.warn('SoundCloud: the client id was refused, reading a new one'); continue; } throw e; }
        }
    },

    async fetchRelease(path, progress) {
        const page = `https://soundcloud.com${path}`;
        const pl = await this.api('/resolve?url=' + encodeURIComponent(page));
        if (!pl || pl.kind !== 'playlist') throw new Error('SoundCloud: not a set');
        // the set names its first tracks in full and the rest by id: read those in batches of 50
        const byId = new Map((pl.tracks || []).filter(t => t && t.title).map(t => [t.id, t]));
        const missing = (pl.tracks || []).filter(t => t && !byId.has(t.id)).map(t => t.id);
        for (let i = 0; i < missing.length; i += 50) (await this.api('/tracks?ids=' + missing.slice(i, i + 50).join(','))).forEach(t => byId.set(t.id, t));
        const list = (pl.tracks || []).map(t => byId.get(t.id)).filter(Boolean);
        const pm0 = (list[0] && list[0].publisher_metadata) || {};
        Log.info(`SoundCloud set ${path}: "${pl.title}" by ${pl.user && pl.user.username} · ${pl.set_type || 'set'} · ${list.length} track(s) · ${pl.release_date || pl.published_at || pl.created_at || 'no date'} · label "${pl.label_name || ''}" · UPC ${pm0.upc_or_ean || '—'}`);

        const uploader = pl.user || {};
        const linkFor = name => (uploader.username && normName(name) === normName(uploader.username) ? uploader.permalink_url : null);   // only the uploader has a page we know
        const names = text => String(text || '').split(/\s*,\s*|\s+&\s+/).filter(Boolean).map(name => ({ name, url: linkFor(name) }));
        const tracks = list.map((t, i) => {
            const pm = t.publisher_metadata || {};
            const tf = splitFeat(t.title || '');
            const credit = creditFromTitle(names(pm.artist || uploader.username), tf.feat);
            progress && progress(i + 1, list.length);
            Log.debug(`track ${i + 1}: "${tf.title}" — ${credit.map(c => c.name + c.join).join('')} (${pm.isrc || 'no ISRC'})`);
            return { title: tf.title, lengthMs: t.full_duration || t.duration || null, isrc: pm.isrc || null, url: t.permalink_url || null, credit };
        });
        const artists = [...new Set(list.map(t => (t.publisher_metadata || {}).artist).filter(Boolean))];
        const af = splitFeat(pl.title || '');
        const credit = artists.length > 4 ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }]
            : creditFromTitle(names(artists.length === 1 ? artists[0] : uploader.username), af.feat);
        const upcs = [...new Set(list.map(t => String((t.publisher_metadata || {}).upc_or_ean || '').trim()).filter(Boolean))];
        const [y, m, d] = String(pl.release_date || pl.published_at || pl.created_at || '').slice(0, 10).split('-').map(n => parseInt(n, 10));
        const url = pl.permalink_url || page;
        return {
            source: this.id,
            annotation: notesText(pl.description),
            url,
            title: af.title,
            credit,
            types: this.TYPES[String(pl.set_type || '').toLowerCase()] || [],
            status: 'official',
            packaging: 'None',
            date: { year: y || null, month: m || null, day: d || null },
            country: 'XW',
            barcode: upcs.length === 1 ? upcs[0] : null,
            labels: pl.label_name ? [{ name: pl.label_name, catno: '' }] : [],
            urls: [{ url, linkType: 85 }],   // 85 = stream for free
            mediums: [{ format: 'Digital Media', name: '', tracks }],
        };
    },
};

// Amazon Music (#650, majkinetor: "implement AM"): the API its own web player uses
// (na.mesk.skill.music.a2z.com), as a guest — music.amazon.com/config.json hands out a session (CSRF
// token, device and session id, no login), carried as a JSON "headers" string in each request's body.
// Platform Check (#644) and ISRC Scout read it the same way. The guest session is amazon.com's (US)
// catalogue: an album from another country's store is looked up by the same id there. The album
// page is one flat tracklist (no disc numbers), with each track's length, link and, when it isn't
// the album artist, an artist line like "A, B & C" whose first name alone is linked. No barcode or
// ISRCs (Amazon Music shows neither); the label is read from the page's ℗ line.
const AMAZON = {
    id: 'amazonmusic',
    name: 'Amazon Music',
    abbr: 'amz',
    // MB stores an Amazon Music artist under any of its domains
    urlForms(url) {
        const m = url.match(/^https?:\/\/music\.amazon\.[a-z.]+\/artists\/([A-Z0-9]{10})/i);
        return m ? AMAZON_TLDS.map(t => `https://music.amazon.${t}/artists/${m[1].toUpperCase()}`) : [];
    },
    host: /^music\.amazon\.(?:com|co\.uk|de|fr|it|es|ca|co\.jp|com\.au|com\.br|com\.mx|in)$/,
    albumId(loc) { const m = loc.pathname.match(/^\/albums\/([A-Z0-9]{10})\/?$/i); return m ? m[1].toUpperCase() : null; },
    API: 'https://na.mesk.skill.music.a2z.com/api/',
    TYPES: { album: ['Album'], ep: ['EP'], single: ['Single'] },
    MONTHS: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
    session: null,
    post(url, data, headers) {
        const t0 = Date.now();
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST', url, data, timeout: 20000, anonymous: true, headers: headers || {},
                onload: r => {
                    Log.debug(`POST ${url} → ${r.status}, ${(r.responseText || '').length} b in ${Date.now() - t0} ms`);
                    if (r.status < 200 || r.status >= 300) return reject(Object.assign(new Error(`Amazon Music: HTTP ${r.status} for ${url}`), { status: r.status }));
                    try { resolve(JSON.parse(r.responseText)); } catch (e) { reject(new Error(`Amazon Music: bad JSON from ${url}`)); }
                },
                onerror: () => reject(new Error('Amazon Music: network error')),
                ontimeout: () => reject(new Error('Amazon Music: timeout')),
            });
        });
    },
    async guest() {
        if (this.session) return this.session;
        const j = await this.post('https://music.amazon.com/config.json', '');
        if (!j || !j.csrf || !j.deviceId) throw new Error('Amazon Music: no guest session; its web player may have changed');
        Log.info(`Amazon Music: guest session (marketplace ${j.marketplaceId || '?'}, player ${j.version || '?'})`);
        return (this.session = j);
    },
    async call(endpoint, body) {
        const s = await this.guest();
        const headers = JSON.stringify({
            'x-amzn-authentication': JSON.stringify({ interface: 'ClientAuthenticationInterface.v1_0.ClientTokenElement', accessToken: s.accessToken || '' }),
            'x-amzn-device-model': 'WEBPLAYER', 'x-amzn-device-width': '1920', 'x-amzn-device-family': 'WebPlayer', 'x-amzn-device-id': s.deviceId,
            'x-amzn-user-agent': navigator.userAgent, 'x-amzn-session-id': s.sessionId, 'x-amzn-device-height': '1080',
            'x-amzn-request-id': (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)), 'x-amzn-device-language': 'en_US',
            'x-amzn-currency-of-preference': 'USD', 'x-amzn-os-version': '1.0', 'x-amzn-application-version': s.version,
            'x-amzn-device-time-zone': 'UTC', 'x-amzn-timestamp': String(Date.now()),
            'x-amzn-csrf': JSON.stringify({ interface: 'CSRFInterface.v1_0.CSRFHeaderElement', token: s.csrf.token, timestamp: s.csrf.ts, rndNonce: s.csrf.rnd }),
            'x-amzn-music-domain': 'music.amazon.com', 'x-amzn-referer': '', 'x-amzn-affiliate-tags': '', 'x-amzn-ref-marker': '', 'x-amzn-page-url': 'https://music.amazon.com/',
            'x-amzn-weblab-id-overrides': '', 'x-amzn-video-player-token': '', 'x-amzn-feature-flags': '', 'x-amzn-has-profile-id': '', 'x-amzn-age-band': '',
        });
        let j;
        try { j = await this.post(this.API + endpoint, JSON.stringify(Object.assign({}, body, { headers })), { 'Content-Type': 'text/plain;charset=UTF-8' }); }
        catch (e) { if (e.status === 401 || e.status === 403) this.session = null; throw e; }
        const tpl = j && j.methods && (j.methods.find(m => m.template) || {}).template;
        if (!tpl) throw new Error(`Amazon Music: ${endpoint} gave no page; its API may have changed`);
        return tpl;
    },
    text: t => String((t && typeof t === 'object' ? t.text : t) || '').trim(),
    slug: s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    // "A, B & C" with a link to one artist's page (/artists/<id>/<slug>) → [{ name, url }]. The link
    // names who it is: when its slug is the whole line ("Simon & Garfunkel"), the line is one artist;
    // otherwise it's a list, and the link belongs to the name its slug matches (the first, so far).
    artists(line, link) {
        const m = String(link || '').match(/^\/artists\/([A-Z0-9]{10})(?:\/([^/?#]+))?/i);
        const url = m ? `https://music.amazon.com/artists/${m[1].toUpperCase()}` : null;
        const slug = m && m[2] ? m[2].toLowerCase() : '';
        const names = /,\s|\s&\s/.test(line) && !(slug && slug === this.slug(line)) ? line.split(/\s*,\s+|\s+&\s+/).map(x => x.trim()).filter(Boolean) : [line];
        let at = slug ? names.findIndex(n => this.slug(n) === slug) : -1;
        if (at < 0 && url) { at = 0; if (slug) Log.debug(`Amazon Music: the link /${slug} is none of ${JSON.stringify(names)}; it goes to the first`); }
        return names.map((name, i) => (i === at ? { name, url } : { name }));
    },
    // "MAY 17 2013" → { year, month, day }
    date(s) {
        const m = String(s || '').match(/\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
        if (m) return { year: +m[3], month: this.MONTHS.indexOf(m[1].toLowerCase()) + 1 || null, day: +m[2] };
        const y = String(s || '').match(/\b(\d{4})\b/);
        return { year: y ? +y[1] : null, month: null, day: null };
    },
    secs(x) { const p = String(x || '').split(':').map(Number); return p.length > 1 && p.every(n => !isNaN(n)) ? p.reduce((a, n) => a * 60 + n, 0) : null; },

    async fetchRelease(id, progress) {
        const tpl = await this.call('showCatalogAlbum', { id, userHash: JSON.stringify({ level: 'LIBRARY_MEMBER' }) });
        const title = this.text(tpl.headerText);
        if (!title) throw new Error(`Amazon Music: no album ${id}`);
        const sub = String(tpl.headerTertiaryText || '').split(/\s*•\s*/);
        const artistLine = this.text(tpl.headerPrimaryText);
        const artistLink = (tpl.headerPrimaryTextLink || {}).deeplink;
        const rows = [];
        for (const w of tpl.widgets || []) for (const it of w.items || []) {
            const tid = (String((it.primaryTextLink || {}).deeplink || '').match(/^\/tracks\/([A-Z0-9]{10})/) || String((it.primaryLink || {}).deeplink || '').match(/[?&]trackAsin=([A-Z0-9]{10})/) || [])[1];
            if (tid && !rows.some(r => r.id === tid)) rows.push({ id: tid, it });
        }
        const said = parseInt(((sub[0] || '').match(/^([\d,.]+)\s+(?:song|track)s?\b/i) || [])[1] || '', 10);
        Log.info(`Amazon Music album ${id}: "${title}" by ${artistLine} (${artistLink || 'no link'}) · ${this.text(tpl.headerLabel) || 'no kind'} · ${rows.length} track(s)${said && said !== rows.length ? ` (the header says ${said})` : ''} · ${sub.slice(1).join(' · ')} · ${tpl.footer || 'no ℗ line'}`);
        if (!rows.length) throw new Error(`Amazon Music: album ${id} has no tracks in its answer; its page may have changed`);

        const va = /^various artists$/i.test(artistLine);
        const albumArtists = va ? null : this.artists(artistLine, artistLink);
        const tracks = rows.map(({ id: tid, it }, i) => {
            const tf = splitFeat(this.text(it.primaryText));
            const line = this.text(it.secondaryText2);
            const listed = line ? this.artists(line, (it.secondaryText2Link || {}).deeplink) : (albumArtists || [{ name: 'Various Artists' }]);
            const credit = creditFromTitle(listed, tf.feat);
            const secs = this.secs(it.secondaryText3);
            progress && progress(i + 1, rows.length);
            Log.debug(`track ${i + 1}: "${tf.title}" ${it.secondaryText3 || '?'} — ${credit.map(c => c.name + c.join).join('')}${line ? ` (line "${line}")` : ' (album artist)'}`);
            return { title: tf.title, lengthMs: secs == null ? null : secs * 1000, isrc: null, url: `https://music.amazon.com/tracks/${tid}`, credit };
        });
        const af = splitFeat(title);
        const credit = va ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }] : creditFromTitle(albumArtists, af.feat);
        const date = this.date(sub.find(x => /\b\d{4}$/.test(x)) || '');
        const lbl = labelFromCopyright(tpl.footer);
        const url = `https://music.amazon.com/albums/${id}`;
        return {
            source: this.id,
            url,
            title: af.title,
            credit,
            types: this.TYPES[this.text(tpl.headerLabel).toLowerCase()] || [],
            status: 'official',
            packaging: 'None',
            date,
            country: 'XW',
            barcode: null,
            labels: lbl ? [{ name: lbl, catno: '' }] : [],
            urls: [{ url, linkType: 980 }],   // 980 = streaming page (paid)
            // #650 (majkinetor, of "℗© VIDLIK": "this is not label", "could probably be added in
            // annotation"): the page's ℗ line is its only note; it goes there whole, read as a label or not
            annotation: notesText(tpl.footer),
            mediums: [{ format: 'Digital Media', name: '', tracks }],
        };
    },
};

// Audiomack (#664): its API (api.audiomack.com/v1), as ISRC Scout and Platform Check read it. Every
// call is OAuth 1.0a-signed with the web player's own public key and secret, so no login. An album
// (/<artist>/album/<slug>) has its tracks in order, each with its ISRC; a song (/<artist>/song/<slug>)
// is a one-track release. The barcode is the album's `upc`, the label comes from its ℗ line.
const AUDIOMACK = {
    id: 'audiomack',
    name: 'Audiomack',
    abbr: 'amk',
    artistLinkType: 194,   // free streaming: MB offers free and paid (#664)
    host: /^(www\.)?audiomack\.com$/,
    albumId(loc) { const m = loc.pathname.match(/^\/([^/]+)\/(album|song)\/([^/]+)\/?$/); return m ? `${m[1]}/${m[2]}/${m[3]}` : null; },
    API: 'https://api.audiomack.com/v1/',
    KEY: 'audiomack-web',
    SECRET: 'bd8a07e9f23fbe9d808646b730f89b8e',
    async api(endpoint) {
        const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
        const url = this.API + endpoint;
        const p = { oauth_consumer_key: this.KEY, oauth_nonce: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
            oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: String(Math.floor(Date.now() / 1000)), oauth_version: '1.0' };
        const qs = Object.keys(p).sort().map(k => `${enc(k)}=${enc(p[k])}`).join('&');
        const te = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', te.encode(enc(this.SECRET) + '&'), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
        const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, te.encode(['GET', enc(url), enc(qs)].join('&'))))));
        const j = await gmJson(`${url}?${qs}&oauth_signature=${enc(sig)}`);
        if (!j || !j.results) throw new Error(`Audiomack: nothing at ${endpoint}`);
        return j.results;
    },
    // "℗ Spaceship/ Bad Habit/ Atlantic Records,  2025 Spaceship …" → "Spaceship/ Bad Habit/ Atlantic Records"
    label: pline => String(pline || '').replace(/^[\s©℗]*(?:\(P\)\s*)?(?:\d{4}\s+)?/i, '').split(/,\s+\d{4}\b/)[0].trim(),

    async fetchRelease(id, progress) {
        const [artistSlug, kind, slug] = id.split('/');
        const a = await this.api(`music/${kind}/${artistSlug}/${slug}`);
        const list = kind === 'album' ? (a.tracks || []) : [a];
        const ts = Number(a.original_release_date || a.released || 0);
        Log.info(`Audiomack ${kind} ${id}: "${a.title}" by ${a.artist} · ${list.length} track(s) · ${ts ? new Date(ts * 1000).toISOString().slice(0, 10) : 'no date'} · UPC ${a.upc || '—'} · ℗ "${a.pline || ''}"`);
        const uploader = a.uploader || {};
        const linkFor = name => (uploader.name && normName(name) === normName(uploader.name) ? `https://audiomack.com/${uploader.url_slug}` : null);   // only the uploader has a page we know
        const names = text => String(text || '').split(/\s*,\s*|\s+&\s+/).filter(Boolean).map(name => ({ name, url: linkFor(name) }));
        const tracks = list.map((t, i) => {
            const tf = splitFeat(t.title || '');
            const feat = tf.feat.length ? tf.feat : String(t.featuring || '').split(/\s*,\s*|\s+&\s+/).filter(Boolean);
            const credit = creditFromTitle(names(t.artist || a.artist), feat);
            progress && progress(i + 1, list.length);
            Log.debug(`track ${i + 1}: "${tf.title}" — ${credit.map(c => c.name + c.join).join('')} (${t.isrc || 'no ISRC'})`);
            const songSlug = t.url_slug;
            return { title: tf.title, lengthMs: Number(t.duration) > 0 ? Number(t.duration) * 1000 : null, isrc: t.isrc || null,
                url: songSlug ? `https://audiomack.com/${t.uploader_url_slug || uploader.url_slug || artistSlug}/song/${songSlug}` : null, credit };
        });
        const af = splitFeat(a.title || '');
        const credit = /^various artists$/i.test(a.artist || '') ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }]
            : creditFromTitle(names(a.artist), af.feat.length ? af.feat : String(a.featuring || '').split(/\s*,\s*|\s+&\s+/).filter(Boolean));
        const d = ts ? new Date(ts * 1000) : null;
        const url = `https://audiomack.com/${id}`;
        const lbl = this.label(a.pline);
        return {
            source: this.id,
            annotation: notesText(a.description),
            url,
            title: af.title,
            credit,
            types: kind === 'song' ? ['Single'] : [],   // an album: its title's EP / Single, or its track count, decide it (importCurrent)
            status: 'official',
            packaging: 'None',
            date: { year: d ? d.getUTCFullYear() : null, month: d ? d.getUTCMonth() + 1 : null, day: d ? d.getUTCDate() : null },
            country: 'XW',
            barcode: String(a.upc || '').replace(/\D/g, '') || null,
            labels: lbl ? [{ name: lbl, catno: '' }] : [],
            urls: [{ url, linkType: 85 }],   // 85 = stream for free
            mediums: [{ format: 'Digital Media', name: '', tracks }],
        };
    },
};

// 7digital (#669): the release page has the title, the release artist with their page, the release
// date, the label, and the tracklist (each track's id, title and length). The barcode, type, discs,
// track artists and ISRCs come from 7digital's catalogue API, with the key its own store ships in its
// app.js, as Platform Check and ISRC Scout read it. That key may only search, so the release is found
// by its title, and each track by its title (with the album's title, or after its artist), by their
// ids. The catalogue is per country: the store's.
const SEVENDIGITAL = {
    id: 'sevendigital',
    name: '7digital',
    abbr: '7d',
    host: /^(?:[a-z]{2}\.|www\.)?7digital\.com$/,
    albumId(loc) { return /^\/artist\/[^/]+\/release\/(?:[^/]*-)?\d{3,}\/?$/.test(loc.pathname) ? loc.pathname.replace(/\/$/, '') : null; },
    KEY: '7drfpc993qp5',
    withoutPage: true,   // #747: a headless read refused by the captcha is read from the API (fromApi)   // the store's key when this was written; a refused one is replaced by the store's current one
    TYPES: { Album: ['Album'], EP: ['EP'], Single: ['Single'] },
    text: el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : ''),
    // "PT4M9S" → ms
    iso(d) { const m = String(d || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/); return m ? ((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)) * 1000 || null : null; },

    async apiKey(fresh) {
        if (this.key && !fresh) return this.key;
        if (!fresh) return (this.key = this.KEY);
        if (this.keyP) return this.keyP;
        this.keyP = (async () => {
            const own = document.querySelector('script[src*="/static/build/javascript/app."]');
            let src = own && own.getAttribute('src');
            if (!src) src = ((await gmText('https://us.7digital.com/', { Accept: 'text/html' })).match(/\/\/js-cdn\.7digital\.com\/static\/build\/javascript\/app\.[a-z0-9]+\.js/i) || [])[0];
            if (!src) throw new Error('7digital: the store\'s JS was not found');
            const k = ((await gmText(new URL(src, 'https://us.7digital.com/').href, { Accept: '*/*' })).match(/oauth_consumer_key="([A-Za-z0-9]+)"/) || [])[1];
            if (!k) throw new Error('7digital: no key in the store\'s JS');
            return (this.key = k);
        })().finally(() => { this.keyP = null; });
        return this.keyP;
    },
    // One API read: its JSON, or throws. A refused key (HTTP 401) is replaced, once.
    async api(path, params) {
        for (let attempt = 0; ; attempt++) {
            const key = await this.apiKey(attempt > 0);
            const qs = new URLSearchParams(Object.assign({}, params, { usageTypes: 'download', oauth_consumer_key: key }));
            try {
                const j = await gmJson(`https://api.7digital.com/1.2/${path}?${qs}`);
                if (!j || j.status !== 'ok') throw new Error(`7digital ${path}: ${(j && j.error && j.error.message) || 'no answer'}`);
                return j;
            } catch (e) {
                if (e.status === 401 && attempt === 0) { Log.warn('7digital: the key was refused; fetching the store\'s current one'); continue; }
                throw e;
            }
        }
    },
    // "A, B & C" / "A;B;C" / "A x B" → names; the release's own artist ("Simon & Garfunkel") stays one
    names(line, own) {
        const s = String(line || '').trim();
        if (!s) return [];
        if (own && normName(s) === normName(own)) return [s];
        return s.split(/\s*;\s*|\s*,\s+|\s+&\s+|\s+x\s+/).map(x => x.trim()).filter(Boolean);
    },

    // #747: a release without its page (7digital's captcha refused Mission Control's read): found by the words of its
    // address (artist and title) in the API's release search, by its id; its tracks from the track search on the same
    // words, by the release's id. What the page would give: { title, artist, artistUrl, pageLabel, rows, apiRel, apiTracks }.
    async fromApi(url, country, releaseId, progress) {
        const m = new URL(url).pathname.match(/^\/artist\/([^/]+)\/release\/(.*?)-?\d{3,}\/?$/) || [];
        const words = x => decodeURIComponent(x || '').replace(/-/g, ' ').trim();
        const a = words(m[1]), t = words(m[2]);
        let r = null, at = country;
        for (const c of [...new Set([country, 'GB', 'US'])]) {
            for (const q of [`${a} ${t}`, t].filter(x => x.trim())) {
                try {
                    const j = await this.api('release/search', { q, country: c, pageSize: '50' });
                    r = ((j.searchResults || {}).searchResult || []).map(x => x.release).find(x => x && String(x.id) === String(releaseId)) || null;
                } catch (e) { Log.warn(`7digital: release search "${q}" (${c}) failed: ${e.message}`); }
                if (r) { at = c; break; }
            }
            if (r) break;
        }
        if (!r) throw new Error(`7digital asked to verify you're human, and release ${releaseId} wasn't found in its catalogue search: open the page once in this browser`);
        const want = Number(r.trackCount) || 0, tracks = new Map();
        for (const q of [`${(r.artist || {}).name || a} ${r.title}`, r.title, `${a} ${t}`]) {
            if (want && tracks.size >= want) break;
            try {
                const j = await this.api('track/search', { q, country: at, pageSize: '100' });
                for (const x of (j.searchResults || {}).searchResult || []) if (x.track && x.track.release && String(x.track.release.id) === String(releaseId)) tracks.set(String(x.track.id), x.track);
            } catch (e) { Log.warn(`7digital: track search "${q}" failed: ${e.message}`); }
            progress && progress(tracks.size, want || tracks.size);
        }
        const list = [...tracks.values()].sort((x, y) => (x.discNumber || 1) - (y.discNumber || 1) || (x.trackNumber || x.number || 0) - (y.trackNumber || y.number || 0));
        Log.warn(`7digital: the page asked to verify you're human; read from the API's search instead: "${r.title}" by ${(r.artist || {}).name} · ${list.length} of ${want || '?'} track(s)`);
        return {
            title: r.title || t, artist: (r.artist || {}).name || a,
            artistUrl: r.artist && r.artist.slug ? `${new URL(url).origin}/artist/${r.artist.slug}` : null,
            pageLabel: (r.label || {}).name || '',
            rows: list.map(x => ({ id: String(x.id), title: x.title || '', lengthMs: x.duration ? x.duration * 1000 : null })),
            apiRel: r, apiTracks: list,
        };
    },
    async fetchRelease(path, progress, doc) {
        doc = doc || document;
        const og = (doc.querySelector('meta[property="og:url"]') || {}).content || '';
        const url = (/7digital\.com\/artist\//.test(og) ? og : originOf(doc) + path).replace(/[?#].*$/, '').replace(/\/$/, '');
        const sub = (new URL(url).hostname.match(/^([a-z]{2})\./) || [])[1];
        const country = sub === 'uk' || !sub ? 'GB' : sub.toUpperCase();
        const info = doc.querySelector('.release-info');
        const releaseId = (info && info.dataset.releaseid) || (url.match(/(\d{3,})$/) || [])[1];
        let title, artistA, artist, artistUrl, pageLabel, pageDate, plines, all, extras, rows, apiRel = null, apiTracks = [];
        if (doc.fcRefused) {
            // #747: Mission Control's read, refused by 7digital's captcha: the release and its tracks from the API's search
            ({ title, artist, artistUrl, pageLabel, rows, apiRel, apiTracks } = await this.fromApi(url, country, releaseId, progress));
            pageDate = ''; plines = [];
        } else {
            title = this.text(doc.querySelector('.release-info-title'));
            if (!title) throw new Error('7digital: no release on this page (is it asking you to prove you\'re human?)');
            artistA = doc.querySelector('.release-info-artist a');
            artist = this.text(artistA) || (doc.querySelector('.release-info-artist [itemprop="name"]') || {}).content || '';
            artistUrl = artistA ? new URL(artistA.getAttribute('href'), url).href : null;
            pageLabel = this.text(doc.querySelector('.release-label-info .release-data-info'));
            pageDate = this.text(doc.querySelector('.release-date-info .release-data-info'));
            // majkinetor: "It doesnt get annotation <dd class="release-data-info">℗ 2014 Asylum Records UK, a Warner
            // Music UK Company</dd>". Below the tracklist, the ℗ and © lines are the page's only notes: they go
            // to the annotation whole, as Amazon Music's ℗ line does
            plines = [...doc.querySelectorAll('.release-data-info')].map(el => this.text(el)).filter(t => /^(?:[℗©]|\([pc]\))/i.test(t));
            // majkinetor: "reads PDF as track": a digital booklet is a row of the tracklist too, marked with
            // its file type (<em class="release-track-file-type is-pdf">); a song's row has none
            all = [...doc.querySelectorAll('tr.release-track[data-trackid]')];
            extras = all.filter(tr => { const ft = tr.querySelector('.release-track-file-type'); return ft && !/\baudio\b/i.test(ft.className + ' ' + ft.textContent); });
            if (extras.length) Log.info(`7digital: left out ${extras.map(tr => `"${this.text(tr.querySelector('.release-track-name p'))}" (${this.text(tr.querySelector('.release-track-file-type'))})`).join(', ')}: not a track`);
            rows = all.filter(tr => !extras.includes(tr)).map(tr => ({
                id: tr.dataset.trackid,
                title: this.text(tr.querySelector('.release-track-name p')) || (tr.querySelector('.release-track-name [itemprop="name"]') || {}).content || '',
                lengthMs: this.iso((tr.querySelector('[itemprop="duration"]') || {}).content),
            }));
        }
        const various = /^various artists$/i.test(artist);
        Log.info(`7digital release ${releaseId} (${country}): "${title}" by ${artist} · ${rows.length} track(s) · ${pageDate || 'no date'} · label "${pageLabel}" · ${plines.join(' · ') || 'no ℗ line'}`);

        // the release: its barcode, type and date (found by its title, as the store's key can't read it by id).
        // 7digital's search can take 10 s or more, so it runs alongside the tracks' searches below.
        const relP = apiRel ? Promise.resolve(apiRel) : (async () => {
            for (const c of [...new Set([country, 'GB', 'US'])]) {
                for (const q of [title, `${artist} ${title}`]) {
                    try {
                        const j = await this.api('release/search', { q, country: c, pageSize: '50' });
                        const r = ((j.searchResults || {}).searchResult || []).map(x => x.release).find(x => x && String(x.id) === String(releaseId));
                        if (r) return r;
                    } catch (e) { Log.warn(`7digital: release search "${q}" (${c}) failed: ${e.message}`); }
                }
            }
            return null;
        })();

        // the tracks: each by its title with the album's (often the whole album comes back for one), after its
        // artist, or alone; a hit fills every row it is
        const hits = new Map(apiTracks.map(t => [String(t.id), t]));
        const search = async (q, c) => {
            try {
                const j = await this.api('track/search', { q, country: c, pageSize: '50' });
                for (const x of (j.searchResults || {}).searchResult || []) if (x.track && x.track.release && String(x.track.release.id) === String(releaseId)) hits.set(String(x.track.id), x.track);
            } catch (e) { Log.warn(`7digital: track search "${q}" failed: ${e.message}`); }
        };
        // the count is of tracks found: one search often brings up the whole album at once
        const found = () => rows.filter(r => hits.has(r.id)).length;
        // the store's country first; a release its catalogue doesn't have (a UK compilation on the US
        // store) is looked for in the UK's and the US's
        for (const c of [...new Set([country, 'GB', 'US'])]) {
            await mapLimit(rows, 6, async row => {
                for (const q of [`${row.title} ${title}`, various ? null : `${artist} ${row.title}`, row.title]) {
                    if (hits.has(row.id)) break;
                    if (q) { await search(q, c); progress && progress(found(), rows.length); }
                }
            });
            if (found()) break;
            Log.info(`7digital: none of the tracks is in the ${c} catalogue`);
        }
        const rel = await relP;
        if (rel) Log.info(`7digital API: type ${rel.type} · UPC ${rel.barcode || '—'} · ${(rel.download || {}).releaseDate || 'no date'} · label "${(rel.label || {}).name || ''}"`);
        else Log.warn('7digital: the release wasn\'t found in the API: no barcode, and the type is guessed');
        Log.info(`7digital API: ${rows.filter(r => hits.has(r.id)).length} of ${rows.length} track(s) found, ${rows.filter(r => (hits.get(r.id) || {}).isrc).length} with an ISRC`);

        const storeArtist = a => (a && a.slug ? `${new URL(url).origin}/artist/${a.slug}` : null);
        const mediums = [];
        let disc = 1;
        rows.forEach((row, i) => {
            const t = hits.get(row.id);
            if (t && t.discNumber) disc = t.discNumber;
            const tf = splitFeat((t && t.title) || row.title);
            // the track's artist line: "A, B & C", "A x B", "A feat. B" ("The Blessed Madonna feat. Clementine Douglas")
            const lf = splitFeat(t ? (t.artist || {}).name : (various ? '' : artist));
            const names = this.names(lf.title, artist);
            // the release artist links their page; a track's own 7digital artist is one entry for its whole
            // line, so it links only an artist who is the whole line
            const contributors = names.map(name => ({ name, url: normName(name) === normName(artist) ? artistUrl : names.length === 1 && !lf.feat.length && t ? storeArtist(t.artist) : null }));
            const credit = creditFromTitle(contributors.length ? contributors : [{ name: artist, url: artistUrl }], lf.feat.concat(tf.feat.filter(n => !lf.feat.some(f => normName(f) === normName(n)))));
            while (mediums.length < disc) mediums.push({ format: 'Digital Media', name: '', tracks: [] });
            mediums[disc - 1].tracks.push({ title: tf.title, lengthMs: row.lengthMs || (t && t.duration ? t.duration * 1000 : null), isrc: (t && t.isrc) || null, url: null, credit });
            Log.debug(`track ${disc}.${t ? t.number : '?'} (${i + 1}): "${tf.title}" — ${credit.map(c => c.name + c.join).join('')} (${(t && t.isrc) || 'no ISRC'})`);
        });
        const empty = mediums.findIndex(m => !m.tracks.length);
        if (empty >= 0) { Log.warn(`7digital: disc ${empty + 1} has no tracks; the tracklist is one medium`); mediums.splice(0, mediums.length, { format: 'Digital Media', name: '', tracks: [].concat(...mediums.map(m => m.tracks)) }); }

        const af = splitFeat(title);
        const credit = various ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }] : creditFromTitle(this.names(artist, artist).map(name => ({ name, url: artistUrl })), af.feat);
        // the release date is the store's local midnight in UTC ("2020-07-22T23:00:00Z" is 23 July in the UK):
        // the day 12 hours on is the local day, wherever the store is
        const at = Date.parse(((rel || {}).download || {}).releaseDate || '');
        let [y, m, d] = Number.isFinite(at) ? new Date(at + 12 * 3600e3).toISOString().slice(0, 10).split('-').map(n => parseInt(n, 10)) : [];
        if (!y && sub === 'uk') [d, m, y] = pageDate.split('/').map(n => parseInt(n, 10));   // the UK store writes 23/07/2020
        // 7digital stores some barcodes as 14 digits (00602508436901): one leading zero too many for an EAN
        const bc = String((rel || {}).barcode || '').replace(/\D/g, '').replace(/^0(?=\d{13}$)/, '');
        const label = pageLabel || ((rel || {}).label || {}).name || labelFromCopyright(plines[0]) || '';
        return {
            source: this.id,
            annotation: notesText(plines.join('\n')),
            url,
            title: af.title,
            credit,
            types: (rel && this.TYPES[rel.type]) || [],
            status: 'official',
            packaging: 'None',
            date: { year: y || (rel && rel.year) || null, month: m || null, day: d || null },
            country: 'XW',
            barcode: /^\d{12,13}$/.test(bc) ? bc : null,
            labels: label ? [{ name: label, catno: '' }] : [],
            urls: [{ url, linkType: 74 }],   // 74 = purchase for download, the only type MusicBrainz allows for 7digital
            mediums,
        };
    },
};

// Ototoy (#670): a Japanese download store. Everything is on the album page, server-rendered: the title,
// the album artist with their page, "DISC n" rows, each track's title, length and the artists Ototoy links
// for it, the release dates, the label with its page, and the album info. No barcode, no ISRCs, no type.
// A track's linked artists are all of Ototoy's for it: on some compilations that includes the arranger or
// the label (IMAGINATION vol.1: ときのそら and Yunomi), which can't be told from a co-singer (three on
// にじさんじ's "3倍！Sun Shine！カーニバル！"), so all are kept, and the title's "(feat. …)" makes the
// featured ones. Hi-res and CD-quality editions are separate pages; older titles carry their format.
const OTOTOY = {
    id: 'ototoy',
    name: 'Ototoy',
    abbr: 'oto',
    host: /^ototoy\.jp$/,
    albumId(loc) { const m = loc.pathname.match(/^\/_\/default\/p\/(\d+)\/?$/); return m ? m[1] : null; },
    text: el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : ''),
    // "04:28" / "1:02:03" → ms
    hms(t) { const p = String(t || '').trim().split(':').map(Number); return p.length > 1 && p.every(Number.isFinite) ? p.reduce((a, n) => a * 60 + n, 0) * 1000 : null; },
    // "Live Archives Disc2(24bit/44.1kHz)", "… (dsd+mp3)": the format the page sells, not the title
    FORMAT: /\s*[(（][^()（）]*(?:\d+\s*bit|khz|\bdsd\b|\bmp3\b|\bflac\b|\bwav\b|\balac\b|\baac\b|hi-?res|ハイレゾ)[^()（）]*[)）]\s*$/i,
    artist(a) { return { name: this.text(a), url: a.getAttribute('href') ? new URL(a.getAttribute('href'), 'https://ototoy.jp/').href.replace(/[?#].*$/, '') : null }; },

    async fetchRelease(id, progress, doc) {
        doc = doc || document;
        const rawTitle = this.text(doc.querySelector('h1.album-title'));
        if (!rawTitle) throw new Error('Ototoy: no album on this page');
        const title = rawTitle.replace(this.FORMAT, '');
        const albumArtists = [...doc.querySelectorAll('p.album-artist a[href*="/_/default/a/"]')].map(a => this.artist(a));
        const detail = [...doc.querySelectorAll('.album-meta-data .detail p')].map(p => this.text(p));
        const field = re => { const l = detail.find(x => re.test(x)); return l ? l.replace(re, '').trim() : ''; };
        const released = field(/^Release date:\s*/i), original = field(/^Original release date:\s*/i), catno = field(/^Catalog number:\s*/i);
        const labelA = doc.querySelector('.album-meta-data .detail p.label-name a');
        const label = this.text(labelA);
        Log.info(`Ototoy album ${id}: "${rawTitle}"${title !== rawTitle ? ` (title "${title}")` : ''} by ${albumArtists.map(a => a.name).join(', ') || '—'} · ${detail.join(' · ')}`);
        if (catno) Log.info(`Ototoy: catalog number ${catno} left out: Ototoy shows the CD's or a distributor's code as often as the release's`);

        const various = albumArtists.length === 1 && /^(?:various artists|v\.?\s*a\.?)$/i.test(albumArtists[0].name);
        const mediums = [];
        let disc = 0;
        const rows = [...doc.querySelectorAll('#tracklist tr')];
        const nTracks = rows.filter(tr => tr.querySelector('[id^="title-"]')).length;
        let n = 0;
        for (const tr of rows) {
            if (tr.classList.contains('disc-row')) { disc = mediums.push({ format: 'Digital Media', name: '', tracks: [] }); continue; }
            const t = tr.querySelector('[id^="title-"]');
            if (!t) continue;
            if (!mediums.length) disc = mediums.push({ format: 'Digital Media', name: '', tracks: [] });
            const tf = splitFeat(this.text(t));
            const linked = [...tr.querySelectorAll('a.artist[href*="/_/default/a/"]')].map(a => this.artist(a));
            const credit = creditFromTitle(linked.length ? linked : (various ? [] : albumArtists), tf.feat);
            const len = [...tr.querySelectorAll('td.item.center')].map(td => this.text(td)).find(x => /^\d+(?::\d\d){1,2}$/.test(x));
            mediums[disc - 1].tracks.push({ title: tf.title, lengthMs: this.hms(len), isrc: null, url: null, credit });
            progress && progress(++n, nTracks);
            Log.debug(`track ${disc}.${mediums[disc - 1].tracks.length}: "${tf.title}" — ${credit.map(c => c.name + c.join).join('') || '(no artist)'}`);
        }
        const emptyDisc = mediums.findIndex(m => !m.tracks.length);
        if (emptyDisc >= 0) mediums.splice(emptyDisc, 1);

        const af = splitFeat(title);
        const credit = various || !albumArtists.length ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }] : creditFromTitle(albumArtists, af.feat);
        // the original release date is the release's; "Release date" can be the day Ototoy listed it
        const [y, m, d] = (original || released).split('-').map(x => parseInt(x, 10));
        const url = `https://ototoy.jp/_/default/p/${id}`;
        return {
            source: this.id,
            annotation: notesText((doc.querySelector('.album-addendum .album-review') || {}).innerHTML),   // the album info
            url,
            title: af.title,
            credit,
            types: [],
            status: 'official',
            packaging: 'None',
            date: { year: y || null, month: m || null, day: d || null },
            country: 'JP',   // Ototoy sells in Japan only
            barcode: null,
            labels: label ? [{ name: label, catno: '', url: labelA.getAttribute('href') ? new URL(labelA.getAttribute('href'), 'https://ototoy.jp/').href : null }] : [],
            urls: [{ url, linkType: 74 }],   // 74 = purchase for download, the only type MusicBrainz allows for Ototoy
            mediums,
        };
    },
};

// mora (#813): Sony's Japanese download shop. The package page is a shell; its <meta name=
// "msApplication-Arguments"> names the package (mountPoint, labelId, materialNo), and the album is the
// packageMeta.json under cf.mora.jp, read the way Harmony does. No CORS there, so through GM. One
// tracklist with no disc breaks, no ISRCs; the barcode only when distPartNo or cdPartNo is one.
const MORA = {
    id: 'mora',
    name: 'mora',
    abbr: 'mor',
    host: /^mora\.jp$/,
    albumId(loc) { const m = loc.pathname.match(/^\/package\/(\d+)\/([\w-]+)\/?$/); return m ? `${m[1]}/${m[2]}` : null; },
    artist(name, no) { return { name: String(name || '').trim(), url: no ? `https://mora.jp/artist/${no}/` : null }; },
    gtin: s => (/^\d{12,14}$/.test(String(s || '')) ? String(s) : null),

    async fetchRelease(id, progress, doc) {
        doc = doc || document;
        const meta = doc.querySelector('meta[name="msApplication-Arguments"]');
        let args = null;
        try { args = JSON.parse(meta.getAttribute('content')); } catch (e) { /* below */ }
        if (!args || !args.materialNo) throw new Error('mora: no package on this page');
        const p = String(args.materialNo).padStart(10, '0');
        const base = `https://cf.mora.jp/contents/package/${args.mountPoint}/${args.labelId}/${p.slice(0, 4)}/${p.slice(4, 7)}/${p.slice(7)}/`;
        Log.info(`mora package ${id}: ${base}packageMeta.json`);
        const j = await gmJson(base + 'packageMeta.json');
        const tracks = j.trackList || [];
        Log.info(`mora: "${j.title}" by ${j.artistName} · ${j.labelcompanyname || '—'} · ${j.startDate || '—'} · cdPartNo ${j.cdPartNo || '—'} · distPartNo ${j.distPartNo || '—'} · ${tracks.length} tracks`);
        const albumArtist = this.artist(j.artistName, j.artistNo);
        const various = /^(?:various artists|v\.?\s*a\.?|オムニバス)$/i.test(albumArtist.name);
        const out = [];
        tracks.forEach((t, i) => {
            const tf = splitFeat(String(t.title || '').trim());
            const credit = creditFromTitle(t.artistName ? [this.artist(t.artistName, t.artistNo)] : (various ? [] : [albumArtist]), tf.feat);
            if (t.mediaFormatNo == 11) Log.info(`mora: track ${i + 1} is a video`);
            out.push({ title: tf.title, lengthMs: t.duration ? t.duration * 1000 : null, isrc: null, url: null, credit });
            progress && progress(i + 1, tracks.length);
            Log.debug(`track ${i + 1}: "${tf.title}" — ${credit.map(c => c.name + c.join).join('') || '(no artist)'}`);
        });
        const barcode = this.gtin(j.distPartNo) || this.gtin(j.cdPartNo);
        const catno = !barcode && j.cdPartNo ? String(j.cdPartNo) : '';
        const af = splitFeat(String(j.title || '').trim());
        const credit = various ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }] : creditFromTitle([albumArtist], af.feat);
        const [y, m, d] = String(j.startDate || '').split(/[/ ]/).map(x => parseInt(x, 10));
        const url = `https://mora.jp/package/${id}/`;
        return {
            source: this.id,
            annotation: '',
            url,
            title: af.title,
            credit,
            types: [],
            status: 'official',
            packaging: 'None',
            date: { year: y || null, month: m || null, day: d || null },
            country: 'JP',   // mora sells in Japan only
            barcode,
            labels: j.labelcompanyname ? [{ name: j.labelcompanyname, catno, url: null }] : [],
            urls: [{ url, linkType: 74 }],   // 74 = purchase for download
            mediums: [{ format: 'Digital Media', name: '', tracks: out }],
        };
    },
};

// Melon (#815): Korea's biggest store. The album and its songs come from the app's JSON API on
// m2.melon.com, read the way Harmony does; no CORS there, so through GM. PLANCNPY is the label
// (SELLCNPY the distributor). No ISRCs, no barcode.
const MELON = {
    id: 'melon',
    name: 'Melon',
    abbr: 'mel',
    host: /^(?:www|m2|m\.app)\.melon\.com$/,
    albumId(loc) { const id = new URLSearchParams(loc.search).get('albumId'); return /^\/album\/detail\.htm$/.test(loc.pathname) && /^\d+$/.test(id || '') ? id : null; },
    TYPES: [[/싱글/, ['Single']], [/정규/, ['Album']], [/EP/i, ['EP']], [/베스트|옴니버스/, ['Album', 'Compilation']], [/라이브/, ['Album', 'Live']], [/리믹스/, ['Album', 'Remix']], [/OST/i, ['Album', 'Soundtrack']]],
    artists: list => (list || []).map(a => ({ name: String(a.ARTISTNAME || '').trim(), url: a.ARTISTID ? `https://www.melon.com/artist/detail.htm?artistId=${a.ARTISTID}` : null })),

    async fetchRelease(id, progress) {
        const info = ((await gmJson(`https://m2.melon.com/m6/v3/album/info.json?albumId=${id}`)) || {}).response || {};
        const a = info.ALBUMINFO;
        if (!a) throw new Error(`Melon: no album ${id}`);
        const songs = ((await gmJson(`https://m2.melon.com/m6/v2/album/song/list.json?albumId=${id}`)) || {}).response || {};
        const discs = songs.CDLIST || [];
        const total = discs.reduce((n, c) => n + (c.SONGLIST || []).length, 0);
        Log.info(`Melon album ${id}: "${a.ALBUMNAME}" · ${info.ALBUMTYPE || '—'} · ${a.ISSUEDATE || '—'} · label ${info.PLANCNPY || '—'} · ${discs.length} disc(s), ${total} songs`);
        const mediums = [];
        let n = 0;
        discs.forEach(c => {
            const tracks = [];
            (c.SONGLIST || []).forEach(s => {
                n++;
                if (s.ISSERVICE === false) Log.info(`Melon: song ${s.SONGID} "${s.SONGNAME}" is not in service, kept`);
                const tf = splitFeat(String(s.SONGNAME || '').trim());
                const credit = creditFromTitle(this.artists(s.ARTISTLIST), tf.feat);
                tracks.push({ title: tf.title, lengthMs: s.PLAYTIME ? s.PLAYTIME * 1000 : null, isrc: null, url: `https://www.melon.com/song/detail.htm?songId=${s.SONGID}`, credit });
                progress && progress(n, total);
                Log.debug(`track ${c.CDNO}.${s.TRACKNO}: "${tf.title}" — ${credit.map(x => x.name + x.join).join('')}`);
            });
            mediums.push({ format: 'Digital Media', name: '', tracks });
        });
        const listed = this.artists(a.ARTISTLIST);
        const af = splitFeat(String(a.ALBUMNAME || '').trim());
        const credit = listed.length === 1 && /^(?:various artists|v\.?\s*a\.?)$/i.test(listed[0].name)
            ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }]
            : creditFromTitle(listed, af.feat);
        const hit = this.TYPES.find(([re]) => re.test(info.ALBUMTYPE || ''));
        const [y, m, d] = String(a.ISSUEDATE || '').split('.').map(x => parseInt(x, 10));
        const url = `https://www.melon.com/album/detail.htm?albumId=${id}`;
        return {
            source: this.id,
            annotation: '',
            url,
            title: af.title,
            credit,
            types: hit ? hit[1] : [],
            status: 'official',
            packaging: 'None',
            date: { year: y || null, month: m || null, day: d || null },
            country: 'KR',   // Melon sells in Korea only
            barcode: null,
            labels: info.PLANCNPY ? [{ name: String(info.PLANCNPY).trim(), catno: '', url: null }] : [],
            urls: [{ url, linkType: 980 }, { url, linkType: 74 }],   // streaming (paid) + download
            mediums,
        };
    },
};

// Bugs (#816): a Korean store. Everything but the lengths is on the album page, server-rendered: the
// info table (artist, type, release date, distributor 유통사, agency 기획사), the album text, and the
// tracklist, a row per track with its disc (disc_id), Bugs track id and linked artists. Each length
// comes from /player/track/<id>, JSON that needs no account. Harmony reads Bugs' app API instead,
// whose secret a userscript can't carry. No ISRCs, no barcode.
const BUGS = {
    id: 'bugs',
    name: 'Bugs',
    abbr: 'bug',
    host: /^music\.bugs\.co\.kr$/,
    albumId(loc) { const m = loc.pathname.match(/^\/album\/(\d+)\/?$/); return m ? m[1] : null; },
    text: el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : ''),
    TYPES: [[/싱글/, ['Single']], [/정규/, ['Album']], [/EP|미니/i, ['EP']], [/베스트|컴필레이션|옴니버스/, ['Album', 'Compilation']], [/라이브/, ['Album', 'Live']], [/리믹스/, ['Album', 'Remix']], [/OST/i, ['Album', 'Soundtrack']]],
    artist(a) { const m = (a.getAttribute('href') || '').match(/\/artist\/(\d+)/); return { name: (a.getAttribute('title') || this.text(a)).trim(), url: m ? `https://music.bugs.co.kr/artist/${m[1]}` : null }; },
    hms(t) { const p = String(t || '').trim().split(':').map(Number); return p.length > 1 && p.every(Number.isFinite) ? p.reduce((a, n) => a * 60 + n, 0) * 1000 : null; },

    async fetchRelease(id, progress, doc) {
        doc = doc || document;
        const info = {};
        doc.querySelectorAll('.basicInfo table.info tr').forEach(tr => { const th = tr.querySelector('th'), td = tr.querySelector('td'); if (th && td) info[this.text(th)] = td; });
        let ld = {};
        for (const sc of doc.querySelectorAll('script[type="application/ld+json"]')) { try { const j = JSON.parse(sc.textContent); if (j && j['@type'] === 'MusicAlbum') { ld = j; break; } } catch (e) { Log.debug('Bugs: unreadable ld+json: ' + e.message); } }
        const rawTitle = String(ld.name || '').trim() || this.text(doc.querySelector('header.pgTitle h1'));
        if (!rawTitle) throw new Error('Bugs: no album on this page');
        const albumArtists = info['아티스트'] ? [...info['아티스트'].querySelectorAll('a[href*="/artist/"]')].map(a => this.artist(a)) : [];
        const type = this.text(info['유형']), date = this.text(info['발매일']), agency = this.text(info['기획사']), distributor = this.text(info['유통사']);
        const rows = [...doc.querySelectorAll('table.trackList tr[rowType="track"]')];
        Log.info(`Bugs album ${id}: "${rawTitle}" by ${albumArtists.map(a => a.name).join(', ') || '—'} · ${type || '—'} · ${date || '—'} · agency ${agency || '—'} · distributor ${distributor || '—'} · ${rows.length} tracks`);
        const various = albumArtists.length === 1 && /^(?:various artists|v\.?\s*a\.?)$/i.test(albumArtists[0].name);
        const mediums = [], byDisc = new Map();
        let n = 0;
        for (const tr of rows) {
            const trackId = tr.getAttribute('trackId');
            const disc = parseInt((tr.querySelector('input[disc_id]') || { getAttribute: () => '1' }).getAttribute('disc_id'), 10) || 1;
            if (!byDisc.has(disc)) { const m = { format: 'Digital Media', name: '', tracks: [] }; byDisc.set(disc, m); mediums.push(m); }
            const tl = tr.querySelector('p.title a');
            const tf = splitFeat((tl && tl.getAttribute('title')) || this.text(tl));
            const linked = [...tr.querySelectorAll('p.artist a[href*="/artist/"]')].map(a => this.artist(a));
            const credit = creditFromTitle(linked.length ? linked : (various ? [] : albumArtists), tf.feat);
            // the length is only in the player JSON, a request per track to Bugs
            let lengthMs = null;
            try { const j = await gmJson(`https://music.bugs.co.kr/player/track/${trackId}`); lengthMs = this.hms(j && j.track && j.track.len); }
            catch (e) { Log.warn(`Bugs: no length for track ${trackId}: ${e.message}`); }
            byDisc.get(disc).tracks.push({ title: tf.title, lengthMs, isrc: null, url: `https://music.bugs.co.kr/track/${trackId}`, credit });
            progress && progress(++n, rows.length);
            Log.debug(`track ${disc}.${byDisc.get(disc).tracks.length}: "${tf.title}" ${lengthMs == null ? '—' : Math.round(lengthMs / 1000) + 's'} — ${credit.map(c => c.name + c.join).join('') || '(no artist)'}`);
        }
        const af = splitFeat(rawTitle);
        const credit = various || !albumArtists.length ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }] : creditFromTitle(albumArtists, af.feat);
        const hit = this.TYPES.find(([re]) => re.test(type));
        const [y, m, d] = date.split(/[.-]/).map(x => parseInt(x, 10));
        const label = agency || distributor;
        const url = `https://music.bugs.co.kr/album/${id}`;
        return {
            source: this.id,
            annotation: notesText((doc.querySelector('#albumContents') || {}).innerHTML),   // the album text
            url,
            title: af.title,
            credit,
            types: hit ? hit[1] : [],
            status: 'official',
            packaging: 'None',
            date: { year: y || null, month: m || null, day: d || null },
            country: 'KR',   // Bugs sells in Korea only
            barcode: null,
            labels: label ? [{ name: label, catno: '', url: null }] : [],
            urls: [{ url, linkType: 980 }, { url, linkType: 74 }],   // streaming (paid) + download
            mediums,
        };
    },
};

// AllMusic (#814): a release page (/album/release/<slug>-mr…). The page is behind a bot check, but
// its data is TiVo's music API, whose staging host answers without a key: /lookup/release?releaseId=MR…
// gives the barcode, catalogue number, label, format, date and the tracks with their discs, lengths and
// performers. A cold call can take ~20 s; the host can also be down, which ends the import with an error.
const ALLMUSIC = {
    id: 'allmusic',
    name: 'AllMusic',
    abbr: 'am',
    host: /^www\.allmusic\.com$/,
    albumId(loc) { const m = loc.pathname.match(/^\/album\/release\/(?:[^/]*-)?(mr\d{10})\/?$/i); return m ? m[1].toLowerCase() : null; },
    FORMATS: [[/^CD$/i, 'CD'], [/vinyl|LP/i, 'Vinyl'], [/cassette/i, 'Cassette'], [/SACD/i, 'SACD'], [/DVD/i, 'DVD'], [/blu-?ray/i, 'Blu-ray'], [/digital|download|stream/i, 'Digital Media']],
    artist: a => ({ name: a.name, url: /^MN\d+$/i.test(a.id || a.nameId || '') ? `https://www.allmusic.com/artist/${(a.id || a.nameId).toLowerCase()}` : null }),

    async fetchRelease(id, progress) {
        const j = await gmJson(`https://tivomusicapi-staging-elb.digitalsmiths.net/sd/tivomusicapi/taps/v3/lookup/release?releaseId=${id.toUpperCase()}`);
        const hit = j && j.hits && j.hits[0];
        if (!hit) throw new Error(`AllMusic: TiVo's API has no release ${id}`);
        const alb = (hit.album || [])[0] || {};
        const albumArtists = (alb.primaryArtists || []).map(this.artist);
        const fmt = (this.FORMATS.find(([re]) => re.test(hit.format || '')) || [])[1] || '';
        Log.info(`AllMusic release ${id}: "${hit.title}" by ${albumArtists.map(a => a.name).join(', ') || '—'} · ${hit.format || '—'} · ${hit.releaseDate || '—'} · ${[].concat(hit.label || []).join(', ') || '—'} · ${hit.catalog || '—'} · ${hit.productCode || '—'} · ${(hit.tracks || []).length} tracks`);
        const various = albumArtists.length === 1 && /^(?:various artists|v\.?\s*a\.?)$/i.test(albumArtists[0].name);
        const mediums = [], byDisc = new Map();
        for (const t of hit.tracks || []) {
            const disc = +t.disc || 1;
            if (!byDisc.has(disc)) { const m = { format: fmt, name: '', tracks: [] }; byDisc.set(disc, m); mediums.push(m); }
            const tf = splitFeat(t.title || '');
            const primary = (t.performers || []).filter(p => /^primary artist$/i.test(p.role || '')).map(this.artist);
            const credit = creditFromTitle(primary.length ? primary : (various ? [] : albumArtists), tf.feat);
            byDisc.get(disc).tracks.push({ title: tf.title, lengthMs: t.duration ? t.duration * 1000 : null, isrc: null, url: null, credit });
            Log.debug(`track ${disc}.${t.phyTrackNum}: "${tf.title}" ${t.duration || '—'}s — ${credit.map(c => c.name + c.join).join('') || '(no artist)'}`);
        }
        progress && progress(1, 1);
        const af = splitFeat(hit.title || alb.title || '');
        const credit = various || !albumArtists.length ? [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }] : creditFromTitle(albumArtists, af.feat);
        const [y, m, d] = String(hit.releaseDate || '').split('-').map(x => parseInt(x, 10));
        const flags = [].concat(hit.flags || alb.flags || []).join(' ');
        const url = `https://www.allmusic.com/album/release/${id}`;
        return {
            source: this.id,
            url,
            title: af.title,
            credit,
            types: [...(/compilation/i.test(flags) ? ['Compilation'] : []), ...(/live/i.test(flags) ? ['Live'] : [])],
            status: 'official',
            packaging: hit.format && !/digital|download|stream/i.test(hit.format) ? null : 'None',
            date: { year: y || null, month: m || null, day: d || null },
            country: null,
            barcode: hit.productCode || null,
            labels: [].concat(hit.label || []).map((name, i) => ({ name, catno: i ? '' : (hit.catalog || ''), url: null })),
            urls: [{ url, linkType: 755 }],   // "has an AllMusic page at"
            mediums,
        };
    },
};

// Presto Music (#779): a UK shop for classical and jazz, CDs, SACDs, vinyl and downloads. Everything is
// on the product page, server-rendered behind Cloudflare: the title, the artist line (plain text, roles
// in brackets), the format bought here, Release date / Label / Catalogue number, the barcode in the
// ld+json (gtin13), and the tracklist as works, each a row (composer, work, length, linked performers)
// with its movements under it. No ISRCs, no type, no country, no disc breaks. A product with no
// tracklist (a new vinyl) shows the album title as one bullet; its tracks are then taken from another
// format of the same album, which the page links. Out of Platform Check and Mission Control (majkinetor).
// Presto's streaming app (streaming.prestomusic.com/album/<code>) reads the same products from a JSON API
// (anonymous, open CORS, no Cloudflare), by the store's product number: the works and tracks with their
// ISRCs, the label, cat. no and date, but no barcode (only a booklet's file name has it). A product
// that doesn't stream answers code 54. The store import reads it too, for the ISRCs and the streaming link.
const PRESTO = {
    id: 'presto',
    name: 'Presto Music',
    abbr: 'pm',
    host: /^(?:www|streaming)\.prestomusic\.com$/,
    consolidate: false,
    api: 'https://ajax-www.prestomusic.com/api/app/6/',
    // "classical/9959653" on the store, "streaming/9888521" on the streaming app
    albumId(loc) {
        if (/^streaming\./.test(loc.hostname || '')) { const s = loc.pathname.match(/^\/album\/(\d+)(?:\/[a-z-]*)?\/?$/); return s ? `streaming/${s[1]}` : null; }
        const m = loc.pathname.match(/^\/(classical|jazz)\/products\/(\d+)/); return m ? `${m[1]}/${m[2]}` : null;
    },
    streamUrl: code => `https://streaming.prestomusic.com/album/${code}`,
    // one API call; null for a product that doesn't stream ("The record is not yet available", code 54)
    async call(what, code) {
        const r = await fetch(`${this.api}${what}/${code}`, { headers: { Accept: 'application/json' } });
        const j = await r.json().catch(() => null);   // code 54 comes as a 404 that says so
        if (!r.ok && !(j && j.status === 'error')) throw new Error(`Presto Music API: HTTP ${r.status} for ${what}/${code}`);
        if (j && j.status === 'ok') return j.payload;
        Log.info(`Presto Music API ${what}/${code}: ${(j && j.message) || 'no answer'}`);
        return null;
    },
    text: el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : ''),
    hms(t) { const p = String(t || '').trim().split(':').map(Number); return p.length > 1 && p.every(Number.isFinite) ? p.reduce((a, n) => a * 60 + n, 0) * 1000 : null; },
    // "Ida Sand", "Antonio Dayyani, Kristoffer Jessen (leadvocalist)": the role isn't the name
    unrole: s => String(s || '').replace(/\s*\([^()]*\)\s*$/, '').trim(),
    // An artist list → the credit: each name once, and only the names Presto gives without a role.
    // The roles are the musicians' credits (majkinetor, Ida Sand: "Ida Sand (piano), Ida Sand, Ida Sand
    // (wurlitzer), Ola Gustafsson (guitar), …"); a list where every name has one (classical: "Chiaroscuro
    // Quartet (stringquartet)") is the performers, and all of them are the credit.
    credit(names) {
        const all = names.map(n => ({ name: this.unrole(n), plain: !/\([^()]*\)\s*$/.test(n) })).filter(x => x.name);
        const pick = all.some(x => x.plain) ? all.filter(x => x.plain) : all;
        const seen = new Set();
        return pick.filter(x => !seen.has(normName(x.name)) && seen.add(normName(x.name))).map(x => ({ name: x.name, url: null }));
    },
    // the format bought on this page → the medium's format and how many there are ("5 CDs")
    format(doc) {
        const phys = doc.querySelector('.c-product__purchase--physical .c-purchase__format__name');
        if (!phys) return doc.querySelector('.c-product__purchase--download') ? { name: 'Download', format: 'Digital Media', count: 1, digital: true } : null;
        const name = this.text(phys), sub = this.text(phys.parentElement.querySelector('p'));
        const count = parseInt((name.match(/^(\d+)\s/) || [])[1], 10) || 1;
        const size = (name.match(/\b(7|10|12)\s*(?:"|''|”|-?inch)/i) || [])[1];
        const f = /\bsacd\b/i.test(name) ? (/hybrid/i.test(sub + ' ' + name) ? 'Hybrid SACD' : 'SACD')
            : /blu-?ray/i.test(name) ? 'Blu-ray'
                : /dvd/i.test(name) ? (/audio/i.test(name) ? 'DVD-Audio' : 'DVD-Video')
                    : /vinyl|\blps?\b/i.test(name) ? (size ? `${size}" Vinyl` : 'Vinyl')
                        : /cassette/i.test(name) ? 'Cassette'
                            : /\bcds?\b/i.test(name) ? 'CD' : null;
        return { name: [name, sub].filter(Boolean).join(' '), format: f, count, digital: false };
    },
    // the tracklist: a work with movements gives "Work: Movement" for each (as 140 of 141 sampled
    // releases with a Presto link have it), one without is a track itself. The composer Presto puts
    // before the work ("Beethoven: String Quartet No. 9…"), linked, is not part of the title. Jazz puts
    // the composer there too, unlinked ("Ida Sand: Salt & Sugar", "trad.: Jesus, gjør meg stille", "Ira
    // Gershwin, Vernon Duke: I Can't Get Started"): it goes when every work has one, or it names an artist.
    tracks(doc, album, artists) {
        const titleOf = w => w.querySelector('.c-track:not(.c-track--track) .c-track__title');
        const works = [...doc.querySelectorAll('.c-tracklist .c-tracklist__work')].filter(w => titleOf(w)).map(w => {
            const head = w.querySelector('.c-track:not(.c-track--track)');
            const c = titleOf(w).cloneNode(true);
            const linked = !!c.querySelector('a[href*="/composers/"]');
            c.querySelectorAll('a[href*="/composers/"]').forEach(a => a.remove());
            // an item can hold several names, some of them linked ("Tord Gustavsen Trio, Tord Gustavsen (piano), …")
            const names = [...w.querySelectorAll('.c-track__details li')].map(li => this.text(li));
            const moves = [...w.querySelectorAll('.c-track--track')].map(m => ({ title: this.text(m.querySelector('.c-track__title')), len: this.text(m.querySelector('.c-track__duration')) }));
            return { title: this.text(c).replace(/^[\s:,;/&]+/, '').replace(/\s{2,}/g, ' '), linked, names, len: this.text(head.querySelector('.c-track__duration')), moves };
        });
        const out = this.rows(works, artists);
        if (!out.length) {
            // no works: a bulleted list of titles, or the album title alone, which is no tracklist
            const li = [...doc.querySelectorAll('.c-tracklist li')].map(x => this.text(x)).filter(Boolean);
            if (li.length > 1 || (li.length === 1 && normName(li[0]) !== normName(album))) li.forEach(x => out.push({ title: x, len: '', performers: [] }));
        }
        return out.map(x => Object.assign(x, { len: x.len.replace(/^(?:Work|Track) length\s*/i, '') }));
    },
    // the API's tracklist (tracks/<code>) as the page's works. A work with a title has its tracks as
    // movements; one without (jazz) is a track itself. A work with a composer id is the page's linked
    // composer, who comes first ("Mendelssohn: Songs without Words…", "Loewe, F: Almost like being in love")
    apiTracks(payload, artists) {
        const works = [];
        for (const w of (payload && payload.works) || []) {
            const linked = w.composerId != null;
            const bare = t => (linked ? String(t || '').replace(/^[^:]+:\s+(?=\S)/, '') : String(t || '').trim());
            const names = [].concat(w.artists || []);
            const ts = w.tracks || [];
            const single = ts.length === 1 && (!w.workTitle || ts[0].singleFieldTrackTitle === w.workTitle || ts[0].trackTitle === w.workTitle);
            if (!w.workTitle || single) ts.forEach(t => works.push({ title: bare(w.workTitle && single ? w.workTitle : t.trackTitle), linked, names, len: t.duration || '', isrc: t.ISRC || null, moves: [] }));
            else works.push({ title: bare(w.workTitle), linked, names, len: w.workDuration || '', moves: ts.map(t => ({ title: String(t.trackTitle || '').trim(), len: t.duration || '', isrc: t.ISRC || null })) });
        }
        return this.rows(works, artists);
    },
    // works ({ title without the linked composer, linked, names, len, isrc, moves }) → the tracks
    rows(works, artists) {
        const out = [];
        // every work names its composer, linked or not; an unlinked one is then taken off. A linked one's
        // rest stays whole: a classical page of excerpts is "Puccini: Gianni Schicchi: O mio babbino caro"
        const allBy = works.length > 0 && works.every(w => w.linked || /^[^:]+:\s+\S/.test(w.title));
        for (const w of works) {
            // No artist link is handed off: MusicBrainz keeps no Presto artist pages, and Apollo would offer to add them
            // "Recorded: 2023-10-12", "Recording Venue: …" are no names
            const names = w.names.flatMap(s => (/^[A-Z][A-Za-z ]{2,30}:\s/.test(s) ? [] : s.split(/\s*,\s*/)));
            const performers = this.credit(names);
            const plain = names.filter(n => !/\([^()]*\)\s*$/.test(n)).map(n => normName(n));
            let work = w.title;
            const by = work.match(/^([^:]+):\s+(.+)$/);
            if (by && ((allBy && !w.linked) || artists.concat(names.map(n => this.unrole(n))).some(n => normName(n) === normName(by[1])))) work = by[2];
            if (!w.moves.length) { out.push({ title: work, len: w.len, isrc: w.isrc || null, performers, plain }); continue; }
            for (const m of w.moves) out.push({ title: `${work}: ${m.title}`, len: m.len, isrc: m.isrc || null, performers, plain });
        }
        return out;
    },
    // Cloudflare refuses some of a page's own fetches (403, "Just a moment…") at random, the page's
    // clearance or not; one tried again 2 s later mostly passes, within 6 tries in every probe
    async page(url) {
        for (let i = 1; ; i++) {
            const r = await fetch(url, { credentials: 'include', headers: { Accept: 'text/html' } });
            const doc = r.status === 403 || r.ok ? new DOMParser().parseFromString(await r.text(), 'text/html') : null;
            if (r.ok && !/just a moment/i.test(doc.title)) return doc;
            if (!doc || i === 6) throw new Error(doc ? `Presto's bot check refused ${url} ${i} times: open it, then import again` : `HTTP ${r.status} for ${url}`);
            Log.debug(`Presto Music: ${url} refused by the bot check (try ${i}), again in 2 s`);
            await new Promise(res => setTimeout(res, 2000));
        }
    },

    // a booklet's file name is its barcode ("0827568019622_W.pdf"), when the check digit says it is one
    bookletBarcode(url) {
        const n = (String(url || '').match(/\/(\d{12,13})_[^/]*\.pdf\b/i) || [])[1];
        if (!n) return null;
        const d = n.split('').map(Number).reverse();
        return d.slice(1).reduce((s, x, i) => s + x * (i % 2 ? 1 : 3), 0) % 10 === (10 - d[0]) % 10 ? n.padStart(13, '0') : null;   // a UPC as the store's gtin13
    },

    async fetchRelease(id, progress, doc) {
        if (id.startsWith('streaming/')) return this.fromStream(id.split('/')[1], progress);
        doc = doc || document;
        const pid = id.split('/')[1];
        // the streaming API, for the ISRCs and whether the product streams; asked at once, read last
        const api = Promise.all([this.call('album', pid), this.call('tracks', pid)]).catch(e => { Log.warn(e.message); return [null, null]; });
        const h1 = doc.querySelector('.c-product__purchase h1, h1');
        const c = h1 && h1.cloneNode(true);
        if (c) c.querySelectorAll('.is-visuallyhidden').forEach(e => e.remove());
        const rawTitle = this.text(c);
        if (!rawTitle) throw new Error('Presto Music: no product on this page');
        const artistLine = this.text(h1.parentElement.querySelector('.o-text--sharp-med-it-18'));
        const meta = {};
        doc.querySelectorAll('.c-product-block__metadata li').forEach(li => {
            const k = this.text(li.querySelector('strong')).replace(/:$/, '');
            if (k) meta[k] = { text: this.text(li).slice(this.text(li.querySelector('strong')).length).trim(), a: li.querySelector('a') };
        });
        let barcode = null, offerUrl = null;
        for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
            try { const j = [].concat(JSON.parse(s.textContent)); const p = j.find(x => x && x['@type'] === 'Product'); if (p && p.gtin13) barcode = String(p.gtin13); if (p && p.offers && p.offers.url) offerUrl = String(p.offers.url); } catch (e) { /* not ours */ }
        }
        const fmt = this.format(doc);
        Log.info(`Presto Music product ${pid}: "${rawTitle}" by ${artistLine || '—'} · ${fmt ? fmt.name : 'no format'} · ${Object.entries(meta).map(([k, v]) => `${k}: ${v.text}`).join(' · ')} · barcode ${barcode || '—'}`);
        if (fmt && !fmt.format) Log.warn(`Presto Music: format "${fmt.name}" has no MusicBrainz format here; left for you`);

        // the album's artists: the line under the title
        const lineNames = artistLine ? artistLine.split(/\s*,\s*/) : [];
        const artistNames = lineNames.map(n => this.unrole(n)).filter(Boolean);
        let rows = this.tracks(doc, rawTitle, artistNames), from = null;
        const [album, list] = await api;
        if (rows.length) {
            // the API's tracks are the page's, one for one: their ISRCs go on the page's tracks
            const ar = this.apiTracks(list, artistNames);
            if (ar.length === rows.length) rows.forEach((r, i) => { r.isrc = ar[i].isrc; });
            else if (list) Log.warn(`Presto Music: the streaming app lists ${ar.length} track(s), the page ${rows.length}: no ISRCs`);
        } else {
            const others = [...doc.querySelectorAll('a.c-product__variant[href*="/products/"]')].map(a => ({ url: new URL(a.getAttribute('href'), 'https://www.prestomusic.com/').href, name: this.text(a.querySelector('.c-product__variant__title')) }));
            others.sort((a, b) => (/\bcd\b/i.test(b.name) ? 1 : 0) - (/\bcd\b/i.test(a.name) ? 1 : 0));   // a CD's tracklist usually has the lengths
            Log.info(`Presto Music lists no tracks for this ${fmt ? fmt.name : 'product'}; looking at its other formats: ${others.map(o => `${o.name} ${o.url}`).join(', ') || 'none'}`);
            for (const o of others) {
                // the API first, which has no bot check; the page when that format doesn't stream
                try {
                    const code = (o.url.match(/\/products\/(\d+)/) || [])[1];
                    const r = code ? this.apiTracks(await this.call('tracks', code), artistNames) : [];
                    Log.info(`Presto Music: the streaming app has ${r.length} track(s) for ${o.name} ${o.url}`);
                    if (r.length) { rows = r; from = o; break; }
                } catch (e) { Log.warn(`Presto Music: ${o.url}: ${e.message}`); }
                try {
                    const d = await this.page(o.url);
                    const r = this.tracks(d, rawTitle, artistNames);
                    Log.info(`Presto Music: ${o.name} ${o.url} has ${r.length} track(s)`);
                    if (r.length) { rows = r; from = o; break; }
                } catch (e) { Log.warn(`Presto Music: ${o.url}: ${e.message}`); }
            }
            if (!rows.length) throw new Error('Presto Music lists no tracks for this release, in any format');
        }
        // "16th Oct 2026"
        const dm = ((meta['Release date'] || {}).text || '').match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
        const month = dm ? 'janfebmaraprmayjunjulaugsepoctnovdec'.indexOf(dm[2].toLowerCase()) / 3 + 1 : null;
        const label = meta.Label ? (meta.Label.a ? this.text(meta.Label.a) : meta.Label.text) : '';
        // the product's address with its slug: without it Presto answers 404 (majkinetor). The ld+json's,
        // which names the product, else this page's
        const url = this.slugged(offerUrl, pid) || (doc === document ? this.slugged(location.href, pid) : null) || `https://www.prestomusic.com/${id.split('/')[0]}/products/${pid}`;
        const digital = !fmt || fmt.digital;
        // the streaming page only on a download: one product number sells the CD and the download, and
        // on MusicBrainz they are two releases
        const urls = [{ url, linkType: digital ? 74 : 79 }].concat(digital && album ? [{ url: this.streamUrl(pid), linkType: 980 }] : []);   // 74 = purchase for download, 79 = purchase for mail-order, 980 = streaming page
        return this.release({
            rows, lineNames, progress, rawTitle, url, urls, digital, from,
            annotation: notesText((doc.querySelector('.c-product__about') || {}).innerHTML),
            date: { year: dm ? +dm[3] : null, month: month > 0 ? month : null, day: dm ? +dm[1] : null },
            barcode, label, catno: (meta['Catalogue number'] || {}).text || '',
            format: (fmt && fmt.format) || '', fmtName: fmt && fmt.name, discs: fmt ? fmt.count : 1,
        });
    },
    slugged(u, pid) { const m = String(u || '').match(/^https?:\/\/(?:www\.)?prestomusic\.com(\/(?:classical|jazz)\/products\/(\d+)--[^/?#]+)/); return m && m[2] === String(pid) ? `https://www.prestomusic.com${m[1]}` : null; },

    // the streaming app's album, all from the API. The store page can't be read from here (Cloudflare
    // challenges the cross-site fetch), so the barcode is the booklet's, when there is one
    async fromStream(code, progress) {
        const [album, about, list] = await Promise.all([this.call('album', code), this.call('about', code), this.call('tracks', code)]);
        if (!album) throw new Error(`Presto Music doesn't stream ${code} (yet)`);
        const lineNames = album.artistSummary ? String(album.artistSummary).split(/\s*,\s*/) : [];
        const rows = this.apiTracks(list, lineNames.map(n => this.unrole(n)).filter(Boolean));
        if (!rows.length) throw new Error('Presto Music lists no tracks for this album');
        const ab = about || {};
        const dm = String(ab.releaseDateYYYYMMDD || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const work = ((list && list.works) || []).find(w => w.productLink);
        const store = work ? this.slugged(new URL(work.productLink, 'https://www.prestomusic.com/').href, code) : null;
        const barcode = this.bookletBarcode(album.booklet);
        const discs = +album.noDiscs || 1;
        Log.info(`Presto Music streaming ${code}: "${album.title}" by ${album.artistSummary || '—'} · ${discs} × ${album.medium || '?'} · ${ab.label || '—'} ${ab.cat || ''} · ${ab.releaseDateYYYYMMDD || '—'} · store ${store || '—'} · barcode ${barcode ? `${barcode} (booklet)` : '—'}`);
        const url = this.streamUrl(code);
        return this.release({
            rows, lineNames, progress, rawTitle: String(album.title || ''), url, digital: true, from: null,
            urls: [{ url, linkType: 980 }].concat(store ? [{ url: store, linkType: 74 }] : []),
            annotation: notesText(ab.salesblurb || album.salesblurb),
            date: { year: dm ? +dm[1] : null, month: dm ? +dm[2] : null, day: dm ? +dm[3] : null },
            barcode, label: ab.label || '', catno: ab.cat || '',
            format: 'Digital Media', fmtName: `${discs} discs`, discs,
        });
    },

    // the release, from what the store page or the streaming app gave
    release(o) {
        const { rows, lineNames } = o;
        // a name the line gives with a role is still an artist when a track names it without one
        // (Trio Grande: "Antonio Sánchez, Gilad Hekselman (guitar), Will Vinson", each track all three plain)
        const plainSomewhere = new Set([].concat(...rows.map(r => r.plain || [])));
        // a line where every name has a role is the performers (Debussy: "Emmanuel Pahud (flute), Renaud Capuçon (violin), …"): all of them
        const roled = n => /\([^()]*\)\s*$/.test(n);
        const albumArtists = this.credit(lineNames.every(roled) ? lineNames : lineNames.map(n => (plainSomewhere.has(normName(this.unrole(n))) ? this.unrole(n) : n)));

        const tracks = rows.map((r, i) => {
            const tf = splitFeat(r.title);
            const credit = creditFromTitle(r.performers.length ? r.performers : albumArtists, tf.feat);
            o.progress && o.progress(i + 1, rows.length);
            Log.debug(`track ${i + 1}: "${tf.title}" ${r.len || '(no length)'} — ${credit.map(a => a.name + a.join).join('') || '(no artist)'} (${r.isrc || 'no ISRC'})`);
            return { title: tf.title, lengthMs: this.hms(r.len), isrc: r.isrc || null, url: null, credit };
        });
        const noLen = tracks.filter(t => !t.lengthMs).length;
        if (noLen) Log.info(`Presto Music: ${noLen} of ${tracks.length} track(s) have no length`);
        if (o.discs > 1) Log.warn(`Presto Music sells this as ${o.fmtName} but doesn't say where each disc starts: the tracks are on one medium: split it with Apollo Editor's Split medium`);

        const af = splitFeat(o.rawTitle);
        return {
            source: this.id,
            annotation: o.annotation,
            url: o.url,
            title: af.title,
            credit: albumArtists.length ? creditFromTitle(albumArtists, af.feat) : [],
            types: [],
            status: 'official',
            packaging: o.digital ? 'None' : null,
            date: o.date,
            country: null,   // Presto ships the UK distributor's stock and doesn't say where it was released
            barcode: /^\d{12,13}$/.test(o.barcode || '') ? o.barcode : null,
            labels: o.label ? [{ name: o.label, catno: o.catno, url: null }] : [],
            urls: o.urls,
            mediums: [{ format: o.format, name: '', tracks }],
            tracksFrom: o.from,
            discs: o.discs,
        };
    },
};

const PROVIDERS = [DEEZER, BANDCAMP, DISCOGS, APPLE, TIDAL, QOBUZ, BEATPORT, SPOTIFY, YTMUSIC, VOLUMO, HDTRACKS, SOUNDCLOUD, AMAZON, AUDIOMACK, SEVENDIGITAL, OTOTOY, MORA, MELON, BUGS, ALLMUSIC, PRESTO];

/* ── Harmony (#687): the album sent to Harmony's release lookup instead of the editor ── */
// The album link in the form Harmony reads, for the platforms Harmony looks up by URL; Harmony then
// finds the others by the barcode it reads there. Checked against Harmony's lookup (each form is
// recognised; Beatport's slug can be '-', as Harmony itself writes it).
const HARMONY_URLS = {
    deezer: id => `https://www.deezer.com/album/${id}`,
    bandcamp: id => `https://${location.hostname}${id}`,
    discogs: id => `https://www.discogs.com/release/${id}`,
    apple: id => { const [cc, n] = id.split('/'); return `https://music.apple.com/${cc}/album/${n}`; },
    tidal: id => `https://tidal.com/album/${id}`,
    qobuz: id => `https://www.qobuz.com${id}`,
    beatport: id => `https://www.beatport.com/release/-/${id}`,
    spotify: id => `https://open.spotify.com/album/${id}`,
    ototoy: id => `https://ototoy.jp/_/default/p/${id}`,
    mora: id => `https://mora.jp/package/${id}/`,
    melon: id => `https://www.melon.com/album/detail.htm?albumId=${id}`,
    bugs: id => `https://music.bugs.co.kr/album/${id}`,
};
// Platforms Harmony doesn't know and whose albums never carry a barcode: nothing to send
const HARMONY_NONE = new Set(['ytmusic', 'amazonmusic']);
// spoonkuh: "it does not follow my harmony settings". A link names its providers itself, and one that
// names none looks the album up on its own platform only (a barcode alone, on none). category=preferred
// is the providers ticked in Harmony's settings (its cookies), and with no region in the link Harmony
// takes the settings' region too; Apple's link carries its own country store.
function harmonyLookup({ url, gtin }) {
    const q = new URLSearchParams();
    if (url) q.set('url', url);
    if (gtin) q.set('gtin', gtin);
    q.set('category', 'preferred');
    return `https://${settings().harmonyHost}/release?${q}`;
}
// Harmony's own mark, so the button says where it goes
const HARMONY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="18" height="18" aria-hidden="true">'
    + '<defs><linearGradient id="fc-harmony-g" x1="-7.71" y1="30.11" x2="45.71" y2="-.24" gradientUnits="userSpaceOnUse"><stop offset=".29" stop-color="#ffb92c"/><stop offset="1" stop-color="#c45555"/></linearGradient></defs>'
    + '<path fill="url(#fc-harmony-g)" d="M17.13,0l-6.27,3.6v6.56c.74-.3,1.53-.45,2.34-.45,3.47,0,6.29,2.82,6.29,6.29s-2.82,6.29-6.29,6.29c-.81,0-1.6-.15-2.34-.45v6.56l6.27,3.6,13.63-7.82V7.82L17.13,0Z"/>'
    + '<path fill="#c45555" d="M13.2,11.7c-.85,0-1.65.25-2.32.68-.05,0-.1,0-.15,0-.39,0-.78-.08-1.1-.3-.48-.32-.69-1.03-.76-1.76V3.45L1.24,7.82v16.36l7.62,4.37v-6.88c.08-.73.29-1.44.76-1.76.33-.22.72-.3,1.1-.3.05,0,.11,0,.16,0,.67.43,1.46.68,2.31.68,2.37,0,4.29-1.92,4.29-4.29s-1.92-4.29-4.29-4.29Z"/></svg>';

/* ── the seed: model → the release editor's POST parameters ──────────────── */
// https://musicbrainz.org/doc/Development/Release_Editor_Seeding

function seedParams(rel, editNote) {
    const p = [];
    const add = (k, v) => { if (v !== null && v !== undefined && v !== '') p.push([k, String(v)]); };
    const credit = (prefix, c) => (c || []).forEach((a, i) => {
        add(`${prefix}artist_credit.names.${i}.name`, a.name);
        add(`${prefix}artist_credit.names.${i}.artist.name`, a.artistName || a.name);
        add(`${prefix}artist_credit.names.${i}.mbid`, a.mbid);
        add(`${prefix}artist_credit.names.${i}.join_phrase`, a.join);
    });
    add('name', rel.title);
    credit('', rel.credit);
    (rel.types || []).forEach(t => add('type', t));
    add('status', rel.status);
    add('packaging', rel.packaging);
    add('script', rel.script);
    add('barcode', rel.barcode);
    if (rel.date && (rel.date.year || rel.country)) {
        add('events.0.date.year', rel.date.year);
        add('events.0.date.month', rel.date.month);
        add('events.0.date.day', rel.date.day);
        add('events.0.country', rel.country);
    }
    (rel.labels || []).forEach((l, i) => { add(`labels.${i}.name`, l.name); add(`labels.${i}.mbid`, l.mbid); add(`labels.${i}.catalog_number`, l.catno); });
    (rel.urls || []).forEach((u, i) => { add(`urls.${i}.url`, u.url); add(`urls.${i}.link_type`, u.linkType); });
    rel.mediums.forEach((m, i) => {
        add(`mediums.${i}.format`, m.format);
        add(`mediums.${i}.name`, m.name);
        m.tracks.forEach((t, j) => {
            const pre = `mediums.${i}.track.${j}.`;
            add(pre + 'name', t.title);
            add(pre + 'number', t.number || j + 1);
            add(pre + 'length', t.lengthMs);
            credit(pre, t.credit);
        });
    });
    add('annotation', rel.annotation);
    add('edit_note', editNote);
    return p;
}

// #684: the album has tracks the platform didn't give (Apple: not offered in the storefront)
function missingText(rel, provider) {
    const m = rel.missing;
    return `${provider.name} lists ${m.of} tracks but offers ${m.of - m.count}: ${m.count} ${m.count === 1 ? 'is' : 'are'} missing${m.at.length ? ` (${m.at.join(', ')}), left as empty tracks to fill in` : ' from this tracklist'}.`;
}
// #739 (majkinetor): no archive lines: the snapshots are found by Apollo's archive menu by each link
function editNoteFor(rel, provider) {
    const lines = [`Imported from ${provider.name}: ${rel.url}`];
    if (rel.missing) lines.push(missingText(rel, provider));
    // #743: lengths Bandcamp hides until the release, from its app data
    if (rel.hiddenLengths) lines.push(`${rel.hiddenLengths} track length(s) are from ${provider.name}'s app data: its page hides them until the album is out, and they can still change.`);
    // #779: Presto lists no tracks for some formats; they come from another format of the album
    if (rel.tracksFrom) lines.push(`Tracklist from the ${rel.tracksFrom.name}: ${rel.tracksFrom.url}`);
    return lines.join('\n') + `\n\n${(typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.name) || NAME} v${VERSION} by majkinetor - ${HOMEPAGE}`;
}

/* ── #659: Internet Archive ──────────────────────────────────────────────── */
// The release editor's tab sends the save requests (the platform tab may close right after the
// import). Saving and the archive.org keys are the shared <ST-ARCHIVE> block, with Apollo Editor (#736); whether FC archives is its own setting.

// What to archive for this import, or null when archiving is off. The page as the user has it,
// not the canonical URL: that one often redirects (Deezer's /album/<id> to a country's
// /xx/album/<id>), and Wayback then stores the snapshot under the target, so a link to the
// canonical URL by the import's time finds an older snapshot instead of this one.
function archivePlan(rel, provider, id) {
    const s = settings();
    if (!s.archive) { Log.info('archive: off in the settings'); return null; }
    const urls = provider.archivePage === false ? [] : [{ url: mbaCleanUrl(location.href), what: 'page' }];
    if (provider.archiveApi) urls.push({ url: provider.archiveApi(id), what: 'api' });
    const keys = !!mbaKeys();
    Log.info(`archive: ${urls.map(u => u.what + ' ' + u.url).join(', ')} (${keys ? 'Save Page Now 2 with your keys, with a screenshot' : 'anonymous Save Page Now'}); the release editor's tab sends it`);
    return { ts: mbaTs(new Date()), keys, urls };
}

// Send this import's URLs, once per import (a reload of the editor tab doesn't send them again).
async function archiveSources(plan, token) {
    const done = 'fc.archived.' + token;
    try {
        if (sessionStorage.getItem(done)) { Log.debug(`archive: already sent for ${token} (this tab was reloaded)`); return; }
        sessionStorage.setItem(done, '1');
    } catch (e) { /* no sessionStorage: send anyway */ }
    Log.info(`archive: sending ${plan.urls.length} URL(s) to the Internet Archive (${mbaKeys() ? 'Save Page Now 2 with your keys' : 'anonymous'})`);
    for (const a of plan.urls) await mbaSave(a.url, Log, true);   // one at a time: anonymous saves are limited per IP
}

// What Apollo needs to match: every credited artist with its platform link, by position, and
// what it needs to know about the platform (#672), so a new provider needs no change in Apollo:
//   platform: { abbr, name, artistLinkType? }  the badge, the name in logs and edit notes, and the
//                                              artist link type where MB can't pick one itself
//   urlForms: [url, ...]                       on a link MB may store in other forms: all of them
function handoffFor(rel, provider, token) {
    const forms = url => {
        if (!url || !provider.urlForms) return undefined;
        const f = [...new Set([url, ...provider.urlForms(url)])];
        return f.length > 1 ? f : undefined;
    };
    const ac = c => (c || []).map(a => ({ name: a.name, artistName: a.artistName || a.name, join: a.join, url: a.url || null, urlForms: forms(a.url), mbid: a.mbid || null }));
    return {
        v: 2,
        token,
        created: Date.now(),
        source: provider.id,
        sourceName: provider.name,
        platform: { abbr: provider.abbr, name: provider.name, artistLinkType: provider.artistLinkType },
        url: rel.url,
        title: rel.title,
        barcode: rel.barcode,
        credit: ac(rel.credit),
        labels: (rel.labels || []).map(l => ({ name: l.name, catno: l.catno, url: l.url || null, urlForms: forms(l.url), mbid: l.mbid || null })),
        mediums: rel.mediums.map(m => ({ tracks: m.tracks.map(t => ({ title: t.title, isrc: t.isrc, url: t.url, credit: ac(t.credit) })) })),
    };
}

function pruneHandoffs() {
    try {
        for (const k of GM_listValues()) {
            if (!k.startsWith(HANDOFF_PREFIX)) continue;
            const h = GM_getValue(k, null);
            if (!h || !h.created || Date.now() - h.created > HANDOFF_TTL_MS) { GM_deleteValue(k); Log.debug(`pruned old handoff ${k}`); }
        }
    } catch (e) { Log.warn(`handoff prune: ${e.message}`); }
}

/* ── platform side: the button ───────────────────────────────────────────── */

let current = null;   // { provider, id }
let busy = false;

function injectStyle() {
    if (document.getElementById('fc-style')) return;
    const st = document.createElement('style');
    st.id = 'fc-style';
    // On a platform's page a userstyle's --background/--text/--border are the platform's own,
    // not a MusicBrainz theme: take our defaults there.
    const css = MBU_TOKENS, tokens = ON_MB ? css : css.replace(/var\(--(?:background|text|border), ([^)]+)\)/g, '$1');
    st.textContent = tokens + MBU_UI_CSS + `
#fc-root { position: fixed; z-index: 2147483000; display: flex; gap: 0; font: 13px/1.3 system-ui, sans-serif;
  box-shadow: var(--mbu-shadow, 0 2px 10px rgba(0,0,0,.25)); border-radius: 8px; }
#fc-root button { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 12px; background: var(--mbu-bg); color: var(--mbu-text); border: 1px solid var(--mbu-border); }
#fc-root button:hover { background: var(--mbu-bg-hover); }
#fc-root button:focus-visible { outline: 2px solid var(--mbu-accent); outline-offset: -2px; }
#fc-root .fc-go { border-radius: 8px 0 0 8px; font-weight: 600; }
#fc-root .fc-more { border-radius: 0 8px 8px 0; border-left: none; min-width: 30px; justify-content: center; padding: 8px 10px; }
#fc-root .fc-go[aria-busy="true"] { cursor: progress; }
/* #687: Send to Harmony, between Import and ⚙︎ */
#fc-root .fc-harmony { border-left: none; padding: 8px 9px; justify-content: center; }
#fc-root .fc-harmony[hidden] { display: none; }
#fc-root .fc-harmony[aria-disabled="true"] { cursor: default; opacity: .45; }
#fc-root .fc-harmony[aria-disabled="true"]:hover { background: var(--mbu-bg); }
#fc-root .fc-harmony[aria-busy="true"] { cursor: progress; }
#fc-root .fc-harmony svg { display: block; }
/* #702: Consolidate, beside Import */
#fc-root .fc-cons { border-left: none; padding: 8px 9px; justify-content: center; }
#fc-root .fc-cons[hidden] { display: none; }
#fc-root .fc-cons[aria-busy="true"] { cursor: progress; }
#fc-root .fc-cons svg { display: block; }
/* majkinetor: "after the click nothing happens … make it obvious it works": a spinner while it reads */
#fc-root .fc-go[aria-busy="true"]::after { content: ''; width: 14px; height: 14px; flex: 0 0 auto; box-sizing: border-box;
  border: 2px solid var(--mbu-border); border-top-color: var(--mbu-accent-text); border-right-color: var(--mbu-accent-text); border-radius: 50%; animation: fc-spin .8s linear infinite; }
@keyframes fc-spin { to { transform: rotate(360deg); } }
#fc-root .fc-go[aria-busy="true"] span { font-variant-numeric: tabular-nums; }
#fc-root { touch-action: none; animation: fc-fadein .4s ease; }
/* fades in when it appears, as Mammoth's pins do */
@keyframes fc-fadein { from { opacity: 0; } }
#fc-root.fc-settling { opacity: 0 !important; pointer-events: none !important; }
#fc-root.fc-fadein { transition: opacity .4s ease; }
#fc-root.fc-dragging, #fc-root.fc-dragging button { cursor: grabbing; }
/* the readable accent (as Log's): --mbu-accent alone is a deep purple that vanishes on the dark panel */
#fc-panel .fc-reset { justify-self: start; color: var(--mbu-text-weak); }
#fc-panel .fc-reset button { all: unset; cursor: pointer; color: var(--mbu-accent-text); text-decoration: underline; padding: 0 2px; }
#fc-panel .fc-reset button:hover { color: var(--mbu-text); }
#fc-panel .fc-reset button:focus-visible { outline: 2px solid var(--mbu-accent); outline-offset: 1px; }
#fc-root.fc-iconly .fc-go span { display: none; }
#fc-root.fc-iconly .fc-go[aria-busy="true"] span { display: inline; }   /* the progress still shows while it reads */
/* majkinetor: the settings on a right-click of any button; ⚙︎ can then go. The last button left takes the round corner */
#fc-root.fc-gear-hidden .fc-more { display: none; }
#fc-root.fc-gear-hidden:has(.fc-harmony[hidden]):has(.fc-cons[hidden]) .fc-go { border-radius: 8px; }
#fc-root.fc-gear-hidden .fc-harmony { border-radius: 0 8px 8px 0; }
#fc-root.fc-gear-hidden:has(.fc-harmony[hidden]) .fc-cons { border-radius: 0 8px 8px 0; }
#fc-panel { position: fixed; z-index: 2147483001; box-sizing: border-box; width: max-content; max-width: calc(100vw - 16px);
  overflow: auto; overscroll-behavior: contain; background: var(--mbu-bg); color: var(--mbu-text);
  border: 1px solid var(--mbu-border); border-radius: 8px; box-shadow: var(--mbu-shadow, 0 4px 18px rgba(0,0,0,.3));
  font: 12px/1.3 system-ui, sans-serif; padding: 10px 12px; }
#fc-panel .mbu-cfg-h { margin: 0 0 9px; padding: 0 0 8px; font-size: 13px; gap: 6px; }
#fc-panel .mbu-cfg-ic, #fc-panel .mbu-cfg-ic svg { width: 18px; height: 18px; }
#fc-panel .fc-body { display: grid; gap: 7px; }
#fc-panel .fc-reset { margin-top: 2px; }
/* the sections (Import, Archive, Button), headed as Platform Check's settings are */
#fc-panel .fc-sec { font-weight: 700; color: var(--mbu-text); font-size: 11px; letter-spacing: .05em; text-transform: uppercase;
  margin: 8px 0 0; padding-bottom: 3px; border-bottom: 1px solid var(--mbu-divider, var(--mbu-border-soft)); }
#fc-panel .fc-sec:first-child { margin-top: 0; }
/* the whole margin, not just the indent: qobuz.com gives every label an 8px bottom margin, which spread the rows apart */
#fc-panel .fc-body > :not(.fc-sec) { margin: 0 0 0 8px; }
#fc-panel .fc-pos { color: var(--mbu-text); margin-right: 14px; }
#fc-panel label { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
#fc-panel label.fc-check { justify-content: flex-start; gap: 6px; cursor: pointer; }
/* #659: the archive.org keys (the shared block's mbaKeysCss), under the archive checkbox */
#fc-panel .fc-body > .mbu-ia { margin: -2px 0 0 27px; }
/* the browser's own checkbox, whatever the site's sheet says: qobuz.com's sets appearance:none
   in a rule only Firefox applies, and our checkboxes drew as nothing there (#650) */
#fc-panel input[type=checkbox] { all: revert; margin: 0; accent-color: var(--mbu-accent); cursor: pointer; }
/* native controls follow our theme, not the page's: qobuz.com declares color-scheme dark on a light page */
#fc-root, #fc-panel { color-scheme: light; }
:root[data-mbu-theme=dark] :is(#fc-root, #fc-panel) { color-scheme: dark; }
/* appearance: qobuz.com sets none on every select, which dropped the server list's arrow */
/* #684: tracks the platform didn't give: asked before the editor opens */
#fc-warn { position: fixed; right: 16px; bottom: 16px; z-index: 2147483002; box-sizing: border-box; max-width: min(380px, calc(100vw - 16px));
  background: var(--mbu-bg); color: var(--mbu-text); border: 1px solid var(--mbu-warn); border-radius: 8px;
  box-shadow: var(--mbu-shadow, 0 4px 18px rgba(0,0,0,.3)); font: 12.5px/1.4 system-ui, sans-serif; padding: 10px 12px; color-scheme: light; }
:root[data-mbu-theme=dark] #fc-warn { color-scheme: dark; }
#fc-warn .fc-warn-h { font-weight: 700; color: var(--mbu-warn); margin: 0 0 6px; }
#fc-warn p { margin: 0 0 8px; }
#fc-warn .fc-warn-b { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
#fc-warn button { all: revert; font: inherit; cursor: pointer; padding: 4px 12px; border-radius: 5px; border: 1px solid var(--mbu-border); background: var(--mbu-bg); color: var(--mbu-text); }
#fc-warn button.fc-warn-go { background: var(--mbu-accent); border-color: var(--mbu-accent); color: #fff; }
/* #801: the MusicBrainz check's light, on the Import button and in its panel */
.fc-light { display: inline-block; flex: 0 0 auto; width: 10px; height: 10px; box-sizing: border-box; border-radius: 50%; border: 2px solid var(--mbu-text-weak); }
.fc-light[data-light="linked"] { background: var(--mbu-ok); border-color: var(--mbu-ok); }
.fc-light[data-light="barcode"] { background: var(--mbu-warn); border-color: var(--mbu-warn); }
.fc-light[data-light="similar"] { background: color-mix(in srgb, var(--mbu-warn) 50%, var(--mbu-error)); border-color: color-mix(in srgb, var(--mbu-warn) 50%, var(--mbu-error)); }
.fc-light[data-light="failed"] { border-style: dashed; }
.fc-light[data-light="busy"] { border-color: var(--mbu-text-weak); border-top-color: var(--mbu-accent-text); animation: fc-spin .8s linear infinite; }
#fc-root .fc-go[aria-busy="true"] .fc-light { display: none; }
#fc-check { position: fixed; right: 16px; bottom: 16px; z-index: 2147483002; box-sizing: border-box; width: min(460px, calc(100vw - 16px)); overflow: auto;
  background: var(--mbu-bg); color: var(--mbu-text); border: 1px solid var(--mbu-border); border-radius: 8px;
  box-shadow: var(--mbu-shadow, 0 4px 18px rgba(0,0,0,.3)); font: 12.5px/1.4 system-ui, sans-serif; padding: 10px 12px; color-scheme: light; }
:root[data-mbu-theme=dark] #fc-check { color-scheme: dark; }
#fc-check .fc-check-h { display: flex; align-items: center; gap: 7px; font-weight: 700; margin: 0 0 6px; }
#fc-check p { margin: 0 0 8px; }
#fc-check .fc-check-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
#fc-check li { margin: 0; padding: 6px 8px; border: 1px solid var(--mbu-border-soft); border-radius: 6px; }
#fc-check li.fc-other { opacity: .8; }
#fc-check .fc-check-rel { display: flex; align-items: center; gap: 6px; font-weight: 600; }
#fc-check .fc-check-rel a { color: var(--mbu-accent-text); }
#fc-check .fc-dim { color: var(--mbu-text-dim); font-weight: normal; }
#fc-check .fc-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 5px; }
#fc-check .fc-ic { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 20px; color: var(--mbu-ok); cursor: default; }
#fc-check .fc-ic svg { width: 14px; height: 14px; display: block; }
#fc-check .fc-ic::after { content: '✓'; position: absolute; right: -1px; bottom: -3px; font-size: 9px; font-weight: 700; line-height: 1; }
#fc-check .fc-ic-no { color: var(--mbu-warn); }
#fc-check .fc-ic-no::after { content: '≠'; font-size: 10px; }
#fc-check .fc-check-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
#fc-check .fc-warn-b { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
#fc-check button { all: revert; font: inherit; cursor: pointer; padding: 4px 12px; border-radius: 5px; border: 1px solid var(--mbu-border); background: var(--mbu-bg); color: var(--mbu-text); }
#fc-check button:hover { background: var(--mbu-bg-hover); }
#fc-check button.fc-check-upd { background: var(--mbu-accent); border-color: var(--mbu-accent); color: #fff; }
/* links (? Help, get them) in the readable accent: --mbu-accent is the deep purple that vanishes on the dark panel */
#fc-panel a { color: var(--mbu-accent-text); }
` + mbaKeysCss('#fc-panel');
    (document.head || document.documentElement).appendChild(st);
}

function mountButton(provider, id) {
    injectStyle();
    let root = document.getElementById('fc-root');
    if (!root) {
        root = document.createElement('div');
        root.id = 'fc-root';
        root.dataset.mbCorner = 'br';
        root.dataset.mbCornerOrder = '30';
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'fc-go';
        go.innerHTML = mbuHtml(ICON_SVG + '<span>Import to MusicBrainz</span>');
        go.addEventListener('click', () => { importCurrent(); });
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'fc-more';
        more.textContent = MBU_CFG_ICON;
        more.dataset.tip = 'Settings';
        more.setAttribute('aria-label', more.dataset.tip);
        more.addEventListener('click', e => { e.stopPropagation(); togglePanel(more); });
        const cons = document.createElement('button');
        cons.type = 'button';
        cons.className = 'fc-cons';
        cons.innerHTML = mbuHtml(MC_SVG);
        cons.addEventListener('click', () => { consolidateCurrent(); });
        const harmony = document.createElement('button');
        harmony.type = 'button';
        harmony.className = 'fc-harmony';
        harmony.innerHTML = mbuHtml(HARMONY_SVG);
        harmony.addEventListener('click', () => { sendToHarmony(); });
        root.append(go, cons, harmony, more);
        document.body.appendChild(root);
        makeMovable(root);
        // majkinetor: right-click any of the buttons for the settings; a right-click while they are open
        // closes them. That close comes on the press, before the panel's own close-on-a-press-outside,
        // which would then swallow the next click (a right-click makes none)
        let wasOpen = false;
        root.addEventListener('pointerdown', e => {
            if (e.button !== 2) return;
            wasOpen = !!document.getElementById('fc-panel');
            if (wasOpen) closePanel();
        });
        root.addEventListener('contextmenu', e => {
            e.preventDefault();
            if (wasOpen) { wasOpen = false; return; }
            if (!document.getElementById('fc-panel')) togglePanel(more);
        });
        window.addEventListener('resize', () => placeButton(root));
    }
    root.dataset.fcProvider = provider.name;
    root.classList.toggle('fc-iconly', !!settings().iconOnly);   // majkinetor: an option to hide the button's text
    root.classList.toggle('fc-gear-hidden', !!settings().gearHidden);   // majkinetor: ⚙︎ can go, a right-click opens the settings
    const go = root.querySelector('.fc-go');
    go.dataset.tip = go.dataset.tipBase = `Import to MusicBrainz\nOpens the release editor with this ${provider.name} release filled in`;
    // #801: the light of a check already done for this album, or none
    const c = checks.get(checkKey(provider, id)) || {};
    const r = c.result;
    showLight(r ? r.light : c.busy ? 'busy' : null);
    showHarmony(root, provider);
    showCons(root, provider);
    root.style.display = '';
    migrateScrollSetting();
    placeButton(root);
    const pinned = storedPos(provider.name);
    if (scrollsWithPage(provider.name) && pinned && pinned.top != null) settleThenShow(root);
    Log.debug(`button shown for ${provider.name} album ${id}`);
}

// majkinetor: the button can be dragged anywhere, and each platform remembers where. A moved
// button leaves the shared corner stack (data-mb-corner) and keeps its distance from the
// window's right and bottom edges, so it stays put as the window resizes; ⚙︎ → Reset position
// puts it back in the corner.
const POS_KEY = 'fc.pos';
function storedPos(name) { const all = GM_getValue(POS_KEY, {}) || {}; return all[name] || null; }
function storePos(name, pos) {
    const all = Object.assign({}, GM_getValue(POS_KEY, {}) || {});
    if (pos) all[name] = pos; else delete all[name];
    GM_setValue(POS_KEY, all);
}
// majkinetor: "changing the fixed position on page only for some platforms … keeping other
// platforms independent". Moved button scrolls with the page is each platform's own, kept beside
// its position: { platformName: true }.
const SCROLL_KEY = 'fc.scroll';
function scrollsWithPage(name) { return !!(GM_getValue(SCROLL_KEY, {}) || {})[name]; }
function setScrollsWithPage(name, on) {
    const all = Object.assign({}, GM_getValue(SCROLL_KEY, {}) || {});
    if (on) all[name] = true; else delete all[name];
    GM_setValue(SCROLL_KEY, all);
}
// The setting used to be one for every platform: where it was on, it stays on for each platform
// the button had been moved on.
function migrateScrollSetting() {
    const s = GM_getValue('fc.settings', {}) || {};
    if (!Object.prototype.hasOwnProperty.call(s, 'scrollWithPage')) return;
    const on = !!s.scrollWithPage;
    delete s.scrollWithPage;
    GM_setValue('fc.settings', s);
    const moved = Object.keys(GM_getValue(POS_KEY, {}) || {});
    if (on && moved.length) {
        const all = Object.assign({}, GM_getValue(SCROLL_KEY, {}) || {});
        for (const n of moved) all[n] = true;
        GM_setValue(SCROLL_KEY, all);
    }
    Log.info(`Moved button scrolls with the page is now per platform: ${on ? `on for ${moved.join(', ') || 'none (no button moved yet)'}` : 'off everywhere, as it was'}`);
}
// What scrolls the page. Usually the window (Bandcamp, Qobuz); the app-like platforms (Spotify,
// Apple Music) keep the window still and scroll a panel inside it instead, and have more than one
// (sidebars, queues). The page's panel is the one that scrolls under the middle of the window;
// while the app is still drawing there is none (null, as for the window: pos.inner says which).
let scrollerLast = null;
const scrolls = el => el.scrollHeight > el.clientHeight + 1 && el.clientHeight >= 200 && /^(auto|scroll|overlay)$/.test(getComputedStyle(el).overflowY);
function pageScroller() {
    const se = document.scrollingElement || document.documentElement;
    if (se.scrollHeight > se.clientHeight + 1) return null;
    let best = null;
    const hits = document.elementsFromPoint ? document.elementsFromPoint(window.innerWidth / 2, window.innerHeight / 2) : [];
    const start = hits.find(el => !el.closest('#fc-root, #fc-panel'));
    for (let el = start; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        if (scrolls(el)) { best = el; break; }
    }
    if (best !== scrollerLast) Log.debug(`page scrolls in ${best ? `<${best.tagName.toLowerCase()}${best.className ? ' class="' + String(best.className).slice(0, 60) + '"' : ''}> (${best.clientWidth}×${best.clientHeight})` : 'the window (or nothing yet)'}`);
    scrollerLast = best;
    return best;
}
// a spot on the page: across from the centre of what scrolls, down from the top of its content
function pagePosOf(r) {
    const sc = pageScroller();
    if (!sc) return { cx: Math.round(r.left + r.width / 2 - document.documentElement.clientWidth / 2), top: Math.round(r.top + window.scrollY) };
    const sr = sc.getBoundingClientRect();
    return { cx: Math.round(r.left + r.width / 2 - (sr.left + sr.width / 2)), top: Math.round(r.top - sr.top + sc.scrollTop), inner: true };
}
// On the page the button is page content: it goes under the site's fixed bars and the popups
// that open from them, and over its sticky headers. 50 sits between them on every platform:
// Tidal's header and search popup are at 90 and its fullscreen player at 80 (the 100 this was
// went over them), Bandcamp Player Enhanced's player is above 100, while Spotify's, Deezer's and
// Tidal's sticky section headers are at 1 or 2. Measured 2026-10-02; the page's lowest fixed bar
// can't be used instead: Tidal's sticky header at 1 would take the button under the page.
const PAGE_Z = 50;
// majkinetor: "it goes behind this": Discogs's header is page content too, not a fixed bar
// (position relative, z-index 1000, in a shadow root), and a button dropped on it went under it.
// So where the button lands, page content that covers it (not a fixed or sticky bar, nor a popup
// opening from one) lifts it just above that content, for as long as the page is open.
let pageLift = 0;
const pageZ = () => String(Math.max(PAGE_Z, pageLift));
function liftIfCovered(root) {
    if (root.classList.contains('fc-settling') || root.classList.contains('fc-dragging') || root.style.visibility === 'hidden') return;
    const r = root.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (!r.width || x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return;
    let hit = document.elementFromPoint(x, y);
    while (hit && hit.shadowRoot) { const deeper = hit.shadowRoot.elementFromPoint(x, y); if (!deeper || deeper === hit) break; hit = deeper; }
    if (!hit || root.contains(hit)) return;
    let z = 0, by = hit;
    for (let e = hit; e; e = e.parentElement || (e.getRootNode && e.getRootNode().host)) {
        const cs = getComputedStyle(e);
        if (cs.position === 'fixed' || cs.position === 'sticky') { Log.debug(`the button is under a ${cs.position} bar (<${e.tagName.toLowerCase()}>, z-index ${cs.zIndex}): it stays under`); return; }
        const n = parseInt(cs.zIndex, 10);
        if (cs.position !== 'static' && n >= z) { z = n; by = e; }
    }
    if (z + 1 <= Math.max(PAGE_Z, pageLift)) return;
    pageLift = z + 1;
    root.style.zIndex = pageZ();
    Log.info(`the button sat under the page's <${by.tagName.toLowerCase()} class="${String(by.className).slice(0, 60)}"> (z-index ${z}): lifted to ${pageLift}`);
}
// In a scrolling panel the button stays fixed and follows the panel's scroll, cut to the part of
// the panel that shows, so it slides under the panel's edges (Spotify's top bar and player) as
// content does.
function placeInScroller(root, pos, sc, r) {
    const sr = sc.getBoundingClientRect();
    const left = Math.round(Math.min(Math.max(sr.left, sr.left + sr.width / 2 + pos.cx - r.width / 2), Math.max(sr.left, sr.right - r.width)));
    const top = Math.round(sr.top + pos.top - sc.scrollTop);
    root.style.position = '';
    root.style.zIndex = pageZ();
    root.style.right = root.style.bottom = '';
    root.style.left = left + 'px';
    root.style.top = top + 'px';
    const cutTop = Math.max(0, sr.top - top), cutBottom = Math.max(0, top + r.height - sr.bottom);
    root.style.visibility = cutTop + cutBottom >= r.height ? 'hidden' : '';
    root.style.clipPath = cutTop || cutBottom ? `inset(${cutTop}px 0 ${cutBottom}px 0)` : '';
    liftIfCovered(root);
}
const waitScroller = { n: 0, t: 0 };
// majkinetor: "fade in after few like Mammoth". A button pinned to the page would chase the page
// as it lays out (and on Spotify sit against the window until the panel exists): keep it unseen
// until the page goes quiet for 300 ms (1.5 s at most) and its panel is there, then fade it in
// already in place.
function settleThenShow(root) {
    if (root.dataset.fcSettling) return;
    root.dataset.fcSettling = '1';
    root.classList.add('fc-settling');
    const t0 = Date.now();
    let quiet = 0;
    const done = () => {
        clearTimeout(quiet); clearTimeout(cap); mo.disconnect();
        delete root.dataset.fcSettling;
        placeButton(root);
        Log.debug(`page settled after ${Date.now() - t0} ms${root.dataset.fcWaiting ? '; still waiting for its panel' : ''}`);
        if (!root.dataset.fcWaiting) revealButton(root);
    };
    const mo = new MutationObserver(() => { clearTimeout(quiet); quiet = setTimeout(done, 300); });
    mo.observe(document.body, { childList: true, subtree: true });
    quiet = setTimeout(done, 300);
    const cap = setTimeout(done, 1500);
}
function revealButton(root) {
    if (!root.classList.contains('fc-settling')) return;
    root.classList.remove('fc-settling');
    if (root.style.position === 'absolute' || root.style.top) liftIfCovered(root);   // on the page: now it can be hit-tested
    root.classList.add('fc-fadein');
    setTimeout(() => root.classList.remove('fc-fadein'), 450);   // drop the slow transition once faded in
}
// the panel moves and resizes as the app lays out (sidebars, the window): follow it
let watchedScroller = null, scrollerObserver = null;
function watchScroller(root, sc) {
    if (sc === watchedScroller || typeof ResizeObserver === 'undefined') return;
    if (scrollerObserver) scrollerObserver.disconnect();
    watchedScroller = sc;
    scrollerObserver = new ResizeObserver(() => { if (root.style.display !== 'none' && !root.classList.contains('fc-dragging') && scrollsWithPage(root.dataset.fcProvider)) placeButton(root); });
    scrollerObserver.observe(sc);
    if (sc.firstElementChild) scrollerObserver.observe(sc.firstElementChild);
}
let scrollFollow = 0;
document.addEventListener('scroll', e => {
    if (e.target === document || scrollFollow) return;
    scrollFollow = requestAnimationFrame(() => {
        scrollFollow = 0;
        const root = document.getElementById('fc-root');
        if (root && root.style.display !== 'none' && !root.classList.contains('fc-dragging') && root.dataset.fcProvider && scrollsWithPage(root.dataset.fcProvider)) placeButton(root);
    });
}, { capture: true, passive: true });

function placeButton(root) {
    const pos = storedPos(root.dataset.fcProvider);
    const pageMode = scrollsWithPage(root.dataset.fcProvider) && pos && pos.top != null;
    if (!pageMode && root.dataset.fcWaiting) { delete root.dataset.fcWaiting; if (!root.dataset.fcSettling) revealButton(root); }
    if (!pos) {
        // back from a spot on the page (Reset): drop what placed it there, or it stays put on the page
        root.style.position = root.style.zIndex = root.style.clipPath = root.style.visibility = root.style.left = root.style.top = '';
        root.dataset.mbCorner = 'br';
        mbRestackCorner('br');
        return;
    }
    if (root.dataset.mbCorner) { delete root.dataset.mbCorner; mbRestackCorner('br'); }   // the others close the gap
    const r = root.getBoundingClientRect();
    // majkinetor: "keep its position when scrolling" — the button sits on the page (above the
    // cover, say) and scrolls with it. Stored against the page's horizontal centre, since the
    // platforms centre their layout: it stays over the same spot when the window is resized.
    if (pageMode) {
        const sc = pageScroller();
        if (sc) {
            waitScroller.n = 0;
            watchScroller(root, sc);
            placeInScroller(root, pos, sc, r);
            if (root.dataset.fcWaiting) { delete root.dataset.fcWaiting; if (!root.dataset.fcSettling) revealButton(root); }
            return;
        }
        // The spot is on a panel that isn't drawn yet (Spotify builds it well after the page
        // loads): stay out of sight and look again, rather than show it against the window.
        if (pos.inner) {
            root.dataset.fcWaiting = '1';
            root.classList.add('fc-settling');
            if (waitScroller.n++ < 80) { clearTimeout(waitScroller.t); waitScroller.t = setTimeout(() => placeButton(root), 250); }
            else { Log.warn('the panel this button was placed on never showed: the button shows on the screen instead'); delete root.dataset.fcWaiting; storePos(root.dataset.fcProvider, Object.assign({}, pos, { inner: false })); revealButton(root); }
            if (waitScroller.n === 1) Log.debug('waiting for the scrolling panel before placing the button');
            return;
        }
        root.style.clipPath = root.style.visibility = '';
        const vw = document.documentElement.clientWidth;
        const left = Math.round(Math.min(Math.max(0, vw / 2 + pos.cx - r.width / 2), Math.max(0, vw - r.width)));
        const top = Math.max(0, Math.round(pos.top));
        root.style.position = 'absolute';
        // on the page it is page content: a site's fixed bar goes over it as the page scrolls (PAGE_Z)
        root.style.zIndex = pageZ();
        root.style.right = root.style.bottom = '';
        root.style.left = left + 'px';
        root.style.top = top + 'px';
        // a positioned <body> (or margin) shifts what left/top mean: measure and correct once
        const got = root.getBoundingClientRect();
        root.style.left = Math.round(left + (left - got.left - window.scrollX)) + 'px';
        root.style.top = Math.round(top + (top - got.top - window.scrollY)) + 'px';
        liftIfCovered(root);
        return;
    }
    root.style.position = '';
    root.style.zIndex = root.style.clipPath = root.style.visibility = '';
    root.style.right = Math.round(Math.min(Math.max(0, pos.right), Math.max(0, window.innerWidth - r.width))) + 'px';
    root.style.bottom = Math.round(Math.min(Math.max(0, pos.bottom), Math.max(0, window.innerHeight - r.height))) + 'px';
    root.style.left = root.style.top = '';
}
function makeMovable(root) {
    let drag = null, moved = false;
    root.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        const r = root.getBoundingClientRect();
        drag = { x: e.clientX, y: e.clientY, right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom, w: r.width, h: r.height, id: e.pointerId };
        moved = false;
    });
    // move and up are watched on the window: the pointer leaves the button as soon as it moves,
    // and capturing it on pointerdown would retarget the plain click away from Import / ⚙︎
    window.addEventListener('pointermove', e => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!moved) {
            if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;   // a click, not a drag
            moved = true;
            document.documentElement.style.userSelect = 'none';
            root.classList.add('fc-dragging');
            pageLift = 0;   // measured again where it is dropped
            root.style.position = root.style.zIndex = root.style.clipPath = root.style.visibility = '';   // fixed and on top while it moves
            root.style.left = root.style.top = '';
            if (root.dataset.mbCorner) { delete root.dataset.mbCorner; mbRestackCorner('br'); }
            closePanel();
        }
        root.style.right = Math.round(Math.min(Math.max(0, drag.right - dx), window.innerWidth - drag.w)) + 'px';
        root.style.bottom = Math.round(Math.min(Math.max(0, drag.bottom - dy), window.innerHeight - drag.h)) + 'px';
    });
    const end = e => {
        if (!drag || e.pointerId !== drag.id) return;
        drag = null;
        if (!moved) return;
        root.classList.remove('fc-dragging');
        document.documentElement.style.userSelect = '';
        // both ways of keeping it: on the screen, and on the page (Scroll with the page)
        const r = root.getBoundingClientRect();
        const pos = { right: parseInt(root.style.right, 10) || 0, bottom: parseInt(root.style.bottom, 10) || 0,
            ...pagePosOf(r) };
        storePos(root.dataset.fcProvider, pos);
        placeButton(root);
        Log.info(`button moved on ${root.dataset.fcProvider}: on the screen ${pos.right}px from the right, ${pos.bottom}px from the bottom; on the page ${pos.cx}px from the centre, ${pos.top}px from the top`);
    };
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
    // the click that ends a drag is not an import (or a settings toggle)
    root.addEventListener('click', e => { if (moved) { moved = false; e.stopPropagation(); e.preventDefault(); } }, true);
}

function unmountButton() {
    const root = document.getElementById('fc-root');
    if (root && root.style.display !== 'none') { root.style.display = 'none'; mbRestackCorner('br'); }
    closePanel();
}

// Next to the whole button (not ⚙︎, which may be a tab above it): above it, or below when there's
// more room there, right edges lined up, and always inside the window — the button can be
// dragged anywhere, so the panel can't assume the corner. Too tall for either side: it scrolls.
// #684: an album with tracks the platform didn't give asks before the editor opens: the log line,
// the edit note and a toast after the import were easy to miss. → true to import anyway.
function askMissing(rel, provider, anchor) {
    return new Promise(resolve => {
        document.getElementById('fc-warn')?.remove();
        const m = rel.missing, box = document.createElement('div');
        box.id = 'fc-warn';
        box.setAttribute('role', 'alertdialog');
        const p = t => { const e = document.createElement('p'); e.textContent = t; return e; };
        const h = document.createElement('div'); h.className = 'fc-warn-h'; h.textContent = '⚠ Tracks missing';
        const b = document.createElement('div'); b.className = 'fc-warn-b';
        const no = document.createElement('button'); no.type = 'button'; no.className = 'fc-warn-no'; no.textContent = 'Cancel';
        const go = document.createElement('button'); go.type = 'button'; go.className = 'fc-warn-go'; go.textContent = 'Import anyway';
        b.append(no, go);
        box.append(h, p(missingText(rel, provider)), p(m.at.length ? `The editor gets the ${m.of - m.count} tracks ${provider.name} gave, with an empty track at each missing position: give each its title, or remove it. The edit note says which.`
            : `The editor gets the ${m.of - m.count} tracks ${provider.name} gave; add the missing ones there. The edit note says so.`), b);
        document.body.appendChild(box);
        if (anchor && anchor.isConnected) placePanel(box, anchor);
        const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
        const done = ok => { box.remove(); document.removeEventListener('keydown', key, true); resolve(ok); };
        document.addEventListener('keydown', key, true);
        no.addEventListener('click', () => done(false));
        go.addEventListener('click', () => done(true));
        go.focus();
    });
}
function placePanel(panel, anchor) {
    const r = anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight, M = 8;
    const above = r.top - M * 2, below = vh - r.bottom - M * 2;
    const up = panel.offsetHeight <= above || above >= below;
    panel.style.maxHeight = Math.max(120, up ? above : below) + 'px';
    const w = panel.offsetWidth, h = panel.offsetHeight;
    panel.style.left = Math.round(Math.min(Math.max(M, r.right - w), Math.max(M, vw - w - M))) + 'px';
    panel.style.top = Math.round(up ? Math.max(M, r.top - M - h) : Math.min(r.bottom + M, Math.max(M, vh - h - M))) + 'px';
    panel.style.right = panel.style.bottom = '';
    Log.debug(`settings panel ${w}×${h} ${up ? 'above' : 'below'} the button at ${Math.round(r.left)},${Math.round(r.top)} (window ${vw}×${vh})`);
}

// The settings close through their dismiss handler, which then lets go of the page's clicks. A bare
// remove() left it waiting, and it swallowed the next click anywhere: ⚙︎ after Reset did nothing.
let panelDismiss = null;
function closePanel() {
    const f = panelDismiss;
    panelDismiss = null;
    if (f) f();
    const panel = document.getElementById('fc-panel');
    if (panel) panel.remove();
}
function togglePanel(anchor) {
    let panel = document.getElementById('fc-panel');
    if (panel) { closePanel(); return; }
    const s = settings();
    const here = (document.getElementById('fc-root') || { dataset: {} }).dataset.fcProvider || '';
    panel = document.createElement('div');
    panel.id = 'fc-panel';
    panel.innerHTML = mbuHtml(mbuCfgHeader({ script: SCRIPT, name: NAME, version: VERSION, icon: ICON_SVG, log: true })
        // majkinetor: "make clear categories here not wall of options": Import, Archive, Button
        + '<div class="fc-body">'
        + '<div class="fc-sec">Import</div>'
        + '<label>MusicBrainz server <select class="fc-server">'
        + SERVERS.map(h => `<option value="${h}"${h === s.server ? ' selected' : ''}>${h}</option>`).join('')
        + '</select></label>'
        // #801
        + `<label data-tip="Look the album up in MusicBrainz before the release editor opens\nBy its link, its barcode, and its title and artist. If MusicBrainz may have it, you choose: update that release in Mission Control, add only the link, or import anyway.\n- On import: when you click Import\n- On page load: the album is read and checked as the page opens, its light on the button; Import uses that read">Check MusicBrainz <select class="fc-check-mode">`
        + CHECK_MODES.map(([v, t]) => `<option value="${v}"${v === checkMode() ? ' selected' : ''}>${t}</option>`).join('')
        + '</select></label>'
        + `<label class="fc-check" data-tip="The album's notes on ${here}, as the annotation\n- Bandcamp: about and credits\n- Discogs: notes\n- Qobuz, Apple Music: reviews\n- Beatport, YouTube Music: description\n- Amazon Music: the ℗ line\nA line says where they come from. For ${here} only.\n⚠ A review is the critic's text: check you may copy it before you submit"><input type="checkbox" class="fc-annotation"${annotationOn(here) ? ' checked' : ''}> Annotation from ${here}'s notes</label>`
        + `<label class="fc-check" data-tip="Close the platform's tab once the release editor has the release\nOr once the album is sent to Harmony. It stays open when the import fails, or when the browser blocked the new tab and the editor or Harmony opened here."><input type="checkbox" class="fc-close-after"${s.closeAfter ? ' checked' : ''}> Close this page after the import</label>`
        + `<label class="fc-check" data-tip="A Consolidate button beside Import\nIt reads this album and opens Mission Control on MusicBrainz, which finds it on the other platforms and lets you take the best of each into the release editor."><input type="checkbox" class="fc-cons-opt"${s.consolidate ? ' checked' : ''}> Consolidate button</label>`
        + `<label class="fc-check" data-tip="A Send to Harmony button between Import and ⚙︎\nIt looks this album up on Harmony instead, with every platform that has its barcode. Falcon carries on from there."><input type="checkbox" class="fc-harmony-opt"${s.harmony ? ' checked' : ''}> Send to Harmony button</label>`
        + `<label data-tip="The Harmony that Send to Harmony opens\nBoth run the same Harmony; each keeps its own settings.">Harmony <select class="fc-harmony-host">`
        + HARMONY_HOSTS.map(h => `<option value="${h}"${h === s.harmonyHost ? ' selected' : ''}>${h}</option>`).join('')
        + '</select></label>'
        + '<div class="fc-sec">Archive</div>'
        // #659: majkinetor: "It should be ON by default or many people will not use it"
        + `<label class="fc-check" data-tip="Save the album page on the Wayback Machine at every import\nFor Deezer and Apple Music, the album data First Contact read as well.\n⚠ This sends each imported URL to archive.org"><input type="checkbox" class="fc-archive"${s.archive ? ' checked' : ''}> Archive the album page on the Internet Archive</label>`
        + mbaKeysHtml(!s.archive)
        + '<div class="fc-sec">Button</div>'
        + `<label class="fc-check" data-tip="Only the icon on the button\nHover it for what it does"><input type="checkbox" class="fc-iconly-opt"${s.iconOnly ? ' checked' : ''}> Icon only</label>`
        + `<label class="fc-check" data-tip="No ⚙︎ button\nRight-click: any of the buttons opens the settings (with ⚙︎ shown too)"><input type="checkbox" class="fc-gear-hidden-opt"${s.gearHidden ? ' checked' : ''}> Hide settings button, use right click instead</label>`
        + `<label class="fc-check" data-tip="A moved button scrolls with the page\nIt stays on its spot on the page (above the cover, say) instead of on the screen. In its corner it always stays on the screen. For ${here} only."><input type="checkbox" class="fc-scroll-opt"${scrollsWithPage(here) ? ' checked' : ''}> Moved button scrolls with the page on ${here}</label>`
        // majkinetor: "change this to Reset: all | this one"
        + `<div class="fc-reset" data-tip="Drag the button to move it\nEach platform remembers its own place. Reset puts it back in the bottom-right corner."><span class="fc-pos">Position</span>Reset: `
        + `<button type="button" class="fc-reset-all" data-tip="Back in the corner on every platform">all</button> | `
        + `<button type="button" class="fc-reset-pos" data-tip="Back in the corner on ${document.getElementById('fc-root').dataset.fcProvider}">this one</button></div>`
        + '</div>');
    document.body.appendChild(panel);
    mbuControls(panel);   // the shared drop-downs
    placePanel(panel, anchor.closest('#fc-root') || anchor);
    panel.querySelector('.fc-reset-pos').addEventListener('click', () => {
        const root = document.getElementById('fc-root');
        storePos(root.dataset.fcProvider, null);
        setScrollsWithPage(root.dataset.fcProvider, false);
        placeButton(root);
        closePanel();
        Log.info(`button back in the corner on ${root.dataset.fcProvider}`);
    });
    panel.querySelector('.fc-reset-all').addEventListener('click', () => {
        const root = document.getElementById('fc-root');
        const had = Object.keys(GM_getValue(POS_KEY, {}) || {});
        GM_setValue(POS_KEY, {});
        GM_setValue(SCROLL_KEY, {});
        placeButton(root);
        closePanel();
        Log.info(`button back in the corner on every platform (it had been moved on ${had.join(', ') || 'none'})`);
    });
    panel.querySelector('.mbu-cfg-log').addEventListener('click', () => Log.open());
    panel.querySelector('.fc-server').addEventListener('change', e => {
        const next = Object.assign(settings(), { server: e.target.value });
        saveSettings(next);
        Log.info(`server set to ${next.server}`);
    });
    panel.querySelector('.fc-check-mode').addEventListener('change', e => {
        const next = Object.assign(settings(), { check: e.target.value });
        saveSettings(next);
        Log.info(`check MusicBrainz: ${e.target.value}`);
        if (next.check === 'off') showLight(null);
        else if (current) checkOnLoad(current.provider, current.id);
    });
    panel.querySelector('.fc-harmony-host').addEventListener('change', e => {
        const next = Object.assign(settings(), { harmonyHost: e.target.value });
        saveSettings(next);
        Log.info(`Harmony set to ${next.harmonyHost}`);
    });
    panel.querySelector('.fc-scroll-opt').addEventListener('change', e => {
        setScrollsWithPage(here, e.target.checked);
        const root = document.getElementById('fc-root');
        if (root) placeButton(root);
        Log.info(`moved button on ${here}: ${e.target.checked ? 'scrolls with the page' : 'stays on the screen'}`);
    });
    panel.querySelector('.fc-cons-opt').addEventListener('change', e => {
        const next = Object.assign(settings(), { consolidate: e.target.checked });
        saveSettings(next);
        const root = document.getElementById('fc-root');
        if (root && current) showCons(root, current.provider);
        Log.info(`Consolidate button: ${next.consolidate ? 'shown' : 'hidden'}`);
    });
    panel.querySelector('.fc-harmony-opt').addEventListener('change', e => {
        const next = Object.assign(settings(), { harmony: e.target.checked });
        saveSettings(next);
        const root = document.getElementById('fc-root');
        if (root && current) showHarmony(root, current.provider);
        Log.info(`Send to Harmony button: ${next.harmony ? 'shown' : 'hidden'}`);
    });
    panel.querySelector('.fc-gear-hidden-opt').addEventListener('change', e => {
        const next = Object.assign(settings(), { gearHidden: e.target.checked });
        saveSettings(next);
        const root = document.getElementById('fc-root');
        if (root) { root.classList.toggle('fc-gear-hidden', next.gearHidden); mbRestackCorner('br'); }
        Log.info(`settings button: ${next.gearHidden ? 'hidden (right-click a button for the settings)' : 'shown'}`);
    });
    panel.querySelector('.fc-iconly-opt').addEventListener('change', e => {
        const next = Object.assign(settings(), { iconOnly: e.target.checked });
        saveSettings(next);
        const root = document.getElementById('fc-root');
        if (root) { root.classList.toggle('fc-iconly', next.iconOnly); mbRestackCorner('br'); }
        Log.info(`button: ${next.iconOnly ? 'icon only' : 'icon and text'}`);
    });
    panel.querySelector('.fc-annotation').addEventListener('change', e => {
        setAnnotationOn(here, e.target.checked);
        Log.info(`annotation from ${here}'s notes: ${e.target.checked ? 'on' : 'off'}`);
    });
    panel.querySelector('.fc-close-after').addEventListener('change', e => {
        const next = Object.assign(settings(), { closeAfter: e.target.checked });
        saveSettings(next);
        Log.info(`close the page after the import: ${next.closeAfter ? 'on' : 'off'}`);
    });
    panel.querySelector('.fc-archive').addEventListener('change', e => {
        const next = Object.assign(settings(), { archive: e.target.checked });
        saveSettings(next);
        panel.querySelector('.mbu-ia').classList.toggle('mbu-ia-off', !next.archive);
        Log.info(`archive on the Internet Archive: ${next.archive ? 'on' : 'off'}`);
    });
    mbaKeysWire(panel, Log);
    panelDismiss = mbuDismissOn(panel, () => { panelDismiss = null; panel.remove(); });
}

// What an import does to the release a provider read, before it is seeded: the type guessed where
// the platform gives none, labels split, Various Artists, the annotation, the script. Consolidate and
// Mission Control's reads (#702) do the same, so every platform's release is finished alike.
function finishRelease(rel, provider) {
    const tracks = [].concat(...rel.mediums.map(m => m.tracks)).filter(t => !t.placeholder);   // an empty track (#684) is no song
    const g = guessReleaseType(rel.title, tracks);
    Log.info(`type: ${provider.name} says ${rel.types.join(' + ') || 'nothing'}; the guess is ${g.type || 'none'} (${g.why})`);
    // the platform's own type stands, unless it's a plain Album and the title says EP / Single
    rel.typeGuessed = false;
    if (g.type && (!rel.types.length || (g.explicit && rel.types[0] === 'Album' && g.type !== 'Album'))) {
        rel.typeGuessed = !rel.types.length;
        rel.types = [g.type].concat(rel.types.slice(1));
        Log.info(`type set to ${rel.types.join(' + ')}`);
    }
    rel.labels = splitLabels(rel.labels);
    const va = variousArtistsWhy(rel);
    if (va) {
        Log.info(`release artist: Various Artists, not ${rel.credit.map(c => c.name + c.join).join('')} (${va})`);
        rel.credit = [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }];
        if (!rel.types.includes('Compilation')) rel.types = (rel.types.length ? rel.types : ['Album']).concat('Compilation');
    }
    if (rel.annotation && annotationOn(provider.name)) {
        rel.annotation += `\n\nFrom ${provider.name}: ${rel.url}`;
        Log.info(`annotation: ${rel.annotation.length} characters of ${provider.name}'s notes`);
    } else {
        if (rel.annotation) Log.info(`annotation: ${provider.name} has notes (${rel.annotation.length} characters); off for ${provider.name} in the settings`);
        rel.annotation = null;
    }
    rel.script = guessScript([rel.title].concat(...rel.mediums.map(m => m.tracks.map(t => t.title))));
    return rel;
}

async function importCurrent() {
    if (busy || !current) return;
    const { provider, id } = current;
    const go = document.querySelector('#fc-root .fc-go');
    const label = go && go.querySelector('span');
    const server = settings().server;
    const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    Log.info(`import ${location.href}`);
    Log.info(`import ${provider.name} album ${id} → ${server} (token ${token})`);
    busy = true;
    if (go) go.setAttribute('aria-busy', 'true');
    const t0 = Date.now();
    // the button says what it does from the click on, with the tracks read so far (when the platform
    // counts them) and the seconds gone, so a slow platform (7digital's search takes 10 s) visibly works
    let count = '', phase = `Reading ${provider.name}…`;
    const show = () => { if (label) label.textContent = `${phase}${count ? ' ' + count : ''} · ${Math.round((Date.now() - t0) / 1000)} s`; };
    show();
    const ticker = setInterval(show, 1000);
    try {
        // #801: an album read as the page opened is taken as it is
        const raw = await readAlbum(provider, id, (n, total) => { count = `${n}/${total}`; show(); });
        if (raw.missing) {
            count = ''; phase = 'Tracks missing'; show();
            if (!(await askMissing(raw, provider, go))) { Log.info('import cancelled: tracks missing'); return; }
            Log.info('import anyway, with tracks missing');
        }
        const rel = finishedCopy(raw, provider);
        const nTracks = rel.mediums.reduce((n, m) => n + m.tracks.length, 0);
        Log.info(`release read in ${Date.now() - t0} ms: "${rel.title}" · ${rel.credit.map(c => c.name + c.join).join('')} · ${rel.mediums.length} medium(s), ${nTracks} track(s) · types ${rel.types.join('+') || '—'} · script ${rel.script || '—'}`);
        if (!nTracks) throw new Error(`${provider.name} returned no tracks`);
        // #801: MusicBrainz may have it already: a match asks first
        if (checkMode() !== 'off') {
            const c = checks.get(checkKey(provider, id)) || {};
            checks.set(checkKey(provider, id), c);
            count = ''; phase = 'Checking MusicBrainz…'; show();
            let result = c.result || (c.checkP && await c.checkP.catch(() => null));
            if (!result) {
                try { result = c.result = await checkAlbum(provider, id, rel); } catch (e) {
                    Log.warn(`MusicBrainz check failed, importing without it: ${e.message}`);
                    mbuToast(`⚠ ${NAME}: the MusicBrainz check failed (${e.message}); the album is imported without it`, { kind: 'warn' });
                }
            }
            showLight(result ? result.light : 'failed');
            if (result && result.releases.some(e => e.same || e.links.length)) {
                count = ''; phase = 'In MusicBrainz?'; show();
                if ((await askExisting(result, rel, provider, go)) !== 'import') { Log.info('import not done: MusicBrainz may have the album'); return; }
                Log.info('import anyway, though MusicBrainz may have the album');
            }
        }
        count = ''; phase = 'Opening MusicBrainz…'; show();

        pruneHandoffs();
        // archiving is extra: whatever goes wrong with it, the import goes on without it
        let archive = null;
        try { archive = archivePlan(rel, provider, id); } catch (e) { Log.warn(`archive: skipped, it failed: ${e && e.message || e}`); }
        GM_setValue(HANDOFF_PREFIX + token, Object.assign(handoffFor(rel, provider, token), { archive }));
        const params = seedParams(rel, editNoteFor(rel, provider));
        Log.debug(`seed: ${params.length} parameters`);
        if (mbuTestHooks()) window.__fcLastSeed = { token, server, params, rel };

        const where = sendSeed(server, token, params);
        if (rel.tracksFrom) mbuToast(`⚠ ${provider.name} lists no tracks for this format: the tracklist is the ${rel.tracksFrom.name}'s, check it against this one`, { kind: 'warn' });
        if (rel.discs > 1) mbuToast(`⚠ ${provider.name} sells this as ${rel.discs} discs but doesn't say where each starts: split the medium with Apollo Editor's Split medium`, { kind: 'warn' });
        if (rel.hiddenLengths) mbuToast(`⚠ ${rel.hiddenLengths} track length(s) are from ${provider.name}'s app data: the album isn't out yet, so they can still change`, { kind: 'warn' });
        Log.ok(`seeded ${server}/release/add with ${nTracks} track(s) (${where === 'here' ? 'in this tab: the browser blocked a new one' : 'in a new tab'})`);
        if (settings().closeAfter) {
            if (where !== 'here') closeSourceTab();
            else Log.info('close after the import: skipped, the editor opened in this tab');
        }
    } catch (e) {
        Log.err(`import failed: ${e.message}`);
        mbuToast(`✗ ${NAME}: ${e.message}`, { kind: 'warn', action: { label: 'Copy log', onClick: b => Log.copy(b) } });
    } finally {
        clearInterval(ticker);
        busy = false;
        if (go) go.removeAttribute('aria-busy');
        if (label) label.textContent = 'Import to MusicBrainz';
    }
}

// #687: Send to Harmony. A platform Harmony knows goes by its album link, at once; Harmony finds the
// others by the barcode it reads there. Any other platform goes by the barcode, read here first as
// Import reads the album. YouTube Music and Amazon Music have neither, so the button is greyed out.
function showHarmony(root, provider) {
    const b = root.querySelector('.fc-harmony');
    if (!b) return;
    b.hidden = !settings().harmony;
    const none = HARMONY_NONE.has(provider.id);
    b.setAttribute('aria-disabled', String(none));
    b.setAttribute('aria-label', 'Send to Harmony');
    b.dataset.tip = harmonyWhy(provider);
}
function harmonyWhy(provider) {
    if (HARMONY_NONE.has(provider.id)) return `Send to Harmony\nHarmony can't look up ${provider.name}, and ${provider.name} shows no barcode`;
    if (HARMONY_URLS[provider.id]) return `Send to Harmony\nLooks this ${provider.name} album up on Harmony, with every platform that has its barcode`;
    return `Send to Harmony\nReads the barcode here first (Harmony can't look up ${provider.name}), then looks it up on Harmony`;
}
async function sendToHarmony() {
    if (busy || !current) return;
    const { provider, id } = current;
    if (HARMONY_NONE.has(provider.id)) { mbuToast(harmonyWhy(provider).replace(/^Send to Harmony\n/, ''), { kind: 'warn' }); return; }
    const direct = HARMONY_URLS[provider.id];
    if (direct) {
        openHarmony(harmonyLookup({ url: direct(id) }));
        return;
    }
    const root = document.getElementById('fc-root');
    const go = root && root.querySelector('.fc-go'), hb = root && root.querySelector('.fc-harmony');
    const label = go && go.querySelector('span');
    busy = true;
    for (const b of [go, hb]) if (b) b.setAttribute('aria-busy', 'true');
    const t0 = Date.now();
    let count = '';
    const show = () => { if (label) label.textContent = `Reading ${provider.name} for Harmony…${count ? ' ' + count : ''} · ${Math.round((Date.now() - t0) / 1000)} s`; };
    show();
    const ticker = setInterval(show, 1000);
    try {
        Log.info(`Harmony: reading the barcode of ${provider.name} album ${id}`);
        const rel = await provider.fetchRelease(id, (n, total) => { count = `${n}/${total}`; show(); });
        if (!rel.barcode) throw new Error(`${provider.name} gives no barcode for this album, so Harmony can't look it up`);
        openHarmony(harmonyLookup({ gtin: rel.barcode }));
    } catch (e) {
        Log.err(`Send to Harmony failed: ${e.message}`);
        mbuToast(`✗ ${NAME}: ${e.message}`, { kind: 'warn', action: { label: 'Copy log', onClick: b => Log.copy(b) } });
    } finally {
        clearInterval(ticker);
        busy = false;
        for (const b of [go, hb]) if (b) b.removeAttribute('aria-busy');
        if (label) label.textContent = 'Import to MusicBrainz';
    }
}
// A tab the manager opens isn't a blocked popup, even after the read; without it the page opens one
// majkinetor: "Option to close page after import should apply to Harmony too". Only when Harmony got a
// tab of its own: when the browser blocked it, Harmony is in this one.
function openHarmony(url) {
    Log.ok(`sent to Harmony: ${url}`);
    if (mbuTestHooks()) window.__fcLastHarmony = url;
    let here = false;
    if (typeof GM_openInTab === 'function') GM_openInTab(url, { active: true, insert: true });
    else {
        const w = window.open(url, '_blank');
        if (w) w.opener = null;
        else here = true;
    }
    if (settings().closeAfter) {
        if (!here) closeSourceTab();
        else Log.info('close after sending to Harmony: skipped, the browser blocked a new tab and Harmony opens in this one');
    }
    if (here) location.assign(url);
}

/* ── #702: Consolidate in Mission Control ────────────────────────────────── */
// The album is read as for an import and handed to Mission Control on MusicBrainz's
// /release/add#mc=<token>, in the script's storage under fc.handoff.cons.<token>. There Platform
// Check finds the album on the other platforms, this script reads each of them (headless, mc:read),
// and Mission Control lets you take the best of each into the release editor (fc:seed).
const CONS_PREFIX = HANDOFF_PREFIX + 'cons.';
const MC_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 8 108 112" width="18" height="18" aria-hidden="true"><g stroke="#22223b" stroke-width="5" stroke-linejoin="round">'
    + '<path d="M77 35.5 L64 43 L51 35.5 L51 20.5 L64 13 L77 20.5Z" fill="#7a57e8"/>'
    + '<path d="M59.7 77.5 L46.7 85 L33.7 77.5 L33.7 62.5 L46.7 55 L59.7 62.5Z" fill="#ffc94a"/><path d="M94.3 77.5 L81.3 85 L68.3 77.5 L68.3 62.5 L81.3 55 L94.3 62.5Z" fill="#ffc94a"/>'
    + '<path d="M42.3 107.5 L29.4 115 L16.4 107.5 L16.4 92.5 L29.4 85 L42.3 92.5Z" fill="#ffc94a"/><path d="M77 107.5 L64 115 L51 107.5 L51 92.5 L64 85 L77 92.5Z" fill="#ffc94a"/>'
    + '<path d="M111.6 107.5 L98.6 115 L85.7 107.5 L85.7 92.5 L98.6 85 L111.6 92.5Z" fill="#ffc94a"/></g></svg>';
const providerMeta = p => ({ id: p.id, name: p.name, abbr: p.abbr, artistLinkType: p.artistLinkType || null });
// a release with every artist's and label's link carrying the forms MusicBrainz may store it under
function relWithForms(rel, provider) {
    const forms = url => {
        if (!url || !provider.urlForms) return undefined;
        const f = [...new Set([url, ...provider.urlForms(url)])];
        return f.length > 1 ? f : undefined;
    };
    const ac = c => (c || []).map(a => Object.assign({}, a, { urlForms: forms(a.url) }));
    return Object.assign({}, rel, {
        credit: ac(rel.credit),
        labels: (rel.labels || []).map(l => Object.assign({}, l, { urlForms: forms(l.url) })),
        mediums: rel.mediums.map(m => Object.assign({}, m, { tracks: m.tracks.map(t => Object.assign({}, t, { credit: ac(t.credit) })) })),
    });
}
function showCons(root, provider) {
    const b = root.querySelector('.fc-cons');
    if (!b) return;
    b.hidden = !settings().consolidate || provider.consolidate === false;
    b.setAttribute('aria-label', 'Consolidate in Mission Control');
    b.dataset.tip = `Consolidate in Mission Control\nReads this ${provider.name} album, finds it on the other platforms, and takes the best of each into the release editor`;
}
async function consolidateCurrent() {
    if (busy || !current) return;
    const { provider, id } = current;
    const root = document.getElementById('fc-root');
    const go = root && root.querySelector('.fc-go'), cb = root && root.querySelector('.fc-cons');
    const label = go && go.querySelector('span');
    const server = settings().server;
    const token = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    busy = true;
    for (const b of [go, cb]) if (b) b.setAttribute('aria-busy', 'true');
    const t0 = Date.now();
    let count = '';
    const show = () => { if (label) label.textContent = `Reading ${provider.name} for Mission Control…${count ? ' ' + count : ''} · ${Math.round((Date.now() - t0) / 1000)} s`; };
    show();
    const ticker = setInterval(show, 1000);
    try {
        Log.info(`consolidate ${location.href}`);
        Log.info(`consolidate ${provider.name} album ${id} → ${server} (token ${token})`);
        const rel = finishRelease(await provider.fetchRelease(id, (n, total) => { count = `${n}/${total}`; show(); }), provider);
        const nTracks = rel.mediums.reduce((n, m) => n + m.tracks.length, 0);
        if (!nTracks) throw new Error(`${provider.name} returned no tracks`);
        Log.info(`release read in ${Date.now() - t0} ms: "${rel.title}" · ${rel.mediums.length} medium(s), ${nTracks} track(s) · barcode ${rel.barcode || '—'}`);
        pruneHandoffs();
        GM_setValue(CONS_PREFIX + token, { v: 1, token, created: Date.now(), source: provider.id, sourceName: provider.name, platform: providerMeta(provider), id, page: mbaCleanUrl(location.href), url: rel.url, rel: relWithForms(rel, provider) });
        const url = `https://${server}/release/add#mc=${token}`;
        if (mbuTestHooks()) window.__fcLastCons = { token, url, rel };
        Log.ok(`handed to Mission Control: ${url}`);
        let here = false;
        if (typeof GM_openInTab === 'function' && !mbuTestHooks()) GM_openInTab(url, { active: true, insert: true });
        else if (!mbuTestHooks()) { const w = window.open(url, '_blank'); if (w) w.opener = null; else here = true; }
        if (settings().closeAfter) {
            if (!here) closeSourceTab();
            else Log.info('close after Consolidate: skipped, the browser blocked a new tab and Mission Control opens in this one');
        }
        if (here) location.assign(url);
    } catch (e) {
        Log.err(`Consolidate failed: ${e.message}`);
        mbuToast(`✗ ${NAME}: ${e.message}`, { kind: 'warn', action: { label: 'Copy log', onClick: b => Log.copy(b) } });
    } finally {
        clearInterval(ticker);
        busy = false;
        for (const b of [go, cb]) if (b) b.removeAttribute('aria-busy');
        if (label) label.textContent = 'Import to MusicBrainz';
    }
}

/* ── #801: is the album in MusicBrainz already? ──────────────────────────── */
// It is too easy to import an album MusicBrainz has, which only needed its link. Before the release
// editor opens (or as the page opens, by the Check MusicBrainz setting) the album is looked up in
// MusicBrainz: by its links (linked), its barcode, and its title and artist (similar). A release is this
// album when its barcode (leading zeros aside), its format in kind and its track count agree with the
// album's, each where both give one: Mission Control's ccSameRelease, for a consolidation. A match opens a
// panel: update that release in Mission Control, add the link only, or import anyway. Consolidate and
// Mission Control's reads never check: Mission Control's consolidation has its own (ccCheckInMb).
const CHECK_MODES = [
    ['off', 'Off'],
    ['import', 'On import'],
    ['load', 'On page load'],
];
const UPDATE_PREFIX = HANDOFF_PREFIX + 'upd.';
const LIGHTS = {
    busy: 'Checking MusicBrainz…',
    linked: 'MusicBrainz has this album\nIts link is on a release there',
    barcode: 'MusicBrainz may have this album\nA release there has its barcode',
    similar: 'MusicBrainz may have this album\nA release there has a similar title and artist, and as many tracks',
    none: 'Not found in MusicBrainz\nNo release there has its link, its barcode, or its title and artist',
    failed: 'The MusicBrainz check failed\nSee the log',
};
const checks = new Map();   // provider id + album id → { light, releases, raw (the album read, unfinished), relP }
const checkKey = (provider, id) => provider.id + ' ' + id;
const checkMode = () => { const m = settings().check; return m === 'link' || m === 'read' ? 'load' : CHECK_MODES.some(([v]) => v === m) ? m : 'import'; };

// ws/2 through the manager: the JSON, null for a 404. One request a second, as MusicBrainz asks; a busy
// server (503) is asked again twice.
let wsNext = 0;
async function mbWs(path) {
    const now = Date.now(), at = Math.max(now, wsNext);
    wsNext = at + 1100;
    if (at > now) await new Promise(r => setTimeout(r, at - now));
    const url = `https://${settings().server}/ws/2/${path}${path.includes('?') ? '&' : '?'}fmt=json`;
    for (let i = 0; ; i++) {
        try { return JSON.parse(await gmText(url)); } catch (e) {
            if (e.status === 404) return null;
            if (e.status === 503 && i < 2) { await new Promise(r => setTimeout(r, 1500 * (i + 1))); continue; }
            throw e;
        }
    }
}

// The album's links in every form MusicBrainz may store them in: the read's, Harmony's form of the page,
// the page itself; an Apple Music album under any storefront, an Amazon Music one under any domain.
function albumLinks(provider, id, rel) {
    const out = new Set();
    const add = u => { if (u) { const s = String(u).replace(/\/+$/, ''); out.add(s); } };
    if (rel) { add(rel.url); (rel.urls || []).forEach(u => add(u.url)); }
    if (HARMONY_URLS[provider.id]) try { add(HARMONY_URLS[provider.id](id)); } catch (e) { /* no such form */ }
    if (provider.albumId(location) === id) add(mbaCleanUrl(location.href).replace(/[?#].*$/, ''));
    for (const u of [...out]) {
        let m = u.match(/^https?:\/\/(?:music|itunes)\.apple\.com\/([a-z]{2})\/album\/(?:[^/?#]+\/)?(?:id)?(\d+)/i);
        if (m) [m[1].toLowerCase(), ...APPLE_STOREFRONTS].forEach(c => out.add(`https://music.apple.com/${c}/album/${m[2]}`));
        m = u.match(/^https?:\/\/music\.amazon\.[a-z.]+\/albums\/([A-Z0-9]{10})/i);
        if (m) AMAZON_TLDS.forEach(t => out.add(`https://music.amazon.${t}/albums/${m[1].toUpperCase()}`));
        m = u.match(/^https?:\/\/(?:listen\.)?tidal\.com\/(?:browse\/)?album\/(\d+)/i);
        if (m) out.add(`https://tidal.com/album/${m[1]}`).add(`https://tidal.com/browse/album/${m[1]}`);
    }
    return [...out].slice(0, 100);
}

const fmtKind = f => String(f || '').split('+').map(x => { x = x.trim(); return /digital/i.test(x) ? 'digital' : /\bcd\b|compact disc|hdcd|sacd/i.test(x) ? 'cd' : /vinyl|"|\blp\b/i.test(x) ? 'vinyl' : /cassette/i.test(x) ? 'cassette' : x.toLowerCase(); }).sort().join('+');
const bcCore = b => String(b || '').replace(/\D/g, '').replace(/^0+/, '');
const relFormat = rel => rel.mediums.map(m => m.format || 'Digital Media').join(' + ');
const relTracks = rel => rel.mediums.reduce((n, m) => n + m.tracks.length, 0);
// this album, as far as MusicBrainz's release and the read tell: what's missing on either side doesn't count
function sameAlbum(e, rel) {
    if (e.barcode && rel.barcode && bcCore(e.barcode) !== bcCore(rel.barcode)) return false;
    if (e.format && !/unknown/i.test(e.format) && fmtKind(e.format) !== fmtKind(relFormat(rel))) return false;
    if (e.tracks && e.tracks !== relTracks(rel)) return false;
    return true;
}
const foldTitle = s => String(s || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function titleClose(a, b) {
    const x = foldTitle(a), y = foldTitle(b);
    if (!x || !y) return false;
    if (x === y) return true;
    const m = Math.max(x.length, y.length);
    let prev = Array.from({ length: y.length + 1 }, (v, j) => j);
    for (let i = 1; i <= x.length; i++) {
        const cur = [i];
        for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
        prev = cur;
    }
    return 1 - prev[y.length] / m >= 0.85;
}
// One album's link, whatever form it is stored in: the platform and its album id where the address has one
// (a storefront, a locale, www, /browse, a slug aside), else the address without its scheme, www and trailing slash
function linkKey(url) {
    const u = String(url || '').trim();
    const m = (re, k) => { const x = u.match(re); return x ? k + ':' + x[x.length - 1].toLowerCase() : null; };
    return m(/^https?:\/\/(?:music|itunes)\.apple\.com\/(?:[a-z]{2}\/)?album\/(?:[^/?#]+\/)?(?:id)?(\d+)/i, 'apple')
        || m(/^https?:\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?album\/(\d+)/i, 'deezer')
        || m(/^https?:\/\/(?:listen\.)?tidal\.com\/(?:browse\/)?album\/(\d+)/i, 'tidal')
        || m(/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\/([A-Za-z0-9]{22})/i, 'spotify')
        || m(/^https?:\/\/music\.amazon\.[a-z.]+\/albums\/([A-Z0-9]{10})/i, 'amazon')
        || m(/^https?:\/\/(?:www\.|open\.)?qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?album\/(?:[^/?#]+\/)?([A-Za-z0-9]+)\/?(?:[?#]|$)/i, 'qobuz')
        || m(/^https?:\/\/(?:www\.)?beatport\.com\/(?:[a-z]{2}\/)?release\/[^/]+\/(\d+)/i, 'beatport')
        || m(/^https?:\/\/(?:www\.)?discogs\.com\/(?:[a-z]{2}\/)?release\/(\d+)/i, 'discogs')
        || u.toLowerCase().replace(/^https?:\/\/(?:www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
}
const luceneQ = s =>'"' + String(s || '').replace(/["\\]/g, '\\$&') + '"';
function entryOf(by, x) {
    const e = by.get(x.id) || { id: x.id, title: x.title || '', disamb: x.disambiguation || '', date: x.date || '', country: x.country || '', barcode: x.barcode || '', links: [], how: [] };
    if (Array.isArray(x.media) && x.media.length && e.tracks == null) {
        e.format = x.media.map(m => m.format || '(unknown format)').join(' + ');
        e.tracks = x.media.reduce((n, m) => n + (m['track-count'] || 0), 0);
    }
    // "Label catno, Label catno": the search hits carry label-info, a lookup only with inc=labels
    if (Array.isArray(x['label-info']) && !e.labels) e.labels = x['label-info'].map(li => {
        const name = li.label && li.label.name && li.label.name !== '[no label]' ? li.label.name : '';
        const cat = li['catalog-number'] && !/^\[none\]$/i.test(li['catalog-number']) ? li['catalog-number'] : '';
        return [name, cat].filter(Boolean).join(' ');
    }).filter(Boolean).join(', ');
    if (x['artist-credit'] && !e.artist) e.artist = x['artist-credit'].map(a => (a.name || '') + (a.joinphrase || '')).join('');
    by.set(x.id, e);
    return e;
}
// the releases the album's links are on
async function checkLinks(links, by) {
    if (!links.length) return;
    const j = await mbWs('url?' + links.map(u => 'resource=' + encodeURIComponent(u)).join('&') + '&inc=release-rels');
    if (!j) return;
    (Array.isArray(j.urls) ? j.urls : [j]).forEach(u => (u.relations || []).forEach(r => {
        if (!r.release || !r.release.id) return;
        const e = entryOf(by, r.release);
        if (!e.links.includes(u.resource)) e.links.push(u.resource);
        if (!e.how.includes('link')) e.how.push('link');
    }));
}
// The light and the releases for an album read (finished)
async function checkAlbum(provider, id, rel) {
    const t0 = Date.now(), by = new Map();
    const links = albumLinks(provider, id, rel);
    Log.info(`MusicBrainz check (${settings().server}): ${links.length} link form(s), barcode ${rel.barcode || '—'}, "${rel.title}"`);
    await checkLinks(links, by);
    {
        const d = String(rel.barcode || '').replace(/\D/g, ''), core = bcCore(d);
        const forms = [...new Set([d, core, '0' + core, '00' + core])].filter(x => x.length >= 8 && x.length <= 14);
        if (core) {
            const j = await mbWs(`release?query=${encodeURIComponent('barcode:(' + forms.join(' OR ') + ')')}&limit=10`);
            ((j && j.releases) || []).filter(x => bcCore(x.barcode) === core).forEach(x => { const e = entryOf(by, x); if (!e.how.includes('barcode')) e.how.push('barcode'); });
        }
        const va = rel.credit.some(c => c.mbid === VARIOUS_ARTISTS_MBID);
        const artist = (rel.credit[0] || {}).artistName || (rel.credit[0] || {}).name;
        const q = `release:${luceneQ(rel.title)}` + (!va && artist ? ` AND artistname:${luceneQ(artist)}` : '');
        const j = await mbWs(`release?query=${encodeURIComponent(q)}&limit=15`);
        ((j && j.releases) || []).filter(x => titleClose(x.title, rel.title)).forEach(x => { const e = entryOf(by, x); if (!e.how.includes('title')) e.how.push('title'); });
        // each release's own links (and, for one found by its link alone, its format and track count): the
        // album's link may be on it in a form the lookup above didn't try (another storefront, locale or domain)
        const keys = new Set(albumLinks(provider, id, rel).map(linkKey));
        const pre = [...by.values()];
        pre.forEach(e => { e.same = sameAlbum(e, rel); });
        for (const e of pre.filter(x => x.same || x.links.length).slice(0, 6)) {
            const x = await mbWs(`release/${e.id}?inc=media+url-rels+labels`);
            if (!x) continue;
            entryOf(by, Object.assign({}, x, { id: e.id }));
            e.urls = (x.relations || []).map(r => r.url && r.url.resource).filter(Boolean);
            for (const u of e.urls) if (keys.has(linkKey(u)) && !e.links.includes(u)) { e.links.push(u); if (!e.how.includes('link')) e.how.unshift('link'); }
        }
    }
    const releases = [...by.values()];
    releases.forEach(e => {
        e.same = sameAlbum(e, rel);
        // found by its title only, it counts when the track count agrees (not only where one is unknown)
        if (e.how.length === 1 && e.how[0] === 'title' && !(e.tracks && e.tracks === relTracks(rel))) e.same = false;
    });
    const rank = e => (e.how.includes('link') ? 4 : 0) + (e.same ? 2 : 0) + (e.how.includes('barcode') ? 1 : 0);
    releases.sort((a, b) => rank(b) - rank(a));
    const light = releases.some(e => e.links.length) ? 'linked'
        : releases.some(e => e.same && e.how.includes('barcode')) ? 'barcode'
        : releases.some(e => e.same) ? 'similar' : 'none';
    // a title-only hit that isn't this album is noise; another edition by link or barcode is worth a line
    const shown = releases.filter(e => e.same || e.how.some(h => h !== 'title'));
    Log[light === 'none' ? 'ok' : 'warn'](`MusicBrainz check: ${light} in ${Date.now() - t0} ms${shown.length ? ' · ' + shown.map(e => `${e.id} "${e.title}" ${e.format || '?'}, ${e.tracks == null ? '?' : e.tracks} tracks, barcode ${e.barcode || '—'} [${e.how.join('+')}${e.same ? ', this album' : ''}]`).join(' | ') : ''}`);
    return { light, releases: shown };
}

// The light on the Import button
function showLight(light) {
    const go = document.querySelector('#fc-root .fc-go');
    if (!go) return;
    let dot = go.querySelector('.fc-light');
    if (!light) { if (dot) dot.remove(); go.dataset.tip = go.dataset.tipBase || go.dataset.tip; return; }
    if (!dot) { dot = document.createElement('i'); dot.className = 'fc-light'; go.insertBefore(dot, go.querySelector('span')); }
    dot.dataset.light = light;
    go.dataset.tipBase = go.dataset.tipBase || go.dataset.tip;
    go.dataset.tip = go.dataset.tipBase + '\n\n' + LIGHTS[light];
}
// The album read for this page, once: an import, or the check as the page opens. Kept unfinished; each
// use finishes its own copy (finishRelease changes what it gets).
function readAlbum(provider, id, progress) {
    const c = checks.get(checkKey(provider, id)) || {};
    checks.set(checkKey(provider, id), c);
    if (!c.relP) {
        c.relP = provider.fetchRelease(id, progress || (() => {}));
        c.relP.catch(() => { if (checks.get(checkKey(provider, id)) === c) c.relP = null; });   // a failed read is read again
    }
    return c.relP;
}
const finishedCopy = (raw, provider) => finishRelease(JSON.parse(JSON.stringify(raw)), provider);
// As the page opens (Check MusicBrainz: On page load): the album read and checked
async function checkOnLoad(provider, id) {
    if (checkMode() !== 'load') return;
    const key = checkKey(provider, id), c = checks.get(key) || {};
    checks.set(key, c);
    if (c.result || c.busy) return;
    c.busy = true;
    const here = () => current && checkKey(current.provider, current.id) === key;
    // the read waits for the page to settle: the readers of a page's own data need it drawn
    await new Promise(r => setTimeout(r, 2000));
    if (!here()) { c.busy = false; return; }
    showLight('busy');
    const p = (async () => (c.result = await checkAlbum(provider, id, finishedCopy(await readAlbum(provider, id), provider))))();
    c.checkP = p;
    try {
        await p;
        if (here()) showLight(c.result.light);
    } catch (e) {
        Log.warn(`MusicBrainz check on load failed: ${e.message}`);
        if (here()) showLight('failed');
    } finally { c.busy = false; c.checkP = null; }
}

// The panel's icons: the link (Apollo's), the barcode, the format by kind and the date (Mission Control's), a
// title and a tracklist of their own
const CHECK_ICONS = {
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    barcode: '<svg viewBox="0 0 14 10" fill="currentColor"><rect x="0" width="1.4" height="10"/><rect x="2.4" width="0.8" height="10"/><rect x="4.2" width="1.8" height="10"/><rect x="7" width="0.8" height="10"/><rect x="8.8" width="1.4" height="10"/><rect x="11.2" width="0.8" height="10"/><rect x="12.6" width="1.4" height="10"/></svg>',
    title: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 3h10M7 3v9"/></svg>',
    tracks: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 3.5h7.5M5 7h7.5M5 10.5h7.5"/><circle cx="2" cy="3.5" r=".9" fill="currentColor"/><circle cx="2" cy="7" r=".9" fill="currentColor"/><circle cx="2" cy="10.5" r=".9" fill="currentColor"/></svg>',
    date: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="2.5" width="11" height="10" rx="1.5"/><path d="M1.5 6h11M4.5 1v3M9.5 1v3"/></svg>',
};
const FORMAT_ICONS = {
    digital: '<path d="M8 25h16a6 6 0 0 0 .8-11.95A9 9 0 0 0 7.4 15.2 5 5 0 0 0 8 25z"/>',
    vinyl: '<circle cx="14" cy="17" r="11.5"/><circle cx="14" cy="17" r="7.5" stroke-width="1.5"/><circle cx="14" cy="17" r="3.2" fill="currentColor"/><path d="M28 3v11l-6 6"/><circle cx="28" cy="3.5" r=".6" fill="currentColor"/>',
    cassette: '<rect x="3" y="7" width="26" height="18" rx="2.5"/><circle cx="11" cy="15" r="2.6"/><circle cx="21" cy="15" r="2.6"/><path d="M11 12.4h10M9 25l2-4h10l2 4"/>',
    disc: '<circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="3.5"/><path d="M16 7a9 9 0 0 1 9 9" opacity=".55"/>',
};
function checkIcon(name, format) {
    if (name !== 'format') return CHECK_ICONS[name] || '';
    const k = fmtKind(String(format || '').split('+')[0]);
    return '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">' + (FORMAT_ICONS[k] || FORMAT_ICONS.disc) + '</svg>';
}
// A release's badges in the panel: [name, agrees, tooltip] for each thing both the release and the album give
function checkBadges(e, rel, provider) {
    const out = [];
    const relDate = rel.date && rel.date.year ? [rel.date.year, rel.date.month, rel.date.day].filter(Boolean).map((n, i) => (i ? String(n).padStart(2, '0') : n)).join('-') : '';
    if (e.links.length) out.push(['link', true, `Its ${provider.name} link is on this release`]);
    if (e.barcode && rel.barcode) out.push(['barcode', bcCore(e.barcode) === bcCore(rel.barcode), `Barcode\nThis release: ${e.barcode}\n${provider.name}: ${rel.barcode}`]);
    if (e.title) out.push(['title', titleClose(e.title, rel.title), `Title\nThis release: ${e.title}\n${provider.name}: ${rel.title}`]);
    if (e.tracks) out.push(['tracks', e.tracks === relTracks(rel), `Track count\nThis release: ${e.tracks}\n${provider.name}: ${relTracks(rel)}`]);
    if (e.format && !/unknown/i.test(e.format)) out.push(['format', fmtKind(e.format) === fmtKind(relFormat(rel)), `Format\nThis release: ${e.format}\n${provider.name}: ${relFormat(rel)}`]);
    if (e.date && relDate) out.push(['date', e.date === relDate, `Release date\nThis release: ${e.date}\n${provider.name}: ${relDate}`]);
    return out;
}
// The panel a match opens before the release editor. → 'import', or null (done, or cancelled)
function askExisting(result, rel, provider, anchor) {
    return new Promise(resolve => {
        document.getElementById('fc-check')?.remove();
        const box = document.createElement('div');
        box.id = 'fc-check';
        box.setAttribute('role', 'alertdialog');
        const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
        const sure = result.light === 'linked';
        const h = el('div', 'fc-check-h');
        h.append(el('i', 'fc-light'), el('span', null, sure ? 'MusicBrainz has this album' : 'MusicBrainz may have this album'));
        h.firstChild.dataset.light = result.light;
        box.append(h, el('p', null, sure ? `Its ${provider.name} link is already on the release below. Update it with what it lacks rather than adding the album again.`
            : `Check the release${result.releases.filter(e => e.same).length > 1 ? 's' : ''} below before you add the album again: update one with what it lacks, or add only the link.`));
        const list = el('ul', 'fc-check-list');
        const done = v => { box.remove(); document.removeEventListener('keydown', key, true); resolve(v); };
        const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
        for (const e of result.releases) {
            const li = el('li', e.same || e.links.length ? 'fc-same' : 'fc-other');
            const dot = el('i', 'fc-light');
            dot.dataset.light = e.links.length ? 'linked' : !e.same ? 'other' : e.how.includes('barcode') ? 'barcode' : 'similar';
            const a = el('a', null, e.title);
            a.href = `https://${settings().server}/release/${e.id}`; a.target = '_blank'; a.rel = 'noopener';
            const meta = [e.artist, e.date, e.country, e.format, e.tracks != null ? `${e.tracks} tracks` : null, e.labels, e.barcode].filter(Boolean).join(' · ');
            const line = el('div', 'fc-check-rel');
            line.append(dot, a);
            if (e.disamb) line.append(el('span', 'fc-dim', ` (${e.disamb})`));
            li.append(line, el('div', 'fc-dim', `${meta}${!e.same && !e.links.length ? `${meta ? ' · ' : ''}another edition` : ''}`));
            // majkinetor: "badges for stuff that matches", as icons: what agrees with the album (✓), and what differs (≠)
            const badges = el('div', 'fc-badges');
            for (const [name, ok, tip] of checkBadges(e, rel, provider)) {
                const bd = el('span', 'fc-ic' + (ok ? '' : ' fc-ic-no'));
                bd.dataset.name = name;
                bd.dataset.tip = tip;
                bd.setAttribute('aria-label', (ok ? '' : '≠ ') + name);
                bd.innerHTML = mbuHtml(checkIcon(name, e.format));
                badges.append(bd);
            }
            if (badges.childNodes.length) li.append(badges);
            if (e.same || e.links.length) {
                const acts = el('div', 'fc-check-acts');
                const upd = el('button', 'fc-check-upd', 'Update this release');
                upd.type = 'button';
                upd.dataset.tip = 'Update this release in Mission Control\nIt opens the release, compares it with the platforms, this album included, and offers what it lacks: the barcode, labels and catalog numbers, release event, track lengths, ISRCs and links.';
                upd.addEventListener('click', () => { updateRelease(e, rel, provider); done(null); });
                acts.append(upd);
                // the album's links the release lacks, in whatever form it has them
                const has = new Set((e.urls || e.links).map(linkKey));
                const missing = (rel.urls || []).filter(u => !has.has(linkKey(u.url)));
                if (missing.length) {
                    const ln = el('button', 'fc-check-link', 'Add link only');
                    ln.type = 'button';
                    ln.dataset.tip = `Add the ${provider.name} link to this release\nIts edit page opens with the link and an edit note; nothing else changes.`;
                    ln.addEventListener('click', () => { addLinkOnly(e, missing, rel, provider); done(null); });
                    acts.append(ln);
                }
                li.append(acts);
            }
            list.append(li);
        }
        const b = el('div', 'fc-warn-b');
        const no = el('button', 'fc-warn-no', 'Cancel'); no.type = 'button';
        const go = el('button', 'fc-warn-go', 'Import anyway'); go.type = 'button';
        b.append(no, go);
        box.append(list, b);
        document.body.appendChild(box);
        if (anchor && anchor.isConnected) placePanel(box, anchor);
        document.addEventListener('keydown', key, true);
        no.addEventListener('click', () => done(null));
        go.addEventListener('click', () => done('import'));
        (box.querySelector('.fc-check-upd') || go).focus();
    });
}
function openMb(url) {
    Log.info(`opening ${url}`);
    if (mbuTestHooks()) { window.__fcLastOpen = url; return; }
    if (typeof GM_openInTab === 'function') GM_openInTab(url, { active: true, insert: true });
    else { const w = window.open(url, '_blank'); if (w) w.opener = null; else location.assign(url); }
}
// Update this release: Mission Control opens on it and compares it with the platforms, this album among
// them as read here (on a release page First Contact hands it over: mbUpdate)
function updateRelease(e, rel, provider) {
    const token = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    pruneHandoffs();
    GM_setValue(UPDATE_PREFIX + token, { v: 1, token, created: Date.now(), mbid: e.id, source: provider.id, sourceName: provider.name, platform: providerMeta(provider), url: rel.url, rel: relWithForms(rel, provider) });
    Log.info(`update release ${e.id} "${e.title}" in Mission Control with ${provider.name}'s album (token ${token})`);
    if (mbuTestHooks()) window.__fcLastUpdate = { token, mbid: e.id };
    openMb(`https://${settings().server}/release/${e.id}#fc-update=${token}`);
    if (settings().closeAfter && !mbuTestHooks()) closeSourceTab();
}
// Add link only: the release's edit page, seeded with the album's links and an edit note
function addLinkOnly(e, urls, rel, provider) {
    const q = new URLSearchParams();
    urls.forEach((u, i) => { q.set(`urls.${i}.url`, u.url); if (u.linkType) q.set(`urls.${i}.link_type`, u.linkType); });
    q.set('edit_note', `${provider.name}: ${rel.url}\nMusicBrainz had this album already; First Contact found it by ${e.how.includes('link') ? 'its link' : e.how.includes('barcode') ? 'its barcode' : 'its title and artist'}.\n\n${(typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.name) || NAME} v${VERSION} by majkinetor - ${HOMEPAGE}`);
    Log.info(`add ${urls.length} link(s) to release ${e.id}: ${urls.map(u => u.url).join(', ')}`);
    openMb(`https://${settings().server}/release/${e.id}/edit?${q}`);
}

// On MusicBrainz's /release/add#mc=<token>: hand the album to Mission Control, read the other
// platforms for it, and seed the release editor with what it took. Every detail is a JSON string.
//   fc:consolidate          → the album as Consolidate stored it, or { token, error }; again on fc:consolidate-request
//   mc:read { url, run }    → mc:read-progress { url, run, n, total } while it reads, then
//                             mc:read-result { url, run, ok, provider, rel, ms } or { url, run, ok: false, error }
//   fc:seed { rel, platform, editNote, run } → fc:seeded { run, token }, then the release editor in this tab
const READ_PAGE = new Set(['bandcamp', 'qobuz', 'beatport', 'sevendigital', 'ototoy', 'mora']);   // the readers that parse the album page
function mbConsolidate(token) {
    const key = CONS_PREFIX + token;
    let h = GM_getValue(key, null), from = 'storage';
    if (!h) { try { h = JSON.parse(sessionStorage.getItem(key) || 'null'); from = 'this tab'; } catch (e) { h = null; } }
    if (h) {
        try { sessionStorage.setItem(key, JSON.stringify(h)); } catch (e) { Log.debug(`consolidation ${token}: no copy for this tab (${e.message})`); }
        GM_deleteValue(key);
        Log.info(`Mission Control: consolidation ${token} read from ${from}: ${h.sourceName} "${h.rel && h.rel.title}" (${h.url})`);
    } else Log.warn(`Mission Control page opened with consolidation ${token}, but it is not stored (expired, or another browser)`);
    const json = JSON.stringify(h || { token, error: 'First Contact has no album stored for this page: it is kept for an hour, in the browser that read it.' });
    const publish = why => {
        document.documentElement.dataset.fcConsolidate = json;
        document.dispatchEvent(new CustomEvent('fc:consolidate', { detail: json }));
        Log.debug(`consolidation ${token} published (${why})`);
    };
    publish('load');
    document.addEventListener('fc:consolidate-request', () => publish('request'));
    document.addEventListener('mc:read', e => { mcRead(e.detail); });
    document.addEventListener('fc:seed', e => { mcSeed(e.detail); });
}
// #782: on a release page, the reader alone, for Mission Control's comparison with the platforms: it answers
// mc:discover as provider fc (capability 'read', no probe, no apply) and reads the album pages it is asked to (mc:read)
function mbReader() {
    const hello = () => document.dispatchEvent(new CustomEvent('mc:provider', { detail: JSON.stringify({ id: 'fc', name: 'First Contact', version: VERSION, capabilities: ['read'] }) }));
    document.addEventListener('mc:discover', () => { Log.debug('Mission Control asked: answering as provider fc (reader)'); hello(); });
    document.addEventListener('mc:read', e => { mcRead(e.detail); });
    hello();   // Mission Control may have asked before First Contact loaded
}
// #801: on /release/<mbid>#fc-update=<token>, the album Update this release sent, for Mission Control to compare
// the release with: fc:update (detail: JSON), again on fc:update-request; { token, error } when it isn't stored
function mbUpdate(token) {
    const key = UPDATE_PREFIX + token;
    let h = GM_getValue(key, null), from = 'storage';
    if (!h) { try { h = JSON.parse(sessionStorage.getItem(key) || 'null'); from = 'this tab'; } catch (e) { h = null; } }
    if (h) {
        try { sessionStorage.setItem(key, JSON.stringify(h)); } catch (e) { Log.debug(`update ${token}: no copy for this tab (${e.message})`); }
        GM_deleteValue(key);
        Log.info(`Mission Control: update ${token} read from ${from}: ${h.sourceName} "${h.rel && h.rel.title}" (${h.url}) for release ${h.mbid}`);
    } else Log.warn(`release page opened with update ${token}, but it is not stored (expired, or another browser)`);
    const json = JSON.stringify(h || { token, error: 'First Contact has no album stored for this update: it is kept for an hour, in the browser that read it.' });
    const publish = why => {
        document.documentElement.dataset.fcUpdate = json;
        document.dispatchEvent(new CustomEvent('fc:update', { detail: json }));
        Log.debug(`update ${token} published (${why})`);
    };
    publish('load');
    document.addEventListener('fc:update-request', () => publish('request'));
}
async function mcRead(detail) {
    let d;
    try { d = JSON.parse(detail) || {}; } catch (e) { Log.warn(`mc:read with unreadable detail: ${e.message}`); return; }
    const send = (type, o) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(Object.assign({ url: d.url, run: d.run }, o)) }));
    const t0 = Date.now();
    try {
        const u = new URL(d.url);
        const provider = PROVIDERS.find(p => p.host.test(u.hostname));
        if (!provider) throw new Error(`First Contact can't read ${u.hostname}`);
        const id = provider.albumId(u);
        if (!id) throw new Error(`not an album page ${provider.name} has (${d.url})`);
        if (provider.id === 'spotify') throw new Error('Spotify is read through its web player, on its own page only');
        let doc = null;
        if (READ_PAGE.has(provider.id)) {
            // #745: with the browser's cookies (a bot check's clearance). A page that is refused all the same is no end
            // for a reader that can do without it (Beatport: through Platform Check): it gets an empty page, marked refused
            let html = null, refused = null;
            try {
                html = await gmText(d.url, { Accept: 'text/html' }, true);
                if (/<title>(Just a moment|Human Verification)/i.test(html)) refused = 'its bot check';
            } catch (e) { refused = e.message; }
            if (refused && !provider.withoutPage) throw new Error(`${provider.name} refused the page (${refused})`);
            if (refused) Log.warn(`Mission Control: ${provider.name} refused the page (${refused}); reading it without the page`);
            doc = new DOMParser().parseFromString(refused ? '<html><body></body></html>' : html, 'text/html');
            doc.fcOrigin = u.origin;
            if (refused) doc.fcRefused = refused;
        }
        Log.info(`Mission Control: reading ${provider.name} album ${id}${doc ? ' from its page, fetched' : ''}`);
        const rel = finishRelease(await provider.fetchRelease(id, (n, total) => send('mc:read-progress', { n, total }), doc), provider);
        const nTracks = rel.mediums.reduce((n, m) => n + m.tracks.length, 0);
        Log.ok(`Mission Control: ${provider.name} read in ${Date.now() - t0} ms: "${rel.title}" · ${nTracks} track(s) · barcode ${rel.barcode || '—'}`);
        send('mc:read-result', { ok: true, provider: providerMeta(provider), rel: relWithForms(rel, provider), ms: Date.now() - t0 });
    } catch (e) {
        Log.warn(`Mission Control: reading ${d.url} failed: ${e.message}`);
        send('mc:read-result', { ok: false, error: e.message, ms: Date.now() - t0 });
    }
}
// The handoff for the release Mission Control consolidated: each credit keeps its source link
// (url) and carries the same artist's links on the other platforms read (alt: [{ url, urlForms,
// platform }]), which Apollo tries when the source link alone matches no one (#702).
function handoffFromMc(rel, platform, token) {
    const ac = c => (c || []).map(a => ({ name: a.name, artistName: a.artistName || a.name, join: a.join, url: a.url || null, urlForms: a.urlForms, mbid: a.mbid || null, alt: Array.isArray(a.alt) && a.alt.length ? a.alt : undefined }));
    return {
        v: 2, token, created: Date.now(), mc: true,
        source: platform.id, sourceName: platform.name,
        platform: { abbr: platform.abbr, name: platform.name, artistLinkType: platform.artistLinkType || undefined },
        url: rel.url, title: rel.title, barcode: rel.barcode,
        credit: ac(rel.credit),
        labels: (rel.labels || []).map(l => ({ name: l.name, catno: l.catno, url: l.url || null, urlForms: l.urlForms, mbid: l.mbid || null })),
        mediums: rel.mediums.map(m => ({ tracks: m.tracks.map(t => ({ title: t.title, isrc: t.isrc, url: t.url, credit: ac(t.credit) })) })),
    };
}
function mcSeed(detail) {
    let d;
    try { d = JSON.parse(detail) || {}; } catch (e) { Log.warn(`fc:seed with unreadable detail: ${e.message}`); return; }
    if (!d.rel || !d.platform) { Log.warn('fc:seed without a release'); return; }
    const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    GM_setValue(HANDOFF_PREFIX + token, Object.assign(handoffFromMc(d.rel, d.platform, token), { archive: null }));
    const params = seedParams(d.rel, d.editNote || '');
    const nTracks = d.rel.mediums.reduce((n, m) => n + m.tracks.length, 0);
    Log.info(`Mission Control: seeding the release editor with "${d.rel.title}", ${nTracks} track(s), ${(d.rel.urls || []).length} link(s) (${params.length} parameters, token ${token})`);
    if (mbuTestHooks()) window.__fcLastSeed = { token, params, rel: d.rel, mc: true };
    document.dispatchEvent(new CustomEvent('fc:seeded', { detail: JSON.stringify({ run: d.run, token }) }));
    if (d.dry) return;
    // majkinetor: the browser asked "leave page?" on Add release. MB's editor warns on
    // beforeunload even while empty, once the page has had a click, unless rootField.redirecting
    // (its own flag for leaving on purpose). This page is only Mission Control's: nothing is lost.
    try {
        const w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        const rf = w.MB && w.MB.releaseEditor && w.MB.releaseEditor.rootField;
        if (rf) { rf.redirecting = true; Log.debug('release editor: redirecting set, so leaving asks nothing'); }
        else Log.warn('no MB.releaseEditor.rootField here: the browser may ask before leaving');
    } catch (e) { Log.warn(`could not turn the release editor's leave-page warning off: ${e.message}`); }
    postForm(`/release/add?first_contact=${token}`, '_self', params);
}

// majkinetor: "why does it open tab while reading?" The editor's tab opens once the release is read,
// not at the click. A tab a page opens that long after the click is a popup the browser blocks, but
// one the userscript manager opens (GM_openInTab) isn't: the seed waits in the script's storage, and
// First Contact on that page posts it there (mbPostSeed). Without GM_openInTab, the page opens the tab
// itself and posts into it, or posts in this tab when the browser blocks it.
// → 'tab' (a new tab) or 'here' (this one)
function sendSeed(server, token, params) {
    const action = `https://${server}/release/add?first_contact=${token}`;
    // on a test page the harness's GM_openInTab opens nothing (as for the consolidation): the specs take the window.open path
    if (typeof GM_openInTab === 'function' && !mbuTestHooks()) {
        GM_setValue(SEED_PREFIX + token, { created: Date.now(), params });
        GM_openInTab(`${action}&fc_post=1`, { active: true, insert: true });
        return 'tab';
    }
    const target = 'fc-' + token;
    const win = window.open('about:blank', target);
    postForm(action, win ? target : '_self', params);
    return win ? 'tab' : 'here';
}
function postForm(action, target, params) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    form.target = target;
    form.acceptCharset = 'UTF-8';
    form.style.display = 'none';
    for (const [k, v] of params) {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = k; inp.value = v;
        form.appendChild(inp);
    }
    (document.body || document.documentElement).appendChild(form);
    form.submit();
    form.remove();
}
// On the tab sendSeed opened: stop the empty release editor loading and post the seed to it, here
function mbPostSeed(token) {
    const key = SEED_PREFIX + token;
    const seed = GM_getValue(key, null);
    if (!seed || !Array.isArray(seed.params)) { Log.warn(`release editor opened to take the seed ${token}, but it is not stored (expired, or another browser)`); return; }
    GM_deleteValue(key);
    try { window.stop(); } catch (e) { /* it posts anyway */ }
    Log.debug(`seed ${token}: ${seed.params.length} parameters, posting them to the release editor`);
    const post = () => postForm(`/release/add?first_contact=${token}`, '_self', seed.params);
    if (document.documentElement) post();   // at document-start the page may have no root yet
    else new MutationObserver((m, o) => { if (document.documentElement) { o.disconnect(); post(); } }).observe(document, { childList: true });
}

// majkinetor: an option to close the page once the import is clicked. Only after the POST has
// gone into the editor's tab (closing sooner could take the submission with it), and only with
// @grant window.close: a tab the user opened can't close itself otherwise.
function closeSourceTab() {
    Log.info('closing this page (Close this page after the import)');
    if (mbuTestHooks()) { window.__fcClosed = true; return; }
    setTimeout(() => {
        try { window.close(); } catch (e) { Log.warn(`could not close this page: ${e.message}`); }
        setTimeout(() => { Log.warn('this page is still open: the userscript manager did not let it close (it needs @grant window.close)'); }, 1000);
    }, 500);
}

function platformMain() {
    const provider = PROVIDERS.find(p => p.host.test(location.hostname));
    if (!provider) return;
    Log.info(`${NAME} ${VERSION} on ${provider.name}`);
    // The platforms are single-page apps: watch the address, not the load.
    let last = null;
    const check = () => {
        if (location.href === last) return;
        last = location.href;
        const id = provider.albumId(location);
        current = id ? { provider, id } : null;
        if (id) { if (document.body) { mountButton(provider, id); checkOnLoad(provider, id); } }
        else unmountButton();
    };
    check();
    setInterval(check, 700);
}

/* ── MusicBrainz side: publish the handoff for Apollo ────────────────────── */
// Apollo (or anything else) reads the seed's platform links from
//   document.documentElement.dataset.firstContact   (a JSON string), or
//   the 'first-contact:seed' event on document     (detail: the same JSON string),
// and can ask for it again with a 'first-contact:request' event on document.

function mbMain() {
    if (/^\/release\/[0-9a-f-]{36}\/?$/i.test(location.pathname)) {
        mbReader();
        const upd = (location.hash.match(/[#&]fc-update=([a-z0-9]+)/i) || [])[1];
        if (upd) mbUpdate(upd);
        return;
    }
    if (!/^\/release\/add\/?$/.test(location.pathname)) return;
    const mc = (location.hash.match(/[#&]mc=([a-z0-9]+)/i) || [])[1];
    if (mc) { mbConsolidate(mc); return; }
    const q = new URLSearchParams(location.search);
    const token = q.get('first_contact');
    if (!token) return;
    if (q.get('fc_post')) { mbPostSeed(token); return; }
    pruneHandoffs();
    const key = HANDOFF_PREFIX + token;
    let h = GM_getValue(key, null), from = 'storage';
    if (!h) { try { h = JSON.parse(sessionStorage.getItem(key) || 'null'); from = 'this tab'; } catch (e) { h = null; } }
    if (!h) { Log.warn(`release editor opened with handoff ${token}, but it is not stored (expired, or another browser)`); return; }
    Log.debug(`handoff ${token} read from ${from}`);
    // MusicBrainz's "Continue" page (a POST from another site) comes first, at the same address:
    // the handoff stays stored until the release editor itself is here
    const consume = () => {
        if (!document.getElementById('release-editor')) { Log.debug(`handoff ${token} kept: not the release editor yet (the confirmation page)`); return; }
        try { sessionStorage.setItem(key, JSON.stringify(h)); } catch (e) { Log.debug(`handoff ${token}: no copy for this tab (${e.message})`); }
        GM_deleteValue(key);
        Log.debug(`handoff ${token} taken out of the script's storage`);
        if (h.archive) archiveSources(h.archive, token);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', consume, { once: true }); else consume();
    const json = JSON.stringify(h);
    const publish = why => {
        document.documentElement.dataset.firstContact = json;
        document.dispatchEvent(new CustomEvent('first-contact:seed', { detail: json }));
        Log.debug(`handoff ${token} published (${why})`);
    };
    publish('load');
    document.addEventListener('first-contact:request', () => publish('request'));
    const nArtists = [h.credit].concat(...h.mediums.map(m => m.tracks.map(t => t.credit))).reduce((n, c) => n + c.filter(a => a.url).length, 0);
    Log.info(`release editor seeded from ${h.sourceName} (${h.url}); ${nArtists} artist credit(s) carry a platform link`);
    if (mbuTestHooks()) window.__fcHandoff = h;
}

/* ── shared blocks ───────────────────────────────────────────────────────── */

// <ST-TOKENS> — generated by dev/tokens/sync-tokens.mjs from dev/tokens/design-tokens.mjs — DO NOT EDIT
const MBU_TOKENS = ':root{--mbu-bg:var(--background, #fff);--mbu-bg-raised:#faf9fe;--mbu-bg-raised:color-mix(in srgb, var(--mbu-bg) 96%, var(--mbu-accent));--mbu-bg-sunken:#f4f2f9;--mbu-bg-sunken:color-mix(in srgb, var(--mbu-bg) 94%, var(--mbu-text));--mbu-bg-hover:#f3eefe;--mbu-bg-hover:color-mix(in srgb, var(--mbu-bg) 91%, var(--mbu-accent));--mbu-text:var(--text, #222);--mbu-text-dim:#555;--mbu-text-dim:color-mix(in srgb, var(--mbu-text) 78%, var(--mbu-bg));--mbu-text-weak:#999;--mbu-text-weak:color-mix(in srgb, var(--mbu-text) 52%, var(--mbu-bg));--mbu-text-on-accent:#fff;--mbu-border:var(--border, #cfc6e6);--mbu-border-soft:#e2dcef;--mbu-border-strong:#9a8ccb;--mbu-border-strong:color-mix(in srgb, var(--mbu-border) 70%, var(--mbu-text));--mbu-divider:#eee;--mbu-divider:color-mix(in srgb, var(--mbu-bg) 92%, var(--mbu-text));--mbu-accent:#5f3ec0;--mbu-accent-hover:#4e329f;--mbu-accent-deep:#3b2c70;--mbu-accent-soft:#ece4ff;--mbu-accent-soft:color-mix(in srgb, var(--mbu-bg) 86%, var(--mbu-accent));--mbu-accent-fg:#fff;--mbu-accent-text:#5f3ec0;--mbu-accent-deep-text:#3b2c70;--mbu-ok:#1f9d6b;--mbu-ok:color-mix(in srgb, #1f9d6b 78%, var(--mbu-text));--mbu-ok-bg:#eef7f1;--mbu-ok-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-ok));--mbu-ok-border:#9bd3b6;--mbu-warn:#a05a00;--mbu-warn:color-mix(in srgb, #b4791f 78%, var(--mbu-text));--mbu-warn-bg:#fff7e6;--mbu-warn-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-warn));--mbu-warn-border:#f0c877;--mbu-error:#c0392b;--mbu-error:color-mix(in srgb, #d0473a 78%, var(--mbu-text));--mbu-error-bg:#fdecec;--mbu-error-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-error));--mbu-error-border:#e2a1a1;--mbu-info:#2f7fbf;--mbu-info:color-mix(in srgb, #3f8fd0 78%, var(--mbu-text));--mbu-info-bg:#eef4fb;--mbu-info-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-info));--mbu-info-border:#a9c8e6;--mbu-font:-apple-system,Segoe UI,Roboto,Arial,sans-serif;--mbu-font-mono:ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;--mbu-fs:14px;--mbu-fs-sm:12px;--mbu-fs-xs:11px;--mbu-radius:6px;--mbu-radius-lg:10px;--mbu-shadow:0 1px 5px rgba(60,40,110,.07);--mbu-shadow-lg:0 8px 30px rgba(40,20,80,.3);--mbu-z-panel:30;--mbu-z-pop:99998;--mbu-z-modal:2147483000;--mbu-z-modal-panel:2147483001;--mbu-z-tip:2147483647}:root[data-mbu-theme="dark"]{--mbu-bg:#1e1b24;--mbu-text:#e9e5f2;--mbu-border:#3b3548;--mbu-accent-text:#b9a7f0;--mbu-accent-deep-text:#a493e0}:root[data-mbu-theme="dark"][data-mbu-seed="theme"]{--mbu-bg:var(--background, #1e1b24);--mbu-text:var(--text, #e9e5f2);--mbu-border:var(--border, #3b3548)}';
// </ST-TOKENS>

// <ST-UI> — generated by dev/ui/sync-ui.mjs from dev/ui/ui-components.mjs — DO NOT EDIT
const MBU_UI_CSS = '.mbu-help{font-size:12px;color:var(--mbu-accent-text);text-decoration:none;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);padding:1px 8px;white-space:nowrap;line-height:1.6;background:none}.mbu-help:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-accent);text-decoration:none}h4>.mbu-help,.mbu-cfg-h>.mbu-help{margin-left:8px;flex:0 0 auto;font-weight:normal}#mbu-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:var(--mbu-z-pop);background:var(--mbu-accent-deep);color:var(--mbu-text-on-accent);padding:10px 16px;border-radius:9px;font:13px/1.35 var(--mbu-font);box-shadow:var(--mbu-shadow-lg);opacity:0;transition:opacity .2s;pointer-events:none;max-width:80vw;text-align:center;white-space:pre-wrap}#mbu-toast.mbu-toast-on{opacity:1}#mbu-toast.mbu-toast-act{pointer-events:auto}#mbu-toast .mbu-toast-btn{width:auto;margin-left:10px;padding:2px 9px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;font:inherit;cursor:pointer}#mbu-toast .mbu-toast-btn:hover{background:rgba(255,255,255,.18)}#mbu-toast.mbu-toast-ok{background:var(--mbu-ok)}#mbu-toast.mbu-toast-warn{background:var(--mbu-warn)}#mbu-toast.mbu-toast-error{background:var(--mbu-error)}.mbu-cfg-h{display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:0 0 9px;border-bottom:1px solid var(--mbu-border-soft);font:600 15px/1.3 var(--mbu-font);color:var(--mbu-text)}.mbu-cfg-ic{flex:0 0 auto;display:inline-flex;align-items:center;width:22px;height:22px}.mbu-cfg-ic img,.mbu-cfg-ic svg{width:22px;height:22px;object-fit:contain;display:block}.mbu-cfg-name{flex:0 0 auto;font-weight:700;color:var(--mbu-accent-text)}.mbu-cfg-ver{flex:0 0 auto;font:400 11px var(--mbu-font);color:var(--mbu-text-weak);white-space:nowrap}.mbu-cfg-sp{flex:1 1 auto;min-width:8px}.mbu-cfg-log{flex:0 0 auto;width:auto;font:400 12px var(--mbu-font);color:var(--mbu-accent-text);cursor:pointer;background:none;border:1px solid transparent;border-radius:var(--mbu-radius);padding:1px 8px;line-height:1.6}.mbu-cfg-log:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-border)}#mbu-logpop{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:var(--mbu-z-modal);display:flex;flex-direction:column;width:min(860px,94vw);max-height:72vh;background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:11px;box-shadow:var(--mbu-shadow-lg);font:13px var(--mbu-font);color:var(--mbu-text);overflow:hidden}.mbu-logpop-h{display:flex;align-items:center;gap:8px;padding:10px 13px;border-bottom:1px solid var(--mbu-border-soft);color:var(--mbu-accent-text);cursor:move;user-select:none}.mbu-logpop-sp{margin-left:auto}.mbu-logpop-hclear,.mbu-logpop-clear,.mbu-logpop-copy,.mbu-logpop-x,.mbu-logpop-min,.mbu-logpop-full{width:auto;font-size:12px;color:var(--mbu-accent-text);background:var(--mbu-bg-hover);border:1px solid var(--mbu-border);border-radius:5px;padding:2px 9px;cursor:pointer;font-family:inherit}.mbu-logpop-hclear:hover,.mbu-logpop-clear:hover,.mbu-logpop-copy:hover,.mbu-logpop-x:hover,.mbu-logpop-min:hover,.mbu-logpop-full:hover{background:var(--mbu-accent-soft)}#mbu-logpop.min .mbu-log-list,#mbu-logpop.min .mbu-log-f,#mbu-logpop.min .mbu-logpop-clear,#mbu-logpop.min .mbu-logpop-copy,#mbu-logpop.min .mbu-logpop-x,#mbu-logpop.min .mbu-logpop-full{display:none}#mbu-logpop.min{max-height:none;width:auto!important;height:auto!important}#mbu-logpop.sized{max-height:none}.mbu-logpop-grip{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;opacity:.6;background:linear-gradient(135deg,transparent 55%,var(--mbu-border-strong) 55%,var(--mbu-border-strong) 62%,transparent 62%,transparent 75%,var(--mbu-border-strong) 75%,var(--mbu-border-strong) 82%,transparent 82%)}.mbu-logpop-grip:hover{opacity:1}#mbu-logpop.min .mbu-logpop-grip,#mbu-logpop.full .mbu-logpop-grip{display:none}#mbu-logpop.full{top:12px!important;left:12px!important;right:12px!important;bottom:12px!important;width:auto!important;height:auto!important;max-height:none;transform:none!important}#mbu-logpop.full .mbu-logpop-h{cursor:default}#mbu-logpop.min .mbu-logpop-sp{display:none}.mbu-log-badge{color:var(--mbu-border-strong);font-size:11px}.mbu-logemb{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--mbu-bg);font:13px var(--mbu-font);color:var(--mbu-text)}.mbu-logemb .mbu-logpop-h{cursor:default;padding:7px 10px}.mbu-logemb .mbu-logpop-h>.mbu-log-q{flex-basis:160px;margin-left:0}.mbu-logemb .mbu-logpop-h>.mbu-log-ses{flex-basis:240px}.mbu-logpop-h{flex-wrap:nowrap}.mbu-logpop-h>*{flex-shrink:0;white-space:nowrap}.mbu-logpop-h>.mbu-log-q{flex-shrink:1;min-width:60px}.mbu-logpop-h>.mbu-log-ses{flex-shrink:1;min-width:90px}.mbu-logpop-h>.mbu-logpop-sp{flex:1 1 0;min-width:0}.mbu-logpop .mbu-log-ses{flex:0 1 260px;min-width:120px;max-width:100%}.mbu-logpop-hclear:disabled{opacity:.5;cursor:default}.mbu-log-dbg{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--mbu-text);cursor:pointer;white-space:nowrap}.mbu-log-dbg input{margin:0}#mbu-logpop.min .mbu-log-dbg{display:none}.mbu-log-past .mbu-logpop-clear{display:none}#mbu-logpop.min .mbu-log-ses,#mbu-logpop.min .mbu-logpop-hclear{display:none}.mbu-logpop .mbu-log-q{flex:0 1 200px;min-width:80px;margin-left:6px;font:12px var(--mbu-font);padding:2px 8px;border:1px solid var(--mbu-border);border-radius:5px;cursor:text}#mbu-logpop.min .mbu-log-q{display:none}.mbu-logpop .mbu-log-li.mbu-log-nq{display:none}.mbu-log-list{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;padding:9px 13px;display:flex;flex-direction:column;gap:3px}.mbu-log-li{display:flex;gap:9px;white-space:pre-wrap;word-break:break-word}.mbu-log-pre .mbu-log-m{white-space:pre;font:12px/1.35 ui-monospace,Consolas,monospace;word-break:normal}.mbu-log-t{color:var(--mbu-text-weak);flex:0 0 auto;font-variant-numeric:tabular-nums}.mbu-log-c{color:var(--mbu-text-weak);flex:0 0 auto}.mbu-log-list:not(.mbu-log-cats) .mbu-log-c{display:none}.mbu-log-list.mbu-log-cats{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:3px 9px;align-content:start}.mbu-log-cats .mbu-log-li{display:contents}.mbu-log-cats .mbu-log-empty{grid-column:1/-1}.mbu-log-f{display:flex;flex-wrap:wrap;align-items:center;gap:2px 4px;padding:5px 13px;border-bottom:1px solid var(--mbu-border-soft);font-size:11px}.mbu-log-f[hidden]{display:none}.mbu-log-fg{display:contents}.mbu-log-fs{width:1px;height:12px;background:var(--mbu-border);margin:0 6px}.mbu-logpop .mbu-log-fb{width:auto;font:inherit;color:var(--mbu-text-weak);background:none;border:1px solid transparent;border-radius:5px;padding:0 6px;line-height:1.6;cursor:pointer}.mbu-logpop .mbu-log-fb:hover{color:var(--mbu-text);border-color:var(--mbu-border)}.mbu-logpop .mbu-log-fb.on{color:var(--mbu-accent-text);background:var(--mbu-accent-soft);border-color:var(--mbu-border)}.mbu-logpop .mbu-log-fb[data-sev=error]{color:var(--mbu-error)}.mbu-logpop .mbu-log-fb[data-sev=warn]{color:var(--mbu-warn)}.mbu-logpop .mbu-log-fb[data-sev=info]{color:var(--mbu-text-dim)}.mbu-logpop .mbu-log-fb[data-sev].on{background:var(--mbu-bg-hover);border-color:currentColor;font-weight:600}.mbu-logpop .mbu-log-fb[data-cat]{border-color:var(--mbu-border-soft);background:var(--mbu-bg-raised);border-radius:999px;padding:0 8px}.mbu-logpop .mbu-log-fb[data-cat].on{color:var(--mbu-accent-text);background:var(--mbu-accent-soft);border-color:var(--mbu-accent)}.mbu-log-m{flex:1 1 auto;color:var(--mbu-text-dim)}.mbu-logpop .mbu-log-m a{color:var(--mbu-accent-text)}.mbu-log-ok .mbu-log-m{color:var(--mbu-ok)}.mbu-log-warn .mbu-log-m{color:var(--mbu-warn)}.mbu-log-error .mbu-log-m{color:var(--mbu-error)}.mbu-log-debug>*{opacity:.85}.mbu-log-debug .mbu-log-m{color:var(--mbu-text-weak)}.mbu-log-empty{color:var(--mbu-text-weak)}.mbu-ov{position:fixed;inset:0;z-index:var(--mbu-z-modal);background:rgba(15,12,28,.45);display:flex;align-items:center;justify-content:center;padding:24px}.mbu-ov-panel{background:var(--mbu-bg);color:var(--mbu-text);border-radius:var(--mbu-radius-lg);box-shadow:var(--mbu-shadow-lg);max-width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden}.mbu-ov-h{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--mbu-border-soft);font-weight:700}.mbu-ov-h .mbu-ov-title{flex:1 1 auto;min-width:0}.mbu-ov-x{flex:0 0 auto;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;cursor:pointer;color:var(--mbu-text-dim);background:none;border:none;border-radius:var(--mbu-radius)}.mbu-ov-x:hover{background:var(--mbu-bg-hover);color:var(--mbu-text)}.mbu-ov-body{flex:1 1 auto;overflow:auto;padding:14px 16px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) ::placeholder{color:var(--mbu-text-weak);opacity:1;font-style:italic}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :is(table,td,th,div,span,label)[style*=background]{color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:not(:where([type=checkbox],[type=radio],[type=range],[type=color],[type=file])),:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select{background:var(--mbu-bg-sunken);color:var(--mbu-text);border-color:var(--mbu-border)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select:focus-visible{outline:2px solid var(--mbu-accent);outline-offset:1px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :where(input[type=checkbox],input[type=radio],input[type=range]){accent-color:var(--mbu-accent)}:root[data-mbu-theme=dark] :where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color-scheme:dark;--invert-value:none;--invert:none}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) button{background-color:var(--mbu-bg-raised);color:var(--mbu-text);border-color:var(--mbu-border)}.mbu-compact .mbu-bt{display:none}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input){-webkit-appearance:none;-moz-appearance:none;appearance:none;width:18px;height:18px;margin:0;border:none;border-radius:3px;cursor:pointer;background:transparent url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27%23888%27%3E%3Crect%20x=%271%27%20y=%273.5%27%20width=%2710%27%20height=%279%27%20rx=%271.5%27/%3E%3Cpath%20d=%27M11.5%207L15%204.8v6.4L11.5%209z%27/%3E%3C/svg%3E") center/13px no-repeat;opacity:.45;box-shadow:none;flex:0 0 auto;vertical-align:middle}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):hover{opacity:1}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):checked{opacity:1;background-color:var(--mbu-accent);background-image:url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27%23fff%27%3E%3Crect%20x=%271%27%20y=%273.5%27%20width=%2710%27%20height=%279%27%20rx=%271.5%27/%3E%3Cpath%20d=%27M11.5%207L15%204.8v6.4L11.5%209z%27/%3E%3C/svg%3E")}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):focus-visible{outline:1px solid var(--mbu-accent);outline-offset:1px}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):disabled{cursor:default;opacity:.3}select.mbu-select:not(#mbu-0):not(#mbu-1){-webkit-appearance:none;-moz-appearance:none;appearance:none;box-sizing:border-box;height:22px;max-width:100%;margin:0 2px;padding:0 26px 0 12px;border:1px solid var(--mbu-border);border-radius:20px;outline-offset:1px;background-color:transparent;background-image:linear-gradient(45deg,transparent 50%,var(--mbu-text-weak) 50%),linear-gradient(135deg,var(--mbu-text-weak) 50%,transparent 50%);background-position:calc(100% - 13px) 50%,calc(100% - 8px) 50%;background-size:5px 5px;background-repeat:no-repeat;color:var(--mbu-text);font:600 12px var(--mbu-font);line-height:20px;cursor:pointer;vertical-align:middle}select.mbu-select:not(#mbu-0):not(#mbu-1):hover{border-color:var(--mbu-accent)}select.mbu-select:not(#mbu-0):not(#mbu-1):disabled{opacity:.45;cursor:default;border-color:var(--mbu-border)}select.mbu-select:not(#mbu-0):not(#mbu-1) option{background:var(--mbu-bg);color:var(--mbu-text);font-weight:400}.mbu-step:not(#mbu-0):not(#mbu-1){display:inline-flex;align-items:center;box-sizing:border-box;height:22px;margin:0 2px;padding:0;border:1px solid var(--mbu-border);border-radius:20px;background:transparent;vertical-align:middle;white-space:nowrap;flex:0 0 auto}.mbu-step:not(#mbu-0):not(#mbu-1):hover,.mbu-step:not(#mbu-0):not(#mbu-1):focus-within{border-color:var(--mbu-accent)}.mbu-step:not(#mbu-0):not(#mbu-1)>button{all:unset;box-sizing:border-box;width:20px;height:20px;text-align:center;font:600 13px/20px var(--mbu-font);color:var(--mbu-text-weak);cursor:pointer;user-select:none}.mbu-step:not(#mbu-0):not(#mbu-1)>button:hover{color:var(--mbu-accent)}.mbu-step:not(#mbu-0):not(#mbu-1)>input{all:unset;box-sizing:content-box;min-width:2ch;height:20px;padding:0 1px;font:600 12px/20px var(--mbu-font);color:var(--mbu-text);text-align:center;-moz-appearance:textfield;appearance:textfield;cursor:text}.mbu-step:not(#mbu-0):not(#mbu-1)>input::-webkit-inner-spin-button,.mbu-step:not(#mbu-0):not(#mbu-1)>input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.mbu-step:not(#mbu-0):not(#mbu-1):has(>input:disabled){opacity:.45;border-color:var(--mbu-border)}.mbu-step:not(#mbu-0):not(#mbu-1):has(>input:disabled)>button{cursor:default;color:var(--mbu-text-weak)}';
// Help link markup. Every script's help link is this, pointing at its own README.
// `name` is the userscript folder, e.g. mbuHelpHref('art_station').
function mbuHelpHref(name) {
    return 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/' + name + '/README.md';
}
function mbuHelpHtml(name, label) {
    return '<a class="mbu-help" href="' + mbuHelpHref(name) + '" target="_blank" rel="noopener"'
        + ' data-tip="Open the README in a new tab">' + (label || '? Help') + '</a>';
}
function mbuHelpEl(name, label) {
    var a = document.createElement('a');
    a.className = 'mbu-help';
    a.href = mbuHelpHref(name);
    a.target = '_blank';
    a.rel = 'noopener';
    a.dataset.tip = 'Open the README in a new tab';
    a.textContent = label || '? Help';
    return a;
}

// The config (settings) icon every script's settings button shows: the gear in text
// presentation (U+FE0E), so it takes the button's colour instead of an emoji's. #650
var MBU_CFG_ICON = '\u2699\uFE0E';

// HTML for an innerHTML on a page that enforces Trusted Types (YouTube Music, #650): there a
// plain string is refused ("This document requires 'TrustedHTML' assignment"). The policy
// passes the string through; the markup is the script's own. Elsewhere it is the string.
var _mbuTT;
function mbuHtml(s) {
    if (_mbuTT === undefined) {
        _mbuTT = null;
        try {
            var tt = (typeof window !== 'undefined' && window.trustedTypes) || null;
            if (tt && tt.createPolicy) _mbuTT = tt.createPolicy('mbu-' + Math.random().toString(36).slice(2, 8), { createHTML: function (x) { return x; } });
        } catch (e) { /* the page allows no new policy: plain strings, as before */ }
    }
    return _mbuTT ? _mbuTT.createHTML(String(s)) : String(s);
}

// The first line of every script's log: the script, its version, and what runs it, so a
// pasted log says which manager and browser it came from (#282 started it in Art Station):
//   Log.info(mbuStartupInfo('Fusion'));
//   -> Fusion v2026.10.1 · Violentmonkey 2.31.0 · firefox 143.0 (win)
// Inside String Theory GM_info describes the bundle, so the line names it:
//   -> Fusion (String Theory v2026.10.1) · Tampermonkey 5.3.3 · chrome 140.0 (win)
// On MusicBrainz it ends with the interface language, which changes what a script reads
// off the page: "· MusicBrainz in de".
function mbuStartupInfo(name) {
    var g = null;
    try { g = (typeof GM_info !== 'undefined' && GM_info) || null; } catch (e) { /* no GM_info */ }
    var s = (g && g.script) || {}, p = (g && g.platform) || {};
    var host = String(s.name || '').replace(/\*$/, ''), ver = s.version || '?';
    var line = !name ? (host || 'Script') + ' v' + ver
        : (host && host !== name) ? name + ' (' + host + ' v' + ver + ')'
        : name + ' v' + ver;
    if (g) line += ' · ' + (g.scriptHandler || 'unknown manager') + (g.version ? ' ' + g.version : '');
    if (p.browserName) line += ' · ' + p.browserName + (p.browserVersion ? ' ' + p.browserVersion : '') + (p.os ? ' (' + p.os + ')' : '');
    else { try { line += ' · ' + navigator.userAgent; } catch (e) { /* no navigator */ } }
    try {
        if (/(^|\.)musicbrainz\.(org|eu)$/i.test(location.hostname)) {
            // <html lang>, or MB's lang cookie when the page isn't parsed yet (document-start)
            var lang = (document.documentElement && document.documentElement.lang) || ((document.cookie.match(/(?:^|;\s*)lang=([^;]+)/) || [])[1]) || 'en';
            line += ' · MusicBrainz in ' + lang;
        }
    } catch (e) { /* no document */ }
    return line;
}

// One copy per page (#653). With String Theory and a standalone install of the same script
// both on, two copies build the same element ids and fight over them: each settings window
// fills in the other's checkboxes, rows flip between two rule sets. So one copy runs, the
// one with the higher version, and the other stays off without a word; only the running
// copy notes it in its log (majkinetor: "disable copy that has lower version without any
// info (except in log of active copy)"):
//   if (!mbuClaim('platform_check', 'Platform Check')) return;   // first line of the script
// The claim is a data- attribute on <html>, which every copy sees whatever its sandbox.
// It is decided at once, so no script starts late. The copy that starts first takes the
// page. When it is the older one, the newer copy stays off for this page and leaves a note
// in localStorage, and from the next page load the older copy finds the note and steps
// aside. A note whose copy has gone (uninstalled) is cleared by the older copy after the
// page loads, so it runs again from the load after.
function mbuClaimVer(v) {
    return String(v || '').split('.').map(function (n) { return parseInt(n, 10) || 0; });
}
function mbuClaimCmp(a, b) {
    var x = mbuClaimVer(a), y = mbuClaimVer(b);
    for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
    return 0;
}
function mbuClaim(key, label) {
    var info = (typeof GM_info !== 'undefined' && GM_info && GM_info.script) || {};
    var name = String(info.name || label || key), ver = String(info.version || '0');
    var mine = (name.slice(-1) === '*' ? 'String Theory' : 'standalone') + ' v' + ver;
    var root = document.documentElement, attr = 'data-mbu-run-' + key, ev = 'mbu-claim-' + key, noteKey = 'mbu-newer-' + key;
    var log = function (msg) { try { if (typeof mbuLog !== 'undefined' && mbuLog.active) mbuLog.active.info(msg); else if (typeof mbuToast !== 'undefined' && typeof mbuToast.log === 'function') mbuToast.log('info', msg); else console.info('[' + (label || key) + '] ' + msg); } catch (e) { /* no log */ } };
    var note = null;
    try { note = JSON.parse(localStorage.getItem(noteKey) || 'null'); } catch (e) { /* storage blocked */ }
    // A note older than this copy is spent. This copy's own note stays: it is what keeps the
    // older copy aside on every later load, not only the next one (#671).
    var noteCmp = note ? mbuClaimCmp(note.ver, ver) : 1;
    if (noteCmp < 0) { try { localStorage.removeItem(noteKey); } catch (e) { /* storage blocked */ } }
    if (noteCmp <= 0) note = null;
    var held = root && root.getAttribute(attr);
    var off = function (why) {
        // tell the running copy (any sandbox hears a DOM event), or the copy that runs after
        // this one (it reads the attribute), and stay quiet
        try { if (root) root.setAttribute(attr + '-off', JSON.stringify({ mine: mine, why: why })); } catch (e) { /* no attribute */ }
        try { document.dispatchEvent(new CustomEvent(ev, { detail: JSON.stringify({ mine: mine, ver: ver, why: why }) })); } catch (e) { /* no event */ }
        return false;
    };
    if (held) {
        var heldVer = (root.getAttribute(attr + '-ver') || '0');
        if (mbuClaimCmp(ver, heldVer) > 0) {
            try { localStorage.setItem(noteKey, JSON.stringify({ ver: ver, mine: mine, at: Date.now() })); } catch (e) { /* storage blocked */ }
            return off('newer, from the next page load');
        }
        return off('older or the same');
    }
    if (note) {
        // a newer copy said it is installed: leave the page to it, unless it never shows up
        var watch = function () {
            setTimeout(function () {
                if (root.getAttribute(attr)) return;
                try { localStorage.removeItem(noteKey); } catch (e) { /* storage blocked */ }
                try { console.info('[' + (label || key) + '] the newer copy (' + note.mine + ') did not start: this copy runs again from the next page load'); } catch (e) { /* no console */ }
            }, 3000);
        };
        if (document.readyState === 'complete') watch(); else window.addEventListener('load', watch, { once: true });
        return off('older: a newer copy runs');
    }
    if (root) { root.setAttribute(attr, mine); root.setAttribute(attr + '-ver', ver); }
    var told = function (o) {
        log((label || key) + ' is installed twice: ' + mine + ' runs, ' + (o.mine || 'another copy') + ' is switched off'
            + (o.why === 'newer, from the next page load' ? ' for this page (it is newer and runs from the next page load)' : '') + '.');
    };
    document.addEventListener(ev, function (e) { var o = {}; try { o = JSON.parse(e.detail); } catch (x) { /* not ours */ } told(o); });
    // a copy that stepped aside before this one started (it found a note): log it once the script's log is up
    var before = root && root.getAttribute(attr + '-off');
    if (before) setTimeout(function () { var o = {}; try { o = JSON.parse(before); } catch (x) { /* not ours */ } told(o); }, 0);
    return true;
}

// Toast. mbuToast(msg) or mbuToast(msg, { ms, kind, at:{x,y}, action:{ label, onClick } }).
//
// An action adds one button to the toast (e.g. "Copy log"): the toast is then clickable,
// stays up longer (12 s unless ms says otherwise), and closes when the button is used.
//
// Severity is inferred from a leading warning/tick glyph when not given — Art
// Station already did that and it is why its toasts reached its log with the
// right level. Set mbuToast.log = function (level, message) {...} once at
// startup and every toast mirrors into that script's own log; leave it unset
// and the toast still shows.
var _mbuToastT = null;
function mbuToast(msg, opts) {
    opts = opts || {};
    var s = String(msg);
    var kind = opts.kind || (/^\s*[⚠✗×]/.test(s) ? 'warn' : /[✓✅]/.test(s) ? 'ok' : 'info');
    try {
        if (typeof mbuToast.log === 'function') mbuToast.log(kind, s.replace(/^\s*[⚠✗×✓✅]\s*/, ''));
    } catch (e) { /* a broken log sink must never swallow the toast */ }
    var el = document.getElementById('mbu-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'mbu-toast';
        (document.body || document.documentElement).appendChild(el);
    }
    el.className = 'mbu-toast-on' + (kind !== 'info' ? ' mbu-toast-' + kind : '') + (opts.action ? ' mbu-toast-act' : '');
    el.textContent = s;
    if (opts.action) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'mbu-toast-btn'; b.textContent = opts.action.label || 'OK';
        b.onclick = function () {
            try { if (opts.action.onClick) opts.action.onClick(b); } catch (e) { /* the toast still closes */ }
            clearTimeout(_mbuToastT); _mbuToastT = setTimeout(function () { el.className = ''; }, 900);
        };
        el.appendChild(b);
    }
    // Anchor above a click point when asked, clamped into the viewport; otherwise
    // fall back to the centred default by clearing the inline placement.
    if (opts.at) {
        var w = el.offsetWidth, h = el.offsetHeight;
        el.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, opts.at.x - w / 2)) + 'px';
        el.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, opts.at.y - h - 10)) + 'px';
        el.style.bottom = 'auto';
        el.style.transform = 'none';
    } else {
        el.style.left = ''; el.style.top = ''; el.style.bottom = ''; el.style.transform = '';
    }
    clearTimeout(_mbuToastT);
    _mbuToastT = setTimeout(function () { el.className = ''; }, opts.ms || (opts.action ? 12000 : 2600));
    return el;
}

// Config-window title bar.
//
//   mbuCfgHeader({ script:'art_station', name:'Art Station', version:'2026.9.2',
//                  icon:'<svg…>' | '<img…>', log:true, logClass:'as-setup-logbtn' })
//
// Returns the markup for the whole bar. 'log' adds the Log button; a script with
// no log window leaves it out rather than shipping a dead control. logClass /
// logId are carried through IN ADDITION to the shared class so a script's
// existing click handler keeps working — adopting the component must not mean
// rewiring every listener at the same time.
function mbuCfgHeader(o) {
    o = o || {};
    var esc = function (s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    };
    var html = '<div class="mbu-cfg-h">';
    if (o.icon) html += '<span class="mbu-cfg-ic">' + o.icon + '</span>';
    html += '<span class="mbu-cfg-name">' + esc(o.name) + '</span>';
    if (o.version) html += '<span class="mbu-cfg-ver" data-tip="The installed version">v' + esc(o.version) + '</span>';
    html += '<span class="mbu-cfg-sp"></span>';
    if (o.log) {
        html += '<button type="button" class="mbu-cfg-log' + (o.logClass ? ' ' + esc(o.logClass) : '') + '"'
            + (o.logId ? ' id="' + esc(o.logId) + '"' : '')
            + ' data-tip="Open the activity log">Log</button>';
    }
    html += mbuHelpHtml(o.script);
    return html + '</div>';
}

// Settings controls: in root, every <select> becomes the pill drop-down and every number field the
// − n + stepper. The field stays the script's own (its value, min, max, step and listeners): − and +
// step it within them and fire input and change, as typing would. Call it once a window's markup is in;
// again after a re-render does no harm. Returns root.
function mbuControls(root) {
    if (!root || !root.querySelectorAll) return root;
    Array.prototype.forEach.call(root.querySelectorAll('select'), function (s) { s.classList.add('mbu-select'); });
    Array.prototype.forEach.call(root.querySelectorAll('input[type=number]'), function (inp) {
        var p = inp.parentNode;
        if (!p || (p.classList && p.classList.contains('mbu-step'))) return;
        var wrap = document.createElement('span');
        wrap.className = 'mbu-step';
        p.insertBefore(wrap, inp);
        var btn = function (down) {
            var b = document.createElement('button');
            b.type = 'button';
            b.tabIndex = -1;
            b.textContent = down ? '−' : '+';
            b.setAttribute('aria-label', down ? 'Less' : 'More');
            b.addEventListener('click', function (e) {
                e.preventDefault();
                if (inp.disabled || inp.readOnly) return;
                var was = inp.value;
                try { if (down) inp.stepDown(); else inp.stepUp(); } catch (x) { return; }
                if (inp.value === was) return;
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
            });
            return b;
        };
        wrap.appendChild(btn(true));
        wrap.appendChild(inp);
        wrap.appendChild(btn(false));
        // as wide as its longest value; a width the script set for the old field would cut it
        inp.style.width = Math.max(2, String(inp.max || inp.value || '').length) + 0.5 + 'ch';
    });
    return root;
}

// Test hooks. A script puts its test hook on window only when the test harness has
// marked the page (dev/test/harness.mjs sets window.__mbuTest before any script runs):
//   if (mbuTestHooks()) window.__fooTest = { … };
// On a user's page the hooks are never built. (#623)
function mbuTestHooks() {
    try { return typeof window !== 'undefined' && window.__mbuTest === true; } catch (e) { return false; }
}

// Shared settings: the few that belong to all the scripts at once, not to one (the corner
// launchers' layout). GM storage is private to each script, so these live in the page's
// localStorage on MusicBrainz's origin, as JSON under 'mbu.<key>'; every script, bundled or
// standalone, reads the same value. One argument reads (undefined when unset or blocked), two
// write, and null removes. Per-origin: musicbrainz.org, beta and test each keep their own.
// Every key is listed in DEVELOP.md → Shared storage.
function mbuShared(key, value) {
    var k = 'mbu.' + key;
    try {
        if (arguments.length < 2) { var v = localStorage.getItem(k); return v == null ? undefined : JSON.parse(v); }
        if (value == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(value));
    } catch (e) { /* storage blocked */ }
    return value;
}

// Corner slots (#468). Every floating launcher (Apollo Editor, Art Station, Falcon,
// Fusion, Scribe) tags its element with data-mb-corner (which screen corner: 'br',
// 'bl', 'tr', 'tl') and data-mb-corner-order (lower sits closer to the corner), and
// calls mbRestackCorner(corner) right after it shows, hides, creates or removes it.
// That recomputes every element in the corner, whichever script owns it and
// whatever order they loaded in, so two launchers never land on the same pixel.
// Orders in use, all bottom-right: Apollo and Art Station 10 (never on the same page), Scribe 15
// (above Apollo on the edit page), Falcon 20, Fusion 30, Mission Control 40. Scribe is not on the shared block and keeps a copy of this.
// The stack is a column; the shared setting cornerFlow = 'row' (mbuShared, set from String
// Theory's menu) lines it up along the bottom/top edge instead, the lowest order still nearest the corner.
// The shared setting cornerSide = 'left' (also from the menu) mirrors every corner across the screen: a
// launcher tagged 'br' sits bottom-left. Its other side is set to auto, so a CSS left/right can't stretch it.
// On a phone MusicBrainz's page is wider than the screen, so the browser widens the layout
// viewport, which position:fixed measures from, to the page: the corner was off screen, a scroll
// right and down away. Each edge is offset by the gap between it and the visual viewport (what is
// on screen), kept up as that scrolls and resizes; on a desktop the gap is 0.
function mbRestackCorner(corner) {
    var bottom = corner[0] === 'b', right = (corner[1] === 'r') !== (mbuShared('cornerSide') === 'left');
    var row = mbuShared('cornerFlow') === 'row';
    var vv = window.visualViewport, gapX = 0, gapY = 0;
    if (vv) {
        gapX = Math.max(0, right ? window.innerWidth - vv.offsetLeft - vv.width : vv.offsetLeft);
        gapY = Math.max(0, bottom ? window.innerHeight - vv.offsetTop - vv.height : vv.offsetTop);
        var root = document.documentElement;
        if (!root.hasAttribute('data-mb-corner-vv')) {   // one listener for every script's copy
            root.setAttribute('data-mb-corner-vv', '');
            var queued = false;
            var again = function () {
                if (queued) return;
                queued = true;
                requestAnimationFrame(function () { queued = false; ['br', 'bl', 'tr', 'tl'].forEach(function (c) { if (document.querySelector('[data-mb-corner="' + c + '"]')) mbRestackCorner(c); }); });
            };
            vv.addEventListener('resize', again);
            vv.addEventListener('scroll', again);
            // the layout viewport can change alone, with no event: a full-screen view pins the page's body
            // (780px → the screen's width); the body's size is what moves then
            window.addEventListener('resize', again);
            if (window.ResizeObserver && document.body) new window.ResizeObserver(again).observe(document.body);
        }
    }
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-mb-corner="' + corner + '"]'))
        // offsetParent is always null for position:fixed, so it can't tell visibility here
        .filter(function (el) { return getComputedStyle(el).display !== 'none'; })
        .sort(function (a, b) { return (Number(a.dataset.mbCornerOrder) || 0) - (Number(b.dataset.mbCornerOrder) || 0); });
    var pos = 14;
    els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        el.style[bottom ? 'bottom' : 'top'] = (gapY + (row ? 14 : pos)) + 'px';
        el.style[right ? 'right' : 'left'] = (gapX + (row ? pos : 14)) + 'px';
        el.style[right ? 'left' : 'right'] = 'auto';
        pos += (row ? r.width : r.height) + 8;
    });
}

// Activity log: the session's log lines plus the viewers that show them
// (#283's viewer, shared since X12 of #623). A script makes its log once:
//
//   var LOG = mbuLog({ name: 'Fusion', version: VERSION, key: 'fusion.logwin' });
//   LOG.info('…'); LOG.warn(…); LOG.err(…) (or .error); LOG.ok(…); LOG.debug(…)
//   LOG.open(); LOG.close(); LOG.reopen()   // reopen: only if it was left open
//   LOG.markdown(); LOG.copy(btn); LOG.clear(); LOG.lines(); LOG.messages(); LOG.counts()
//   LOG.cat('Spotify').info(…)        // the same calls, each line tagged with a category
//   LOG.pre(text)                     // a block kept as written: line breaks, spacing, monospace (#705)
//   LOG.mount(el, { tools })          // the viewer inside the script's own panel (#705)
//
// Categories (#697) are optional. A tagged line shows its category before the
// message and in the Markdown ("WARN [Spotify] …"). The viewer grows a row of
// filters only when there is a choice: the levels once two of them have lines
// (ok counts as info), the categories once there are two. Click one to see only
// those lines, click it again to see all; Copy always takes everything.
//
// The floating window (open) and a mounted viewer (mount) are the same viewer;
// mount draws it into an element of the script's, without the title bar's
// window buttons, and o.tools (an element) sits in its toolbar before Clear.
// Every viewer has a debug switch: off, LOG.debug() lines are not recorded at all
// (remembered per script under o.key; LOG.debugOn(), LOG.setDebug(v)).
//
// o.name / o.version  the Markdown summary's title (version may be a function)
// o.subtitle          optional function; its text follows the title (e.g. the release)
// o.header            the window's title (default 'Activity log')
// o.key               storage key for the window's open/minimised/position state
// o.load / o.save     that storage (default GM_getValue / GM_setValue)
// o.before            called before the window opens (e.g. to inject the script's CSS)
// o.max               lines kept (default 20000: about 4 MB; 2000 dropped a long session's start)
// o.history           opt-in history of past sessions (#705), below
//
// A long run keeps only the last o.max lines, and the Markdown says how many went
// before them; the copies this replaced grew for the whole session. An open
// viewer appends each new line and drops the oldest row past the cap; the copies
// rebuilt the whole list with innerHTML on every line, which is quadratic over a
// long matching run.
//
// History (#705, Falcon's run logs of #512 made shared). Off unless o.history is given:
//
//   o.history = { prefix: 'falcon:session:', lines: 400, head: 140,
//                 parse: s => entry, nameOf: entries => name, store }
//
// A session starts with the page, or with LOG.session(reason) (Falcon: each run).
// Only a session the script marks with LOG.keep() is stored, so a page that did
// nothing worth reading back leaves nothing behind; LOG.name(text) names it (the
// first name stays). It is stored in the page's localStorage under prefix + id,
// within 100 ms of each line and at once on LOG.flush(), so a crashed tab keeps
// its log; a session longer than `lines` keeps its first `head` lines and its
// end, and says how many went between. The newest 10 sessions are kept, not configurable
// (#811); each script's prefix is its own, and Clear history clears only that script's.
// Leaving the page (a script's reload after its operation, #811) flushes at once.
// prefix + 'current' holds the last kept session's id (LOG.last()), so LOG.resume(id)
// can carry on a session across a navigation. The viewer gets a session list and Clear history.
//   LOG.sessionId(); LOG.last(); LOG.isKept(); LOG.refresh(); LOG.sessions(); LOG.load(id); LOG.forget(id); LOG.clearHistory(); LOG.flush()
// parse reads a stored line that is a string (an older format); nameOf names a
// session stored without a name; store ({ get, set, del, keys }) replaces localStorage.
function mbuLog(o) {
    o = o || {};
    var max = o.max || 20000, buf = [], dropped = 0, warn = 0, error = 0, views = [], bound = {};
    var LEVELS = ['error', 'warn', 'info', 'debug'];
    var group = function (sev) { return sev === 'ok' ? 'info' : sev; };
    var pad = function (n, w) { return String(n).padStart(w || 2, '0'); };
    var ts = function (d) { return d ? pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + pad(d.getMilliseconds(), 3) : '--:--:--.---'; };
    var str = function (v) {
        if (typeof v === 'string') return v;
        if (v instanceof Error) return v.message || String(v);
        if (v && v.nodeType) return '<' + (v.tagName || 'node').toLowerCase() + '>';
        try { return typeof v === 'object' ? JSON.stringify(v) : String(v); } catch (e) { return String(v); }
    };
    var esc = function (s) {
        return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    };
    // escape, then make http(s) URLs clickable, keeping trailing punctuation out of them
    var linkify = function (s) {
        return esc(s).replace(/(https?:\/\/[^\s<]+)/g, function (m) {
            var t = (m.match(/[.,;:!?)\]]+$/) || [''])[0];
            var url = m.slice(0, m.length - t.length);
            return '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>' + t;
        });
    };
    var load = o.load || function (k) { try { return GM_getValue(k, undefined); } catch (e) { return undefined; } };
    var save = o.save || function (k, v) { try { GM_setValue(k, v); } catch (e) { /* no storage: the window just forgets */ } };
    var state = function () { try { return JSON.parse(load(o.key) || '{}') || {}; } catch (e) { return {}; } };
    var remember = function (patch) { try { save(o.key, JSON.stringify(Object.assign(state(), patch))); } catch (e) { /* see save */ } };
    // debug lines are recorded only while the viewer's debug switch is on (default off: majkinetor, #705), per script
    var dbgOn = null;
    var debugOn = function () { if (dbgOn === null) dbgOn = state().debug === true; return dbgOn; };
    var setDebug = function (v) { dbgOn = !!v; remember({ debug: dbgOn }); views.forEach(function (w) { if (w.dbg) w.dbg.checked = dbgOn; }); };
    var tally = function (e, d) { if (e.sev === 'warn') warn += d; else if (e.sev === 'error') error += d; };
    var PRE = { info: '', ok: 'OK   ', warn: 'WARN ', error: 'ERR  ', debug: 'DBG  ' };
    var line = function (e) { return ts(e.t) + '  ' + (PRE[e.sev] || '') + (e.cat ? '[' + e.cat + '] ' : '') + (e.pre ? '\n' : '') + e.msg; };
    var countOf = function (list) {
        var c = { warn: 0, error: 0 };
        list.forEach(function (e) { if (e.sev === 'warn') c.warn++; else if (e.sev === 'error') c.error++; });
        return c;
    };

    // ── history (#705) ──
    var H = o.history || null, hp = H && (H.prefix || ((o.key || 'mbu') + ':session:'));
    var ID_RE = /^\d{14}-\d+$/, sid = '', kept = false, sname = '', savedName = '', seq = 0, pTimer = 0, lastSaved = '';
    var store = H && (H.store || {
        get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* full or blocked: the session just isn't kept */ } },
        del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* nothing to do */ } },
        // one call for all the keys: a userscript reaches localStorage through Firefox's
        // Xray wrapper, where each call costs, and the page may hold hundreds of keys
        keys: function () {
            try { var all = Object.keys(localStorage); if (all.length === localStorage.length) return all; } catch (e) { /* the loop below */ }
            var out = []; try { for (var i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); } catch (e) { /* none */ } return out;
        },
    });
    var keepN = function () { return 10; };   // #811: the last 10 sessions, not configurable
    var newId = function () { return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14) + '-' + (++seq); };
    // the id is the session's start in UTC: YYYYMMDDHHMMSS-n
    var idDate = function (id) {
        var m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)/.exec(id || '');
        return m ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
    };
    function ids() {
        if (!H) return [];
        return store.keys().filter(function (k) { return k && k.indexOf(hp) === 0 && ID_RE.test(k.slice(hp.length)); })
            .map(function (k) { return k.slice(hp.length); }).sort();   // the id's own timestamp sorts as a string
    }
    // a stored line: [time ms | null, sev, cat | 0, msg, pre 1/0]; a string is an older format, read by H.parse
    function fromStored(x, id) {
        if (typeof x === 'string') {
            var p = null;
            try { p = H.parse ? H.parse(x, idDate(id)) : null; } catch (e) { /* unreadable: kept as text */ }
            return p ? { t: p.t || null, sev: p.sev || 'info', cat: p.cat || '', msg: String(p.msg == null ? x : p.msg), pre: !!p.pre } : { t: null, sev: 'info', msg: x };
        }
        if (!Array.isArray(x)) return null;
        var e = { t: x[0] != null ? new Date(x[0]) : null, sev: x[1] || 'info', msg: String(x[3] == null ? '' : x[3]) };
        if (x[2]) e.cat = String(x[2]);
        if (x[4]) e.pre = true;
        return e;
    }
    function loadSession(id) {
        if (!H || !id) return null;
        var raw = store.get(hp + id);
        if (raw == null) return null;
        try { return (JSON.parse(raw) || []).map(function (x) { return fromStored(x, id); }).filter(Boolean); } catch (e) { return null; }
    }
    // a past session's name doesn't change, so it is read (or mined from its lines) once
    var names = {};
    function nameOf(id, entries) {
        if (id in names) return names[id];
        var n = store.get(hp + id + ':name');
        if (!n) { try { n = H.nameOf ? H.nameOf(entries || loadSession(id) || []) || '' : ''; } catch (e) { n = ''; } }
        return (names[id] = n || '');
    }
    // the first `head` lines and the end, and a line saying how many went between
    function storedWindow() {
        var cap = H.lines || 400, head = Math.min(H.head || 140, cap - 2);
        var pack = function (e) { return [e.t ? e.t.getTime() : null, e.sev, e.cat || 0, e.msg, e.pre ? 1 : 0]; };
        if (buf.length <= cap) return buf.map(pack);
        var tail = cap - head - 1, cut = buf.length - head - tail;
        return buf.slice(0, head).map(pack)
            .concat([[null, 'info', 0, '——— ' + cut + ' line(s) from the middle of this session were dropped to fit the stored-log budget; its start and end are kept in full ———', 0]])
            .concat(buf.slice(-tail).map(pack));
    }
    function flush() {
        clearTimeout(pTimer); pTimer = 0;
        if (!H || !sid || !kept) return;
        try {
            var payload = JSON.stringify(storedWindow());
            if (payload === lastSaved) return;
            lastSaved = payload;
            store.set(hp + sid, payload);
            if (sname && savedName !== sname) { store.set(hp + sid + ':name', sname); savedName = sname; }
        } catch (e) { /* not stored */ }
    }
    var persist = function () { if (H && kept && !pTimer) pTimer = setTimeout(flush, 100); };
    function forget(id) { if (H && id) { store.del(hp + id); store.del(hp + id + ':name'); delete names[id]; } }
    function prune() {
        var all = ids().filter(function (id) { return id !== sid; });
        var excess = all.length + (kept ? 1 : 0) - keepN();
        if (excess > 0) all.slice(0, excess).forEach(forget);
    }
    // past sessions, newest first, without the current one
    function sessions() {
        return ids().filter(function (id) { return id !== sid; }).reverse()
            .map(function (id) { return { id: id, date: idDate(id), name: nameOf(id) }; });
    }
    var sessionLabel = function (s) {
        var d = s.date, when = d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) : s.id;
        return when + (s.name ? ' — ' + s.name : '');
    };
    function startSession() {
        flush();
        sid = newId(); kept = false; sname = ''; savedName = ''; lastSaved = '';
        reset();
    }
    function resume(id) {
        var entries = loadSession(id);
        if (!entries) return false;
        flush();
        reset();
        sid = id; kept = true; sname = savedName = store.get(hp + id + ':name') || '';
        lastSaved = store.get(hp + id) || '';
        store.set(hp + 'current', sid);
        entries.forEach(function (e) { push(e); });
        return true;
    }

    // ── the live lines ──
    function reset() {
        buf = []; dropped = 0; warn = 0; error = 0;
        views.forEach(function (v) { if (!v.past) v.show(null); v.sessions(); });
    }
    function push(e) {
        buf.push(e); tally(e, 1);
        // trim in chunks, not one shift per line
        if (buf.length > max + Math.ceil(max / 10)) {
            var gone = buf.splice(0, buf.length - max);
            gone.forEach(function (g) { tally(g, -1); });
            dropped += gone.length;
        }
        views = views.filter(function (v) { return v.el.isConnected; });
        views.forEach(function (v) { if (!v.past) v.append(e); });
    }
    function add(sev, args, cat, pre) {
        var msg = Array.prototype.map.call(args, str).join(' ');
        msg = pre ? msg.replace(/\s+$/, '') : msg.replace(/\s+/g, ' ').trim();
        if (!msg) return;
        var e = { t: new Date(), sev: sev === 'err' ? 'error' : sev, msg: msg };
        if (e.sev === 'debug' && !debugOn()) return;
        if (cat) e.cat = String(cat);
        if (pre) e.pre = true;
        push(e);
        persist();
    }
    function title(bare) {
        var v = typeof o.version === 'function' ? (function () { try { return o.version(); } catch (e) { return ''; } })() : o.version;
        var t = (o.name || 'Log') + (v ? ' v' + v : '');
        try { var s = !bare && o.subtitle && o.subtitle(); if (s) t += ' — ' + s; } catch (e) { /* no subtitle */ }
        return t;
    }
    // past: { id, entries } to copy a stored session instead of this one
    function markdown(past) {
        var list = past ? past.entries : buf, c = past ? countOf(list) : { warn: warn, error: error };
        var body = list.length ? list.map(line).join('\n') : '(no activity logged)';
        if (!past && dropped) body = '(' + dropped + ' earlier line' + (dropped === 1 ? '' : 's') + ' not kept)\n' + body;
        var n = (c.warn || c.error) ? ' (' + c.warn + ' warning' + (c.warn === 1 ? '' : 's') + ', ' + c.error + ' error' + (c.error === 1 ? '' : 's') + ')' : '';
        var what = past ? 'log of ' + sessionLabel({ id: past.id, date: idDate(past.id), name: nameOf(past.id, list) }) : 'session log';
        var fence = String.fromCharCode(96, 96, 96);
        return '<details><summary>' + title(!!past) + ' — ' + what + n + '</summary>\n\n' + fence + 'log\n' + body + '\n' + fence + '\n\n</details>';
    }
    function copy(btn, past) {
        var md = markdown(past);
        var done = function (ok) {
            if (!btn) return;
            var was = btn.dataset.lbl || btn.textContent; btn.dataset.lbl = was;
            btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
            setTimeout(function () { btn.textContent = was; }, 1500);
        };
        var fallback = function () {
            var ok = false;
            try {
                var ta = document.createElement('textarea'); ta.value = md; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
            } catch (x) { /* nothing left to try */ }
            done(ok);
        };
        try { navigator.clipboard.writeText(md).then(function () { done(true); }, fallback); } catch (e) { fallback(); }
    }

    // ── a viewer: the floating window or one mounted in the script's panel ──
    var vseq = 0;
    function view(root, floating, tools) {
        var vid = String(++vseq);
        root.classList.add('mbu-logpop');
        root.dataset.mbuLv = vid;
        root.innerHTML = mbuHtml('<div class="mbu-logpop-h">' + (floating ? '<b>' + esc(o.header || 'Activity log') + '</b> ' : '') + '<span class="mbu-log-badge"></span>'
            + '<input class="mbu-log-q" type="search" placeholder="Filter" data-tip="Show only the lines with this text\nEsc: empty the box" autocomplete="off">'
            + (H ? '<select class="mbu-log-ses mbu-select" data-tip="The session shown\nThis one, or a past one kept in this browser"></select>' : '')
            + '<span class="mbu-logpop-sp"></span>'
            + (H ? '<button class="mbu-logpop-hclear" type="button" data-tip="Delete every past session\nThis one stays">Clear history</button>' : '')
            + '<label class="mbu-log-dbg" data-tip="Record each step in detail\nLeave it on when reporting a problem"><input type="checkbox"> debug</label>'
            + '<button class="mbu-logpop-clear" type="button" data-tip="Clear the log\nThe lines so far are gone">Clear</button>'
            + '<button class="mbu-logpop-copy" type="button" data-tip="Copy the whole log as Markdown\nReady to paste into a GitHub issue">⧉ Copy</button>'
            + (floating ? '<button class="mbu-logpop-full" type="button" data-tip="Full screen\nDouble-click: the title bar does the same">⛶</button>'
                + '<button class="mbu-logpop-min" type="button" data-tip="Minimize">–</button>'
                + '<button class="mbu-logpop-x" type="button" data-tip="Close">✕</button>' : '') + '</div>'
            + '<div class="mbu-log-f" hidden></div><style class="mbu-log-fcss"></style>'
            + '<div class="mbu-log-list"></div>' + (floating ? '<div class="mbu-logpop-grip" data-tip="Resize"></div>' : ''));
        if (tools) root.querySelector('.mbu-logpop-clear').before(tools);
        var list = root.querySelector('.mbu-log-list'), badge = root.querySelector('.mbu-log-badge');
        var qEl = root.querySelector('.mbu-log-q'), q = '', sel = root.querySelector('.mbu-log-ses');
        var fRow = root.querySelector('.mbu-log-f'), fCss = root.querySelector('.mbu-log-fcss');
        // what this viewer shows: the live lines, or a past session (read-only)
        var past = null, src = buf, cats = [], catIx = {}, sevs = {}, fSev = null, fCat = null;
        var scope = '.mbu-logpop[data-mbu-lv="' + vid + '"] ';
        var miss = function (e) { return !!q && ((e.cat || '') + ' ' + e.msg).toLowerCase().indexOf(q) < 0; };
        // note a line's level and category; true when the filter row must change
        var note = function (e) {
            var grew = false;
            if (e.cat && !(e.cat in catIx)) { catIx[e.cat] = cats.length; cats.push(e.cat); grew = true; }
            if (!sevs[group(e.sev)]) { sevs[group(e.sev)] = true; grew = true; }
            return grew;
        };
        var row = function (e) {
            var d = document.createElement('div');
            d._e = e;
            d.className = 'mbu-log-li mbu-log-' + e.sev + (e.pre ? ' mbu-log-pre' : '');
            if (miss(e)) d.classList.add('mbu-log-nq');
            d.dataset.s = group(e.sev);
            if (e.cat) d.dataset.c = catIx[e.cat];
            d.innerHTML = mbuHtml('<span class="mbu-log-t">' + ts(e.t) + '</span>'
                + '<span class="mbu-log-c">' + esc(e.cat || '') + '</span>'
                + '<span class="mbu-log-m">' + linkify(e.msg) + '</span>');
            return d;
        };
        // the filter row, redrawn when a level or category first appears; hiding is one
        // rule in the viewer's own <style>, not a walk over the rows
        var filters = function () {
            var lv = LEVELS.filter(function (l) { return sevs[l]; });
            var showL = lv.length > 1, showC = cats.length > 1;
            if (fSev && !sevs[fSev]) fSev = null;
            if (fCat != null && !(fCat in catIx)) fCat = null;
            var b = function (kind, v, on) {
                return '<button type="button" class="mbu-log-fb' + (on ? ' on' : '') + '" data-' + kind + '="' + esc(v) + '">' + esc(v) + '</button>';
            };
            fRow.innerHTML = mbuHtml((showL ? '<span class="mbu-log-fg">' + lv.map(function (l) { return b('sev', l, fSev === l); }).join('') + '</span>' : '')
                + (showL && showC ? '<span class="mbu-log-fs"></span>' : '')
                + (showC ? '<span class="mbu-log-fg">' + cats.map(function (c) { return b('cat', c, fCat === c); }).join('') + '</span>' : ''));
            fRow.hidden = !showL && !showC;
            list.classList.toggle('mbu-log-cats', cats.length > 0);
            fCss.textContent = (fSev ? scope + '.mbu-log-li:not([data-s="' + fSev + '"]){display:none}' : '')
                + (fCat != null ? scope + '.mbu-log-li:not([data-c="' + catIx[fCat] + '"]){display:none}' : '');
        };
        var showBadge = function () {
            var c = past ? countOf(src) : { warn: warn, error: error };
            badge.textContent = '(' + src.length + ')' + (c.warn || c.error ? ' · ' + c.warn + '⚠ ' + c.error + '✖' : '');
        };
        var empty = function () { return '<div class="mbu-log-empty">' + (past ? 'Nothing was kept of this session.' : 'No activity yet.') + '</div>'; };
        var queued = false, follow = true;
        var paint = function () { queued = false; showBadge(); if (follow) list.scrollTop = list.scrollHeight; };
        // all rows at once: on opening, and when the session shown changes
        var draw = function () {
            cats = []; catIx = {}; sevs = {};
            src.forEach(note);
            var frag = document.createDocumentFragment();
            src.forEach(function (e) { frag.appendChild(row(e)); });
            list.innerHTML = mbuHtml(src.length ? '' : empty());
            if (src.length) list.appendChild(frag);
            filters(); showBadge();
            follow = true; list.scrollTop = list.scrollHeight;
            root.classList.toggle('mbu-log-past', !!past);
        };
        list.addEventListener('scroll', function () { follow = list.scrollHeight - list.scrollTop - list.clientHeight < 40; });
        var qTimer = 0;
        var refilter = function () {
            q = qEl.value.trim().toLowerCase();
            for (var d = list.firstElementChild; d; d = d.nextElementSibling) if (d._e) d.classList.toggle('mbu-log-nq', miss(d._e));
            follow = true; list.scrollTop = list.scrollHeight;
        };
        qEl.addEventListener('input', function () { clearTimeout(qTimer); qTimer = setTimeout(refilter, 120); });
        fRow.addEventListener('click', function (ev) {
            var t = ev.target.closest('.mbu-log-fb'); if (!t) return;
            if (t.dataset.sev) fSev = fSev === t.dataset.sev ? null : t.dataset.sev;
            else fCat = fCat === t.dataset.cat ? null : t.dataset.cat;
            filters();
            follow = true; list.scrollTop = list.scrollHeight;
        });
        var v = {
            el: root, floating: floating, past: null, q: qEl,
            append: function (e) {
                var em = list.querySelector('.mbu-log-empty'); if (em) em.remove();
                if (note(e)) filters();
                list.appendChild(row(e));
                while (list.childElementCount > buf.length) list.firstElementChild.remove();
                if (!queued) { queued = true; requestAnimationFrame(paint); }
            },
            // null: the live lines; an id: that past session
            show: function (id) {
                var entries = id ? loadSession(id) : null;
                if (id && !entries) entries = [{ t: null, sev: 'warn', msg: 'This session could not be read (it may have been deleted in another tab).' }];
                past = id && entries ? id : null; v.past = past;
                src = past ? entries : buf;
                if (sel && sel.value !== (past || '')) sel.value = past || '';
                draw();
            },
            // the session list, refreshed when it is opened and when a session starts
            sessions: function () {
                if (!sel) return;
                var all = sessions(), sig = all.map(function (x) { return x.id + '=' + x.name; }).join('|');
                if (sig === v.sig && !(past && !all.some(function (x) { return x.id === past; }))) return;
                v.sig = sig;
                if (past && !all.some(function (s) { return s.id === past; })) { past = null; v.past = null; src = buf; draw(); }
                sel.innerHTML = mbuHtml('<option value="">Current session</option>' + all.map(function (s) {
                    return '<option value="' + esc(s.id) + '">' + esc(sessionLabel(s)) + '</option>';
                }).join(''));
                sel.value = past || '';
                var hc = root.querySelector('.mbu-logpop-hclear'); if (hc) hc.disabled = !all.length;
            },
            filters: filters,
        };
        if (sel) {
            sel.addEventListener('change', function () { v.show(sel.value || null); });
            root.querySelector('.mbu-logpop-hclear').onclick = function () { clearHistory(); };
        }
        root.querySelector('.mbu-logpop-clear').onclick = function () { clear(); };
        v.dbg = root.querySelector('.mbu-log-dbg input');
        v.dbg.checked = debugOn();
        v.dbg.onchange = function () { setDebug(v.dbg.checked); };
        root.querySelector('.mbu-logpop-copy').onclick = function () {
            copy(root.querySelector('.mbu-logpop-copy'), past ? { id: past, entries: src } : null);
        };
        v.sessions();
        draw();
        views.push(v);
        return v;
    }

    var win = null;
    function open() {
        close(true);
        if (typeof o.before === 'function') { try { o.before(); } catch (e) { /* the window still opens */ } }
        remember({ open: true });
        var st = state();
        var pop = document.createElement('div'); pop.id = 'mbu-logpop';
        document.body.appendChild(pop);
        var v = view(pop, true);
        if (st.left != null) { pop.style.left = st.left; pop.style.top = st.top; pop.style.right = 'auto'; pop.style.transform = 'none'; }
        var restore = { left: pop.style.left, top: pop.style.top, right: pop.style.right, bottom: pop.style.bottom, transform: pop.style.transform };
        // Escape in a filled filter empties it; anywhere else it closes the window. Only the log:
        // it listens first (capture, on window) and keeps the key, so the script's own window under
        // it (ISRC Scout's closes on Escape too) stays open
        var onKey = function (e) {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            if (e.target === v.q && v.q.value) { v.q.value = ''; v.q.dispatchEvent(new Event('input')); return; }
            close();
        };
        win = { el: pop, v: v, off: function () { window.removeEventListener('keydown', onKey, true); } };
        var minBtn = pop.querySelector('.mbu-logpop-min');
        var setMin = function (m) {
            minBtn.textContent = m ? '▢' : '–'; minBtn.dataset.tip = m ? 'Restore' : 'Minimize';
            if (m) { pop.style.left = '14px'; pop.style.bottom = '14px'; pop.style.top = 'auto'; pop.style.right = 'auto'; pop.style.transform = 'none'; }   // dock to the bottom
            else Object.assign(pop.style, restore);
        };
        var fullBtn = pop.querySelector('.mbu-logpop-full');
        var setFull = function (f) {
            pop.classList.toggle('full', f);
            fullBtn.textContent = f ? '❐' : '⛶'; fullBtn.dataset.tip = (f ? 'Restore the size' : 'Full screen') + '\nDouble-click: the title bar does the same';
        };
        minBtn.onclick = function () {
            var m = pop.classList.toggle('min');
            if (m && pop.classList.contains('full')) { setFull(false); remember({ full: false }); }   // minimising leaves full screen
            setMin(m); remember({ min: m });
        };
        fullBtn.onclick = function () { var f = !pop.classList.contains('full'); setFull(f); remember({ full: f }); };
        pop.querySelector('.mbu-logpop-h').addEventListener('dblclick', function (e) {
            if (!e.target.closest('button, input, select') && !pop.classList.contains('min')) fullBtn.click();
        });
        // a size the user gave it, from the corner grip
        if (st.w && st.h) { pop.style.width = st.w; pop.style.height = st.h; pop.classList.add('sized'); }
        if (st.min) { pop.classList.add('min'); setMin(true); }
        else if (st.full) setFull(true);
        pop.querySelector('.mbu-logpop-grip').addEventListener('mousedown', function (e) {
            e.preventDefault(); e.stopPropagation();
            var r = pop.getBoundingClientRect();
            // pin the top-left corner, so only the right and bottom edges move
            pop.style.left = r.left + 'px'; pop.style.top = r.top + 'px'; pop.style.right = 'auto'; pop.style.bottom = ''; pop.style.transform = 'none';
            pop.classList.add('sized');
            var x0 = e.clientX, y0 = e.clientY;
            var mv = function (ev) {
                pop.style.width = Math.max(320, Math.min(window.innerWidth - r.left, r.width + ev.clientX - x0)) + 'px';
                pop.style.height = Math.max(120, Math.min(window.innerHeight - r.top, r.height + ev.clientY - y0)) + 'px';
            };
            var up = function () {
                document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
                restore = { left: pop.style.left, top: pop.style.top, right: 'auto', bottom: '', transform: 'none' };
                remember({ left: pop.style.left, top: pop.style.top, w: pop.style.width, h: pop.style.height });
            };
            document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
        });
        pop.querySelector('.mbu-logpop-x').onclick = function () { close(); };
        // floating and non-modal: dragged by its header
        pop.querySelector('.mbu-logpop-h').addEventListener('mousedown', function (e) {
            if (e.target.closest('button, input, select') || pop.classList.contains('full')) return;
            e.preventDefault();
            var r = pop.getBoundingClientRect();
            pop.style.left = r.left + 'px'; pop.style.top = r.top + 'px'; pop.style.right = 'auto'; pop.style.transform = 'none';
            var ox = e.clientX - r.left, oy = e.clientY - r.top;
            var mv = function (ev) {
                pop.style.left = Math.max(0, Math.min(window.innerWidth - pop.offsetWidth, ev.clientX - ox)) + 'px';
                pop.style.top = Math.max(0, Math.min(window.innerHeight - 36, ev.clientY - oy)) + 'px';
            };
            var up = function () {
                document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
                if (!pop.classList.contains('min')) {
                    restore = { left: pop.style.left, top: pop.style.top, right: 'auto', bottom: '', transform: 'none' };
                    remember({ left: pop.style.left, top: pop.style.top });
                }
            };
            document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
        });
        window.addEventListener('keydown', onKey, true);
        return pop;
    }
    // the viewer inside an element of the script's; a second mount there replaces the first
    function mount(host, opts) {
        if (!host) return null;
        views = views.filter(function (v) { if (v.el.parentNode === host) { v.el.remove(); return false; } return true; });
        var el = document.createElement('div'); el.className = 'mbu-logemb';
        host.appendChild(el);
        return view(el, false, opts && opts.tools).el;
    }
    // empty the live log: the lines, the counts and the "earlier lines not kept" note
    function clear() {
        buf = []; dropped = 0; warn = 0; error = 0;
        if (H && sid) { store.del(hp + sid); lastSaved = ''; }
        views.forEach(function (v) { if (!v.past) v.show(null); });
    }
    function clearHistory() {
        if (!H) return;
        ids().forEach(function (id) { if (id !== sid) forget(id); });
        views.forEach(function (v) { v.sessions(); });
    }
    // quiet: closing to reopen, so the remembered "open" stays as it is
    function close(quiet) {
        var stray = document.getElementById('mbu-logpop');
        if (win) {
            win.off(); win.el.remove();
            views = views.filter(function (v) { return v !== win.v; });
            win = null; if (!quiet) remember({ open: false });
        }
        if (stray) stray.remove();   // another script's window: one log window at a time
    }
    var api = {
        info: function () { add('info', arguments); },
        warn: function () { add('warn', arguments); },
        err: function () { add('error', arguments); },
        error: function () { add('error', arguments); },
        ok: function () { add('ok', arguments); },
        debug: function () { add('debug', arguments); },
        add: function (sev) { add(sev, Array.prototype.slice.call(arguments, 1)); },
        // the debug switch: are debug lines recorded?
        debugOn: function () { return debugOn(); },
        setDebug: setDebug,
        pre: function () { add('info', arguments, null, true); },
        // a logger whose lines carry this category; the same object for the same name
        cat: function (name) {
            if (!name) return api;
            if (!bound[name]) bound[name] = {
                info: function () { add('info', arguments, name); },
                warn: function () { add('warn', arguments, name); },
                err: function () { add('error', arguments, name); },
                error: function () { add('error', arguments, name); },
                ok: function () { add('ok', arguments, name); },
                debug: function () { add('debug', arguments, name); },
                add: function (sev) { add(sev, Array.prototype.slice.call(arguments, 1), name); },
                pre: function () { add('info', arguments, name, true); },
            };
            return bound[name];
        },
        open: open,
        mount: mount,
        close: function () { close(); },
        reopen: function () { if (state().open) open(); },
        isOpen: function () { return !!win; },
        markdown: function () { return markdown(); },
        copy: function (btn) { copy(btn); },
        clear: clear,
        lines: function () { return buf.map(line); },
        entries: function () { return buf.slice(); },
        messages: function () { return buf.map(function (e) { return e.msg; }); },
        counts: function () { return { warn: warn, error: error }; },
        // history (#705); harmless without o.history
        session: function () { if (H) startSession(); return sid; },
        resume: function (id) { return H ? resume(id) : false; },
        keep: function () { if (H && sid && !kept) { kept = true; store.set(hp + 'current', sid); flush(); prune(); views.forEach(function (v) { v.sessions(); }); } },
        name: function (text) { if (H && text && !sname) { sname = String(text); if (kept) store.set(hp + sid + ':name', sname); } },
        sessionId: function () { return sid; },
        last: function () { return H ? store.get(hp + 'current') : null; },
        isKept: function () { return kept; },
        sessions: function () { return H ? sessions() : []; },
        load: function (id) { return loadSession(id); },
        forget: function (id) { forget(id); views.forEach(function (v) { v.sessions(); }); },
        clearHistory: clearHistory,
        // redraw the session lists (a script showing its mounted viewer again); only a changed list is redrawn
        refresh: function () { views.forEach(function (v) { v.sessions(); }); },
        flush: flush,
    };
    if (H) {
        sid = newId();
        // #811: a script reloads the page right after its operation; write the kept session
        // now rather than trusting the 100 ms timer to beat the unload
        try { window.addEventListener('pagehide', flush); } catch (e) { /* no window */ }
    }
    mbuLog.active = api;   // the script's own log, for helpers that note things in it (mbuClaim)
    return api;
}

// Dismiss-on-outside-click, with the trailing click SWALLOWED.
//
//   var off = mbuDismissOn(popoverEl, close);   // off() to detach early
//
// #305: a popover torn down on mousedown removes what was under the cursor, so
// the click that follows lands on whatever the page reflowed into that spot and
// activates it. Tearing down on click instead just moves the problem. So: close
// on outside mousedown, then eat exactly one click in the capture phase. This is
// the single most repeated interaction bug in these scripts and it belongs in
// one place — it is why #563 says interaction is part of the contract.
//
// Esc closes too, innermost first: the handler is registered in capture and stops
// propagation, so a popover inside a modal does not close the modal as well.
function mbuDismissOn(el, close, opts) {
    opts = opts || {};
    var closed = false;
    var onDown = function (e) {
        if (closed || !el || el.contains(e.target)) return;
        if (opts.ignore && e.target.closest && e.target.closest(opts.ignore)) return;
        finish();
        // swallow the click this mousedown will produce, once
        var eat = function (ev) { ev.stopPropagation(); ev.preventDefault(); document.removeEventListener('click', eat, true); };
        document.addEventListener('click', eat, true);
        setTimeout(function () { document.removeEventListener('click', eat, true); }, 400);
    };
    var onKey = function (e) {
        if (closed || e.key !== 'Escape') return;
        e.stopPropagation();
        finish();
    };
    function finish() {
        if (closed) return;
        closed = true;
        document.removeEventListener('mousedown', onDown, true);
        document.removeEventListener('keydown', onKey, true);
        try { close(); } catch (err) { /* a throwing closer must not leave listeners behind */ }
    }
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return finish;
}

// Collapse a toolbar to icon-only when its buttons would wrap.
//
//   mbuFitToolbar(barEl)            // call on build, and on resize
//
// Measured by SUMMING child widths rather than reading scrollWidth or comparing
// offsetTop: a bar with flex:1 spacers never overflows its own scroll box, so
// both of those report "fits" right up until it visibly wraps. Art Station
// learned that the hard way (#234) and it is the only reason this is a helper
// rather than one CSS rule.
//
// opts.gap    inter-item gap in px (default 11)
// opts.pad    horizontal padding to leave (default 24)
// opts.spacer selector for flexible spacers, which must not count (default .mbu-sp)
function mbuFitToolbar(bar, opts) {
    if (!bar) return false;
    opts = opts || {};
    var gap = opts.gap == null ? 11 : opts.gap;
    var pad = opts.pad == null ? 24 : opts.pad;
    var spacer = opts.spacer || '.mbu-sp';
    bar.classList.remove('mbu-compact');            // measure at full labels
    var kids = [].slice.call(bar.children);
    var need = gap * Math.max(0, kids.length - 1);
    for (var i = 0; i < kids.length; i++) {
        if (kids[i].matches && kids[i].matches(spacer)) continue;
        need += kids[i].offsetWidth;
    }
    var compact = need > bar.clientWidth - pad;
    bar.classList.toggle('mbu-compact', compact);
    return compact;
}

// Publish the components on a shared namespace. Three reasons, in order:
//
//  1. it is the cross-userscript contract #563 is about — another script (or a
//     future one) gets the standard widgets without copying them, the same way
//     Mammoth already exposes its field-memory through a documented convention;
//  2. it makes the components testable from outside, which is the only way to
//     assert the *behaviour* half of the contract rather than just the markup;
//  3. it costs nothing when several scripts do it — the definitions are
//     byte-identical, so first writer wins and the rest are no-ops.
//
// Guarded per key, never clobbering: a script that loaded first keeps its copy,
// and a page that defines an unrelated window.MBU is left alone.
// Theme recognition. #564: "we don't have to conform to Stylus vars, we could
// probably use them as a recognition signal to enable our own dark theme."
//
// That is the right way round. Reading --background/--text and hoping every
// derived colour lands somewhere readable is guesswork that fails one token at a
// time; knowing WHICH theme we are in lets the token set say so outright, and
// lets us hand the browser the one thing CSS variables cannot express —
// color-scheme, which is what actually paints a checkbox dark instead of leaving
// a white (Firefox: black) box on a dark panel.
//
// The signal is the rendered page, not a particular userstyle's variable names:
// whatever painted the body, we measure its luminance. So this works for Stylus,
// for a browser extension, for MusicBrainz shipping its own dark mode one day,
// and for a user who just set --background by hand.
//
//   · an explicit --mbu-theme (light|dark) always wins — the escape hatch;
//   · otherwise the page background decides;
//   · re-checked when stylesheets arrive, because Stylus often lands after us.
function mbuThemeOf(bg) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(bg || '');
    if (!m) return null;
    if (m[4] !== undefined && +m[4] < 0.5) return null;      // transparent tells us nothing
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    var L = 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]);
    return L < 0.35 ? 'dark' : 'light';
}
// #569 (chaban-mb) — write only when the value actually changes.
//
// The DOM does not do this for you. classList.add of a token already present,
// classList.toggle to the state it is already in, setAttribute with the value it
// already has: each one re-sets the attribute and dispatches a mutation record.
// Harmless once; these run from 2Hz heartbeats and from observers that react to
// each other, and the measured idle cost on the release editor was 66 records a
// second, of which 93% came from writes that changed nothing (see
// dev/ui/measure-569-idle-mutations.mjs).
//
// Semantically these are exact no-ops: they skip a write ONLY when the value is
// already the one being written, so nothing that reads the DOM afterwards can
// tell the difference. That is the whole reason they are safe to sprinkle around
// a 2Hz loop.
function mbuCls(el, token, on) {
    if (!el || !el.classList) return;
    if (el.classList.contains(token) !== !!on) el.classList.toggle(token, !!on);
}
function mbuAttr(el, name, value) {
    if (!el) return;
    if (value === null || value === undefined || value === false) {
        if (el.hasAttribute(name)) el.removeAttribute(name);
    } else if (el.getAttribute(name) !== String(value)) {
        el.setAttribute(name, String(value));
    }
}
// For IDL properties (disabled, title, textContent, style.display …). Reading
// them is cheap; writing them is not, and textContent in particular replaces
// every child node.
//
// ⚠ textContent is the one to think twice about: its getter concatenates the
// text of ALL descendants, so on an element with child ELEMENTS the comparison
// can match while the DOM shape is wrong, and the guard then skips a write that
// would have flattened it. Only use it where the target holds text and nothing
// else.
function mbuProp(obj, prop, value) {
    if (!obj) return;
    if (obj[prop] !== value) obj[prop] = value;
}

// #569: the one element mbuTheme resolves --background through. Looked up by id
// rather than kept in a variable, so the seven scripts of a bundle share ONE
// probe instead of adding seven, and so it heals itself if anything removes it.
// It lives in <body>: a permanent stray node under <html>, outside head and
// body, is the sort of thing another script's document scan trips over.
function mbuProbe() {
    var p = document.getElementById('mbu-theme-probe');
    if (p) return p;
    if (!document.body) return null;
    p = document.createElement('span');
    p.id = 'mbu-theme-probe';
    p.setAttribute('aria-hidden', 'true');
    p.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;pointer-events:none;background:var(--background)';
    document.body.appendChild(p);
    return p;
}
function mbuTheme() {
    var root = document.documentElement;
    try {
        var cs = getComputedStyle(root);
        var forced = (cs.getPropertyValue('--mbu-theme') || '').trim();
        var t = (forced === 'dark' || forced === 'light') ? forced
            : (mbuThemeOf(getComputedStyle(document.body).backgroundColor)
                || mbuThemeOf(cs.backgroundColor)
                || mbuThemeOf(cs.getPropertyValue('--mbu-bg'))
                || 'light');
        if (root.getAttribute('data-mbu-theme') !== t) root.setAttribute('data-mbu-theme', t);

        // Should we adopt the userstyle's OWN shades, or use our own palette?
        // Only if its --background actually agrees with the theme we detected.
        // A userstyle can paint the page dark with ordinary rules and still leave
        // --background at a light value for its own purposes; taking that on
        // trust hands us a light surface under a correct dark theme, which is
        // indistinguishable from the bug it looks like. Measured, not assumed.
        var seed = null;
        var raw = (cs.getPropertyValue('--background') || '').trim();
        if (raw) {
            // Resolved through a real element, because --background may itself be
            // a var(), a named colour, or anything else CSS accepts.
            //
            // #569 (chaban-mb): this used to CREATE and REMOVE that element on
            // every call, as a direct child of <html>. mbuTheme re-runs whenever
            // the root or body class changes, Mammoth watches the whole document
            // for childList changes and reacts by toggling classes on <html>, and
            // those class changes wake mbuTheme again — a self-feeding loop,
            // measured at 12 root-node mutations a second on an idle page, which
            // is what makes DevTools blink.
            //
            // One element, created once and left in place, breaks it: the value
            // is still resolved LIVE on every call (a cached reading would freeze
            // the theme at whatever it was before Stylus injected, which is the
            // bug this whole function exists to avoid) but nothing is added to or
            // removed from the DOM to read it.
            var probe = mbuProbe();
            var got = null;
            if (probe) {
                got = mbuThemeOf(getComputedStyle(probe).backgroundColor);
            } else {
                // No <body> yet — document-start. Fall back to the transient
                // element for these first one or two calls; the idle loop this
                // avoids cannot exist before the page has a body anyway.
                var tmp = document.createElement('span');
                tmp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;background:var(--background)';
                document.documentElement.appendChild(tmp);
                got = mbuThemeOf(getComputedStyle(tmp).backgroundColor);
                tmp.remove();
            }
            if (got === t) seed = 'theme';
        }
        // guarded: setAttribute dispatches a mutation record even when the value
        // is unchanged, and this runs several times a second
        if (seed) { if (root.getAttribute('data-mbu-seed') !== seed) root.setAttribute('data-mbu-seed', seed); }
        else if (root.hasAttribute('data-mbu-seed')) root.removeAttribute('data-mbu-seed');
        return t;
    } catch (e) { return 'light'; }
}
// A document-start script runs before the document is parsed: documentElement can
// still be null, and <head> and <body> don't exist. Observing a null root threw, the
// catch below swallowed it, and nothing (the watches, the re-checks) was ever set up,
// so such a script never read the theme at all (#625). It starts on the parsed page.
function mbuThemeStart() { try {
    mbuTheme();
    // Stylus and friends inject after us often enough that a one-shot read is
    // wrong about half the time. Watch for stylesheets ARRIVING — head childList
    // plus the root's own attributes — and never the whole subtree: this runs on
    // the release editor, where a subtree observer calling getComputedStyle is a
    // layout thrash on every keystroke.
    var _mbuThemeT = 0;
    var _mbuThemeSoon = function () {
        clearTimeout(_mbuThemeT);
        _mbuThemeT = setTimeout(mbuTheme, 150);
    };
    var _mbuThemeObs = new MutationObserver(_mbuThemeSoon);
    _mbuThemeObs.observe(document.documentElement, { attributeFilter: ['style', 'class'] });
    // ⚠ #569: characterData, not just childList. Until the idle thrash was fixed
    // this function ran several times a second whether or not anything had
    // changed — Apollo re-added a body class at 2Hz, which woke this observer,
    // which is how a theme change was ever noticed. That accidental polling was
    // LOAD-BEARING: with the thrash gone and only head-childList watched, a
    // userstyle that REWRITES ITSELF (Stylus editing it live, or one switching
    // palette) adds and removes no nodes, so nothing woke us and the theme went
    // stale. Caught by verify-569-theme-still-tracks.mjs, which passes on the
    // pre-fix build and failed on the first version of this one.
    if (document.head) _mbuThemeObs.observe(document.head, { childList: true, subtree: true, characterData: true });
    if (document.body) _mbuThemeObs.observe(document.body, { attributeFilter: ['style', 'class'] });
    // …and the case that produces no DOM mutation at all: the OS flipping to dark
    // under a userstyle with a prefers-color-scheme query. Nothing above can see
    // that, and nothing did before either — it was simply never noticed while the
    // page was re-checking itself several times a second.
    try {
        var _mbuMq = matchMedia('(prefers-color-scheme: dark)');
        if (_mbuMq.addEventListener) _mbuMq.addEventListener('change', _mbuThemeSoon);
        else if (_mbuMq.addListener) _mbuMq.addListener(_mbuThemeSoon);
    } catch (e) {}
    setTimeout(mbuTheme, 400);
    setTimeout(mbuTheme, 2000);
} catch (e) { /* no observer, no theme switching — the light defaults still apply */ } }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mbuThemeStart, { once: true });
else mbuThemeStart();

try {
    var _mbuNs = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
    if (!_mbuNs.MBU) _mbuNs.MBU = {};
    if (!_mbuNs.MBU.theme) _mbuNs.MBU.theme = mbuTheme;
    if (!_mbuNs.MBU.helpHref) _mbuNs.MBU.helpHref = mbuHelpHref;
    if (!_mbuNs.MBU.helpHtml) _mbuNs.MBU.helpHtml = mbuHelpHtml;
    if (!_mbuNs.MBU.helpEl) _mbuNs.MBU.helpEl = mbuHelpEl;
    if (!_mbuNs.MBU.toast) _mbuNs.MBU.toast = mbuToast;
    if (!_mbuNs.MBU.cfgHeader) _mbuNs.MBU.cfgHeader = mbuCfgHeader;
    if (!_mbuNs.MBU.dismissOn) _mbuNs.MBU.dismissOn = mbuDismissOn;
    if (!_mbuNs.MBU.fitToolbar) _mbuNs.MBU.fitToolbar = mbuFitToolbar;
    if (!_mbuNs.MBU.tip) _mbuNs.MBU.tip = mbuTip;
} catch (e) { /* a locked-down page must not stop the script loading */ }

// Tooltips: our own, never the browser's title (dev/ui/tooltip.mjs, STANDARDS → Standard 14).
function mbuTipV() { return 13; }
function mbuTipCssText() { return "#mbu-tip{position:fixed;left:0;top:0;z-index:var(--mbu-z-tip,2147483647);box-sizing:border-box;max-width:min(330px,calc(100vw - 16px));padding:7px 11px 8px;background:var(--mbu-bg,#fff);color:var(--mbu-text,#222);border:1px solid var(--mbu-border,#cfc6e6);border-radius:9px;box-shadow:0 6px 24px rgba(40,20,80,.2),0 1px 3px rgba(40,20,80,.12);font:12.5px/1.45 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);text-align:left;white-space:normal;overflow-wrap:break-word;letter-spacing:normal;text-transform:none;pointer-events:none;visibility:hidden;opacity:0;transform:translateY(-3px);transition:opacity .12s ease,transform .12s ease,visibility 0s linear .12s}#mbu-tip.mbu-tip-up{transform:translateY(3px)}#mbu-tip.mbu-tip-on{visibility:visible;opacity:1;transform:none;transition:opacity .12s ease,transform .12s ease}#mbu-tip.mbu-tip-act.mbu-tip-on{pointer-events:auto}#mbu-tip.mbu-tip-wide{max-width:min(460px,calc(100vw - 16px))}#mbu-tip:has(.mbu-tip-dl){max-width:min(480px,calc(100vw - 16px))}#mbu-tip::before{content:\"\";position:absolute;left:calc(var(--mbu-tip-ax,50%) - 5px);top:-5px;width:8px;height:8px;background:inherit;border:1px solid var(--mbu-border,#cfc6e6);border-right:0;border-bottom:0;transform:rotate(45deg)}#mbu-tip.mbu-tip-up::before{top:auto;bottom:-5px;border:1px solid var(--mbu-border,#cfc6e6);border-left:0;border-top:0}#mbu-tip.mbu-tip-card:not(.mbu-tip-up)::before{background:var(--mbu-bg-raised,#faf9fe)}#mbu-tip .mbu-tip-lead{font-weight:600;color:var(--mbu-text,#222)}#mbu-tip .mbu-tip-p{margin:0;color:var(--mbu-text-dim,#555)}#mbu-tip .mbu-tip-lead+*,#mbu-tip .mbu-tip-p+*,#mbu-tip .mbu-tip-ul+*,#mbu-tip .mbu-tip-rows+*{margin-top:5px}#mbu-tip>.mbu-tip-p:first-child:last-child{color:var(--mbu-text,#222)}#mbu-tip .mbu-tip-warn{color:var(--mbu-warn,#a05a00)}#mbu-tip .mbu-tip-rows{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 8px;align-items:start;color:var(--mbu-text-dim,#555)}#mbu-tip .mbu-tip-rows>.mbu-tip-kk,#mbu-tip .mbu-tip-rows>.mbu-tip-dl{min-height:18px}#mbu-tip .mbu-tip-rows>.mbu-tip-k{line-height:18px}#mbu-tip .mbu-tip-rows>:nth-child(odd){justify-self:start}#mbu-tip .mbu-tip-rows>.mbu-tip-span{grid-column:2;justify-self:stretch;margin:-2px 0 0}#mbu-tip .mbu-tip-k{display:inline-block;padding:0;border:0;background:none;color:var(--mbu-text-weak,#888);font:600 11.5px/1.5 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);white-space:nowrap}#mbu-tip .mbu-tip-kk{display:inline-flex;align-items:center;gap:3px;color:var(--mbu-accent-text,#5f3ec0);white-space:nowrap}#mbu-tip .mbu-tip-dl{display:inline-flex;align-items:center;gap:6px;font-weight:600;color:var(--mbu-text,#222);white-space:nowrap}#mbu-tip .mbu-tip-dl i{flex:none;width:10px;height:10px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.22)}#mbu-tip .mbu-tip-on{color:var(--mbu-accent-text,#5f3ec0)}#mbu-tip .mbu-tip-dl.mbu-tip-on::after{content:\"◂\";margin-left:-2px;font-size:11px}#mbu-tip .mbu-tip-off{opacity:.45}#mbu-tip .mbu-tip-sym{letter-spacing:.2px}#mbu-tip .mbu-tip-mouse{display:block;flex:none;position:relative}#mbu-tip .mbu-tip-mouse rect[fill=none],#mbu-tip .mbu-tip-mouse path[stroke]{stroke:var(--mbu-text-weak,#888);stroke-width:1}#mbu-tip .mbu-tip-kx{font:600 10px/1 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);color:var(--mbu-text-weak,#888)}#mbu-tip .mbu-tip-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}#mbu-tip .mbu-tip-o{display:inline-block;padding:0 7px;border-radius:999px;background:var(--mbu-accent-soft,#ece4ff);color:var(--mbu-accent-text,#5f3ec0);font:600 11px/1.6 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);white-space:nowrap}#mbu-tip .mbu-tip-ul{margin:0;padding:0 0 0 15px;color:var(--mbu-text-dim,#555)}#mbu-tip .mbu-tip-ul li{margin:1px 0;padding:0}#mbu-tip code{font:11.5px var(--mbu-font-mono,ui-monospace,Consolas,monospace);padding:0 4px;border-radius:4px;background:var(--mbu-bg-sunken,#f4f2f9)}#mbu-tip b{font-weight:600;color:var(--mbu-text,#222)}#mbu-tip a{color:var(--mbu-accent-text,#5f3ec0)}#mbu-tip.mbu-tip-card{padding:0;width:380px;max-width:min(380px,calc(100vw - 16px));overflow:visible}#mbu-tip .mbu-tip-ch{display:flex;align-items:center;gap:8px;padding:8px 11px;border-bottom:1px solid var(--mbu-border-soft,#e2dcef);background:var(--mbu-bg-raised,#faf9fe);border-radius:9px 9px 0 0}#mbu-tip .mbu-tip-ca{margin-left:auto;font-size:11px;color:var(--mbu-text-weak,#999);white-space:nowrap}#mbu-tip .mbu-tip-cb{padding:8px 11px;display:flex;flex-direction:column;gap:6px}#mbu-tip .mbu-tip-cf{display:flex;gap:10px;padding:6px 11px;border-top:1px solid var(--mbu-border-soft,#e2dcef);font-size:11px;color:var(--mbu-text-weak,#999)}#mbu-tip .mbu-tip-cf>:last-child:not(:first-child){margin-left:auto}@media (prefers-reduced-motion:reduce){#mbu-tip,#mbu-tip.mbu-tip-on{transition:none;transform:none}}"; }
function mbuTipRoots() { return ".mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu"; }
function mbuTipEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
}
function mbuTipLabel(line) {
    var m = /^([^\s:.,;!?()][^:.,;!?()]{0,40}?): (\S[\s\S]*)$/.exec(line);
    if (!m || m[1].split(/\s+/).length > 3 || /https?$/i.test(m[1])) return null;
    return { label: m[1], text: m[2], key: mbuTipIsKey(m[1]) };
}
function mbuTipIsKey(label) {
    return /click|drag|wheel|scroll|hover|double|press|paste|\bkey\b|^(esc|escape|enter|return|tab|space|ctrl|shift|alt|cmd|meta|del|delete|backspace|f\d{1,2})\b|\+|^[↑↓←→]/i.test(label);
}
function mbuTipInline(s) {
    return mbuTipEsc(s)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/\(((?:(?:Ctrl|Alt|Shift|Cmd|Meta)\+)+[^\s()]+)\)/g, function (m, k) { return mbuTipKbd(k); })
        .replace(/\s\((Esc|Enter|Space|Tab|[A-Z0-9]|[↑↓←→])\)(?=$|[\s.,;])/g, ' <kbd class="mbu-tip-k">$1</kbd>');
}
function mbuTipCap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function mbuTipMod(k) { return { ctrl: 'C', alt: 'A', shift: '⇧', cmd: '⌘', meta: '⌘' }[String(k).toLowerCase()] || k; }
function mbuTipKbd(combo) {
    var parts = String(combo).split(/\s*\+\s*/);
    var key = parts.pop();
    return '<kbd class="mbu-tip-k mbu-tip-sym"><span class="mbu-tip-sr">' + mbuTipEsc(combo) + '</span><span aria-hidden="true">'
        + parts.concat('').map(mbuTipMod).join('+') + mbuTipEsc(key.length === 1 ? key.toUpperCase() : mbuTipCap(key)) + '</span></kbd>';
}
function mbuTipKey(label) {
    // two ways to do the same, "Middle-click / Alt+click": each drawn, a grey slash between
    var alts = String(label).split(/\s+\/\s+/);
    if (alts.length > 1) return '<span class="mbu-tip-kk">' + alts.map(mbuTipKey).join('<span class="mbu-tip-kx">/</span>') + '</span>';
    var m = /^((?:(?:ctrl|alt|shift|cmd|meta)\s*[+-]\s*)*)(left|right|middle|double)?[- ]?(click|drag|wheel|scroll)$/i.exec(String(label).trim());
    if (!m) return /^(?:(?:ctrl|alt|shift|cmd|meta)\s*\+\s*)+\S/i.test(label) ? mbuTipKbd(label) : '<span class="mbu-tip-k">' + mbuTipEsc(mbuTipCap(label)) + '</span>';
    var mods = m[1] ? m[1].split(/\s*[+-]\s*/).filter(Boolean) : [];
    var btn = (m[2] || '').toLowerCase(), act = m[3].toLowerCase();
    var wheel = btn === 'middle' || act === 'wheel' || act === 'scroll';
    var fill = wheel ? '' : btn === 'right' ? 'M6 1C8.8 1 11 3.2 11 6v1H6z' : 'M6 1C3.2 1 1 3.2 1 6v1h5z';
    var svg = '<svg class="mbu-tip-mouse" viewBox="0 0 12 16" width="10" height="13" aria-hidden="true">'
        + (fill ? '<path d="' + fill + '" fill="currentColor"/>' : '')
        + '<rect x="1" y="1" width="10" height="14" rx="5" fill="none" stroke="currentColor" stroke-width="1.3"/>'
        + '<path d="M1 7h10' + (wheel ? '' : 'M6 1v6') + '" stroke="currentColor" stroke-width="1.1"/>'
        + (wheel ? '<rect x="5" y="2.6" width="2" height="3.4" rx="1" fill="currentColor"/>' : '')
        + '</svg>';
    var extra = btn === 'double' ? '×2' : act === 'drag' ? 'drag' : (act === 'wheel' || act === 'scroll') ? '↕' : '';
    return '<span class="mbu-tip-kk"><span class="mbu-tip-sr">' + mbuTipEsc(mbuTipCap(label)) + '</span>'
        + (mods.length ? '<kbd class="mbu-tip-k mbu-tip-sym" aria-hidden="true">' + mods.map(mbuTipMod).join('+') + '</kbd>' : '')
        + svg + (extra ? '<span class="mbu-tip-kx" aria-hidden="true">' + extra + '</span>' : '') + '</span>';
}
function mbuTipText(src) {
    var raw = String(src == null ? '' : src).replace(/\r/g, '').replace(/^\s+|\s+$/g, '');
    if (!raw) return '';
    var lines = [];
    // the shapes the old title texts took, read as the rows they mean:
    //   "… — click to open it"              → "…" + "Click: open it"
    //   "… (right-click: guess case all)"   → "…" + "Right-click: guess case all"
    //   "Ctrl-click", "Alt-click"           → "Ctrl+click", "Alt+click"
    raw = raw.replace(/\b(Ctrl|Alt|Shift|Cmd)-(click|drag)/gi, '$1+$2')
        .replace(/\s*\(((?:(?:right|middle|double|ctrl|alt|shift|cmd)[-+ ]?)+click|(?:ctrl|alt|shift|cmd)\+\w+):\s*([^()\n]+)\)(?=\s*(?:$|\n))/gim, function (m, k, t) { return '\n' + mbuTipCap(k) + ': ' + t; })
        .replace(/\s+[—–-]\s+((?:(?:right|middle|double|ctrl|alt|shift)[-+ ]?)?click) to ([^\n·]+)/gi, function (m, k, t) { return '\n' + mbuTipCap(k) + ': ' + t; })
        .replace(/[.;]\s+((?:right|middle|double|ctrl|alt|shift)[-+ ]?click|click) to ([^\n·.]+)\.?(?=\s*(?:$|\n))/gi, function (m, k, t) { return '\n' + mbuTipCap(k) + ': ' + t; });
    raw.split('\n').forEach(function (line) {
        line = line.replace(/\s+$/, '');
        // ' · Label: ' starts a new line; so does '. Label: ' once the line itself opened with a label
        var parts = line.split(/\s+·\s+/), out = [parts[0]];
        for (var i = 1; i < parts.length; i++) {
            if (mbuTipLabel(parts[i])) out.push(parts[i]); else out[out.length - 1] += ' · ' + parts[i];
        }
        out.forEach(function (seg) {
            if (!mbuTipLabel(seg)) { lines.push(seg); return; }
            var bits = seg.split(/(?<=\.)\s+(?=[A-Z][\w+-]*(?:\s[\w+-]+)?:\s)/);
            bits.forEach(function (b) { lines.push(b); });
        });
    });
    // blocks: lead / paragraph / rows / bullets
    var blocks = [], rowRun = [];
    var flushRows = function () {
        if (!rowRun.length) return;
        var keyed = rowRun.filter(function (r) { return r.key; }).length;
        if (rowRun.length >= 2 || keyed) blocks.push({ t: 'rows', rows: rowRun });
        else blocks.push({ t: 'p', s: rowRun[0].line });
        rowRun = [];
    };
    lines.forEach(function (line, n) {
        if (!line.trim()) { flushRows(); return; }
        var b = /^\s*[-•]\s+(.*)$/.exec(line);
        if (b) {
            flushRows();
            var last = blocks[blocks.length - 1];
            if (last && last.t === 'ul') last.items.push(b[1]); else blocks.push({ t: 'ul', items: [b[1]] });
            return;
        }
        // a level row, "{#2f6fd6} Exact: …": a dot in the colour before the label; "{#… on}" marks the
        // chosen level, "{#… off}" dims one past it (a cutoff's table)
        var lv = /^\{(#[0-9a-f]{3,8})(?: (on|off))?\}\s*(\S[\s\S]*)$/i.exec(line);
        if (lv) {
            var ll = mbuTipLabel(lv[3]) || { label: lv[3], text: '' };
            rowRun.push({ label: ll.label, text: ll.text, dot: lv[1], st: lv[2] ? lv[2].toLowerCase() : '', line: line });
            return;
        }
        var l = mbuTipLabel(line);
        // the first line is a row only as a key or when a label follows: alone, "Release group: when…" is a sentence
        if (l && (l.key || blocks.length || rowRun.length || (lines[n + 1] && mbuTipLabel(lines[n + 1])))) { l.line = line; rowRun.push(l); return; }
        flushRows();
        blocks.push({ t: 'p', s: line });
    });
    flushRows();
    // one long paragraph: its first sentence becomes the lead
    if (blocks.length === 1 && blocks[0].t === 'p' && blocks[0].s.length > 110) {
        var m = /^(.{12,110}?[.!?])\s+(?=[A-Z(“"'])([\s\S]+)$/.exec(blocks[0].s);
        if (m) blocks = [{ t: 'p', s: m[1].replace(/\.$/, '') }, { t: 'p', s: m[2] }];
    }
    var lead = blocks.length > 1 && blocks[0].t === 'p';
    var rowsHtml = function (bl) {
        return bl.rows.map(function (r) {
            if (r.dot) {
                var c = r.st ? ' mbu-tip-' + r.st : '';
                return '<span class="mbu-tip-dl' + c + '"><i style="background:' + r.dot + '"></i>' + mbuTipEsc(mbuTipCap(r.label)) + '</span>'
                    + '<span class="mbu-tip-dt' + c + '">' + mbuTipInline(r.text) + '</span>';
            }
            return (r.key ? mbuTipKey(r.label) : '<span class="mbu-tip-o">' + mbuTipEsc(mbuTipCap(r.label)) + '</span>') + '<span>' + mbuTipInline(r.text) + '</span>';
        }).join('');
    };
    var html = function (bl, i, span) {
        var sp = span ? ' mbu-tip-span' : '';
        if (bl.t === 'ul') return '<ul class="mbu-tip-ul' + sp + '">' + bl.items.map(function (x) { return '<li>' + mbuTipInline(x) + '</li>'; }).join('') + '</ul>';
        if (bl.t === 'rows') return span ? rowsHtml(bl) : '<div class="mbu-tip-rows">' + rowsHtml(bl) + '</div>';
        var warn = /^⚠/.test(bl.s);
        return '<div class="' + (lead && i === 0 ? 'mbu-tip-lead' : 'mbu-tip-p') + (warn ? ' mbu-tip-warn' : '') + sp + '">' + mbuTipInline(bl.s) + '</div>';
    };
    // rows with a note between them stay one grid, the note under the row before it, so their labels line up
    var first = -1, last = -1;
    blocks.forEach(function (bl, i) { if (bl.t === 'rows') { if (first < 0) first = i; last = i; } });
    var out = '';
    for (var i = 0; i < blocks.length; i++) {
        if (i === first && last > first) {
            out += '<div class="mbu-tip-rows">';
            for (; i <= last; i++) out += html(blocks[i], i, true);
            out += '</div>';
            i = last;
        } else out += html(blocks[i], i, false);
    }
    return out;
}
function mbuTipCard(o) {
    o = o || {};
    var h = '';
    if (o.head || o.title || o.aside) {
        h += '<div class="mbu-tip-ch">' + (o.head || '') + (o.title ? '<b>' + mbuTipEsc(o.title) + '</b>' : '')
            + (o.aside ? '<span class="mbu-tip-ca">' + mbuTipEsc(o.aside) + '</span>' : '') + '</div>';
    }
    if (o.body) h += '<div class="mbu-tip-cb">' + o.body + '</div>';
    if (o.foot || o.footAside) h += '<div class="mbu-tip-cf"><span>' + (o.foot || '') + '</span>' + (o.footAside ? '<span>' + o.footAside + '</span>' : '') + '</div>';
    return h;
}
function mbuTipS() {
    return mbuTipS.s || (mbuTipS.s = {
        me: Math.random().toString(36).slice(2, 10), lead: false, els: typeof WeakMap === 'function' ? new WeakMap() : null, prov: [],
        cur: null, curOpts: null, pend: null, showT: 0, hideT: 0, liveT: 0, warm: 0, quiet: null, tab: false, mx: -1, my: -1, obs: null,
    });
}
function mbuTip(el, content, opts) {
    if (!el) return el;
    var _mbuTip = mbuTipS();
    mbuTipStart();
    opts = opts || {};
    if (typeof content === 'function') {
        if (_mbuTip.els) _mbuTip.els.set(el, { fn: content, opts: opts });
        el.setAttribute('data-mbu-tip-own', '');
        el.removeAttribute('title');
        return el;
    }
    if (content == null || content === '') el.removeAttribute('data-tip'); else el.setAttribute('data-tip', String(content));
    if (opts.place) el.setAttribute('data-tip-place', opts.place);
    if (opts.wide) el.setAttribute('data-tip-wide', '');
    el.removeAttribute('title');
    if (_mbuTip.cur === el) mbuTipRender();
    return el;
}
function mbuTipOn(selector, fn, opts) {
    mbuTipS().prov.push({ sel: selector, fn: fn, opts: opts || {} });
    mbuTipStart();
}
function mbuTipShowFor(el, content, opts) {
    if (!el || content == null || content === '') { mbuTipHide(true); return; }
    mbuTipStart();
    var o = opts || {};
    var fn = typeof content === 'function' ? content : function () { return content; };
    var S = mbuTipS();
    if (S.cur === el) { S.curOpts.fn = fn; if (!mbuTipRender()) mbuTipHide(true); return; }
    mbuTipShow({ el: el, fn: fn, opts: o });
}
function mbuTipHtml(s) {
    if (mbuTipHtml.tt === undefined) {
        mbuTipHtml.tt = null;
        try {
            var tt = (typeof window !== 'undefined' && window.trustedTypes) || null;
            if (tt && tt.createPolicy) mbuTipHtml.tt = tt.createPolicy('mbu-tip-' + Math.random().toString(36).slice(2, 8), { createHTML: function (x) { return x; } });
        } catch (e) { /* the page allows no new policy: plain strings */ }
    }
    return mbuTipHtml.tt ? mbuTipHtml.tt.createHTML(String(s)) : String(s);
}
function mbuTipCss() {
    var s = document.getElementById('mbu-tip-css');
    if (s && +s.getAttribute('data-v') >= mbuTipV()) return;
    if (!s) { s = document.createElement('style'); s.id = 'mbu-tip-css'; (document.head || document.documentElement).appendChild(s); }
    s.setAttribute('data-v', String(mbuTipV()));
    s.textContent = mbuTipCssText();
}
function mbuTipEl() {
    var t = document.getElementById('mbu-tip');
    if (!t) {
        t = document.createElement('div');
        t.id = 'mbu-tip';
        t.setAttribute('role', 'tooltip');
        (document.body || document.documentElement).appendChild(t);
    }
    // Falcon's panel, Group Therapy's menus and others sit at the top z-index too; at an equal one
    // the later element is drawn over, so the tip moves to the end of the page when it is not there
    // (majkinetor, with a screenshot: Falcon's panel over a tip)
    var host = t.parentNode;
    if (host && host.lastElementChild !== t) host.appendChild(t);
    return t;
}
function mbuTipFind(node) {
    var _mbuTip = mbuTipS();
    var tip = document.getElementById('mbu-tip');
    for (var el = node && node.nodeType === 1 ? node : node && node.parentElement; el && el !== document.documentElement; el = el.parentElement) {
        if (el === tip) return null;
        var reg = _mbuTip.els && _mbuTip.els.get(el);
        if (reg) return { el: el, fn: reg.fn, opts: reg.opts };
        for (var i = 0; i < _mbuTip.prov.length; i++) {
            var p = _mbuTip.prov[i];
            try { if (el.matches(p.sel)) return { el: el, fn: p.fn, opts: p.opts }; } catch (e) { /* a bad selector matches nothing */ }
        }
        if (!_mbuTip.lead) continue;
        if (el.hasAttribute('data-mbu-tip-own')) return null;   // another copy's rich tip
        if (el.hasAttribute('data-tip')) return { el: el, opts: { place: el.getAttribute('data-tip-place'), wide: el.hasAttribute('data-tip-wide') } };
        // an <option> keeps its title: the browser draws a dropdown's list, where no page tooltip reaches
        if (el.hasAttribute('title') && el.getAttribute('title') && el.namespaceURI === 'http://www.w3.org/1999/xhtml' && !/^(OPTION|OPTGROUP)$/.test(el.tagName)) {
            var root = null;
            try { root = el.closest(mbuTipRoots()); } catch (e) { /* no roots */ }
            if (root) {
                el.setAttribute('data-tip', el.getAttribute('title'));
                el.removeAttribute('title');
                return { el: el, opts: {} };
            }
        }
    }
    return null;
}
function mbuTipRender() {
    var _mbuTip = mbuTipS();
    var a = _mbuTip.cur, o = _mbuTip.curOpts || {}, t = mbuTipEl(), c;
    if (!a) return false;
    if (o.fn) {
        try { c = o.fn(a); } catch (e) { c = null; }
        if (c == null || c === '') return false;
        if (typeof c === 'string') t.innerHTML = mbuTipHtml(c);
        else { t.textContent = ''; t.appendChild(c); }
    } else {
        var s = a.getAttribute('data-tip');
        if (!s) return false;
        var h = mbuTipText(s);
        t.innerHTML = mbuTipHtml(h);
        // an element with nothing to read of its own is named by its tip
        if (!a.getAttribute('aria-label') && !/[\p{L}\p{N}]/u.test(a.textContent || '') && !a.querySelector('img[alt]:not([alt=""])')) {
            a.setAttribute('aria-label', s.split('\n')[0]);
        }
    }
    t.className = 'mbu-ui' + (o.card ? ' mbu-tip-card' : '') + (o.interactive ? ' mbu-tip-act' : '') + (o.wide ? ' mbu-tip-wide' : '');
    t.setAttribute('data-owner', _mbuTip.me);
    mbuTipPlace(t, a, o.place);
    return true;
}
function mbuTipPlace(t, a, place) {
    var _mbuTip = mbuTipS();
    var r = a.getBoundingClientRect();
    if (!r.width && !r.height && a.firstElementChild) r = a.firstElementChild.getBoundingClientRect();
    t.style.left = '0px'; t.style.top = '0px';
    var w = t.offsetWidth, h = t.offsetHeight, vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight, gap = 8, m = 6;
    var below = place !== 'above';
    if (below && r.bottom + gap + h > vh - m && r.top - gap - h >= m) below = false;
    else if (!below && r.top - gap - h < m && r.bottom + gap + h <= vh - m) below = true;
    var top = below ? r.bottom + gap : r.top - gap - h;
    // a wide element (a row, a long field): the arrow points where the pointer is
    var cx = r.left + r.width / 2;
    if (r.width > 220 && _mbuTip.mx >= r.left && _mbuTip.mx <= r.right) cx = _mbuTip.mx;
    var left = Math.max(m, Math.min(vw - w - m, Math.round(cx - w / 2)));
    t.style.left = left + 'px';
    t.style.top = Math.max(m, Math.round(top)) + 'px';
    t.style.setProperty('--mbu-tip-ax', Math.max(12, Math.min(w - 12, Math.round(cx - left))) + 'px');
    t.classList.toggle('mbu-tip-up', !below);
}
function mbuTipShow(found) {
    var _mbuTip = mbuTipS();
    clearTimeout(_mbuTip.hideT); clearTimeout(_mbuTip.showT);
    if (_mbuTip.cur && _mbuTip.cur !== found.el) mbuTipHide(true);
    mbuTipCss();
    _mbuTip.cur = found.el;
    _mbuTip.curOpts = { fn: found.fn, interactive: !!found.opts.interactive, card: !!found.opts.card, wide: !!found.opts.wide, place: found.opts.place };
    if (!mbuTipRender()) { _mbuTip.cur = null; return; }
    var t = mbuTipEl();
    found.el.setAttribute('aria-describedby', 'mbu-tip');
    // next frame, so the transition runs from the hidden state
    requestAnimationFrame(function () { if (_mbuTip.cur === found.el) t.classList.add('mbu-tip-on'); });
    // the element can go (a re-render) or change its text while the tip is up
    clearInterval(_mbuTip.liveT);
    _mbuTip.liveT = setInterval(function () { if (!_mbuTip.cur || !_mbuTip.cur.isConnected) mbuTipHide(true); }, 300);
    try {
        if (!_mbuTip.obs) _mbuTip.obs = new MutationObserver(function () { if (_mbuTip.cur && !mbuTipRender()) mbuTipHide(true); });
        _mbuTip.obs.disconnect();
        if (!found.fn) _mbuTip.obs.observe(found.el, { attributes: true, attributeFilter: ['data-tip'] });
    } catch (e) { /* no observer: the text is read again on the next hover */ }
}
function mbuTipHide(now) {
    var _mbuTip = mbuTipS();
    clearTimeout(_mbuTip.showT); clearTimeout(_mbuTip.hideT);
    _mbuTip.pend = null;
    var hide = function () {
        var a = _mbuTip.cur;
        if (!a) return;
        _mbuTip.cur = null;
        clearInterval(_mbuTip.liveT);
        try { if (_mbuTip.obs) _mbuTip.obs.disconnect(); } catch (e) { /* gone */ }
        if (a.getAttribute('aria-describedby') === 'mbu-tip') a.removeAttribute('aria-describedby');
        var t = document.getElementById('mbu-tip');
        if (t && t.getAttribute('data-owner') === _mbuTip.me) t.classList.remove('mbu-tip-on');
        _mbuTip.warm = Date.now();
    };
    if (now) hide();
    else _mbuTip.hideT = setTimeout(hide, _mbuTip.curOpts && _mbuTip.curOpts.interactive ? 220 : 70);
}
function mbuTipStart() {
    if (mbuTipStart.done || typeof document === 'undefined') return;
    var _mbuTip = mbuTipS();
    var root = document.documentElement;
    if (!root) { document.addEventListener('DOMContentLoaded', mbuTipStart, { once: true }); return; }
    mbuTipStart.done = true;
    if (!root.hasAttribute('data-mbu-tip')) { root.setAttribute('data-mbu-tip', _mbuTip.me); _mbuTip.lead = true; }
    var inTip = function (n) { var t = document.getElementById('mbu-tip'); return !!(t && n && t.contains(n)); };
    window.addEventListener('mousemove', function (e) { _mbuTip.mx = e.clientX; _mbuTip.my = e.clientY; }, { passive: true, capture: true });
    window.addEventListener('mouseover', function (e) {
        _mbuTip.mx = e.clientX; _mbuTip.my = e.clientY; _mbuTip.over = e.target;   // :hover can read false in a page that has not seen a real move
        if (inTip(e.target)) { if (_mbuTip.cur) clearTimeout(_mbuTip.hideT); return; }
        var f = mbuTipFind(e.target);
        if (!f) { if (_mbuTip.cur && !_mbuTip.cur.contains(e.target)) mbuTipHide(); return; }
        if (f.el === _mbuTip.cur) { clearTimeout(_mbuTip.hideT); return; }
        if (f.el === _mbuTip.quiet || (_mbuTip.pend && _mbuTip.pend.el === f.el)) return;
        clearTimeout(_mbuTip.showT);
        _mbuTip.pend = f;
        var warm = _mbuTip.cur || Date.now() - _mbuTip.warm < 450;
        _mbuTip.showT = setTimeout(function () {
            _mbuTip.pend = null;
            if (f.el.isConnected && f.el.contains(_mbuTip.over)) mbuTipShow(f);
        }, warm ? 40 : (f.opts.delay != null ? f.opts.delay : 350));
    }, true);
    window.addEventListener('mouseout', function (e) {
        var to = e.relatedTarget;
        var q = _mbuTip.quiet;
        if (q && q.contains(e.target) && !(to && q.contains(to))) _mbuTip.quiet = null;
        var p = _mbuTip.pend;
        if (p && p.el.contains(e.target) && !(to && p.el.contains(to))) { clearTimeout(_mbuTip.showT); _mbuTip.pend = null; }
        var a = _mbuTip.cur;
        if (!a) return;
        if (to && (a.contains(to) || (_mbuTip.curOpts.interactive && inTip(to)))) return;
        if (a.contains(e.target) || inTip(e.target)) mbuTipHide();
    }, true);
    window.addEventListener('mousedown', function (e) {
        if (inTip(e.target)) return;
        clearTimeout(_mbuTip.showT); _mbuTip.pend = null;
        var f = mbuTipFind(e.target);
        _mbuTip.quiet = f ? f.el : null;   // no tip again on the element just clicked until the pointer leaves it
        _mbuTip.tab = false;
        if (_mbuTip.cur) mbuTipHide(true);
    }, true);
    document.addEventListener('keydown', function (e) {
        if (!/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) _mbuTip.tab = e.key === 'Tab';
        if (!_mbuTip.cur) return;
        var interactive = _mbuTip.curOpts && _mbuTip.curOpts.interactive;
        // typing closes a plain tip, as it does the browser's; modifiers alone don't
        if (e.key !== 'Escape') { if (!interactive && !/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) mbuTipHide(true); return; }
        mbuTipHide(true);
        if (interactive) e.stopPropagation();   // a card is a popover: Esc closes it and nothing else
    }, true);
    window.addEventListener('scroll', function (e) { if (_mbuTip.cur && !inTip(e.target)) mbuTipHide(true); }, true);
    window.addEventListener('blur', function () { if (_mbuTip.cur) mbuTipHide(true); });
    document.addEventListener('focusin', function (e) {
        var el = e.target, vis = false;
        try { vis = el.matches(':focus-visible'); } catch (x) { /* old browser */ }
        // a text box is :focus-visible even when a script focuses it (a picker opening), so only Tab's focus shows the tip
        if (!vis || !_mbuTip.tab) return;
        var f = mbuTipFind(el);
        if (f && f.el === el) { clearTimeout(_mbuTip.showT); _mbuTip.showT = setTimeout(function () { if (document.activeElement === el) mbuTipShow(f); }, 150); }
    }, true);
    document.addEventListener('focusout', function (e) {
        if (_mbuTip.cur && _mbuTip.cur === e.target && !(e.relatedTarget && inTip(e.relatedTarget))) mbuTipHide();
    }, true);
}
mbuTipStart();
// </ST-UI>

// <ST-ARCHIVE> — generated by dev/archive/sync-archive.mjs from dev/archive/wayback.mjs — DO NOT EDIT
const MBA_KEY = "mbu.archive";
function mbaTs(d) { return (d || new Date()).toISOString().replace(/[^0-9]/g, '').slice(0, 14); }
function mbaShort(url) { return String(url).replace(/^https?:\/\//i, '').replace(/^www\./i, ''); }
function mbaSnapshot(ts, url) { return 'https://web.archive.org/web/' + ts + '/' + mbaShort(url); }
function mbaCleanUrl(href) {
    const [base, query = ''] = String(href).split('#')[0].split(/\?(.*)/s);
    const kept = query.split('&').filter(p => p && !/^(si|utm_\w+|fbclid|gclid|ref|from|context|nd|feature|redirected)$/i.test(decodeURIComponent(p.split('=')[0].replace(/\+/g, ' '))));
    return base + (kept.length ? '?' + kept.join('&') : '');
}
function mbaSavable(url) {
    const d = String(url).match(/^https?:\/\/(?:www\.)?discogs\.com\/(?:[a-z]{2}\/)?(release|master|artist|label)\/(\d+)(?:[-/?#]|$)/i);
    return d ? `https://api.discogs.com/${d[1].toLowerCase()}s/${d[2]}` : url;
}
function mbaKeys() {
    let v = null;
    try { v = GM_getValue(MBA_KEY, null); } catch (e) { /* no storage: anonymous */ }
    return v && v.iaKey && v.iaSecret ? { key: v.iaKey, secret: v.iaSecret } : null;
}
function mbaKeysStored() {
    let v = null;
    try { v = GM_getValue(MBA_KEY, null); } catch (e) { /* no storage */ }
    return { iaKey: (v && v.iaKey) || '', iaSecret: (v && v.iaSecret) || '' };
}
function mbaSetKeys(iaKey, iaSecret) {
    const prev = (() => { try { return GM_getValue(MBA_KEY, null) || {}; } catch (e) { return {}; } })();
    GM_setValue(MBA_KEY, Object.assign({}, prev, { iaKey: String(iaKey || '').trim(), iaSecret: String(iaSecret || '').trim() }));
}
function mbaSaveAnon(url, log) {
    const t0 = Date.now(), wait = 180000;
    return new Promise(resolve => {
        GM_xmlhttpRequest({
            method: 'GET', url: 'https://web.archive.org/save/' + url, timeout: wait, anonymous: true,
            headers: { Accept: 'text/html' },
            onload: r => {
                const snap = /\/web\/\d{14}\//.test(r.finalUrl || '') ? r.finalUrl : null;
                const ms = Date.now() - t0;
                if (r.status >= 200 && r.status < 300 && snap) log.ok(`archive: saved ${url} → ${snap} (${ms} ms)`);
                else if (r.status === 429) log.warn(`archive: ${url} not saved: Save Page Now is limiting anonymous saves (HTTP 429). archive.org keys in the settings raise the limit`);
                else log.warn(`archive: ${url} → HTTP ${r.status}${snap ? '' : ', no snapshot in the answer'} (${ms} ms)${r.finalUrl ? ', ended at ' + r.finalUrl : ''}`);
                resolve();
            },
            onerror: () => { log.warn(`archive: network error saving ${url}`); resolve(); },
            ontimeout: () => { log.warn(`archive: no answer for ${url} in ${wait / 60000} minutes (the save may still finish)`); resolve(); },
        });
    });
}
function mbaRequest(method, url, auth, body) {
    return new Promise(resolve => {
        GM_xmlhttpRequest({
            method, url, data: body, timeout: 30000, anonymous: true,
            headers: Object.assign({ Accept: 'application/json', Authorization: 'LOW ' + auth }, body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
            onload: r => { let j = null; try { j = JSON.parse(r.responseText || 'null'); } catch (e) { /* not JSON */ } resolve({ status: r.status, json: j, text: r.responseText || '' }); },
            onerror: () => resolve({ status: 0, json: null, text: 'network error' }),
            ontimeout: () => resolve({ status: 0, json: null, text: 'timeout' }),
        });
    });
}
async function mbaSaveWithKeys(url, keys, log, follow) {
    const auth = keys.key + ':' + keys.secret, wait = 180000;
    const body = new URLSearchParams({ url, if_not_archived_within: '30d', capture_screenshot: '1' }).toString();
    const r = await mbaRequest('POST', 'https://web.archive.org/save', auth, body);
    log.debug(`archive: POST /save ${url} → HTTP ${r.status} ${r.text.slice(0, 300)}`);
    if (r.status === 401 || r.status === 403) { log.warn(`archive: archive.org refused your keys (HTTP ${r.status}); check them in the settings`); return; }
    const job = r.json && r.json.job_id;
    if (!job) {
        const msg = (r.json && (r.json.message || r.json.status_ext)) || r.text.slice(0, 200) || 'no answer';
        if (r.status === 200 && /archived|already/i.test(msg)) log.ok(`archive: ${url} has a recent snapshot, not saved again (${msg})`);
        else log.warn(`archive: ${url} not saved (HTTP ${r.status}: ${msg})`);
        return;
    }
    log.info(`archive: ${url} queued as job ${job}`);
    if (!follow) return;
    const t0 = Date.now();
    while (Date.now() - t0 < wait) {
        await new Promise(res => setTimeout(res, 6000));
        const st = await mbaRequest('GET', 'https://web.archive.org/save/status/' + encodeURIComponent(job), auth);
        const j = st.json || {};
        log.debug(`archive: job ${job} → HTTP ${st.status}, ${j.status || '?'}`);
        if (j.status === 'pending') continue;
        if (j.status === 'success') log.ok(`archive: saved ${url} → https://web.archive.org/web/${j.timestamp}/${j.original_url || url}${j.screenshot ? ', screenshot ' + j.screenshot : ''} (${Date.now() - t0} ms)`);
        else log.warn(`archive: job ${job} for ${url} ended ${j.status || 'HTTP ' + st.status}: ${j.message || j.status_ext || st.text.slice(0, 200)}`);
        return;
    }
    log.info(`archive: job ${job} for ${url} still running after ${wait / 60000} minutes; archive.org finishes it on its side`);
}
async function mbaSave(url, log, follow) {
    const keys = mbaKeys();
    try { await (keys ? mbaSaveWithKeys(url, keys, log, follow) : mbaSaveAnon(url, log)); } catch (e) { log.warn(`archive: ${url}: ${e && e.message || e}`); }
}
function mbaKeysState(k, s) {
    k = String(k || '').trim(); s = String(s || '').trim();
    return k && s ? '✓ set' : k ? 'secret missing' : s ? 'access key missing' : 'not set';
}
function mbaKeysHtml(off) {
    const k = mbaKeysStored(), q = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    // no password-manager icon in the fields: they opt out by attribute (LastPass, 1Password,
    // Bitwarden, Dashlane), and the secret is a text field masked in CSS, since type=password draws every manager in
    const opt = 'autocomplete="off" data-lpignore="true" data-1p-ignore data-bwignore data-form-type="other" spellcheck="false"';
    return `<div class="mbu-ia${off ? ' mbu-ia-off' : ''}" data-tip="archive.org keys: optional, shared by First Contact and Apollo Editor\nWith them the save uses Save Page Now 2: higher limits, and a screenshot of the page, the evidence for platforms that build their pages in the browser (Spotify, Tidal, YouTube Music).\nWithout them the save is anonymous.">`
        + `<div class="mbu-ia-h">archive.org keys <span class="mbu-ia-st">${mbaKeysState(k.iaKey, k.iaSecret)}</span> <a href="https://archive.org/account/s3.php" target="_blank" rel="noopener">get them</a></div>`
        + `<input type="text" class="mbu-ia-key" placeholder="access key" ${opt} value="${q(k.iaKey)}">`
        + `<input type="text" class="mbu-ia-secret" placeholder="secret" ${opt} value="${q(k.iaSecret)}"></div>`;
}
function mbaKeysWire(root, log) {
    const key = root.querySelector('.mbu-ia-key'), secret = root.querySelector('.mbu-ia-secret'), st = root.querySelector('.mbu-ia-st');
    if (!key || !secret) return;
    const save = () => {
        mbaSetKeys(key.value, secret.value);
        if (st) { st.textContent = mbaKeysState(key.value, secret.value); st.classList.toggle('mbu-ia-ok', !!(key.value.trim() && secret.value.trim())); }
    };
    const logged = () => log.info(`archive.org keys: ${mbaKeysState(key.value, secret.value)}`);
    for (const f of [key, secret]) { f.addEventListener('input', save); f.addEventListener('change', logged); }
    if (st) st.classList.toggle('mbu-ia-ok', !!(key.value.trim() && secret.value.trim()));
}
function mbaKeysCss(scope) {
    const s = scope + ' .mbu-ia';
    return `${s} { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 6px; }
${s}.mbu-ia-off { opacity: .5; }
${s} .mbu-ia-secret { -webkit-text-security: disc; }
${s} .mbu-ia-h { grid-column: 1 / -1; color: var(--mbu-text-weak); }
${s} .mbu-ia-h a { color: var(--mbu-accent-text); margin-left: 4px; }
${s} .mbu-ia-st { margin-left: 4px; }
${s} .mbu-ia-st.mbu-ia-ok { color: var(--mbu-ok); }
${s} input { all: revert; box-sizing: border-box; width: 100%; min-width: 0; font: 12px var(--mbu-font-mono, monospace);
  padding: 3px 6px; border: 1px solid var(--mbu-border); border-radius: 4px; background: var(--mbu-bg-sunken); color: var(--mbu-text); }
${s} input::placeholder { color: var(--mbu-text-weak); opacity: 1; font-style: normal; }
`;
}
// </ST-ARCHIVE>

try {
    // a provider that must hear the player's own requests hooks them now, before the page's scripts run
    const early = !ON_MB && PROVIDERS.find(p => p.early && p.host.test(location.hostname));
    if (early) early.early();
    if (ON_MB) mbMain();
    else if (document.body) platformMain();
    else document.addEventListener('DOMContentLoaded', platformMain, { once: true });
} catch (e) {
    try { Log.err(`startup: ${e.stack || e.message}`); } catch (_) { /* nothing left to log with */ }
}
if (mbuTestHooks()) window.__fcTest = { mcRead, splitFeat, creditFromTitle, seedParams, editNoteFor, guessScript, splitLabels, providers: PROVIDERS, importCurrent, finishRelease, relWithForms, handoffFromMc, consolidateCurrent };

})();
