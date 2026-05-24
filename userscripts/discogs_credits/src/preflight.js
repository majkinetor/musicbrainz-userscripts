// Pre-flight: resolve every Discogs artist / company against MusicBrainz
// BEFORE the actual import runs, so the review-table phase can show one
// row per credit with the chosen MBID (or "needs attention") for the user
// to confirm. Lookup strategy per entity:
//   1. IDB cache (mblinks store)        — instant; populated by prior runs.
//   2. Name search (`/ws/2/<type>?query=…`) — single exact match wins.
//   3. URL relation (`/ws/2/url?resource=…&inc=<entity>-rels`) — fallback
//      when name search is ambiguous or empty.
//
// Each function returns `{ allResults: [...] }` where each result is one of:
//   { type: 'resolved',  entity, mbUrl, mbName, mbDisambig, logEntry: {...} }
//   { type: 'attention', entity, nameMatches: [...]                      }

import { mbThrottle }                       from './api-mb.js';
import { db }                                from './storage.js';
import { getDiscogsLinkKey, link_infos }    from './api-discogs.js';
import { ENTITY_TYPE_MAP }                  from './data/entity-map.js';

/**
 * Checks each artist against MB using two strategies in sequence:
 *   1. URL-relationship lookup (fast, exact) — the same query the real import uses.
 *      If the Discogs URL is already linked in MB this resolves immediately.
 *   2. Name search fallback — if the URL lookup finds nothing, search by artist name.
 *      A name hit means the artist exists in MB but has no Discogs link yet; the
 *      import will still fail, but the user should link rather than create.
 *
 * Returns an array of objects: { artist, nameMatches }
 *   artist      – the Discogs artist object
 *   nameMatches – array of { id, name, disambiguation } from the MB name search
 *                 (empty array means truly not found → needs creation)
 */
