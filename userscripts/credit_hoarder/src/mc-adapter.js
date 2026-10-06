// Mission Control adapter (#680).
//
// Credit Hoarder works on /release/<mbid>/edit-relationships; its @match now also
// includes the release page itself, where it starts no UI, only this. Mission
// Control asks over document events with JSON-string details (see
// userscripts/mission_control/DEVELOP.md).
//
// Info only: CH never writes from Mission Control. A probe takes the release's
// own external links from the page (the sidebar block headed "External links",
// not the release group's — no MusicBrainz request), reads ONE source's credits
// (the first of Discogs, Qobuz, Deezer, Apple that is linked), and reports per
// track how many credits it has, mapped by the source's order of tracks per
// medium. Nothing is cached for CH's own page yet: getDiscogsReleaseData's cache
// lives for this page only, and CH itself runs on edit-relationships.

import { log } from './log.js';
import { getDiscogsReleaseData } from './api-discogs.js';
import { parseDeezerAlbumUrl, fetchDeezerAlbumPage, extractDeezerCredits } from './sources/deezer.js';
import { parseQobuzAlbumUrl, fetchQobuzAlbumPage, extractQobuzCredits } from './sources/qobuz.js';
import { parseAppleAlbumUrl, fetchAppleCredits } from './sources/apple.js';

const send = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(detail) }));
const version = () => (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) || '?';

function releaseLinks() {
    for (const ul of document.querySelectorAll('ul.external_links')) {
        let h = ul.previousElementSibling;
        while (h && !/^H\d$/.test(h.tagName)) h = h.previousElementSibling;
        if (h && /^external links$/i.test(h.textContent.trim())) return [...ul.querySelectorAll('a[href^="http"]')].map(a => a.href);
    }
    return [];
}
// this release's tracks in page order, with their medium and recording MBID
function pageTracks() {
    const out = [];
    let medium = 0;
    document.querySelectorAll('#content table.medium').forEach(tbl => {
        medium++;
        let pos = 0;
        tbl.querySelectorAll('tbody tr').forEach(tr => {
            const a = tr.querySelector('a[href*="/recording/"]');
            if (!a) return;
            pos++;
            out.push({ medium, pos, rec: (a.getAttribute('href').match(/[0-9a-f-]{36}/) || [])[0] });
        });
    });
    return out;
}
// a source's per-track list ([{ index, credits }], in its own order) → medium numbers:
// a track number that doesn't go up starts the next medium (the sources' own convention)
function withMedia(list) {
    let medium = 1, last = 0;
    return list.map(t => { if (t.index <= last) medium++; last = t.index; return Object.assign({ medium }, t); });
}
const flatRoles = c => (c.roles || [c.role]).filter(Boolean).join(', ');

async function readSource(links) {
    const find = re => links.find(u => re.test(u));
    const discogs = find(/discogs\.com\/(?:[a-z-]+\/)?release\/\d+/i);
    if (discogs) {
        const url = discogs.replace(/^https?:\/\/(www\.)?discogs\.com\/(?:[a-z-]+\/)?release\//i, 'https://www.discogs.com/release/').split(/[?#]/)[0];
        const json = await getDiscogsReleaseData(url);
        const tracks = [];
        const walk = arr => (arr || []).forEach(t => { if (t.sub_tracks) walk(t.sub_tracks); else if (t.type_ === 'track' || !t.type_) tracks.push(t); });
        walk(json.tracklist);
        // the release's own credits (#680), with the tracks they cover when Discogs names them ("1 to 3")
        const release = (json.extraartists || []).map(a => ({ name: a.name, role: a.role + (a.tracks ? ` (tracks ${a.tracks})` : '') }));
        return { source: 'Discogs', perTrack: tracks.map((t, i) => ({ medium: 0, index: i + 1, credits: (t.extraartists || []).map(a => ({ name: a.name, role: a.role })) })), flat: true, release };
    }
    const qobuz = find(/qobuz\.com\//i) && parseQobuzAlbumUrl(find(/qobuz\.com\//i));
    if (qobuz) return { source: 'Qobuz', perTrack: withMedia(extractQobuzCredits(await fetchQobuzAlbumPage(qobuz.pageUrl))) };
    const deezer = find(/deezer\.com\//i) && parseDeezerAlbumUrl(find(/deezer\.com\//i));
    if (deezer) return { source: 'Deezer', perTrack: withMedia(extractDeezerCredits(await fetchDeezerAlbumPage(deezer.pageUrl))) };
    const apple = find(/(music|itunes)\.apple\.com\//i) && parseAppleAlbumUrl(find(/(music|itunes)\.apple\.com\//i));
    if (apple) return { source: 'Apple', perTrack: withMedia((await fetchAppleCredits(apple.storefront, apple.id)).tracks) };
    return null;
}

export function startMcAdapter() {
    const m = location.pathname.match(/^\/release\/([0-9a-f-]{36})\/?$/i);
    if (!m) return false;
    const rel = m[1].toLowerCase();
    const hello = () => send('mc:provider', { id: 'ch', name: 'Credit Hoarder', version: version(), release: rel, capabilities: ['probe'] });
    document.addEventListener('mc:discover', () => { log.info('Mission Control asked — answering as provider ch'); hello(); });
    document.addEventListener('mc:probe', async e => {
        let d = {};
        try { d = JSON.parse(e.detail) || {}; } catch (x) { return; }
        if ((d.release && d.release !== rel) || (d.only && !d.only.includes('ch'))) return;
        const done = (findings, summary) => send('mc:findings', { id: 'ch', run: d.run, release: rel, findings, summary });
        try {
            send('mc:progress', { id: 'ch', run: d.run, state: 'busy', note: 'reading credits' });
            const links = releaseLinks();
            const got = await readSource(links);
            if (!got) { log.info('Mission Control probe: no credit source linked (Discogs, Qobuz, Deezer, Apple)'); done([], 'No credit source linked (Discogs, Qobuz, Deezer, Apple)'); return; }
            const tracks = pageTracks();
            const findings = tracks.map((t, i) => {
                const hit = got.flat ? got.perTrack[i] : got.perTrack.find(x => x.medium === t.medium && x.index === t.pos);
                const list = hit ? hit.credits.map(c => ({ name: c.name, role: flatRoles(c) })) : [];
                return { key: t.rec, track: t.rec, state: list.length ? 'info' : 'none', credits: list.length, list, source: got.source };
            });
            const total = findings.reduce((n, f) => n + f.credits, 0);
            // release-level credits: one finding with no `track` (only Discogs has them)
            const relList = got.release || [];
            if (relList.length) findings.push({ key: 'release', state: 'info', credits: relList.length, list: relList, source: got.source, level: 'release' });
            log.info(`Mission Control probe: ${got.source} — ${total} track credit(s) on ${findings.filter(f => f.track && f.credits).length} of ${tracks.length} track(s), ${relList.length} release credit(s)`);
            relList.forEach(c => log.info(`  release credit: ${c.name} — ${c.role}`));
            done(findings, `${got.source}: ${total} credit${total === 1 ? '' : 's'} on ${findings.filter(f => f.track && f.credits).length} of ${tracks.length} tracks` + (relList.length ? `, ${relList.length} on the release` : ''));
        } catch (x) {
            log.error('Mission Control probe failed: ' + ((x && x.message) || x));
            done([], 'failed: ' + ((x && x.message) || x));
        }
    });
    hello();
    return true;
}
