// ==UserScript==
// @name         First Contact
// @namespace    https://musicbrainz.org/
// @version      2026.10.1.212428
// @description  Import a release into MusicBrainz from the platform's album page with one click: the release editor opens with the title, tracklist, artists, date, label, barcode and link filled in. Each artist's platform link is handed to Apollo Editor for matching. Platforms: Deezer, Bandcamp, Discogs, Apple Music, Tidal, Qobuz, Beatport, Spotify, YouTube Music, Volumo, HDtracks, SoundCloud.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPHRpdGxlPkZpcnN0IENvbnRhY3Q8L3RpdGxlPgogIDwhLS0gdHJhY3RvciBiZWFtIC0tPgogIDxwYXRoIGQ9Ik01MCA0NCBMNzggNDQgTDEwNCAxMTIgTDI0IDExMiBaIiBmaWxsPSIjZjZjNDMxIiBvcGFjaXR5PSIwLjkiLz4KICA8cGF0aCBkPSJNNTYgNDQgTDcyIDQ0IEw4OCAxMTIgTDQwIDExMiBaIiBmaWxsPSIjZmRlNjhhIiBvcGFjaXR5PSIwLjciLz4KICA8IS0tIGxhbmRpbmcgcmluZyAtLT4KICA8ZWxsaXBzZSBjeD0iNjQiIGN5PSIxMTQiIHJ4PSI0MiIgcnk9IjgiIGZpbGw9IiMxZTIzNDYiIHN0cm9rZT0iI2M5Y2RmMiIgc3Ryb2tlLXdpZHRoPSIzIi8+CiAgPGVsbGlwc2UgY3g9IjY0IiBjeT0iMTEzIiByeD0iMjYiIHJ5PSI0LjIiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2Y2YzQzMSIgc3Ryb2tlLXdpZHRoPSIyLjQiLz4KICA8IS0tIHNhdWNlcjogYSBwYWxlIHJpbSwgc28gaXQgc2hvd3Mgb24gYSBkYXJrIGJhY2tncm91bmQgdG9vIC0tPgogIDxwYXRoIGQ9Ik00MCAyNiBBMjQgMTggMCAwIDEgODggMjYgWiIgZmlsbD0iIzFlMjM0NiIgc3Ryb2tlPSIjYzljZGYyIiBzdHJva2Utd2lkdGg9IjMiLz4KICA8cGF0aCBkPSJNNTAgMTggQTEwIDYgMCAwIDEgNjAgMTQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIyLjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxlbGxpcHNlIGN4PSI2NCIgY3k9IjMyIiByeD0iNTYiIHJ5PSIxMyIgZmlsbD0iIzFlMjM0NiIgc3Ryb2tlPSIjYzljZGYyIiBzdHJva2Utd2lkdGg9IjMiLz4KICA8Y2lyY2xlIGN4PSIzOCIgY3k9IjMyIiByPSI0LjQiIGZpbGw9IiNmZmYiLz4KICA8Y2lyY2xlIGN4PSI2NCIgY3k9IjM0IiByPSI0LjQiIGZpbGw9IiNmZmYiLz4KICA8Y2lyY2xlIGN4PSI5MCIgY3k9IjMyIiByPSI0LjQiIGZpbGw9IiNmZmYiLz4KICA8IS0tIHRoZSByZWxlYXNlIGJlaW5nIGJlYW1lZCB1cDogYSBwdXJwbGUgaGV4YWdvbiB3aXRoIGEgbm90ZSAtLT4KICA8cGF0aCBkPSJNNjQgNTggTDg0IDY5LjUgTDg0IDkyLjUgTDY0IDEwNCBMNDQgOTIuNSBMNDQgNjkuNSBaIiBmaWxsPSIjN2I0ZmQ2Ii8+CiAgPHBhdGggZD0iTTY0IDU4IEw4NCA2OS41IEw2NCA4MSBMNDQgNjkuNSBaIiBmaWxsPSIjOWI3MmVhIi8+CiAgPHBhdGggZD0iTTYwIDcyIEw3NCA2OSBMNzQgODkiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIzLjQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICA8cGF0aCBkPSJNNjAgNzIgTDYwIDkyIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMy40Ii8+CiAgPGVsbGlwc2UgY3g9IjU2IiBjeT0iOTIiIHJ4PSI0LjYiIHJ5PSIzLjYiIGZpbGw9IiNmZmYiLz4KICA8ZWxsaXBzZSBjeD0iNzAiIGN5PSI4OSIgcng9IjQuNiIgcnk9IjMuNiIgZmlsbD0iI2ZmZiIvPgogIDwhLS0gc3BhcmtsZXMgLS0+CiAgPHBhdGggZD0iTTE4IDU0IGwyLjUgNiA2IDIuNSAtNiAyLjUgLTIuNSA2IC0yLjUgLTYgLTYgLTIuNSA2IC0yLjUgWiIgZmlsbD0iI2Y2YzQzMSIvPgogIDxwYXRoIGQ9Ik0xMDggNTIgbDIuNSA2IDYgMi41IC02IDIuNSAtMi41IDYgLTIuNSAtNiAtNiAtMi41IDYgLTIuNSBaIiBmaWxsPSIjMWUyMzQ2Ii8+CiAgPHBhdGggZD0iTTExMiA4MiBsMS44IDQuMiA0LjIgMS44IC00LjIgMS44IC0xLjggNC4yIC0xLjggLTQuMiAtNC4yIC0xLjggNC4yIC0xLjggWiIgZmlsbD0iI2Y2YzQzMSIvPgogIDxwYXRoIGQ9Ik0xNCA4NiBsMS44IDQuMiA0LjIgMS44IC00LjIgMS44IC0xLjggNC4yIC0xLjggLTQuMiAtNC4yIC0xLjggNC4yIC0xLjggWiIgZmlsbD0iIzFlMjM0NiIvPgo8L3N2Zz4K
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
// @match        https://volumo.com/*
// @match        https://www.hdtracks.com/*
// @match        https://soundcloud.com/*
// @match        https://*.musicbrainz.org/release/add*
// @noframes
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        unsafeWindow
// @connect      api.deezer.com
// @connect      api.discogs.com
// @connect      music.apple.com
// @connect      amp-api.music.apple.com
// @connect      auth.tidal.com
// @connect      openapi.tidal.com
// @connect      api.beatport.com
// @connect      api-partner.spotify.com
// @connect      music.youtube.com
// @connect      volumo.com
// @connect      hdtracks.azurewebsites.net
// @connect      soundcloud.com
// @connect      a-v2.sndcdn.com
// @connect      api-v2.soundcloud.com
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
const HANDOFF_TTL_MS = 24 * 3600 * 1000;
const SERVERS = ['musicbrainz.org', 'beta.musicbrainz.org', 'test.musicbrainz.org'];

