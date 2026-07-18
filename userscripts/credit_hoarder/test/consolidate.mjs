// #408 unit test — mergeHarvests dedup + provenance.
import assert from 'node:assert';
import { mergeHarvests, entityKeyOf, relKeyOf, mergeResolvedResults } from '../src/consolidate.js';

const rel = (name, url, linkType, pos, attrs) => ({ linkType, entityType: 'artist', attributes: attrs || [], artist: { name, anv: '', resource_url: url || '' }, track: { position: String(pos), title: '', type_: 'track' } });

// Same composer on the same track from two sources → ONE row, both sources.
{
    const deezer = { sourceName: 'Deezer', processTracklist: true, tracklistRels: [rel('Jane Doe', '', 'composer', 1)], tracklist: [{ position: '1', title: '' }] };
    const qobuz = { sourceName: 'Qobuz', processTracklist: true, tracklistRels: [rel('Jane Doe', '', 'composer', 1)], tracklist: [{ position: '1', title: '' }] };
    const m = mergeHarvests([deezer, qobuz]);
    assert.equal(m.tracklistRels.length, 1, 'identical credit from 2 sources collapses to 1');
    const k = relKeyOf(m.tracklistRels[0]);
    assert.deepEqual(m.relSrc.get(k).sort(), ['Deezer', 'Qobuz'], 'both sources recorded on the merged credit');
    assert.deepEqual((m.entitySources.get('_nourl_Jane Doe') || []).sort(), ['Deezer', 'Qobuz'], 'entity sources union');
}

// Same person + track but DIFFERENT roles → two rows kept (majkinetor: keep both).
{
    const a = { sourceName: 'Deezer', processTracklist: true, tracklistRels: [rel('X', '', 'composer', 2)] };
    const b = { sourceName: 'Discogs', processTracklist: true, tracklistRels: [rel('X', '', 'writer', 2)] };
    const m = mergeHarvests([a, b]);
    assert.equal(m.tracklistRels.length, 2, 'different roles stay separate rows');
    assert.deepEqual((m.entitySources.get('_nourl_X') || []).sort(), ['Deezer', 'Discogs'], 'entity aggregates both sources across its rels');
}

// URL-linked identity dedups by URL; a name-only credit for the same name is a DIFFERENT key
// (we can't prove they're the same pre-resolution) — both kept, distinct provenance.
{
    const linked = { sourceName: 'Tidal', processTracklist: true, tracklistRels: [rel('Bob', 'https://tidal.com/artist/9', 'producer', 1)] };
    const nameonly = { sourceName: 'Qobuz', processTracklist: true, tracklistRels: [rel('Bob', '', 'producer', 1)] };
    const m = mergeHarvests([linked, nameonly]);
    assert.equal(m.tracklistRels.length, 2, 'url-linked vs name-only kept separate pre-resolution');
    assert.equal(entityKeyOf({ resource_url: 'https://tidal.com/artist/9' }), 'https://tidal.com/artist/9');
}

// companies dedup by resource_url; tracklist unions by position.
{
    const d1 = { sourceName: 'Discogs', companies: [{ resource_url: 'https://www.discogs.com/label/1', entity_type_name: 'label' }], tracklist: [{ position: '1' }, { position: '2' }] };
    const d2 = { sourceName: 'Tidal', companies: [{ resource_url: 'https://www.discogs.com/label/1', entity_type_name: 'label' }], tracklist: [{ position: '2' }, { position: '3' }] };
    const m = mergeHarvests([d1, d2]);
    assert.equal(m.companies.length, 1, 'same label from 2 sources deduped');
    assert.deepEqual(m.tracklist.map(t => t.position).sort(), ['1', '2', '3'], 'tracklist unioned by position');
    assert.equal(m.processTracklist, false, 'processTracklist false when no source set it');
    // #408 follow-up: companies get provenance too (so their Source column shows a badge, not "—"),
    // keyed by resource_url exactly like the review row's _entityKey.
    assert.deepEqual((m.entitySources.get('https://www.discogs.com/label/1') || []).sort(), ['Discogs', 'Tidal'], 'company sources tracked + unioned');
}

