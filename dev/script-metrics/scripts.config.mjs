// The userscripts whose MusicBrainz edits we count. Each script stamps its edit
// notes with a header like:
//
//   Apollo Editor v2026.6.22 by majkinetor - https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/apollo_editor/README.md
//
// so the unique, stable discriminator is the repo path `userscripts/<slug>` —
// it appears in every note that script writes (README.md links AND the
// Art Station `tree/main/userscripts/art_station` form), and never collides
// between scripts. We search MB edit notes for that substring.
//
// `note` flags scripts that may legitimately produce zero edits (read-only
// analysers that only annotate, never submit) so a 0 isn't read as a bug.

export const SCRIPTS = [
  { slug: 'apollo_editor',   name: 'Apollo Editor' },
  { slug: 'credit_hoarder',  name: 'Credit Hoarder' },
  { slug: 'discogs_credits', name: 'Discogs Credits' },
  { slug: 'art_station',     name: 'Art Station' },
  { slug: 'mammoth',         name: 'Mammoth',        note: 'mostly annotates edit notes; may submit few/no edits of its own' },
  { slug: 'platform_check',  name: 'Platform Check', note: 'analysis tool; may not submit edits' },
  { slug: 'isrc_scout',      name: 'ISRC Scout',     note: 'analysis tool; may not submit edits' },
];

// The substring searched in MB edit-note content for a given script.
export const discriminator = (slug) => `userscripts/${slug}`;
