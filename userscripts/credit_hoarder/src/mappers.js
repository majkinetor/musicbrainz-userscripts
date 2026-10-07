// Pure transforms between Discogs JSON and the internal "role" shape the
// rest of the script consumes. Everything in here is mechanical mapping —
// no MB API calls, no DOM, no IDB. Easiest layer to reason about in
// isolation.

import { ENTITY_TYPE_MAP } from './data/entity-map.js';
import { INSTRUMENTS }     from './data/instruments.js';

// Case-insensitive view of INSTRUMENTS so Discogs role variants like
// "Conga Drum" / "conga drum" / "CONGA DRUM" all hit the same entry.
// Without this, a non-canonical casing fell through the case-sensitive
// `INSTRUMENTS[actualRole]` lookup; the rel then dispatched with the raw
// (un-mapped) role name as the instrument attribute, which MB doesn't
// recognise — observed on majkinetor's "Ifetayo" import (#104) and
// reported again post-fix.
const INSTRUMENTS_CI = Object.fromEntries(
    Object.entries(INSTRUMENTS).map(([k, v]) => [k.toLowerCase(), v])
);

// A bracket that names a more specific MB instrument than its (mapped) base: "Electric Organ
// [B3]" is a Hammond organ, "Electric Piano [Rhodes]" a Rhodes piano, "Synthesizer [Moog]" a
// Moog. Only these pairs: a bracket never overrides a known base on its own ("Bass [Guitar]"
// stays bass, #223). Names as MB has them.
const BRACKET_REFINES = [
    [/^(electronic organ|organ)$/, /\b(b-?3|hammond)\b/i, 'Hammond organ'],
    [/^electric piano$/, /\brhodes\b/i, 'Rhodes piano'],
    [/^(guitar|acoustic guitar)$/, /\b(12|twelve)[- ]string\b/i, '12 string guitar'],
    [/^(guitar|acoustic guitar)$/, /\bnylon\b/i, 'classical guitar'],
    [/^lute$/, /\b(tanpura|tambura)\b/i, 'tambura'],
    [/^synthesizer$/, /\bmoog\b/i, 'Moog'],
];
// the bare-instrument roles that only say "played something" (Discogs Band / Musician /
// Performer …): next to a named instrument or a vocal of the same artist they add nothing,
// and MB shows each as one more line under "instruments:"
const isBareInstrument = r => r.linkType === 'instrument' && !(r.attributes || []).some(a => a && a._type === 'instrument');

// the sort-name guess is shared with Apollo (dev/match/artist-match.mjs, #623)
export { mbmGuessSortName as guessSortName } from '../../../dev/match/artist-match.mjs';

/**
 * Flatten Discogs `tracklist`: classical / multi-movement releases group
 * actual tracks under index-type parent entries (`type_: 'index'`) with a
 * `sub_tracks` array; only the sub_tracks carry positions like "1", "2"…
 * Walking `json.tracklist` directly skips every real track. Replace each
 * index entry with its children so callers see a flat list of tracks.
 * Issue #112.
 */
export function flattenTracklist(tracklist) {
    if (!Array.isArray(tracklist)) return [];
    return tracklist.flatMap(t => {
        if (t?.type_ === 'index' && Array.isArray(t.sub_tracks)) {
            // Credits on the index/heading itself (e.g. a classical movement group
            // crediting Conductor / Orchestra / soloist once for all its movements)
            // apply to every contained track. Push the parent's extraartists down
            // onto each sub_track — otherwise they're dropped and the whole group
            // imports with zero per-track credits. #122
            const parentExtra = Array.isArray(t.extraartists) ? t.extraartists : [];
            if (!parentExtra.length) return t.sub_tracks;
            return t.sub_tracks.map(st => Object.assign({}, st, {
                extraartists: [...(Array.isArray(st.extraartists) ? st.extraartists : []), ...parentExtra],
            }));
        }
        return [t];
    });
}

/**
 * Resolve the tracks a Discogs `tracks` field references. Expands "A1 to A4"
 * ranges and accepts comma-separated lists. Returns an array of track objects
 * from `tracklist`. Internally flattens `sub_tracks` so classical-style index
 * tracklists work (#112).
 */
