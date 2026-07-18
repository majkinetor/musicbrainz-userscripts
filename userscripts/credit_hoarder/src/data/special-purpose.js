// MusicBrainz SPECIAL-PURPOSE artists ([unknown], [traditional], Various Artists, …).
// They must never receive provider URL relationships (#428, same policy as Apollo #306)
// and their aliases are junk (#171). Keyed by MBID, not a name pattern — not all are
// bracketed (Various Artists) and plenty of real artists DO use brackets.
//
// Kept in sync BY HAND across three copies (single-file scripts can't import):
//   - apollo_editor/apollo_editor.user.js  (inline SPECIAL_PURPOSE_ARTISTS)
//   - credit_hoarder/src/data/special-purpose.js   (this file)
//   - discogs_credits/src/data/special-purpose.js  (mirror)
export const SPECIAL_PURPOSE_ARTISTS = new Set([
    '125ec42a-7229-4250-afc5-e057484327fe', // [unknown]
    'f731ccc4-e22a-43af-a747-64213329e088', // [anonymous]
    '33cf029c-63b0-41a0-9855-be2a3665fb3b', // [data]
    '314e1c25-dde7-4e4d-b2f4-0a7b9f7c56dc', // [dialogue]
    'eec63d3c-3b81-4ad4-b1e4-7c147d4d2b61', // [no artist]
    '9be7f096-97ec-4615-8957-8d40b5dcbc41', // [traditional]
    '89ad4ac3-39f7-470e-963a-56509c546377', // Various Artists
    '7e84f845-ac16-41fe-9ff8-df12eb32af55', // MusicBrainz Test Artist
    '66ea0139-149f-4a0c-8fbf-5ea9ec4a6e49', // [Disney]
    'a0ef7e1d-44ff-4039-9435-7d5fefdeecc9', // [theatre]
    '90068d37-bae7-4292-be4a-704c145bd616', // [church chimes]
    '80a8851f-444c-4539-892b-ad2a49292aa9', // [language instruction]
]);
