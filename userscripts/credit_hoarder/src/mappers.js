// Pure transforms between Discogs JSON and the internal "role" shape the
// rest of the script consumes. Everything in here is mechanical mapping —
// no MB API calls, no DOM, no IDB. Easiest layer to reason about in
// isolation.

import { ENTITY_TYPE_MAP } from './data/entity-map.js';
import { INSTRUMENTS }     from './data/instruments.js';
import { SELECTORS }       from './constants.js';

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

/**
 * Best-effort `Name → Sort, Name` heuristic. Used when we create a new MB
 * artist from a Discogs credit. MB's own button has the same limitations and
 * editors are expected to review the result.
 *
 *   - `The Doors` → `Doors, The` (article moves)
 *   - `John Smith` → `Smith, John` (person → family-name first)
 *   - `John Smith Jr.` → `Smith, John Jr.` (suffix preserved)
 *   - Single-word names → unchanged
 */
export function guessSortName(name) {
    if (!name || !name.trim()) return name;
    name = name.trim();

    // Articles that move to the end for group names
    const articleRe = /^(the|a|an)\s+(.+)$/i;

    // Honorific/title prefixes that are treated as part of the given name
    const honorifics = /^(dr\.?|prof\.?|sir|lady|lord|rev\.?|st\.?|dj|mc|mc\.?)\s+/i;

    // Suffixes that stay at the end after the given name
    const suffixRe = /^(.*?),?\s+(jr\.?|sr\.?|ii|iii|iv|v|esq\.?)$/i;

    // Split into words for analysis
    const words = name.split(/\s+/);

    // Single word → no change
    if (words.length === 1) return name;

    // --- Check for article prefix (group name heuristic) ---
    // Only treat as a group if it's an article + multiple remaining words,
    // AND the name doesn't look like a person name (e.g. "The" followed by what
    // looks like "Firstname Lastname" still gets treated as a group).
    const articleMatch = name.match(articleRe);
    if (articleMatch) {
        const article = articleMatch[1];
        const rest    = articleMatch[2];
        // If rest is a single word, it's clearly a group: "The Doors" → "Doors, The"
        // If rest is two+ words, it could be "The John Smith Band" — treat as group too
        return `${rest}, ${article.charAt(0).toUpperCase() + article.slice(1).toLowerCase()}`;
    }

    // --- Person name heuristic ---
    // Extract any trailing suffix
    let suffix = '';
    let baseName = name;
    const suffixMatch = name.match(suffixRe);
    if (suffixMatch) {
        baseName = suffixMatch[1].trim();
        suffix   = ' ' + suffixMatch[2];
    }

    const baseWords = baseName.split(/\s+/);
    if (baseWords.length === 1) return name; // single word after suffix strip

    // Last word is the family name
    const familyName = baseWords[baseWords.length - 1];
    const givenPart  = baseWords.slice(0, -1).join(' ');

    return `${familyName}, ${givenPart}${suffix}`;
}

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
 * Detect Discogs "DJ Mix" credits and turn them into release- or medium-level
 * dj-mixer relationships depending on whether the credit spans whole mediums.
 *
 * Mutates `json.extraartists` (removes any DJ Mix credits we've handled).
 * Returns an array of role objects ready to feed back into the dispatcher.
 */
export function convertPotentialDJMixers(json) {
    let djmixers = json.extraartists?.filter(artist => artist.role === 'DJ Mix') || [];
    djmixers = djmixers
        .map(artist => {
            const tracks = getAllArtistTracks(json.tracklist, artist.tracks);
            const mediums = json.tracklist.reduce(
                (mediums, track, index) => {
                    if (track.type_ === 'heading') {
                        if (index > 0) {
                            mediums.push([]);
                        }
                    } else {
                        mediums[mediums.length - 1].push(track);
                    }
                    return mediums;
                },
                [[]]
            );
            // now see if we can empty all our mediums
            tracks.forEach(t => {
                for (let i = 0; i < mediums.length; i++) {
                    mediums[i] = mediums[i].filter(track => {
                        return t.position !== track.position;
                    });
                }
            });
            // if some mediums are empty then we know that the artist has tracks on that medium
            let mediumsDjAppearsOn = mediums.filter(medium => medium.length === 0);
            if (mediumsDjAppearsOn.length !== mediums.length) {
                // remove them from the extraartists list
                json.extraartists = json.extraartists?.filter(a => {
                    return a !== artist;
                }) || [];
                return Object.assign({}, ENTITY_TYPE_MAP['DJ Mix'], {
                    artist: artist,
                    attributes: [
                        () => {
                            for (let j = mediums.length - 1; j >= 0; j--) {
                                if (mediums[j].length === 0) {
                                    $(SELECTORS.MediumsInput).click();
                                    $($(SELECTORS.MediumsInputOptions).get(j)).click();
                                }
                            }
                        },
                    ],
                });
            } else if (mediumsDjAppearsOn.length === mediums.length) {
                // they're on all tracks so remove
                json.extraartists = json.extraartists?.filter(a => {
                    return a !== artist;
                }) || [];
                return Object.assign({}, ENTITY_TYPE_MAP['DJ Mix'], {
                    artist: artist,
                });
            }
            return null;
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
                return Object.assign({}, role, {
                    artist: artist,
                    attributes: instrumentName ? [{ _type: 'instrument', value: instrumentName.toLowerCase() }] : [],
                });
            }
            if (!mapping) {
                return null;
            }
            if (Array.isArray(mapping.attributes)) {
                additionalAttributes = additionalAttributes.concat(mapping.attributes);
            }
            return Object.assign({}, mapping, {
                artist: artist,
                attributes: additionalAttributes,
            });
        })
        .filter(resolvedRole => {
            return !!resolvedRole;
        });
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