export function getAllArtistTracks(tracklist, artistTracks) {
    tracklist = flattenTracklist(tracklist);
    // lets parse and get all tracks listed by the artist
    return artistTracks.split(',').reduce((trackArray, trackNumber) => {
        if (/ to /.test(trackNumber)) {
            // need to expand the range
            const parts = trackNumber.split(' to ');
            const startTrack = parts[0].trim().replace('.', '-');
            const lastTrack = parts[1].trim().replace('.', '-');
            let hasFoundStart = false,
                hasFoundEnd = false;
            tracklist.forEach(track => {
                const resolvedTrackPosition = track.position.replace('.', '-');
                if (!hasFoundStart && resolvedTrackPosition === startTrack) {
                    hasFoundStart = true;
                    trackArray.push(track);
                } else if (hasFoundStart && !hasFoundEnd) {
                    if (resolvedTrackPosition === lastTrack) {
                        hasFoundEnd = true;
                        trackArray.push(track);
                    } else if (track.position === '') {
                        hasFoundEnd = true;
                    } else {
                        trackArray.push(track);
                    }
                }
            });
        } else {
            const track = tracklist.find(track => {
                return track.position === trackNumber.trim();
            });
            if (track) {
                trackArray.push(track);
            }
        }
        return trackArray;
    }, []);
}

/**
 * Detect Discogs "DJ Mix" credits that cover the whole release and turn them into
 * release-level dj-mixer relationships.
 *
 * #623 (sweep, C1): a DJ Mix credit that covers only some tracks — or only some of
 * the mediums — used to become a release-level DJ-mixer too. Its scope was meant to
 * ride along as a legacy jQuery "attribute" clicking the old dialog's medium
 * selector, which the dispatcher can't read, so the credit went release-wide
 * ("tracks 1–3 of 12" → "mixed the release"). Such a credit now stays in
 * `json.extraartists` with its `tracks`, and the per-track path turns it into
 * recording relationships. A credit without `tracks` is release-level already
 * (the main path maps it); it isn't touched here.
 *
 * Mutates `json.extraartists` (removes the credits it turns release-level).
 * Returns the role objects for those, ready for the dispatcher.
 */
export function convertPotentialDJMixers(json) {
    const all = flattenTracklist(json.tracklist || []).filter(t => t.type_ === 'track');
    const djmixers = (json.extraartists || [])
        .filter(artist => artist.role === 'DJ Mix' && artist.tracks)
        .map(artist => {
            const covered = new Set(getAllArtistTracks(json.tracklist, artist.tracks).map(t => t.position));
            if (!all.length || !all.every(t => covered.has(t.position))) return null;   // partial: a track credit
            json.extraartists = json.extraartists.filter(a => a !== artist);
            return Object.assign({}, ENTITY_TYPE_MAP['DJ Mix'], { artist });
        })
        .filter(role => role !== null);
    return djmixers;
}

/**
 * Map a single Discogs extraartist's `role` string into one or more
 * internal-role objects. Each comma-separated role is parsed for its base
 * (e.g. `Producer`) plus optional bracket modifiers (e.g. `[Co]`,
 * `[Additional]`). Returns roles that survived mapping; unknown bases
 * yield `null` and are filtered out.
 *
 * Special handling:
 *   - `Engineer [Recording Engineer]` / `Engineer [Mastering Engineer]`
 *     → dedicated MB link types (not the generic `engineer`).
 *   - `Artwork [Cover Design]` and `Cover [Design|Art]` → `Design` /
 *     `Artwork` link type respectively.
 *   - `[Additional|Assistant|Co|Executive|Associate|Guest|Solo]`
 *     translate into MB checkbox attributes (with `Co` remapped to
 *     `additional` per issue #3).
 *   - Roles mapped to `linkType: 'misc'` / `engineer` / `mix` /
 *     `photography` / `artwork` carry a `task` text attribute pulled
 *     from the bracket modifier.
 *   - Instrument roles fall through to the INSTRUMENTS table; the
 *     instrument name becomes a structured `{_type:'instrument',
 *     value:…}` attribute (with `Drum Programming` remapped to the
 *     `Programmed By` link type).
 */