// A name-only company (no resource_url) is keyed by _nourl_<name>, matching the review row.
{
    const d = { sourceName: 'Discogs', companies: [{ name: 'The Carvery', entity_type_name: 'label' }] };
    const m = mergeHarvests([d]);
    assert.deepEqual(m.entitySources.get('_nourl_The Carvery') || [], ['Discogs'], 'name-only company keyed by _nourl_<name>');
}

// mergeResolvedResults: two sources resolve the SAME person to the SAME MBID → one row,
// combined roles, unioned source badges; and the mergeMap covers both source keys.
{
    const tidalUrl = 'https://tidal.com/artist/9', qobuzUrl = 'https://open.qobuz.com/artist/5';
    const mb = '//musicbrainz.org/artist/abc';
    const results = [
        { type: 'resolved', mbUrl: mb, entity: { name: 'Reggie', resource_url: tidalUrl }, _roles: [{ linkType: 'composer', displayLabel: 'composer', trackPos: '15', trackTitle: '' }] },
        { type: 'resolved', mbUrl: mb, entity: { name: 'Reggie', resource_url: qobuzUrl }, _roles: [{ linkType: 'producer', displayLabel: 'producer', trackPos: '15', trackTitle: '' }] },
    ];
    const es = new Map([[tidalUrl, ['Tidal']], [qobuzUrl, ['Qobuz']]]);
    const { results: out, mergeMap } = mergeResolvedResults(results, es);
    assert.equal(out.length, 1, 'same-MBID rows across sources collapse to one');
    assert.deepEqual(out[0]._roles.map(r => r.linkType).sort(), ['composer', 'producer'], 'roles from both sources combined');
    assert.deepEqual((es.get(tidalUrl) || []).sort(), ['Qobuz', 'Tidal'], 'source badges unioned onto the kept row');
    assert.deepEqual(mergeMap.get(tidalUrl).sort(), [qobuzUrl, tidalUrl].sort(), 'mergeMap covers every merged source url');
    assert.deepEqual((out[0]._mergeUrls || []).sort(), [qobuzUrl, tidalUrl].sort(), 'merged row carries all source URLs (for add-all-links)');
}

// Distinct MBIDs stay separate rows.
{
    const results = [
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/a', entity: { resource_url: 'u1', name: 'A' }, _roles: [] },
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/b', entity: { resource_url: 'u2', name: 'B' }, _roles: [] },
    ];
    const { results: out } = mergeResolvedResults(results, new Map());
    assert.equal(out.length, 2, 'distinct MBIDs stay separate');
}

// #408 (Alan Morrallee): one source resolved the name, the other didn't → the unresolved row is
// routed to its resolved same-name twin, adopts the MBID, and its roles + source merge in.
{
    const tidal = 'https://tidal.com/artist/1', qobuz = 'https://open.qobuz.com/artist/2';
    const results = [
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/alan', entity: { resource_url: tidal, name: 'Alan Morrallee' }, _roles: [{ linkType: 'producer', displayLabel: 'producer', trackPos: '8', trackTitle: '' }] },
        { type: 'attention', entity: { resource_url: qobuz, name: 'Alan Morrallee' }, _roles: [{ linkType: 'composer', displayLabel: 'composer', trackPos: '8', trackTitle: '' }] },
    ];
    const es = new Map([[tidal, ['Tidal']], [qobuz, ['Qobuz']]]);
    const { results: out, mergeMap } = mergeResolvedResults(results, es);
    assert.equal(out.length, 1, 'unresolved same-name row merges into the resolved one');
    assert.equal(out[0].type, 'resolved', 'kept row is resolved (adopted the MBID)');
    assert.equal(out[0].mbUrl, '//musicbrainz.org/artist/alan');
    assert.deepEqual(out[0]._roles.map(r => r.linkType).sort(), ['composer', 'producer'], 'roles merged across resolved + unresolved');
    assert.deepEqual((es.get(tidal) || []).sort(), ['Qobuz', 'Tidal'], 'sources unioned');
    assert.deepEqual(mergeMap.get(tidal).sort(), [qobuz, tidal].sort(), 'both source urls in the mergeMap');
}