/* ── activity log: the shared window and buffer (mbuLog, in the ST-UI block below) ── */
const Log = mbuLog({ name: NAME, version: VERSION, header: NAME + ' — activity log', key: 'fc.logwin', before: () => injectStyle() });
Log.info(mbuStartupInfo(NAME));
mbuToast.log = (kind, msg) => (kind === 'warn' ? Log.warn(msg) : kind === 'ok' ? Log.ok(msg) : Log.info(msg));

function settings() {
    const s = Object.assign({ server: 'musicbrainz.org', annotation: false, iconOnly: false }, GM_getValue('fc.settings', {}));
    if (!SERVERS.includes(s.server)) s.server = 'musicbrainz.org';
    return s;
}
function saveSettings(s) { GM_setValue('fc.settings', s); }

/* ── network ─────────────────────────────────────────────────────────────── */

// A GET through the manager (no CORS): the response text, or throws. `headers` add to the request;
// an error carries the HTTP status (`e.status`) for a caller that retries on one.
function gmText(url, headers) {
    const t0 = Date.now();
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET', url, headers: Object.assign({ Accept: 'application/json' }, headers || {}), timeout: 20000, anonymous: true,
            onload: r => {
                Log.debug(`GET ${url} → ${r.status}, ${(r.responseText || '').length} b in ${Date.now() - t0} ms`);
                if (r.status < 200 || r.status >= 300) return reject(Object.assign(new Error(`HTTP ${r.status} for ${url}`), { status: r.status }));
                resolve(r.responseText || '');
            },
            onerror: () => reject(new Error(`network error for ${url}`)),
            ontimeout: () => reject(new Error(`timeout for ${url}`)),
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
            onerror: () => reject(new Error(`network error for ${url}`)),
            ontimeout: () => reject(new Error(`timeout for ${url}`)),
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
    const tracks = [].concat(...rel.mediums.map(m => m.tracks));
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

/* ── providers ───────────────────────────────────────────────────────────────
   One object per platform. Kept deliberately thin: recognise the album page, fetch the
   release and return it in First Contact's model. Everything MusicBrainz-specific (the
   seed, the handoff) is shared code below; matching is Apollo's.

   Model:
     { source, url, title, credit:[Credit], types:[primary, ...secondary], status, packaging,
       date:{year,month,day}, country, barcode, labels:[{name, catno}], urls:[{url, linkType}],
       mediums:[{ format, name, tracks:[{ title, lengthMs, isrc, url, credit:[Credit] }] }] }
     Credit = { name, url?, mbid?, join }
*/

const DEEZER = {
    id: 'deezer',
    name: 'Deezer',
    host: /^www\.deezer\.com$/,
    albumId(loc) { const m = loc.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?album\/(\d+)\/?$/i); return m ? m[1] : null; },
    albumUrl: id => `https://www.deezer.com/album/${id}`,
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
    host: /(^|\.)bandcamp\.com$/,
    albumId(loc) { return /^\/album\/[^/]+\/?$/.test(loc.pathname) ? loc.pathname.replace(/\/$/, '') : null; },
    VARIOUS: /^various( artists)?$/i,

    // a "04 Mar 2011 00:00:00 GMT" date, read in UTC
    date(s) {
        const d = s ? new Date(s) : null;
        return d && !isNaN(d) ? { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() } : { year: null, month: null, day: null };
    },

    async fetchRelease(path, progress) {
        const tEl = document.querySelector('script[data-tralbum]');
        if (!tEl) throw new Error('Bandcamp: no album data on this page (tralbum)');
        const t = JSON.parse(tEl.dataset.tralbum);
        let ld = null;
        try { ld = JSON.parse((document.querySelector('script[type="application/ld+json"]') || {}).textContent || 'null'); } catch (e) { Log.warn(`Bandcamp ld+json: ${e.message}`); }
        const cur = t.current || {};
        const url = (t.url || location.origin + path).replace(/^http:/, 'https:');
        const by = ld && ld.byArtist ? { name: ld.byArtist.name, url: ld.byArtist['@id'] || null } : null;
        const pub = ld && ld.publisher ? { name: ld.publisher.name, url: ld.publisher['@id'] || null } : null;
        const albumArtist = t.artist || cur.artist || (by && by.name) || '';
        Log.info(`Bandcamp album "${cur.title}" by ${albumArtist} · ${(t.trackinfo || []).length} track(s) · released ${t.album_release_date || cur.release_date} · UPC ${cur.upc || '—'} · by ${by ? by.name + ' ' + (by.url || '(no page)') : '—'} · publisher ${pub ? pub.name + ' ' + (pub.url || '') : '—'}${t.album_is_preorder ? ' · PREORDER' : ''}`);

        let band = null;
        try { band = JSON.parse((document.querySelector('script[data-band]') || {}).dataset?.band || 'null'); } catch (e) { Log.debug(`Bandcamp data-band: ${e.message}`); }
        // the account this page belongs to: an artist's own, or a label's
        const account = { name: (band && band.name) || (pub && pub.name) || '', url: (pub && pub.url) || location.origin };
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
    host: /^(www\.)?discogs\.com$/,
    albumId(loc) { const m = loc.pathname.match(/^\/(?:[a-z]{2}\/)?release\/(\d+)(?:-[^/]*)?\/?$/i); return m ? m[1] : null; },
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
        for (const t of r.tracklist || []) {
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
    host: /^music\.apple\.com$/,
    albumId(loc) {
        const m = loc.pathname.match(/^\/([a-z]{2})\/album\/(?:[^/]+\/)?(\d+)\/?$/i);
        return m ? `${m[1].toLowerCase()}/${m[2]}` : null;
    },
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

    async fetchRelease(key, progress) {
        const [sf, id] = key.split('/');
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
            mediums[disc - 1].tracks.push({ title: tf.title, lengthMs: x.durationInMillis || null, isrc: x.isrc || null, url: x.url || null, credit });
            progress && progress(i + 1, songs.length);
            Log.debug(`track ${disc}.${x.trackNumber}: "${tf.title}" — ${credit.map(c => c.name + c.join).join('')} (${x.isrc || 'no ISRC'})`);
        });

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
            urls: [{ url, linkType: 980 }],   // 980 = streaming page (paid)
            mediums,
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
        const root = new URL(path, location.origin);
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
        const url = location.origin + path;
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
    host: /^www\.beatport\.com$/,
    albumId(loc) { const m = loc.pathname.match(/^\/(?:[a-z]{2}\/)?release\/[^/]+\/(\d+)\/?$/i); return m ? m[1] : null; },
    TYPES: { Album: ['Album'], EP: ['EP'], Single: ['Single'], Compilation: ['Album', 'Compilation'] },
    url: (kind, x) => `https://www.beatport.com/${kind}/${x.slug || '-'}/${x.id}`,

    // the page's __NEXT_DATA__ when it is this release's, else the release page fetched anew
    async nextData(id, doc) {
        const read = d => { const el = d.querySelector('script#__NEXT_DATA__'); return el ? JSON.parse(el.textContent) : null; };
        const here = read(doc || document);
        const rel = here && here.props && here.props.pageProps && here.props.pageProps.release;
        if (rel && String(rel.id) === String(id)) { Log.debug('Beatport: the page\'s own data is this release\'s'); return here; }
        Log.info(`Beatport: the page's data is ${rel ? 'release ' + rel.id : 'not a release'}; fetching release ${id}`);
        const r = await fetch(`${location.origin}/release/-/${id}`, { credentials: 'include' });
        if (!r.ok) throw new Error(`Beatport: HTTP ${r.status} for release ${id}`);
        const got = read(new DOMParser().parseFromString(await r.text(), 'text/html'));
        if (!got) throw new Error('Beatport: no __NEXT_DATA__ on the release page (bot check?)');
        return got;
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
// replays the album query with what it heard. No ISRCs or barcode: the player doesn't have them.
const SPOTIFY = {
    id: 'spotify',
    name: 'Spotify',
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

    async fetchRelease(id, progress) {
        for (let i = 0; !this.auth && i < 50; i++) await new Promise(r => setTimeout(r, 100));
        Log.info(`Spotify: the hook saw ${this.seen} request(s) to Spotify's APIs; token ${this.auth ? 'heard' : 'not heard'}; album query id ${this.hash ? 'heard' : 'not heard, using the known one'}`);
        if (!this.auth) throw new Error(this.seen ? 'Spotify: the player\u2019s requests carried no token; reload the page and try again'
            : 'Spotify: no request of the player was heard. Your userscript manager may start First Contact too late on Spotify; reload the page, and if it persists, copy the log to #650');
        const hash = this.hash || this.GETALBUM_HASH;
        const page = offset => this.post({ variables: { uri: `spotify:album:${id}`, locale: '', offset, limit: 50 }, operationName: 'getAlbum', extensions: { persistedQuery: { version: 1, sha256Hash: hash } } });
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
        Log.info(`Spotify album ${id}: "${a.name}" by ${a.artists.items.map(x => x.profile.name).join(', ')} · ${a.type} · ${items.length} of ${a.tracksV2.totalCount} track(s) · ${a.date && a.date.isoString} (${a.date && a.date.precision}) · label "${a.label || ''}"`);

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
            barcode: null,
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
    host: /^music\.youtube\.com$/,
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

const PROVIDERS = [DEEZER, BANDCAMP, DISCOGS, APPLE, TIDAL, QOBUZ, BEATPORT, SPOTIFY, YTMUSIC, VOLUMO, HDTRACKS, SOUNDCLOUD];

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

function editNoteFor(rel, provider) {
    return `Imported from ${provider.name}: ${rel.url}\n\n${NAME} v${VERSION} by majkinetor - ${HOMEPAGE}`;
}

// What Apollo needs to match: every credited artist with its platform link, by position.
function handoffFor(rel, provider, token) {
    const ac = c => (c || []).map(a => ({ name: a.name, artistName: a.artistName || a.name, join: a.join, url: a.url || null, mbid: a.mbid || null }));
    return {
        v: 1,
        token,
        created: Date.now(),
        source: provider.id,
        sourceName: provider.name,
        url: rel.url,
        title: rel.title,
        barcode: rel.barcode,
        credit: ac(rel.credit),
        labels: (rel.labels || []).map(l => ({ name: l.name, catno: l.catno, url: l.url || null, mbid: l.mbid || null })),
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
    const tokens = ON_MB ? MBU_TOKENS : MBU_TOKENS.replace(/var\(--(?:background|text|border), ([^)]+)\)/g, '$1');
    st.textContent = tokens + MBU_UI_CSS + `
#fc-root { position: fixed; z-index: 2147483000; display: flex; gap: 0; font: 13px/1.3 system-ui, sans-serif;
  box-shadow: var(--mbu-shadow, 0 2px 10px rgba(0,0,0,.25)); border-radius: 8px; }
#fc-root button { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 12px; background: var(--mbu-bg); color: var(--mbu-text); border: 1px solid var(--mbu-border); }
#fc-root button:hover { background: var(--mbu-bg-hover); }
#fc-root button:focus-visible { outline: 2px solid var(--mbu-accent); outline-offset: -2px; }
#fc-root .fc-go { border-radius: 8px 0 0 8px; font-weight: 600; }
#fc-root .fc-more { border-radius: 0 8px 8px 0; border-left: none; min-width: 30px; justify-content: center; padding: 8px 10px; }
#fc-root .fc-go[aria-busy="true"] { cursor: progress; opacity: .85; }
#fc-root.fc-iconly .fc-go span { display: none; }
#fc-root.fc-iconly .fc-go[aria-busy="true"] span { display: inline; }   /* the progress still shows while it reads */
#fc-panel { position: fixed; z-index: 2147483001; min-width: 300px; background: var(--mbu-bg); color: var(--mbu-text);
  border: 1px solid var(--mbu-border); border-radius: 8px; box-shadow: var(--mbu-shadow, 0 4px 18px rgba(0,0,0,.3));
  font: 13px/1.4 system-ui, sans-serif; padding: 12px 14px; }
#fc-panel .mbu-cfg-ic svg { width: 22px; height: 22px; }
#fc-panel .fc-body { display: grid; gap: 8px; }
#fc-panel label { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
#fc-panel label.fc-check { justify-content: flex-start; gap: 6px; cursor: pointer; }
/* the browser's own checkbox, whatever the site's sheet says: qobuz.com's sets appearance:none
   in a rule only Firefox applies, and our checkboxes drew as nothing there (#650) */
#fc-panel input[type=checkbox] { all: revert; margin: 0; accent-color: var(--mbu-accent); cursor: pointer; }
/* native controls follow our theme, not the page's: qobuz.com declares color-scheme dark on a light page */
#fc-root, #fc-panel { color-scheme: light; }
:root[data-mbu-theme=dark] :is(#fc-root, #fc-panel) { color-scheme: dark; }
#fc-panel select { font: inherit; color: inherit; background: var(--mbu-bg); border: 1px solid var(--mbu-border); border-radius: 4px; padding: 2px 4px; }
#fc-panel a { color: var(--mbu-accent); }
`;
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
        more.title = 'Settings';
        more.setAttribute('aria-label', more.title);
        more.addEventListener('click', e => { e.stopPropagation(); togglePanel(more); });
        root.append(go, more);
        document.body.appendChild(root);
    }
    root.classList.toggle('fc-iconly', !!settings().iconOnly);   // majkinetor: an option to hide the button's text
    root.querySelector('.fc-go').title = `Import to MusicBrainz: open the release editor with this ${provider.name} release filled in`;
    root.style.display = '';
    mbRestackCorner('br');
    Log.debug(`button shown for ${provider.name} album ${id}`);
}

function unmountButton() {
    const root = document.getElementById('fc-root');
    if (root && root.style.display !== 'none') { root.style.display = 'none'; mbRestackCorner('br'); }
    const panel = document.getElementById('fc-panel');
    if (panel) panel.remove();
}

function togglePanel(anchor) {
    let panel = document.getElementById('fc-panel');
    if (panel) { panel.remove(); return; }
    const s = settings();
    panel = document.createElement('div');
    panel.id = 'fc-panel';
    panel.innerHTML = mbuHtml(mbuCfgHeader({ script: SCRIPT, name: NAME, version: VERSION, icon: ICON_SVG, log: true })
        + '<div class="fc-body"><label>MusicBrainz server <select class="fc-server">'
        + SERVERS.map(h => `<option value="${h}"${h === s.server ? ' selected' : ''}>${h}</option>`).join('')
        + '</select></label>'
        + `<label class="fc-check" title="The button shows only its icon; hover it for what it does"><input type="checkbox" class="fc-iconly-opt"${s.iconOnly ? ' checked' : ''}> Icon only</label>`
        + `<label class="fc-check" title="The album's notes on the platform (Bandcamp's about and credits, Discogs's notes, Qobuz's and Apple's reviews, Beatport's and YouTube Music's description), with a line saying where they come from. Reviews are the critic's text: check you may copy it before you submit."><input type="checkbox" class="fc-annotation"${s.annotation ? ' checked' : ''}> Annotation from the platform's notes</label>`
        + '</div>');
    document.body.appendChild(panel);
    const r = anchor.getBoundingClientRect();
    panel.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
    panel.style.bottom = Math.max(8, window.innerHeight - r.top + 8) + 'px';
    panel.querySelector('.mbu-cfg-log').addEventListener('click', () => Log.open());
    panel.querySelector('.fc-server').addEventListener('change', e => {
        const next = Object.assign(settings(), { server: e.target.value });
        saveSettings(next);
        Log.info(`server set to ${next.server}`);
    });
    panel.querySelector('.fc-iconly-opt').addEventListener('change', e => {
        const next = Object.assign(settings(), { iconOnly: e.target.checked });
        saveSettings(next);
        const root = document.getElementById('fc-root');
        if (root) { root.classList.toggle('fc-iconly', next.iconOnly); mbRestackCorner('br'); }
        Log.info(`button: ${next.iconOnly ? 'icon only' : 'icon and text'}`);
    });
    panel.querySelector('.fc-annotation').addEventListener('change', e => {
        const next = Object.assign(settings(), { annotation: e.target.checked });
        saveSettings(next);
        Log.info(`annotation from the platform's notes: ${next.annotation ? 'on' : 'off'}`);
    });
    mbuDismissOn(panel, () => panel.remove());
}

async function importCurrent() {
    if (busy || !current) return;
    const { provider, id } = current;
    const go = document.querySelector('#fc-root .fc-go');
    const label = go && go.querySelector('span');
    const server = settings().server;
    const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    // Open the target tab now, inside the click: a window opened after the fetches would be
    // a popup the browser blocks. The form posts into it once the data is in.
    const target = 'fc-' + token;
    const win = window.open('about:blank', target);
    Log.info(`import ${location.href}`);
    Log.info(`import ${provider.name} album ${id} → ${server} (token ${token}, tab ${win ? 'opened' : 'BLOCKED: posting in this tab'})`);
    busy = true;
    if (go) go.setAttribute('aria-busy', 'true');
    const t0 = Date.now();
    try {
        const rel = await provider.fetchRelease(id, (n, total) => { if (label) label.textContent = `Reading ${provider.name}… ${n}/${total}`; });
        {
            const tracks = [].concat(...rel.mediums.map(m => m.tracks));
            const g = guessReleaseType(rel.title, tracks);
            Log.info(`type: ${provider.name} says ${rel.types.join(' + ') || 'nothing'}; the guess is ${g.type || 'none'} (${g.why})`);
            // the platform's own type stands, unless it's a plain Album and the title says EP / Single
            if (g.type && (!rel.types.length || (g.explicit && rel.types[0] === 'Album' && g.type !== 'Album'))) {
                rel.types = [g.type].concat(rel.types.slice(1));
                Log.info(`type set to ${rel.types.join(' + ')}`);
            }
        }
        rel.labels = splitLabels(rel.labels);
        const va = variousArtistsWhy(rel);
        if (va) {
            Log.info(`release artist: Various Artists, not ${rel.credit.map(c => c.name + c.join).join('')} (${va})`);
            rel.credit = [{ name: 'Various Artists', mbid: VARIOUS_ARTISTS_MBID, join: '' }];
            if (!rel.types.includes('Compilation')) rel.types = (rel.types.length ? rel.types : ['Album']).concat('Compilation');
        }
        if (rel.annotation && settings().annotation) {
            rel.annotation += `\n\nFrom ${provider.name}: ${rel.url}`;
            Log.info(`annotation: ${rel.annotation.length} characters of ${provider.name}'s notes`);
        } else {
            if (rel.annotation) Log.info(`annotation: ${provider.name} has notes (${rel.annotation.length} characters); off in the settings`);
            rel.annotation = null;
        }
        rel.script = guessScript([rel.title].concat(...rel.mediums.map(m => m.tracks.map(t => t.title))));
        const nTracks = rel.mediums.reduce((n, m) => n + m.tracks.length, 0);
        Log.info(`release read in ${Date.now() - t0} ms: "${rel.title}" · ${rel.credit.map(c => c.name + c.join).join('')} · ${rel.mediums.length} medium(s), ${nTracks} track(s) · types ${rel.types.join('+') || '—'} · script ${rel.script || '—'}`);
        if (!nTracks) throw new Error(`${provider.name} returned no tracks`);

        pruneHandoffs();
        GM_setValue(HANDOFF_PREFIX + token, handoffFor(rel, provider, token));
        const params = seedParams(rel, editNoteFor(rel, provider));
        Log.debug(`seed: ${params.length} parameters`);
        if (mbuTestHooks()) window.__fcLastSeed = { token, server, params, rel };

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `https://${server}/release/add?first_contact=${token}`;
        form.target = win ? target : '_self';
        form.acceptCharset = 'UTF-8';
        form.style.display = 'none';
        for (const [k, v] of params) {
            const inp = document.createElement('input');
            inp.type = 'hidden'; inp.name = k; inp.value = v;
            form.appendChild(inp);
        }
        document.body.appendChild(form);
        form.submit();
        form.remove();
        Log.ok(`seeded ${server}/release/add with ${nTracks} track(s)`);
    } catch (e) {
        Log.err(`import failed: ${e.message}`);
        if (win) try { win.close(); } catch (_) { /* already gone */ }
        mbuToast(`✗ ${NAME}: ${e.message}`, { kind: 'warn', action: { label: 'Copy log', onClick: b => Log.copy(b) } });
    } finally {
        busy = false;
        if (go) go.removeAttribute('aria-busy');
        if (label) label.textContent = 'Import to MusicBrainz';
    }
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
        if (id) { if (document.body) mountButton(provider, id); }
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
    const token = new URLSearchParams(location.search).get('first_contact');
    if (!token) return;
    const h = GM_getValue(HANDOFF_PREFIX + token, null);
    if (!h) { Log.warn(`release editor opened with handoff ${token}, but it is not stored (expired, or another browser)`); return; }
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
const MBU_TOKENS = ':root{--mbu-bg:var(--background, #fff);--mbu-bg-raised:#faf9fe;--mbu-bg-raised:color-mix(in srgb, var(--mbu-bg) 96%, var(--mbu-accent));--mbu-bg-sunken:#f4f2f9;--mbu-bg-sunken:color-mix(in srgb, var(--mbu-bg) 94%, var(--mbu-text));--mbu-bg-hover:#f3eefe;--mbu-bg-hover:color-mix(in srgb, var(--mbu-bg) 91%, var(--mbu-accent));--mbu-text:var(--text, #222);--mbu-text-dim:#555;--mbu-text-dim:color-mix(in srgb, var(--mbu-text) 78%, var(--mbu-bg));--mbu-text-weak:#999;--mbu-text-weak:color-mix(in srgb, var(--mbu-text) 52%, var(--mbu-bg));--mbu-text-on-accent:#fff;--mbu-border:var(--border, #cfc6e6);--mbu-border-soft:#e2dcef;--mbu-border-strong:#9a8ccb;--mbu-border-strong:color-mix(in srgb, var(--mbu-border) 70%, var(--mbu-text));--mbu-divider:#eee;--mbu-divider:color-mix(in srgb, var(--mbu-bg) 92%, var(--mbu-text));--mbu-accent:#5f3ec0;--mbu-accent-hover:#4e329f;--mbu-accent-deep:#3b2c70;--mbu-accent-soft:#ece4ff;--mbu-accent-soft:color-mix(in srgb, var(--mbu-bg) 86%, var(--mbu-accent));--mbu-accent-fg:#fff;--mbu-accent-text:#5f3ec0;--mbu-accent-deep-text:#3b2c70;--mbu-ok:#1f9d6b;--mbu-ok:color-mix(in srgb, #1f9d6b 78%, var(--mbu-text));--mbu-ok-bg:#eef7f1;--mbu-ok-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-ok));--mbu-ok-border:#9bd3b6;--mbu-warn:#a05a00;--mbu-warn:color-mix(in srgb, #b4791f 78%, var(--mbu-text));--mbu-warn-bg:#fff7e6;--mbu-warn-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-warn));--mbu-warn-border:#f0c877;--mbu-error:#c0392b;--mbu-error:color-mix(in srgb, #d0473a 78%, var(--mbu-text));--mbu-error-bg:#fdecec;--mbu-error-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-error));--mbu-error-border:#e2a1a1;--mbu-info:#2f7fbf;--mbu-info:color-mix(in srgb, #3f8fd0 78%, var(--mbu-text));--mbu-info-bg:#eef4fb;--mbu-info-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-info));--mbu-info-border:#a9c8e6;--mbu-font:-apple-system,Segoe UI,Roboto,Arial,sans-serif;--mbu-font-mono:ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;--mbu-fs:14px;--mbu-fs-sm:12px;--mbu-fs-xs:11px;--mbu-radius:6px;--mbu-radius-lg:10px;--mbu-shadow:0 1px 5px rgba(60,40,110,.07);--mbu-shadow-lg:0 8px 30px rgba(40,20,80,.3);--mbu-z-panel:30;--mbu-z-pop:99998;--mbu-z-modal:2147483000;--mbu-z-modal-panel:2147483001}:root[data-mbu-theme="dark"]{--mbu-bg:#1e1b24;--mbu-text:#e9e5f2;--mbu-border:#3b3548;--mbu-accent-text:#b9a7f0;--mbu-accent-deep-text:#a493e0}:root[data-mbu-theme="dark"][data-mbu-seed="theme"]{--mbu-bg:var(--background, #1e1b24);--mbu-text:var(--text, #e9e5f2);--mbu-border:var(--border, #3b3548)}';
// </ST-TOKENS>

// <ST-UI> — generated by dev/ui/sync-ui.mjs from dev/ui/ui-components.mjs — DO NOT EDIT
const MBU_UI_CSS = '.mbu-help{font-size:12px;color:var(--mbu-accent-text);text-decoration:none;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);padding:1px 8px;white-space:nowrap;line-height:1.6;background:none}.mbu-help:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-accent);text-decoration:none}h4>.mbu-help,.mbu-cfg-h>.mbu-help{margin-left:8px;flex:0 0 auto;font-weight:normal}#mbu-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:var(--mbu-z-pop);background:var(--mbu-accent-deep);color:var(--mbu-text-on-accent);padding:10px 16px;border-radius:9px;font:13px/1.35 var(--mbu-font);box-shadow:var(--mbu-shadow-lg);opacity:0;transition:opacity .2s;pointer-events:none;max-width:80vw;text-align:center;white-space:pre-wrap}#mbu-toast.mbu-toast-on{opacity:1}#mbu-toast.mbu-toast-act{pointer-events:auto}#mbu-toast .mbu-toast-btn{margin-left:10px;padding:2px 9px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;font:inherit;cursor:pointer}#mbu-toast .mbu-toast-btn:hover{background:rgba(255,255,255,.18)}#mbu-toast.mbu-toast-ok{background:var(--mbu-ok)}#mbu-toast.mbu-toast-warn{background:var(--mbu-warn)}#mbu-toast.mbu-toast-error{background:var(--mbu-error)}.mbu-cfg-h{display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:0 0 9px;border-bottom:1px solid var(--mbu-border-soft);font:600 15px/1.3 var(--mbu-font);color:var(--mbu-text)}.mbu-cfg-ic{flex:0 0 auto;display:inline-flex;align-items:center;width:22px;height:22px}.mbu-cfg-ic img,.mbu-cfg-ic svg{width:22px;height:22px;object-fit:contain;display:block}.mbu-cfg-name{flex:0 0 auto;font-weight:700;color:var(--mbu-accent-text)}.mbu-cfg-ver{flex:0 0 auto;font:400 11px var(--mbu-font);color:var(--mbu-text-weak);white-space:nowrap}.mbu-cfg-sp{flex:1 1 auto;min-width:8px}.mbu-cfg-log{flex:0 0 auto;font:400 12px var(--mbu-font);color:var(--mbu-accent-text);cursor:pointer;background:none;border:1px solid transparent;border-radius:var(--mbu-radius);padding:1px 8px;line-height:1.6}.mbu-cfg-log:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-border)}#mbu-logpop{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:var(--mbu-z-modal);display:flex;flex-direction:column;width:min(720px,94vw);max-height:72vh;background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:11px;box-shadow:var(--mbu-shadow-lg);font:13px var(--mbu-font);color:var(--mbu-text);overflow:hidden}.mbu-logpop-h{display:flex;align-items:center;gap:8px;padding:10px 13px;border-bottom:1px solid var(--mbu-border-soft);color:var(--mbu-accent-text);cursor:move;user-select:none}.mbu-logpop-sp{margin-left:auto}.mbu-logpop-clear,.mbu-logpop-copy,.mbu-logpop-x,.mbu-logpop-min{font-size:12px;color:var(--mbu-accent-text);background:var(--mbu-bg-hover);border:1px solid var(--mbu-border);border-radius:5px;padding:2px 9px;cursor:pointer;font-family:inherit}.mbu-logpop-clear:hover,.mbu-logpop-copy:hover,.mbu-logpop-x:hover,.mbu-logpop-min:hover{background:var(--mbu-accent-soft)}#mbu-logpop.min .mbu-log-list,#mbu-logpop.min .mbu-logpop-clear,#mbu-logpop.min .mbu-logpop-copy,#mbu-logpop.min .mbu-logpop-x{display:none}#mbu-logpop.min{max-height:none;width:auto}#mbu-logpop.min .mbu-logpop-sp{display:none}.mbu-log-badge{color:var(--mbu-border-strong);font-size:11px}.mbu-log-list{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;padding:9px 13px;display:flex;flex-direction:column;gap:3px}.mbu-log-li{display:flex;gap:9px;white-space:pre-wrap;word-break:break-word}.mbu-log-t{color:var(--mbu-text-weak);flex:0 0 auto;font-variant-numeric:tabular-nums}.mbu-log-m{flex:1 1 auto;color:var(--mbu-text-dim)}#mbu-logpop .mbu-log-m a{color:var(--mbu-accent-text)}.mbu-log-ok .mbu-log-m{color:var(--mbu-ok)}.mbu-log-warn .mbu-log-m{color:var(--mbu-warn)}.mbu-log-error .mbu-log-m{color:var(--mbu-error)}.mbu-log-debug{opacity:.85}.mbu-log-debug .mbu-log-m{color:var(--mbu-text-weak)}.mbu-log-empty{color:var(--mbu-text-weak)}.mbu-ov{position:fixed;inset:0;z-index:var(--mbu-z-modal);background:rgba(15,12,28,.45);display:flex;align-items:center;justify-content:center;padding:24px}.mbu-ov-panel{background:var(--mbu-bg);color:var(--mbu-text);border-radius:var(--mbu-radius-lg);box-shadow:var(--mbu-shadow-lg);max-width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden}.mbu-ov-h{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--mbu-border-soft);font-weight:700}.mbu-ov-h .mbu-ov-title{flex:1 1 auto;min-width:0}.mbu-ov-x{flex:0 0 auto;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;cursor:pointer;color:var(--mbu-text-dim);background:none;border:none;border-radius:var(--mbu-radius)}.mbu-ov-x:hover{background:var(--mbu-bg-hover);color:var(--mbu-text)}.mbu-ov-body{flex:1 1 auto;overflow:auto;padding:14px 16px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) ::placeholder{color:var(--mbu-text-weak);opacity:1;font-style:italic}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :is(table,td,th,div,span,label)[style*=background]{color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:not(:where([type=checkbox],[type=radio],[type=range],[type=color],[type=file])),:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select{background:var(--mbu-bg-sunken);color:var(--mbu-text);border-color:var(--mbu-border)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select:focus-visible{outline:2px solid var(--mbu-accent);outline-offset:1px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :where(input[type=checkbox],input[type=radio],input[type=range]){accent-color:var(--mbu-accent)}:root[data-mbu-theme=dark] :where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color-scheme:dark;--invert-value:none;--invert:none}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) button{background-color:var(--mbu-bg-raised);color:var(--mbu-text);border-color:var(--mbu-border)}.mbu-compact .mbu-bt{display:none}';
// Help link markup. Every script's help link is this, pointing at its own README.
// `name` is the userscript folder, e.g. mbuHelpHref('art_station').
function mbuHelpHref(name) {
    return 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/' + name + '/README.md';
}
function mbuHelpHtml(name, label) {
    return '<a class="mbu-help" href="' + mbuHelpHref(name) + '" target="_blank" rel="noopener"'
        + ' title="open the README in a new tab">' + (label || '? Help') + '</a>';
}
function mbuHelpEl(name, label) {
    var a = document.createElement('a');
    a.className = 'mbu-help';
    a.href = mbuHelpHref(name);
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'open the README in a new tab';
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
    if (note && mbuClaimCmp(note.ver, ver) <= 0) { try { localStorage.removeItem(noteKey); } catch (e) { /* storage blocked */ } note = null; }
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
    if (o.version) html += '<span class="mbu-cfg-ver" title="installed script version">v' + esc(o.version) + '</span>';
    html += '<span class="mbu-cfg-sp"></span>';
    if (o.log) {
        html += '<button type="button" class="mbu-cfg-log' + (o.logClass ? ' ' + esc(o.logClass) : '') + '"'
            + (o.logId ? ' id="' + esc(o.logId) + '"' : '')
            + ' title="Open the activity log">Log</button>';
    }
    html += mbuHelpHtml(o.script);
    return html + '</div>';
}

// Test hooks. A script puts its test hook on window only when the test harness has
// marked the page (dev/test/harness.mjs sets window.__mbuTest before any script runs):
//   if (mbuTestHooks()) window.__fooTest = { … };
// On a user's page the hooks are never built. (#623)
function mbuTestHooks() {
    try { return typeof window !== 'undefined' && window.__mbuTest === true; } catch (e) { return false; }
}

// Corner slots (#468). Every floating launcher (Apollo Editor, Art Station, Falcon,
// Fusion, Scribe) tags its element with data-mb-corner (which screen corner: 'br',
// 'bl', 'tr', 'tl') and data-mb-corner-order (lower sits closer to the corner), and
// calls mbRestackCorner(corner) right after it shows, hides, creates or removes it.
// That recomputes every element in the corner, whichever script owns it and
// whatever order they loaded in, so two launchers never land on the same pixel.
// Orders in use: Apollo and Art Station 10 (never on the same page), Falcon 20,
// Fusion above Falcon. Scribe is not on the shared block and keeps a copy of this.
function mbRestackCorner(corner) {
    var bottom = corner[0] === 'b', right = corner[1] === 'r';
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-mb-corner="' + corner + '"]'))
        // offsetParent is always null for position:fixed, so it can't tell visibility here
        .filter(function (el) { return getComputedStyle(el).display !== 'none'; })
        .sort(function (a, b) { return (Number(a.dataset.mbCornerOrder) || 0) - (Number(b.dataset.mbCornerOrder) || 0); });
    var pos = 14;
    els.forEach(function (el) {
        el.style[bottom ? 'bottom' : 'top'] = pos + 'px';
        el.style[right ? 'right' : 'left'] = '14px';
        pos += el.getBoundingClientRect().height + 8;
    });
}

// Activity log: the session's log lines plus the floating window that shows them
// (#283's viewer, shared since X12 of #623). A script makes its log once:
//
//   var LOG = mbuLog({ name: 'Fusion', version: VERSION, key: 'fusion.logwin' });
//   LOG.info('…'); LOG.warn(…); LOG.err(…) (or .error); LOG.ok(…); LOG.debug(…)
//   LOG.open(); LOG.close(); LOG.reopen()   // reopen: only if it was left open
//   LOG.markdown(); LOG.copy(btn); LOG.clear(); LOG.lines(); LOG.messages(); LOG.counts()
//
// o.name / o.version  the Markdown summary's title (version may be a function)
// o.subtitle          optional function; its text follows the title (e.g. the release)
// o.header            the window's title (default 'Activity log')
// o.key               storage key for the window's open/minimised/position state
// o.load / o.save     that storage (default GM_getValue / GM_setValue)
// o.before            called before the window opens (e.g. to inject the script's CSS)
// o.max               lines kept (default 20000: about 4 MB; 2000 dropped a long session's start)
//
// A long run keeps only the last o.max lines, and the Markdown says how many went
// before them; the copies this replaced grew for the whole session. An open
// window appends each new line and drops the oldest row past the cap; the copies
// rebuilt the whole list with innerHTML on every line, which is quadratic over a
// long matching run.
function mbuLog(o) {
    o = o || {};
    var max = o.max || 20000, buf = [], dropped = 0, warn = 0, error = 0, win = null;
    var pad = function (n, w) { return String(n).padStart(w || 2, '0'); };
    var ts = function (d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + pad(d.getMilliseconds(), 3); };
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
    var tally = function (e, d) { if (e.sev === 'warn') warn += d; else if (e.sev === 'error') error += d; };
    var PRE = { info: '', ok: 'OK   ', warn: 'WARN ', error: 'ERR  ', debug: 'DBG  ' };
    var line = function (e) { return ts(e.t) + '  ' + (PRE[e.sev] || '') + e.msg; };

    function add(sev, args) {
        var msg = Array.prototype.map.call(args, str).join(' ').replace(/\s+/g, ' ').trim();
        if (!msg) return;
        var e = { t: new Date(), sev: sev === 'err' ? 'error' : sev, msg: msg };
        buf.push(e); tally(e, 1);
        // trim in chunks, not one shift per line
        if (buf.length > max + Math.ceil(max / 10)) {
            var gone = buf.splice(0, buf.length - max);
            gone.forEach(function (g) { tally(g, -1); });
            dropped += gone.length;
        }
        if (win) win.append(e);
    }
    function title() {
        var v = typeof o.version === 'function' ? (function () { try { return o.version(); } catch (e) { return ''; } })() : o.version;
        var t = (o.name || 'Log') + (v ? ' v' + v : '');
        try { var s = o.subtitle && o.subtitle(); if (s) t += ' — ' + s; } catch (e) { /* no subtitle */ }
        return t;
    }
    function markdown() {
        var body = buf.length ? buf.map(line).join('\n') : '(no activity logged)';
        if (dropped) body = '(' + dropped + ' earlier line' + (dropped === 1 ? '' : 's') + ' not kept)\n' + body;
        var n = (warn || error) ? ' (' + warn + ' warning' + (warn === 1 ? '' : 's') + ', ' + error + ' error' + (error === 1 ? '' : 's') + ')' : '';
        var fence = String.fromCharCode(96, 96, 96);
        return '<details><summary>' + title() + ' — session log' + n + '</summary>\n\n' + fence + 'log\n' + body + '\n' + fence + '\n\n</details>';
    }
    function copy(btn) {
        var md = markdown();
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
    function open() {
        close(true);
        if (typeof o.before === 'function') { try { o.before(); } catch (e) { /* the window still opens */ } }
        remember({ open: true });
        var st = state();
        var pop = document.createElement('div'); pop.id = 'mbu-logpop'; pop.className = 'mbu-logpop';
        pop.innerHTML = mbuHtml('<div class="mbu-logpop-h"><b>' + esc(o.header || 'Activity log') + '</b> <span class="mbu-log-badge"></span><span class="mbu-logpop-sp"></span>'
            + '<button class="mbu-logpop-clear" type="button" title="Clear the log (the lines so far are gone)">Clear</button>'
            + '<button class="mbu-logpop-copy" type="button" title="Copy as Markdown (paste into a GitHub issue)">⧉ Copy</button>'
            + '<button class="mbu-logpop-min" type="button" title="Minimize">–</button>'
            + '<button class="mbu-logpop-x" type="button" title="Close">✕</button></div>'
            + '<div class="mbu-log-list"></div>');
        document.body.appendChild(pop);
        if (st.left != null) { pop.style.left = st.left; pop.style.top = st.top; pop.style.right = 'auto'; pop.style.transform = 'none'; }
        var restore = { left: pop.style.left, top: pop.style.top, right: pop.style.right, bottom: pop.style.bottom, transform: pop.style.transform };
        var list = pop.querySelector('.mbu-log-list'), badge = pop.querySelector('.mbu-log-badge');
        var row = function (e) {
            var d = document.createElement('div');
            d.className = 'mbu-log-li mbu-log-' + e.sev;
            d.innerHTML = mbuHtml('<span class="mbu-log-t">' + ts(e.t) + '</span><span class="mbu-log-m">' + linkify(e.msg) + '</span>');
            return d;
        };
        var showBadge = function () { badge.textContent = '(' + buf.length + ')' + (warn || error ? ' · ' + warn + '⚠ ' + error + '✖' : ''); };
        // the rows, once; later lines are appended one by one
        var frag = document.createDocumentFragment();
        buf.forEach(function (e) { frag.appendChild(row(e)); });
        if (buf.length) list.appendChild(frag);
        else list.innerHTML = mbuHtml('<div class="mbu-log-empty">No activity yet.</div>');
        showBadge();
        list.scrollTop = list.scrollHeight;
        // badge and scroll once per frame, however many lines arrive in it
        var queued = false, follow = true;
        list.addEventListener('scroll', function () { follow = list.scrollHeight - list.scrollTop - list.clientHeight < 40; });
        var paint = function () { queued = false; showBadge(); if (follow) list.scrollTop = list.scrollHeight; };
        var onKey = function (e) { if (e.key === 'Escape') close(); };
        win = {
            el: pop,
            append: function (e) {
                var empty = list.querySelector('.mbu-log-empty'); if (empty) empty.remove();
                list.appendChild(row(e));
                while (list.childElementCount > buf.length) list.firstElementChild.remove();
                if (!queued) { queued = true; requestAnimationFrame(paint); }
            },
            off: function () { document.removeEventListener('keydown', onKey); },
            cleared: function () { list.innerHTML = mbuHtml('<div class="mbu-log-empty">No activity yet.</div>'); showBadge(); },
        };
        pop.querySelector('.mbu-logpop-clear').onclick = function () { clear(); };
        pop.querySelector('.mbu-logpop-copy').onclick = function () { copy(pop.querySelector('.mbu-logpop-copy')); };
        var minBtn = pop.querySelector('.mbu-logpop-min');
        var setMin = function (m) {
            minBtn.textContent = m ? '▢' : '–'; minBtn.title = m ? 'Restore' : 'Minimize';
            if (m) { pop.style.left = '14px'; pop.style.bottom = '14px'; pop.style.top = 'auto'; pop.style.right = 'auto'; pop.style.transform = 'none'; }   // dock to the bottom
            else Object.assign(pop.style, restore);
        };
        minBtn.onclick = function () { var m = pop.classList.toggle('min'); setMin(m); remember({ min: m }); };
        if (st.min) { pop.classList.add('min'); setMin(true); }
        pop.querySelector('.mbu-logpop-x').onclick = function () { close(); };
        // floating and non-modal: dragged by its header
        pop.querySelector('.mbu-logpop-h').addEventListener('mousedown', function (e) {
            if (e.target.closest('button')) return;
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
        document.addEventListener('keydown', onKey);
        return pop;
    }
    // empty the log: the lines, the counts and the "earlier lines not kept" note
    function clear() {
        buf = []; dropped = 0; warn = 0; error = 0;
        if (win) win.cleared();
    }
    // quiet: closing to reopen, so the remembered "open" stays as it is
    function close(quiet) {
        var stray = document.getElementById('mbu-logpop');
        if (win) { win.off(); win.el.remove(); win = null; if (!quiet) remember({ open: false }); }
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
        open: open,
        close: function () { close(); },
        reopen: function () { if (state().open) open(); },
        isOpen: function () { return !!win; },
        markdown: markdown,
        copy: copy,
        clear: clear,
        lines: function () { return buf.map(line); },
        messages: function () { return buf.map(function (e) { return e.msg; }); },
        counts: function () { return { warn: warn, error: error }; },
    };
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
} catch (e) { /* a locked-down page must not stop the script loading */ }
// </ST-UI>

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
if (mbuTestHooks()) window.__fcTest = { splitFeat, creditFromTitle, seedParams, guessScript, splitLabels, providers: PROVIDERS, importCurrent };

})();
