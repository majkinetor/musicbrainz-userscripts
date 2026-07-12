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

// Ambiguous: a name resolving to TWO different MBIDs is left alone (unresolved twin not forced).
{
    const results = [
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/j1', entity: { resource_url: 'a', name: 'John Smith' }, _roles: [] },
        { type: 'resolved', mbUrl: '//musicbrainz.org/artist/j2', entity: { resource_url: 'b', name: 'John Smith' }, _roles: [] },
        { type: 'attention', entity: { resource_url: 'c', name: 'John Smith' }, _roles: [] },
    ];
    const { results: out } = mergeResolvedResults(results, new Map());
    assert.equal(out.length, 3, 'ambiguous same-name (2 MBIDs) → nothing force-merged');
}

console.log('consolidate: all assertions passed');