// Two same-name rows that NEVER resolved still merge (one review row to resolve once).
{
    const results = [
        { type: 'attention', entity: { resource_url: 'x1', name: 'Jane' }, _roles: [{ linkType: 'composer', displayLabel: 'composer', trackPos: '1', trackTitle: '' }] },
        { type: 'attention', entity: { resource_url: 'x2', name: 'Jane' }, _roles: [{ linkType: 'lyricist', displayLabel: 'lyricist', trackPos: '1', trackTitle: '' }] },
    ];
    const { results: out } = mergeResolvedResults(results, new Map());
    assert.equal(out.length, 1, 'same-name unresolved rows merge');
    assert.deepEqual(out[0]._roles.map(r => r.linkType).sort(), ['composer', 'lyricist']);
}

// #415 (conflict row): the same name resolved to TWO different MB artists across sources
// (John Andrews) → ONE attention row with both MB artists as candidates; the unresolved
// same-name row joins the group. Nothing auto-imports until the user picks.
{
    const results = [
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/j1', mbName: 'John Smith', mbDisambig: 'US bassist', entity: { resource_url: 'a', name: 'John Smith' }, _roles: [{ linkType: 'organ', displayLabel: 'organ', trackPos: '', trackTitle: '' }] },
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/j2', mbName: 'John Smith', mbDisambig: 'UK organist', entity: { resource_url: 'b', name: 'John Smith' }, _roles: [{ linkType: 'piano', displayLabel: 'piano', trackPos: '', trackTitle: '' }] },
        { type: 'attention', entity: { resource_url: 'c', name: 'John Smith' }, _roles: [{ linkType: 'photography', displayLabel: 'photography', trackPos: '', trackTitle: '' }] },
    ];
    const es = new Map([['a', ['Discogs']], ['b', ['Tidal']], ['c', ['Qobuz']]]);
    const { results: out, mergeMap } = mergeResolvedResults(results, es);
    assert.equal(out.length, 1, 'conflicting resolutions collapse to ONE row (#415)');
    assert.equal(out[0].type, 'attention', 'conflict row needs the user to pick');
    assert.equal(out[0].mbUrl, null, 'no auto-adopted MBID on a conflict row');
    assert.deepEqual(out[0].nameMatches.map(c => c.id).sort(), ['j1', 'j2'], 'both MB artists offered as candidates');
    assert.equal(out[0].nameMatches.find(c => c.id === 'j2').disambiguation, 'UK organist', 'candidate keeps its disambiguation');
    assert.deepEqual(out[0]._roles.map(r => r.linkType).sort(), ['organ', 'photography', 'piano'], 'roles unioned across all three rows');
    assert.deepEqual((es.get('a') || []).sort(), ['Discogs', 'Qobuz', 'Tidal'], 'source badges unioned');
    assert.deepEqual(mergeMap.get('a').sort(), ['a', 'b', 'c'], 'mergeMap covers every member for post-pick expansion');
}