export function getArtistRoles(artist) {
    const roleStr = artist.role;
    const rawRoles = roleStr.split(',');
    if (/\([0-9]+\)/.test(artist.anv)) {
        artist.anv = artist.anv.replace(/\([0-9]+\)/, '').trim();
    }
    if (/\([0-9]+\)/.test(artist.name)) {
        artist.name = artist.name.replace(/\([0-9]+\)/, '').trim();
    }
    return rawRoles
        .map(role => {
            let additionalAttributes = [];
            let creditedAs = null;
            let rolePart = role.trim().split('[');
            const actualRole = rolePart[0].trim();
            if (/Recording Engineer/.test(rolePart[1]) && actualRole === 'Engineer') {
                return Object.assign({}, ENTITY_TYPE_MAP['Recording Engineer'], {
                    artist: artist,
                });
            }
            if (/Mastering Engineer/.test(rolePart[1]) && actualRole === 'Engineer') {
                return Object.assign({}, ENTITY_TYPE_MAP['Mastered By'], {
                    artist: artist,
                });
            }
            if (/Cover Design/.test(rolePart[1]) && actualRole === 'Artwork') {
                return Object.assign({}, ENTITY_TYPE_MAP['Design'], {
                    artist: artist,
                });
            }
            if (/Design/.test(rolePart[1]) && actualRole === 'Cover') {
                return Object.assign({}, ENTITY_TYPE_MAP['Design'], {
                    artist: artist,
                });
            }
            if (/Art/.test(rolePart[1]) && actualRole === 'Cover') {
                return Object.assign({}, ENTITY_TYPE_MAP['Artwork'], {
                    artist: artist,
                });
            }
            if (/Additional/.test(rolePart[1])) {
                additionalAttributes.push('additional');
            }
            if (/Assistant/.test(rolePart[1])) {
                additionalAttributes.push('assistant');
            }
            if (/Co /.test(rolePart[1])) {
                // MB has no `co` attribute. The convention for "Co-X" is the
                // `additional` attribute on the base role (issue #3). Without
                // this remap MB rejects the commit ("Instrument with 'co'
                // attribute blocks the commit").
                additionalAttributes.push('additional');
            }
            if (/Executive/.test(rolePart[1])) {
                additionalAttributes.push('executive');
            }
            if (/Associate/.test(rolePart[1])) {
                additionalAttributes.push('associate');
            }
            if (/Guest/.test(rolePart[1])) {
                additionalAttributes.push('guest');
            }
            if (/Solo/.test(rolePart[1])) {
                additionalAttributes.push('solo');
            }
            const mapping = ENTITY_TYPE_MAP[actualRole];
            if (mapping && mapping.linkType == 'misc') {
                // Use sub-role text if present (e.g. '[Management]'), otherwise the role name itself
                const taskValue = rolePart[1] ? rolePart[1].replace(']', '').trim().toLowerCase() : actualRole.trim().toLowerCase();
                additionalAttributes.push({ _type: 'task', value: taskValue });
            }
            if (mapping && mapping.linkType == 'engineer' && rolePart[1]) {
                additionalAttributes.push({ _type: 'task', value: rolePart[1].replace(']', '').trim().toLowerCase() });
            }
            if (mapping && mapping.linkType == 'mix' && rolePart[1]) {
                additionalAttributes.push({ _type: 'task', value: rolePart[1].replace(']', '').trim().toLowerCase() });
            }
            if (mapping && mapping.linkType == 'photography' && rolePart[1]) {
                additionalAttributes.push({ _type: 'task', value: rolePart[1].replace(']', '').trim().toLowerCase() });
            }
            if (mapping && mapping.linkType == 'artwork' && rolePart[1]) {
                additionalAttributes.push({ _type: 'task', value: rolePart[1].replace(']', '').trim().toLowerCase() });
            }
            if (mapping && mapping.linkType == 'vocal' && rolePart[1]) {
                // #233: Voice Actor [Character] — the bracket is the character. It
                // becomes the credited-as ON the vocal attribute (rendering
                // "spoken vocals [Michal]"), NOT the artist's entity credit. Attached
                // to the attribute below.
                creditedAs = rolePart[1].replace(/]/g, '').trim() || null;
            }
            const actualRoleLc = actualRole.toLowerCase();
            if (!mapping && Object.prototype.hasOwnProperty.call(INSTRUMENTS_CI, actualRoleLc)) {
                // It's a known instrument — case-insensitive lookup so
                // Discogs role casing variants hit the same entry. The
                // mapper value is either a MB attribute name (string)
                // or `null` (= "no specific instrument; dispatch bare
                // instrument rel"). Previously the code defaulted
                // `instrumentName = actualRole` and only overrode on
                // truthy values, so vague Discogs roles like `Musician`
                // (mapped to null) leaked the raw role name through to
                // findAttrByName — which then logged
                //   WARN Attribute "musician" not found in MB
                // and dropped it anyway. Use the mapper value directly.
                let instrumentName = INSTRUMENTS_CI[actualRoleLc];
                let role = ENTITY_TYPE_MAP.Instruments;
                if (actualRoleLc === 'drum programming') {
                    role = ENTITY_TYPE_MAP['Programmed By'];
                    instrumentName = INSTRUMENTS_CI['drum machine'];
                }
                // #223: when the base instrument has no specific MB mapping
                // (`null` → bare "instrument" rel), the Discogs bracket modifier
                // often names the actual device — e.g. "Electronic Drums
                // [Rhythm Box]" is a drum machine, "Mallets [Vibraphone]" a
                // vibraphone. Gated on `!instrumentName` so a known base is
                // never overridden by its bracket (e.g. "Bass [Guitar]" must
                // stay "bass", not become "guitar").
                const bracket = rolePart[1] ? rolePart[1].replace(/]/g, '').trim() : '';
                if (instrumentName && bracket) {
                    const ref = BRACKET_REFINES.find(([base, re]) => base.test(instrumentName.toLowerCase()) && re.test(bracket));
                    if (ref) instrumentName = ref[2];
                }
                if (!instrumentName && bracket) {
                    // "Soloist [Trumpet Solo]": the instrument with "Solo" taken off (solo itself
                    // is an attribute, below)
                    const noSolo = bracket.replace(/\s*\bsolos?\b\s*/ig, ' ').trim();
                    for (const candidate of [bracket, bracket.split(',')[0].trim(), noSolo]) {
                        const lc = candidate.toLowerCase();
                        if (lc && Object.prototype.hasOwnProperty.call(INSTRUMENTS_CI, lc) && INSTRUMENTS_CI[lc]) {
                            instrumentName = INSTRUMENTS_CI[lc];
                            break;
                        }
                    }
                }
                // the bracket's solo / guest / additional ride along: they were dropped here before,
                // so "Soloist [Trumpet Solo]" lost the solo (the other bracket words aren't
                // instrument attributes)
                const extra = additionalAttributes.filter(a => a === 'solo' || a === 'guest' || a === 'additional');
                return Object.assign({}, role, {
                    artist: artist,
                    attributes: (instrumentName ? [{ _type: 'instrument', value: instrumentName.toLowerCase() }] : []).concat(extra),
                });
            }
            if (!mapping) {
                return null;
            }
            if (Array.isArray(mapping.attributes)) {
                let mapped = mapping.attributes;
                // #233: hang the Voice Actor's character off the vocal attribute as its
                // credited-as → "spoken vocals [Michal]". Clone so the shared entity-map
                // attribute object isn't mutated across roles.
                if (creditedAs && mapping.linkType === 'vocal') {
                    mapped = mapped.map(a => (a && a._type === 'vocal') ? Object.assign({}, a, { creditedAs }) : a);
                }
                additionalAttributes = additionalAttributes.concat(mapped);
            }
            return Object.assign({}, mapping, {
                artist: artist,
                attributes: additionalAttributes,
            });
        })
        .filter(resolvedRole => {
            return !!resolvedRole;
        })
        .filter((r, i, all) => !isBareInstrument(r)
            || !all.some(o => o.linkType === 'vocal' || (o.linkType === 'instrument' && !isBareInstrument(o))));
}

