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

The flow: Credit Hoarder fetches the credits and lists every artist, label and place in the review table; clear matches are selected for you. You resolve the rest (or leave them out) and confirm. Instant Fill adds the relationships, and you review and submit the edit as usual.

## Import bar

<img width="600" src="./screenshots/bar.png" />

- **Import credits:** one icon per source available on this release. Click to import; right-click opens the source's page. Several sources can run in one session; their edits stack.
- **⚛ All** (with more than one source) runs a [consolidated import](#consolidated-import).

| Option                         |                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| Per-track credits              | import track credits as well as release credits                                          |
| Move release credits to tracks | put release-level recording credits (instruments, vocals, producer, mix…) on every track |
| Use works                      | existing works only, or also the ones writer credits need                                |
| Equivalence sets               | skip a role when an equivalent one is already there (writer ≡ composer)                  |
| Duplicate roles                | skip a role the recording already has                                                    |

*Use works*: *create none* (the default) uses existing works only, *create needed* also creates a work a composer, lyricist or writer credit needs, and off never touches works.

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
2. **Release context**: one of the release artist's related artists (band members, collaborators) carries the name or alias. So *George Harrison* on a Beatles release, although MusicBrainz has several.
3. **Exact name or alias**, when exactly one MusicBrainz artist carries it (*Don Abi* → *Abiodun*). A common name like *Kim* can't be proven unique and is left for you, with the reason on the row.
4. **Co-credit**: a recording that credits the name alongside the release artist.

When name and URL disagree, the row is left for you. Each match is cached with how it was made (`url`, `name+url`, `alias+url`, `context`, `name`, `alias`, `co-credit`, `user`); adding an alias with **+ alias** updates it. **🔄 Refresh from MB** re-matches rows cached before a change. A bare name's match is kept for this release only. 🔄 clears the cache and matches again.

### Match cutoff

Each automatic match has a dot saying how sure it is:

| Dot | Confidence  | Match                                                       |
| :-: | ----------- | ----------------------------------------------------------- |
|  🔵  | Exact       | `name+url`, `alias+url`                                     |
|  🟢  | Strong      | `url`, `context`                                            |
|  🟡  | Unique name | `name`, `alias`; a label or place by its exact name         |
|  🟠  | Weak        | `co-credit`, `similar name` ([⚛ All](#consolidated-import)) |

**Cutoff** in the table's header sets the lowest confidence selected for you; it starts at *Strong*. A match below it stays on its row as the first candidate, marked *below cutoff*, and ✓ takes it. Changing the cutoff applies at once to every row you haven't changed yourself. Your own picks have a grey dot.

On a row:

- **Search** by name, or paste an MBID or a MusicBrainz URL.
- **+** opens MusicBrainz's create page prefilled (name, sort name, type, source URL); the new entity is selected when you save. Right-click creates it in the background. **▾** adds options where the source has a profile (Discogs): disambiguation from the role or from selected profile text, the real name. Its **Create ↗** takes a right-click too, to create it in the background.
- **+ alias**: when the credited name is neither the artist's name nor an alias, offers to add it as one, so the next import matches it directly. Click opens the add-alias form prefilled (the button turns ✓ once the alias exists); right-click adds it in the background. A one-off spelling is better left to *Credited as*.
- **Credited as** sets the credited name on every relationship for that entity. **[MB]** and **[source]** fill in either name.
- **⋔ Split** turns a combined name (`&`, `and`, `feat.`, `vs.`, `with`, `×`, `,`, `;`) into one row per artist, expanding a shared surname: *George & Ira Gershwin* → *George Gershwin*, *Ira Gershwin*.
- **MB roles** shows the artist's existing relationship types (producer, mix, instrument…), to sanity-check the source's role.

## Consolidated import

**⚛ All** harvests every source, merges the credits into one review table, and fills once, so the same person credited by Tidal and Qobuz is resolved once.

<img width="1000" src="./screenshots/multi.png" />

- Identical credits merge before matching; rows that resolve to the same entity merge after.
- An unresolved name that is a close typo of a uniquely resolved one (*Mark Barott* → *Mark Barrott*), or differs from it only by a middle initial, is matched to it on its own row as a `similar name` match, which is [Weak](#match-cutoff). Short names and ambiguous typos aren't.
- The **source** column shows each provider that credited the row: coloured when it gave an artist URL (click to open it), grey when only a name.
- 🔗 adds every provider's URL at once, and a new artist is created with all of them.
- The edit note names the sources: `Source: Import all (Tidal, Qobuz, Deezer)`.

## Instant Fill

Adds the confirmed relationships to the editor without dialogs: release-level (labels, places, companies, artists), per track (instruments, vocals, engineers…) and per work (composer, lyricist, writer). A relationship that already exists, or was added earlier in the session, is skipped.

The edit note carries the statistics, one block per source when several ran, including how the entities used were matched: *Matched: 9 exact, 4 strong, 1 by you (cutoff: strong)*. What an earlier source already added is reported as *already added this session*, not as *already in MB*.

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
| Titles         | remixers named in the release's own track titles                                         | names                                      |          |

A source with an artist ID resolves to the exact MusicBrainz artist; a name-only credit goes through matching and your review.

- **Tidal** and **Metal Archives** open briefly in a background tab. Many Tidal albums list their credits once, on the Info tab; those are read too.
- **Qobuz**: signed in under [Platform Check](../platform_check/README.md), the credits are more reliable and carry the composer's artist ID; otherwise they are names only.
- **YouTube Music** is read anonymously, from each song's *Credits* (⋮ → Credits), for a release linked to a YouTube Music album. It has three groups: *Written by* (a writer, on the work), *Produced by* (producer) and *Performed by*, which is the track's artist credit and isn't imported. *Music metadata provided by* is the label, also not imported. Some labels send no credits at all. YouTube Music numbers a multi-disc album straight through, so its songs are placed on the release's mediums by their track counts; when the counts don't add up, the log says so.
- **Metal Archives**: guitars and bass default to electric; guests get the *guest* attribute; on a split release, each band's credits stay on its own tracks.
- **Titles** reads named remixes: *Song (Artist Remix)*, *Track (KiNK Dub)*, *Tune (Tom Moulton Mix)*, *Cut (Remixed by Someone)* each give that recording a remixer. *(Extended Mix)*, *(Radio Edit)*, a bare *(Remix)* and *(Mixed by …)* don't. It's a heuristic over a naming habit, so check what it finds.

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

The log records every step. Its menu copies the log with or without the raw data, and each source's raw and parsed data, for an issue. *Preflight diagnostics* under the log trace every request.

## Notes

How each source is read is in [DEVELOP.md](./DEVELOP.md).
