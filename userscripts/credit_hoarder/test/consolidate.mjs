// #408 unit test — mergeHarvests dedup + provenance.
import assert from 'node:assert';
import { mergeHarvests, entityKeyOf, relKeyOf } from '../src/consolidate.js';

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

console.log('consolidate: all assertions passed');