// #433: visual-art credits attached to EVERY track belong on the RELEASE — MB's
// artist-recording guidance reserves artwork rels for VIDEO recordings, everything else
// goes release-level. Providers (Tidal/Qobuz, Discogs track ranges) often stamp the
// cover artist onto each track. Hoist a per-track rel to ONE release-level rel when its
// (artist, linkType, attributes) span ALL tracklist positions; partial coverage stays
// per-track (it may be deliberate). Detecting video recordings would cost a lookup per
// recording — maintainer: skip that check.
const ARTWORK_LINK_TYPES = new Set(['artwork', 'design', 'photography', 'illustration', 'graphic design']);
export function hoistFullSpanArtworkRels(artistRoles, tracklistRels, tracklist) {
    const allPos = new Set((tracklist || []).map(t => String(t && t.position != null ? t.position : '')).filter(Boolean));
    if (!allPos.size) return { artistRoles, tracklistRels, hoisted: [] };
    const keyOf = r => [
        (r.artist && (r.artist.resource_url || r.artist.name)) || '',
        r.linkType,
        JSON.stringify((r.attributes || []).map(a => (a && typeof a === 'object' && a._type) ? a._type + ':' + a.value : String(a)).sort()),
    ].join('|');
    const groups = new Map();
    for (const r of tracklistRels) {
        if (!ARTWORK_LINK_TYPES.has(r.linkType) || !r.artist) continue;
        const k = keyOf(r);
        if (!groups.has(k)) groups.set(k, { rels: [], pos: new Set() });
        const g = groups.get(k);
        g.rels.push(r);
        if (r.track && r.track.position != null) g.pos.add(String(r.track.position));
    }
    const drop = new Set(), hoisted = [];
    for (const g of groups.values()) {
        if (g.pos.size !== allPos.size || ![...allPos].every(p => g.pos.has(p))) continue;
        g.rels.forEach(r => drop.add(r));
        const rel = Object.assign({}, g.rels[0]);
        delete rel.track;   // release-level now
        hoisted.push(rel);
    }
    if (!hoisted.length) return { artistRoles, tracklistRels, hoisted };
    return { artistRoles: artistRoles.concat(hoisted), tracklistRels: tracklistRels.filter(r => !drop.has(r)), hoisted };
}

/** Run `getArtistRoles` over every artist, flattening the results. */
export function rolesFromDiscogsArtists(artists) {
    return artists?.reduce((rolesArr, artist) => {
        const roles = getArtistRoles(artist);
        if (Array.isArray(roles) && roles.length > 0) {
            return rolesArr.concat(roles);
        }
        return rolesArr;
    }, []) || [];
}