// #415 (middle initial): an unresolved "Vasilis Korres" merges into the uniquely-resolved
// "Vasilis N. Korres" (single-letter tokens ignored when looking for the resolved twin).
{
    const tidal = 'https://tidal.com/artist/1', discogs = 'https://www.discogs.com/artist/2';
    const results = [
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/vasilis', entity: { resource_url: tidal, name: 'Vasilis N. Korres' }, _roles: [{ linkType: 'recording', displayLabel: 'recording', trackPos: '', trackTitle: '' }] },
        { type: 'attention', entity: { resource_url: discogs, name: 'Vasilis Korres' }, _roles: [{ linkType: 'engineer', displayLabel: 'engineer', trackPos: '', trackTitle: '' }] },
    ];
    const es = new Map([[tidal, ['Tidal']], [discogs, ['Discogs']]]);
    const { results: out, mergeMap } = mergeResolvedResults(results, es);
    assert.equal(out.length, 1, 'middle-initial variant merges into its resolved twin (#415)');
    assert.equal(out[0].mbUrl, '//musicbrainz.org/artist/vasilis', 'adopts the resolved MBID');
    assert.deepEqual(out[0]._roles.map(r => r.linkType).sort(), ['engineer', 'recording'], 'roles merged');
    assert.deepEqual(mergeMap.get(tidal).sort(), [discogs, tidal].sort(), 'both urls in mergeMap');
}

// #415 (initial guard): stripping initials must not merge across DIFFERENT initials that
// resolve to different people — "John A. Smith" and "John B. Smith" both strip to
// "john smith", so an unresolved "John Smith" has no unique twin and stays alone.
{
    const results = [
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/a', entity: { resource_url: 'u1', name: 'John A. Smith' }, _roles: [] },
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/b', entity: { resource_url: 'u2', name: 'John B. Smith' }, _roles: [] },
        { type: 'attention', entity: { resource_url: 'u3', name: 'John Smith' }, _roles: [] },
    ];
    const { results: out } = mergeResolvedResults(results, new Map());
    assert.equal(out.length, 3, 'stripped-name ambiguity (2 MBIDs) → nothing force-merged');
}

// #408 (typo merge): an unresolved credit that is a single-char typo of a uniquely-resolved name
// ("Mark Barott" vs "Mark Barrott") routes to that MBID and merges.
{
    const tidal = 'https://tidal.com/artist/1', qobuz = 'https://open.qobuz.com/artist/2';
    const results = [
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/mark', entity: { resource_url: tidal, name: 'Mark Barrott' }, _roles: [{ linkType: 'producer', displayLabel: 'producer', trackPos: '3', trackTitle: '' }] },
        { type: 'attention', entity: { resource_url: qobuz, name: 'Mark Barott' }, _roles: [{ linkType: 'remixer', displayLabel: 'remixer', trackPos: '3', trackTitle: '' }] },
    ];
    const es = new Map([[tidal, ['Tidal']], [qobuz, ['Qobuz']]]);
    const { results: out, mergeMap } = mergeResolvedResults(results, es);
    assert.equal(out.length, 1, 'typo name merges into its uniquely-resolved twin');
    assert.equal(out[0].mbUrl, '//musicbrainz.org/artist/mark', 'typo row adopts the resolved MBID');
    assert.deepEqual(out[0]._roles.map(r => r.linkType).sort(), ['producer', 'remixer'], 'roles merged across typo pair');
    assert.deepEqual(mergeMap.get(tidal).sort(), [qobuz, tidal].sort(), 'both urls in mergeMap');
}

// #408 (typo guard): short names must NOT fuzzy-merge (too collision-prone) — "Joan" vs "John".
{
    const results = [
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/john', entity: { resource_url: 'a', name: 'John' }, _roles: [] },
        { type: 'attention', entity: { resource_url: 'b', name: 'Joan' }, _roles: [] },
    ];
    const { results: out } = mergeResolvedResults(results, new Map());
    assert.equal(out.length, 2, 'short-name single-edit difference stays separate');
}

// #408 (typo ambiguity): a typo within tolerance of TWO different resolved names (exact to neither)
// is left alone.
{
    const results = [
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/1', entity: { resource_url: 'a', name: 'Roberto Fonseca' }, _roles: [] },
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/2', entity: { resource_url: 'b', name: 'Roberta Fonseca' }, _roles: [] },
        { type: 'attention', entity: { resource_url: 'c', name: 'Robertt Fonseca' }, _roles: [] },
    ];
    const { results: out } = mergeResolvedResults(results, new Map());
    assert.equal(out.length, 3, 'typo within tolerance of two resolved names → nothing force-merged');
}

