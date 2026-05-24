# GitHub Discussions to create

Drafts for new bugs/findings discovered during the refactor + test-harness work
on branch `refactoring_and_some_fixes`. Each block is meant to become one
Discussion on https://github.com/majkinetor/musicbrainz-userscripts/discussions
(or, if you prefer, an Issue — Discussions are just easier to triage first).

When filed, delete the block below or replace it with a link.

How to file:
- **Manually**: copy the title + body, paste at https://github.com/majkinetor/musicbrainz-userscripts/discussions/new
- **Via `gh` (if installed)**: `gh discussion create --repo majkinetor/musicbrainz-userscripts --category Bugs --title "..." --body-file <(echo "...")`

---

## Bug #5 — 51 instruments silently dropped at import time (INSTRUMENTS dup keys)

**Labels:** `bug`, `discogs_credits`

The `INSTRUMENTS` table at the bottom of `discogs_credits.user.js` has ~51 duplicate keys: an early "mapped" entry like

```js
Banjo: 'banjo',
```

is silently overridden by a later

```js
Banjo: null,
```

in the catch-all "unmapped" block at the bottom. Per the JS spec the **later** declaration wins, so for every release that credits one of these 51 instruments, the script sets the attribute to `null` and the instrument tag is **dropped** at import time. Banjo, cello, harp, sitar, piano, organ, saxophone, trumpet, harmonica, mandolin, etc. — all affected.

This is latent today (it's been there since the table was assembled) and was discovered by adding ESLint with `no-dupe-keys` as part of the refactor (`pnpm run verify`).

**Affected lines in `src/discogs_credits.user.js`** (post-refactor branch — line numbers will shift in `main`): ~4575–4818 (the catch-all block at the bottom of the literal).

**Affected keys** (51 confirmed via a small Node scan):

```
Bongos, Xylophone, Bells, Bongos, Claves, Congas, Cowbell, Maracas, Percussion,
Shaker, Tabla, Tambourine, Timbales, Udu, Celesta, Chimes, Glockenspiel, Marimba,
Vibraphone, Xylophone, Harmonium, Harpsichord, Keyboards, Melodica, Organ,
Piano, Synth, Synthesizer, Banjo, Cello, Harp, Kora, Laúd, Mandolin, Oud, Sitar,
Strings, Ukulele, Viola, Violin, Accordion, Bassoon, Clarinet, Cornet, Didgeridoo,
Flugelhorn, Flute, Harmonica, Oboe, Saxophone, Trombone, Trumpet, Tuba,
Electronics, Theremin, Vocoder, Mbira
```

**Fix:** delete the later `null` duplicate for each affected key (preserves the intended mapping). Lint disabled around the block on the refactor branch with a marker comment until the data is cleaned.

---

## Bug #6 — "Done: X added, Y already existed" only counts pre-existing **works**, not pre-existing relationships

**Labels:** `bug`, `discogs_credits`

The summary line at the end of an import claims a count of "already existed" relationships, but in practice that counter (`skipped`) is only incremented on a few specific paths inside `instantFillRelationships` — `dispatchedThisSession` dedup, the work-already-linked branch, and a couple of skip cases. A pre-existing relationship that gets dispatched a second time is counted as **added** because MB's reducer no-ops the redundant dispatch and the script never asks.

Example from a Midwest Funk import: the script says "Done: 100 added, 4 already existed, 0 failed/skipped". The "4" refers to four works that already had a `recording of` link. The actual count of *relationships* the script tried to add that were already present is much higher.

**Fix:** in `processOne` (or wherever the final dispatch happens), scan the source entity's relationships for an existing rel with matching `(linkTypeID, target.gid, attrs)` *before* calling `re.dispatch(...)`. If one exists, increment a separate `alreadyExistedRels` counter and skip the dispatch.

Suggested updated summary layout:

```
Done: 91 added (88 rels, 3 works), 18 already existed (14 rels, 4 works), 0 failed/skipped
```

---

## Bug #7 — Entity-resolution cache only persists when the user clicks "Start import"

**Labels:** `bug`, `discogs_credits`, `performance`

The `mblinks` IndexedDB store is updated in two places:

1. **Inline writes** inside `checkOne()` in `checkMissingArtists` / `checkMissingCompanies`, called per entity as preflight resolves a name match or URL hit.
2. **Bulk write** at the end of `startImportRels`, iterating `confirmedMap.forEach(...)` after the user clicks "Start import" on the review table.

In practice (2) is what populates IDB for most entities — the (1) inline writes only happen on certain resolution paths. So if preflight is interrupted before the user confirms (tab close, JS error in the review table, anything that prevents the click), the work the preflight just did is **lost** and the next run starts from scratch.

For a release like Midwest Funk (230 entities, ~10 min rate-limited preflight on a cold cache), this is painful — every interrupted run is ~10 min thrown away.

**Fix:** write to IDB as each entity resolves inside the preflight workers, not just on confirm. The bulk write at the end becomes a final correctness sweep but the script becomes resumable.

---

## Note: bug #2 variant (also caught by the new test gate)

Bug majkinetor/musicbrainz-userscripts#2 ("Mastering relationship is deprecated for recordings") is one instance of a broader class. The new headless test harness caught a sibling on the very first run:

> `linkType "orchestra"` dispatched with `(artist, recording)` endpoints; MB metadata defines that link type as `(artist, event)`.

The generalized fix from the refactor plan (validate every dispatched `(linkTypeID, sourceType, targetType)` triple against `MB.linkedEntities.link_type` before dispatch) addresses both, plus any future variants. Mentioning here for cross-reference; no separate Discussion needed.