export async function checkMissingArtists(artists, progressLi, bypassIdb) {
    const CONCURRENCY = 5;   // worker count (MB requests are serialized via mbThrottle)
    const MIN_GAP_MS  = 50;  // stagger between worker starts (actual MB pacing is in mbThrottle)

    let done = 0;
    let inFlight = 0; // names of artists currently being fetched
    const inFlightNames = new Set();

    function setProgress() {
        if (!progressLi) return;
        const remaining = artists.length - done;
        const checking = inFlightNames.size
            ? ` \u2014 checking <em>${[...inFlightNames].join(', ')}</em>` : '';
        progressLi.innerHTML =
            `Checking artists against MusicBrainz\u2026 ` +
            `<strong>${done}/${artists.length}</strong> done${checking}` +
            (remaining === 0 ? ' \u2714' : ` (${remaining} remaining)`);
    }

    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    // Fetch with automatic retry on 503/429; backs off and retries up to 4 times.
    // Returns parsed JSON or null on permanent failure.
    async function mbFetch(url, retries = 4) {
        return mbThrottle.fetchJson(url, retries);
    }

    function checkIdbCache(key) {
        return new Promise(resolve => {
            if (!key || !db) return resolve(null);
            try {
                const tx = db.transaction(['mblinks'], 'readonly');
                const req = tx.objectStore('mblinks').get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror  = () => resolve(null);
            } catch(e) { resolve(null); }
        });
    }

    async function checkOne(artist) {
        const key         = getDiscogsLinkKey(artist.resource_url);
        const searchName  = artist.name;
        const displayName = (artist.anv && artist.anv.trim()) || artist.name;
        const discogsHref = artist.resource_url
            .replace('https://api.discogs.com/artists/', 'https://www.discogs.com/artist/');

        function resolvedResult(mbUrl, mbName, mbDisambig, via) {
            return { type: 'resolved', entityType: 'artist', entity: artist,
                     displayName, discogsHref, mbUrl, mbName, mbDisambig,
                     logEntry: { displayName, discogsHref, mbUrl, mbName, mbDisambig, via } };
        }

        // Fetch MB artist name/disambiguation for a known MBID (for display purposes)
        async function fetchMbArtistInfo(mbUrl) {
            const mbid = mbUrl.replace(/.*\/artist\//, '');
            const json = await mbFetch(`//musicbrainz.org/ws/2/artist/${mbid}?fmt=json`);
            return json ? { name: json.name || null, disambiguation: json.disambiguation || '' } : { name: null, disambiguation: '' };
        }

        // 1. IDB cache — instant, no network (skip for artists with no real key)
        if (!bypassIdb && key) {
            const cachedRec = await checkIdbCache(key);
            if (cachedRec?.mb_links?.[0]) {
                const cached = cachedRec.mb_links[0];
                if (cachedRec.mb_name) {
                    return resolvedResult(cached, cachedRec.mb_name, cachedRec.mb_disambiguation || '', 'cache');
                }
                const info = await fetchMbArtistInfo(cached);
                if (info.name) {
                    try { const t=db.transaction(['mblinks'],'readwrite'); t.objectStore('mblinks').put({...cachedRec, mb_name:info.name, mb_disambiguation:info.disambiguation}); } catch(e){}
                }
                return resolvedResult(cached, info.name, info.disambiguation, 'cache');
            }
        }

        // 2. Name search — resolves newly created artists without a Discogs link yet
        const nameJson = await mbFetch(
            `//musicbrainz.org/ws/2/artist?query=${encodeURIComponent(searchName)}&fmt=json&limit=10`
        );
        const nameSearchFailed = nameJson === null;
        const normalized = searchName.toLowerCase().trim();
        const nameMatches = !nameJson?.artists ? [] : nameJson.artists
            .filter(a => a.name.toLowerCase().trim() === normalized || (a.score != null && a.score >= 70))
            .map(a => ({ id: a.id, name: a.name, disambiguation: a.disambiguation || '', score: a.score || 0 }));

        const exactMatches = nameMatches.filter(a => a.name.toLowerCase().trim() === normalized);
        if (exactMatches.length === 1) {
            const a = exactMatches[0];
            const mbUrl = `//musicbrainz.org/artist/${a.id}`;
            if (key) {
                try {
                    const tx = db.transaction(['mblinks'], 'readwrite');
                    tx.objectStore('mblinks').put({ discogs_id: key, mb_links: [mbUrl], mb_name: a.name, mb_disambiguation: a.disambiguation || '' });
                } catch(e) { /* ignore duplicate */ }
            }
            return resolvedResult(mbUrl, a.name, a.disambiguation, 'name');
        }

        // 3. URL lookup — needed when name search is ambiguous or empty
        const urlJson = key && link_infos[key] ? await mbFetch(
            `//musicbrainz.org/ws/2/url?resource=${encodeURIComponent(link_infos[key].clean_url)}&inc=artist-rels&fmt=json`
        ) : null;
        if (urlJson?.relations?.length > 0) {
            const rel = urlJson.relations.find(r => r.artist);
            if (rel) {
                const a = rel.artist;
                const mbUrl = `//musicbrainz.org/artist/${a.id}`;
                // rel.artist from the URL endpoint may not include full name details; fetch them
                const info = (a.name) ? a : await fetchMbArtistInfo(mbUrl);
                const resolvedName = info.name || a.name;
                const resolvedDisam = info.disambiguation || a.disambiguation || '';
                if (key && resolvedName) {
                    try {
                        const tx2 = db.transaction(['mblinks'], 'readwrite');
                        tx2.objectStore('mblinks').put({ discogs_id: key, mb_links: [mbUrl], mb_name: resolvedName, mb_disambiguation: resolvedDisam });
                    } catch(e) {}
                }
                return resolvedResult(mbUrl, resolvedName, resolvedDisam, 'url');
            }
        }

        return { type: 'attention', entityType: 'artist', entity: artist,
                 displayName, discogsHref, nameMatches,
                 rateLimited: nameSearchFailed && !nameMatches.length };
    }

    // Concurrency pool: launch up to CONCURRENCY workers simultaneously.
    // Each worker pulls the next artist from the queue, processes it, then loops.
    // A small per-slot stagger (MIN_GAP_MS) avoids thundering-herd on burst start.
    return (async () => {
        const queue   = artists.map((a, i) => ({ artist: a, index: i }));
        const results = new Array(artists.length);

        setProgress();

        async function worker(slotIndex) {
            await delay(slotIndex * MIN_GAP_MS); // stagger slot start
            while (queue.length > 0) {
                const { artist, index } = queue.shift();
                const displayName = (artist.anv && artist.anv.trim()) || artist.name;
                inFlightNames.add(displayName);
                setProgress();

                const result = await checkOne(artist);
                results[index] = result;

                inFlightNames.delete(displayName);
                done++;
                setProgress();
            }
        }

        const slots = Math.min(CONCURRENCY, artists.length);
        await Promise.all(Array.from({ length: slots }, (_, i) => worker(i)));

        // Return all results for the unified review table
        // resolved: { type:'resolved', artist, mbUrl, logEntry:{displayName,discogsHref,mbUrl,mbName,mbDisambig,via} }
        // attention: { type:'attention', artist, nameMatches }
        return { allResults: results };
    })();
}

/**
 * Checks companies (labels/places) against MB — same approach as checkMissingArtists.
 * Returns { allResults } with the same unified result shape.
 */
export async function checkMissingCompanies(companies, progressLi, bypassIdb) {
    const CONCURRENCY = 5;
    const MIN_GAP_MS  = 200;
    let done = 0;
    const inFlightNames = new Set();

    function setProgress() {
        if (!progressLi) return;
        const remaining = companies.length - done;
        const checking = inFlightNames.size
            ? ` \u2014 checking <em>${[...inFlightNames].join(', ')}</em>` : '';
        progressLi.innerHTML =
            `Checking labels/places against MusicBrainz\u2026 ` +
            `<strong>${done}/${companies.length}</strong> done${checking}` +
            (remaining === 0 ? ' \u2714' : ` (${remaining} remaining)`);
    }

    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    async function mbFetch(url, retries = 4) {
        return mbThrottle.fetchJson(url, retries);
    }

    function checkIdbCache(key) {
        return new Promise(resolve => {
            if (!key || !db) return resolve(null);
            try {
                const tx = db.transaction(['mblinks'], 'readonly');
                const req = tx.objectStore('mblinks').get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror  = () => resolve(null);
            } catch(e) { resolve(null); }
        });
    }

    async function checkOne(company) {
        const details = ENTITY_TYPE_MAP[company.entity_type_name];
        if (!details) return null; // unmapped company type — skip
        const entityType  = details.entityType; // 'label' or 'place'
        const key         = getDiscogsLinkKey(company.resource_url);
        const searchName  = company.name;
        const displayName = company.name;
        // API uses plural paths (labels/, masters/) but website uses singular (label/, master/)
        const discogsHref = company.resource_url
            .replace(/https:\/\/api\.discogs\.com\/(\w+?)s\/(\d+)/, 'https://www.discogs.com/$1/$2');

        async function fetchMbEntityInfo(mbUrl) {
            const mbid = mbUrl.replace(/.*\/(label|place)\//, '');
            const json = await mbFetch(`//musicbrainz.org/ws/2/${entityType}/${mbid}?fmt=json`);
            return json ? { name: json.name || null, disambiguation: json.disambiguation || '' }
                        : { name: null, disambiguation: '' };
        }

        // 1. IDB cache — use stored name if available (skip when bypassIdb)
        if (!bypassIdb) {
            const cachedRec = await checkIdbCache(key);
            if (cachedRec?.mb_links?.[0]) {
                const cached = cachedRec.mb_links[0];
                if (cachedRec.mb_name) {
                    return { type: 'resolved', entityType, entity: company, displayName, discogsHref,
                             mbUrl: cached, mbName: cachedRec.mb_name, mbDisambig: cachedRec.mb_disambiguation || '',
                             logEntry: { displayName, discogsHref, mbUrl: cached, mbName: cachedRec.mb_name,
                                         mbDisambig: cachedRec.mb_disambiguation || '', via: 'cache' } };
                }
                const info = await fetchMbEntityInfo(cached);
                if (info.name) {
                    try { const t=db.transaction(['mblinks'],'readwrite'); t.objectStore('mblinks').put({...cachedRec, mb_name:info.name, mb_disambiguation:info.disambiguation}); } catch(e){}
                }
                return { type: 'resolved', entityType, entity: company, displayName, discogsHref,
                         mbUrl: cached, mbName: info.name, mbDisambig: info.disambiguation,
                         logEntry: { displayName, discogsHref, mbUrl: cached, mbName: info.name,
                                     mbDisambig: info.disambiguation, via: 'cache' } };
            }
        }

        // 2. Name search
        const nameJson = await mbFetch(
            `//musicbrainz.org/ws/2/${entityType}?query=${encodeURIComponent(searchName)}&fmt=json&limit=8`
        );
        const resultKey = entityType === 'label' ? 'labels' : 'places';
        const normalized = searchName.toLowerCase().trim();
        const nameSearchFailed2 = nameJson === null;
        const nameMatches = !(nameJson?.[resultKey]) ? [] : nameJson[resultKey]
            .filter(a => a.name.toLowerCase().trim() === normalized || (a.score != null && a.score >= 70))
            .map(a => ({ id: a.id, name: a.name, disambiguation: a.disambiguation || a['disambiguation-comment'] || '', score: a.score || 0 }));

        const exactMatches = nameMatches.filter(a => a.name.toLowerCase().trim() === normalized);
        if (exactMatches.length === 1) {
            const a = exactMatches[0];
            const mbUrl = `//musicbrainz.org/${entityType}/${a.id}`;
            if (key) {
                try {
                    const tx = db.transaction(['mblinks'], 'readwrite');
                    tx.objectStore('mblinks').put({ discogs_id: key, mb_links: [mbUrl] });
                } catch(e) {}
            }
            if (key) try { const t=db.transaction(['mblinks'],'readwrite'); t.objectStore('mblinks').put({discogs_id:key, mb_links:[mbUrl], mb_name:a.name, mb_disambiguation:a.disambiguation||''}); } catch(e){}
            return { type: 'resolved', entityType, entity: company, displayName, discogsHref,
                     mbUrl, mbName: a.name, mbDisambig: a.disambiguation,
                     logEntry: { displayName, discogsHref, mbUrl, mbName: a.name,
                                 mbDisambig: a.disambiguation, via: 'name' } };
        }

        // 3. URL lookup — for places also try label-rels (facilities are often stored as labels in MB)
        const incRels = entityType === 'place' ? 'place-rels+label-rels' : `${entityType}-rels`;
        const urlJson = key && link_infos[key] ? await mbFetch(
            `//musicbrainz.org/ws/2/url?resource=${encodeURIComponent(link_infos[key].clean_url)}&inc=${incRels}&fmt=json`
        ) : null;
        if (urlJson?.relations?.length > 0) {
            const rel = urlJson.relations.find(r => r[entityType] || r['label'] || r['place']);
            if (rel) {
                const actualEt = rel[entityType] ? entityType : (rel['label'] ? 'label' : 'place');
                const a = rel[actualEt];
                const mbUrl = `//musicbrainz.org/${actualEt}/${a.id}`;
                const info = a.name ? a : await fetchMbEntityInfo(mbUrl);
                return { type: 'resolved', entityType: actualEt, entity: company, displayName, discogsHref,
                         mbUrl, mbName: info.name || a.name, mbDisambig: info.disambiguation || '',
                         logEntry: { displayName, discogsHref, mbUrl,
                                     mbName: info.name || a.name, mbDisambig: info.disambiguation || '', via: 'url' } };
            }
        }

        return { type: 'attention', entityType, entity: company, displayName, discogsHref, nameMatches };
    }

    return (async () => {
        const queue   = companies.map((c, i) => ({ company: c, index: i }));
        const results = [];
        // Use index from queue item instead of resource_url Map (avoids collision for duplicate URLs)
        const resultArr = new Array(companies.length);
        setProgress();

        async function worker(slotIndex) {
            await delay(slotIndex * MIN_GAP_MS);
            while (queue.length > 0) {
                const _item = queue.shift();
                const company = _item.company || _item;
                const _cIdx = _item.index ?? -1;
                inFlightNames.add(company.name);
                setProgress();
                const result = await checkOne(company);
                if (result && _cIdx >= 0) resultArr[_cIdx] = result;
                inFlightNames.delete(company.name);
                done++;
                setProgress();
            }
        }

        const slots = Math.min(CONCURRENCY, companies.length);
        if (slots > 0) await Promise.all(Array.from({ length: slots }, (_, i) => worker(i)));
        return { allResults: resultArr.filter(Boolean) };
    })();
}