// #417 (kind guard): a music PUBLISHER named like the singer is a LABEL row — it must NOT
// name-merge into the resolved artist row (that dispatched an artist into a label→work
// publishing rel, which MB rejects and the whole edit failed to submit).
{
    const results = [
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/monica', entityType: 'artist', entity: { resource_url: 'https://tidal.com/artist/9621022', name: 'Monica Rypma' }, _roles: [{ linkType: 'vocal', displayLabel: 'lead vocals', trackPos: '1', trackTitle: '' }] },
        { type: 'attention', entityType: 'label', entity: { resource_url: 'https://tidal.com/_publisher/Monica%20Rypma', name: 'Monica Rypma', entityType: 'label' }, _roles: [{ linkType: 'publishing', displayLabel: 'publishing', trackPos: '1', trackTitle: '' }] },
    ];
    const { results: out } = mergeResolvedResults(results, new Map());
    assert.equal(out.length, 2, 'same-named label (publisher) row never merges into the artist row (#417)');
    assert.equal(out.find(r => r.entityType === 'label').type, 'attention', 'publisher row stays unresolved for the user');
}

// #417 (kind guard, resolved both): a resolved artist and a resolved label sharing a name are
// NOT a #415 conflict — different kinds are different entities by definition.
{
    const results = [
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/w1', entityType: 'artist', entity: { resource_url: 'a', name: 'Widowspeak' }, _roles: [] },
        { type: 'resolved', mbUrl: '//musicbrainz.org/label/w2', entityType: 'label', entity: { resource_url: 'b', name: 'Widowspeak' }, _roles: [] },
    ];
    const { results: out } = mergeResolvedResults(results, new Map());
    assert.equal(out.length, 2, 'same-named artist + label resolved rows are no conflict, stay separate');
    assert.ok(out.every(r => r.type === 'resolved'), 'neither row downgraded');
}

// #428: synthesized provider keys (tidal.com/_publisher/… , /_company/…) are resolution
// keys, not pages — they must never enter the row's URL set (no dead add-link chip/badge).
{
    const synth = 'https://tidal.com/_publisher/Shika%20Shika';
    const real  = 'https://tidal.com/artist/123';
    const results = [
        { type: 'resolved', mbUrl: '//musicbrainz.org/label/shika', entityType: 'label', entity: { resource_url: synth, name: 'Shika Shika', entityType: 'label' }, _roles: [] },
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/abc', entityType: 'artist', entity: { resource_url: real, name: 'Real Artist' }, _roles: [] },
    ];
    const { results: out } = mergeResolvedResults(results, new Map());
    assert.deepEqual(out.find(r => r.entityType === 'label')._mergeUrls, [], 'synthetic publisher key excluded from _mergeUrls (#428)');
    assert.deepEqual(out.find(r => r.entityType === 'artist')._mergeUrls, [real], 'real provider URL kept');
}

// #429: Discogs member keys carry the API form — the row's URL set must hold the WEBSITE
// form (MB refuses api.discogs.com as a URL relationship).
{
    const api = 'https://api.discogs.com/artists/3749';
    const tidal = 'https://tidal.com/artist/55';
    const mb = '//musicbrainz.org/artist/boozoo';
    const results = [
        { type: 'resolved', mbUrl: mb, entityType: 'artist', entity: { resource_url: api, name: 'Boozoo Bajou' }, _roles: [] },
        { type: 'resolved', mbUrl: mb, entityType: 'artist', entity: { resource_url: tidal, name: 'Boozoo Bajou' }, _roles: [] },
    ];
    const { results: out } = mergeResolvedResults(results, new Map());
    assert.equal(out.length, 1, 'same-MBID rows merge');
    assert.deepEqual(out[0]._mergeUrls.sort(), ['https://tidal.com/artist/55', 'https://www.discogs.com/artist/3749'], 'api.discogs.com canonicalized to www form in _mergeUrls (#429)');
}

console.log('consolidate: all assertions passed');
