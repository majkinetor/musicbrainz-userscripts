# Credit Hoarder <img src="icon.svg" align="left" width="48" height="48">

Imports track and release credits from streaming services and databases into MusicBrainz relationships, with a review step so only entities that really exist in MusicBrainz are linked.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/credit_hoarder/dist/credit_hoarder.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/credit_hoarder/dist/credit_hoarder.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)

<img width="600" src="./screenshots/review_table.png" />

It appears on a release's **Edit relationships** page when there's something to import: a linked [provider](#providers) (or one [Platform Check](../platform_check/README.md) found), or track titles that name a remixer. See [Style / Relationships](https://musicbrainz.org/doc/Style/Relationships) for the guidelines.

> [!TIP]
> [Group Therapy](../group_therapy/README.md) adds batch helpers for the same page: group delete, highlight, copy and move credits.

## Features

- **[Import bar](#import-bar)**: pick a [source](#providers) and the import options.
- **[Review table](#review-table)**: confirm each credited name's MusicBrainz match, with automatic matching, a [confidence cutoff](#match-cutoff), search and entity creation.
- **[Consolidated import](#consolidated-import)** of every source at once, de-duplicated.
- **[Instant Fill](#instant-fill)** writes the confirmed relationships into the editor in one pass.
- **[Diagnostics](#diagnostics)**: a log of every step, to copy into an issue.

Credit Hoarder lists every credited artist, label and place, with clear matches selected. You resolve the rest or leave them out; Instant Fill adds the relationships, and you submit as usual.

## Import bar

<img width="600" src="./screenshots/bar.png" />

- **Import credits:** one icon per source available on this release. Click to import; right-click opens the source's page. Several sources can run in one session; their edits stack.
- **⚛ All** (with more than one source) runs a [consolidated import](#consolidated-import).

| Option                         |                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| Per-track credits              | import track credits as well as release credits                                          |
| Move release credits to tracks | put release-level recording credits (instruments, vocals, producer, mix…) on every track |
| Use works                      | existing ones (*create none*), also those writer credits need (*create needed*), or off  |
| Equivalence sets               | skip a role when an equivalent one is already there (writer ≡ composer)                  |
| Duplicate roles                | skip a role the recording already has                                                    |

## Review table

One row per credited entity:

| Row |                                                    |
| --- | -------------------------------------------------- |
| ⚪   | matched automatically                              |
| 🟢   | picked by you                                      |
| 🟡   | matched by URL, but the names differ; worth a look |
| 🔴   | unresolved, or matched below the cutoff            |

For sources that give an artist URL (Discogs, Tidal, Metal Archives), a chip shows it: ✓ already linked in MusicBrainz, 🔗 add it (opens the edit page prefilled), ⚠ linked to a different entity.

**Automatic matching**, in this order:

1. **Source URL**: the artist is linked to that URL in MusicBrainz. When it also carries the credited name, as its name or an alias, the row says `name+url` or `alias+url`; otherwise just `url`, and **+ alias** is offered.
2. **Release context**: one of the release artist's related artists (band members, collaborators) carries the name or alias: *George Harrison* on a Beatles release.
3. **Exact name or alias**, when exactly one MusicBrainz artist carries it (*Don Abi* → *Abiodun*). A common name like *Kim* can't be proven unique and is left for you, with the reason on the row.
4. **Co-credit**: a recording that credits the name alongside the release artist.

When name and URL disagree, the row is left for you. Matches are remembered, a bare name's for this release only. **🔄 Refresh from MB** re-matches rows remembered before a change in MusicBrainz; 🔄 forgets them all and matches again.

### Match cutoff

Each automatic match has a dot saying how sure it is:

| Dot | Confidence  | Match                                                       |
| :-: | ----------- | ----------------------------------------------------------- |
|  🔵  | Exact       | `name+url`, `alias+url`                                     |
|  🟢  | Strong      | `url`, `context`                                            |
|  🟡  | Unique name | `name`, `alias`; a label or place by its exact name         |
|  🟠  | Weak        | `co-credit`, `similar name` ([⚛ All](#consolidated-import)) |

**Cutoff** in the table's header (default *Strong*) is the lowest confidence selected for you. A match below it waits on its row, marked *below cutoff*, for ✓. A change applies at once to every row but your own picks, which have a grey dot.

On a row:

- The roles under the name are the relationships it gets, with their task where there is one: *Coordinator [Album]* is *misc: album coordinator*. Hover them for the credit each came from.
- **Search** by name, or paste an MBID or a MusicBrainz URL.
- **+** opens MusicBrainz's create page prefilled (name, sort name, type, source URL) and selects the new entity once saved; a right-click creates it in the background. Where the source has a profile (Discogs), **▾** adds a disambiguation from the role or the profile, and the real name; its **Create ↗** takes a right-click too.
- **+ alias** adds a credited name the artist lacks as an alias, so the next import matches it: a click opens the prefilled form, a right-click adds it in the background. A one-off spelling is better left to *Credited as*.
- **Credited as** sets the credited name on every relationship for that entity. **[MB]** and **[source]** fill in either name.
- **⋔ Split** turns a combined name (`&`, `and`, `feat.`, `vs.`, `with`, `×`, `,`, `;`) into one row per artist, expanding a shared surname: *George & Ira Gershwin* → *George Gershwin*, *Ira Gershwin*.
- **MB roles** shows the artist's existing relationship types (producer, mix, instrument…), to sanity-check the source's role.

## Consolidated import

**⚛ All** harvests every source, merges the credits into one review table, and fills once, so the same person credited by Tidal and Qobuz is resolved once.

<img width="1000" src="./screenshots/multi.png" />

- Identical credits merge before matching; rows that resolve to the same entity merge after.
- An unresolved name a close typo or a middle initial away from a resolved one (*Mark Barott* → *Mark Barrott*) gets it as a [Weak](#match-cutoff) `similar name` match. Short names and ambiguous typos don't.
- The **source** column shows each provider that credited the row: coloured when it gave an artist URL (click to open it), grey when only a name.
- 🔗 adds every provider's URL at once, and a new artist is created with all of them.
- The edit note names the sources: `Source: Import all (Tidal, Qobuz, Deezer)`.

## Instant Fill

Adds the confirmed relationships to the editor without dialogs: release-level (labels, places, companies, artists), per track (instruments, vocals, engineers…) and per work (composer, lyricist, writer). A relationship that already exists, or was added earlier in the session, is skipped.

The edit note carries the statistics per source, with how the entities were matched: *Matched: 9 exact, 4 strong, 1 user (cutoff: strong)*. What an earlier source added counts as *already added this session*, not *already in MB*.

## Providers

| Source         | Credits                                                                                  | Artist identity                            | Login    |
| -------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------ | -------- |
| Discogs        | the fullest: performers, instruments, engineering, production, artwork, mastering        | Discogs artist ID                          |          |
| Tidal          | producer, engineers, writers and publisher per track; performers and artwork per release | Tidal artist ID, on nearly all credits     |          |
| Metal Archives | the lineup with instruments, work credits, other staff                                   | Metal Archives artist ID                   |          |
| Qobuz          | composer, lyricist, producer, publisher, performers                                      | names, except the composer and main artist | optional |
| Apple Music    | composer, writer, lyricist, producer, engineers, arranger, vocals                        | names                                      |          |
| YouTube Music  | writer, producer                                                                         | names                                      |          |
| Deezer         | composers only                                                                           | names                                      |          |
| mora           | composer, lyricist, arranger, producer                                                   | names                                      |          |
| Titles         | remixers named in the release's own track titles                                         | names                                      |          |

A source with an artist ID resolves to the exact MusicBrainz artist; a name-only credit goes through matching and your review.

- **Tidal** and **Metal Archives** open briefly in a background tab. Tidal's album-wide credits (the Info tab) are read too.
- **Qobuz**: signed in under [Platform Check](../platform_check/README.md), the credits are more reliable and carry the composer's artist ID; otherwise they are names only.
- **YouTube Music**, for a release linked to an album there, reads each song's *Credits*: *Written by* (a writer, on the work) and *Produced by*. *Performed by* and the label aren't imported; some labels send no credits. Songs are placed on the mediums by their track counts; when those don't add up, the log says so.
- **mora**, for a release linked to a mora.jp package, reads each track's composer, lyricist, arranger and producer. Several names in one credit are split on `、` and commas.
- **Metal Archives**: guitars and bass default to electric; guests get the *guest* attribute; on a split release, each band's credits stay on its own tracks.
- **Titles** reads named remixes: *Song (Artist Remix)*, *Track (KiNK Dub)*, *Tune (Tom Moulton Mix)*, *Cut (Remixed by Someone)* each give that recording a remixer. *(Extended Mix)*, *(Radio Edit)*, a bare *(Remix)* and *(Mixed by …)* don't. Check what it finds.

| Streaming role                                | MusicBrainz relationship                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| Composer, Lyricist, Writer, Orchestrator      | on the work (created if *Use works* allows)                                   |
| Producer, Mixing / Recording / Sound Engineer | on the recording (*mix*, *recording*, *sound*); an assistant gets *assistant* |
| Instruments, Vocals, Conductor                | on the recording                                                              |
| Artwork                                       | on the release                                                                |
| Music Publisher                               | a label, *publishing* the work (`Copyright Control` is dropped)               |
| Distributor                                   | a label, *distributed* the release                                            |

Not imported, but listed as skipped: main and featured artists and the record label (set elsewhere), mastering engineer (belongs on the release), sound editor, studio personnel.

## Diagnostics

The log records every step. Its menu copies it, with or without each source's raw and parsed data, for an issue. *Preflight diagnostics* trace every request.

## Notes

How each source is read is in [DEVELOP.md](./DEVELOP.md).
