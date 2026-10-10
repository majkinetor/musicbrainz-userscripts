# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md); the user docs are in [README.md](README.md). `pnpm test` here runs this script's specs (`--project=mission_control`) on test.musicbrainz.org.

## Provider bus

Mission Control is a planner and a dashboard. What to probe and how to apply it stays in each member script ([#680](https://github.com/majkinetor/musicbrainz-userscripts/issues/680), [#677](https://github.com/majkinetor/musicbrainz-userscripts/discussions/677)). They all run on the same `/release/<mbid>` page, so they talk through events on `document`.

Every `detail` is a **JSON string**, never an object. Each userscript runs in its own sandbox, and Firefox's Xray wrappers hide an object's fields from another realm. Falcon's `falcon:*` events follow the same rule.

| Event | From | `detail` |
| --- | --- | --- |
| `mc:discover` | MC | `{ release, mc }`: the release MBID and MC's version |
| `mc:provider` | provider | `{ id, name, version, release, capabilities: [...] }` |
| `mc:probe` | MC | `{ release, run, only, links, isrcs }`: `only` lists the provider ids asked; `links`, the album links selected in PC's card; `isrcs`, after a [consolidation](#consolidation), the ISRCs taken there, by track. On the consolidation page, `{ run, only: ['pc'], seed }` instead (no `release`) |
| `mc:progress` | provider | `{ id, run, state: 'busy', note }` |
| `mc:findings` | provider | `{ id, run, release, findings: [...] }` |
| `mc:apply` | MC | `{ id, run, release, keys, dry, mc }`: the selected finding keys of one provider, and MC's version. Every edit note a provider writes for it ends with `Via Mission Control v<mc>: <release URL>` |
| `mc:applied` | provider | `{ id, run, ok, sent, note }` |
| `mc:check` | MC | `{ id, run, release, key }`: look up more for one finding (Fusion: its group's ISRCs and AcoustIDs) |
| `mc:update` | provider | `{ id, run, release, keys, findings, error }`: findings sent again; each replaces the one with its key and keeps its selection unless it can't be selected any more |
| `mc:open` | MC | `{ id, release, key }`: show one finding in the provider's own window (Fusion: its group on the board) |

`id` is one of `pc`, `is`, `as`, `fusion`, `ch` (the `STEPS` table in the script). A provider answers `mc:discover`, and also sends `mc:provider` once when it loads, so the load order doesn't matter.

Each probe has a `run` id, and MC drops progress or findings that carry an older one. A provider ignores a probe for another release, or one whose `only` leaves it out. Fusion and CH are only asked in Auto mode.

The album links selected in PC's card aren't on the release yet (Execute adds them before IS runs), so IS is probed with them in `links` and reads them as if they were: a selected Bandcamp album gives the tracks its Bandcamp links before Execute. MC asks IS again whenever the selected set changes, once IS's answer to the last probe is in; IS takes them off its release load again before it answers.

The steps under the header show each provider's last `mc:progress` note and the seconds since it came, and turn amber ("no word for N s") after 20 s without one. A provider working longer than that sends a note at least every 20 s, or it reads as stuck.

### Findings

One finding per thing the provider looked at:

| Field |  |
| --- | --- |
| `key` | unique within the provider (PC: the platform key, which is also its ST-ICONS name) |
| `name` | the label to show |
| `url` | what was found, if anything |
| `state` | `new` · `linked` · `withheld` · `unsure` · `none` |
| `why` | for `withheld` / `unsure`: what holds it back; PC joins several with ` · ` |
| `icon` | the ST-ICONS key, when it isn't `key` |
| `track` | the recording MBID, for a per-track finding |
| `kind` | a second kind of per-track finding beside the main one (IS: `link`) |
| `barcode` | PC: the barcode the platform gives; `mc:findings` carries the release's own as `barcode` too. MC groups the release's links by barcode, a lane each (leading zeros aside, as PC compares them): each shown in one form (12 digits when it fits, else 13); the release's own first in green, then the others by size, then the platforms that gave none under an empty barcode. What a lane is goes in its barcode's tooltip. A lane is one line of platform icons that toggle one by one, with *take all in*; a click opens it into rows. A linked link with a barcode sits in its lane as a ✓ icon (the release's own Discogs, say) |
| `entity` | `{ type, mbid, name }`: the artist or label a PC link is for |
| `tracks`, `mbTracks`, `format` | PC: the platform's track count, the release's, and the platform's format |
| `mismatch` | PC: the reasons in `why` that say the link is another release (a different track count, a format that isn't the release's). `why` lists them first, then barcode or format confidence; in a lane MC drops the barcode reason, shows these in amber, marks the lane icon, and leaves the link out of *take all in* |
| `kind: 'barcode'`, `code` | PC: a barcode to add, sent only while the release has none, keyed `barcode:<code>`: a pasted one, and each one the platforms report. `new` when pasted, or reported by a link the release has whose track count and medium match; `unsure` otherwise (another medium, or the linked links disagree); `withheld` with a wrong check digit. At most one is `new`. MC lists them at the top of Release, out of the lanes and out of *take all in*, and keeps one taken in at a time. Apply puts it on the Falcon release item as `barcode`, which Falcon types into the release editor, and adds a line to the edit note |

`new` rows start selected. `withheld` and `unsure` rows can be selected by hand, `linked` ones can't, and the `none` rows collapse into one line of icons. There are no tick boxes: a click on a row (or a matrix cell) takes it in or leaves it out, and a taken-in one is tinted with a ✓. A link inside a row only opens.

In the track matrix each pick carries `data-col` (`isrc`, `links`, `fusion`) and a found link also `data-ico` (its platform), which scope the bulk picks ([#714](https://github.com/majkinetor/musicbrainz-userscripts/issues/714)), the Apollo and IS convention: Ctrl (or ⌘) = the track's row, Alt = the column (a link: same `data-ico`), Ctrl+Alt = the whole table; every one is set to the clicked one's opposite state. Links take the modifiers on right-click, since a modified left-click on a link belongs to the browser. A press on an ISRC or Fusion cell dragged over others in the same column sets each to the pressed one's new state; the click that ends a drag is swallowed.

### Adapters

- **Platform Check** (`pc`): PC already scans on load, so a probe waits for the scan that's running (or the last one) and never starts a second. If a rescan replaces that scan, the probe waits for the new one. The states mirror PC's own panel: `linked` is a link the release already has, `new` is a ✓ that link confidence lets through, and `withheld` is held back by barcode or format confidence. Apply hands the selected links to Falcon as one release item, with PC's own edit note, and the barcode taken in, if any, on that item. A withheld link selected by hand is noted as forced, as with a middle-click on +. Without Falcon on the page, apply fails and says why. A dry run queues the batch in Falcon without running it.

  The probe also reports the Artists & labels links ([#671](https://github.com/majkinetor/musicbrainz-userscripts/issues/671)): one finding per link, keyed `ent:<type>:<mbid>:<url>`, with `entity` set. MusicBrainz is asked which of them it already has through the same cached `/ws/2/url` lookup as PC's count. A link it has on this entity is `linked`, one it has on someone else is `withheld`. MC lists them under their own sub-heading in the card, which is now called Release and entity links. Apply puts the selected ones in the same Falcon batch as the release's links, one item per artist or label, with PC's link types.

  Execute sends the batch with `headless: true` and `tag: 'mc:pc:<run>'`. Falcon keeps its panel off-screen (its workers live in it) and reports every change to the batch as `falcon:status` (`{ tag, running, items }`). MC lists the items in the card with their status and any error. When one fails, the card offers **Open Falcon**, which sends `falcon:show`. A dry run isn't headless: it queues the batch in Falcon's panel without running it.

- **ISRC Scout** (`is`): per track. `key` and `track` are the recording MBID. The probe runs without IS's dialog. It imports one album source, in the order of the dialog's **Match**: the fastest first (one-request sources such as Qobuz, Audiomack and Apple Music before per-track ones such as Deezer and 7digital, then Spotify), the next one when a source fails or gives nothing, and never a link pulled from the release group. It takes only that source's first batch, as the dialog does before it pauses, and maps each ISRC to a track the way the dialog does (by position, then by a title that's unambiguous). The states are `new`; `unsure` (the recording already has another ISRC); `linked`; and `none`. A finding also carries `isrc`, `existing`, `source`, and the recording's current links (`links`, `linkUrls`). The probe then runs Find links without the dialog (`TrackLinks.findHeadless`), trying the ISRCs it just found as well as MusicBrainz's, so one probe does what the dialog does in two steps. Each link it finds is a finding of its own: `kind: 'link'`, keyed `link:<recording>:<url>`, `state: 'new'`. The matrix shows them as + icons after the linked ones. Apply submits the selected ISRCs through IS's own OAuth web-service call, with its usual edit note, then the selected links in one `/ws/js/edit/create` POST, as the dialog's Submit does.
- **Fusion** (`fusion`): per track, and slow, so it runs in Ask mode by default. The probe loads the release group's recordings and auto-matches them with Fusion's own settings, including its Cutoff (MC has none of its own), without AcoustID enrichment (the Fusion window does that; the release group's ISRCs come with its recordings). As the window does, it then asks MB which grouped recordings have open edits ([#529](https://github.com/majkinetor/musicbrainz-userscripts/issues/529)). It reports, for each track of this release, the group the track falls in, as `new`. As in the window, a group with an open edit on a member is dropped and its recordings stay ungrouped (`none`); a track whose own recording has an open edit carries `pending: true`, which MC shows as *⏳ pending* linked to its open edits, like the window's pool badge. The finding carries what Fusion's group shows: `tier` (strict · normal · loose · manual), `cutoff`, `signals` (Fusion's `signalsAll`: what every pair agrees on) and `any` (what some pair agrees on), `checked` (`{ isrc, acoustid }`: whether every member's were looked up), `self` (this track's recording) and `matches` (the others), each `{ gid, title, artist, release, pos, of, more, len, ms, isrcs, acoustids, pending }`, and `why`.

  The matrix cell shows the count, which opens the comparison under the row: the signal chips, one line per recording with what differs marked (length, title, artist) and what is shared marked ✓ (ISRC, AcoustID), and its open edits linked. Once Fusion's findings arrive, MC sends `mc:check` for each group missing ISRCs or AcoustIDs, one group at a time (the next once `mc:update` names the key, or after 2 minutes), and a track in a group already asked for is skipped: Fusion looks up the group's ISRCs and AcoustIDs, a few requests instead of the release group's, recomputes the group, and answers `mc:update`. A new Fusion probe stops the queue. Fusion's icon (*Open in Fusion*) sends `mc:open`: Fusion opens its window and puts the group on the board (its members leave any group they sat in). Apply merges the selected tracks' groups one at a time through `mergeGroup`, because MB's merge queue is one per session.

Ask-mode providers aren't asked on Probe. Their matrix column shows a **Fetch** button that probes just that provider, within the current run.

### Not on the release page

The sidebar's links are read from `a[href]` and resolved through `a.href`: MusicBrainz writes some of them protocol-relative (`//x.bandcamp.com/…`), which `a[href^="http"]` missed.

Art Station and Credit Hoarder have their own pages, so their `@match` now includes the release page as well. There they start no UI: only the adapter, which then returns.

- **Art Station** (`as`): release level. The probe reads the Cover Art Archive listing (the card's `summary`) and the release's own external links (the sidebar block headed "External links", not the release group's). It offers each linked platform AS can source from, with `icon` naming its ST-ICONS key. Rows start selected only when there's no front cover.

  Covers are sourced headless, in a hidden frame of `/release/<mbid>/cover-art?mc_frame=<token>&mc_source=[links]`. There AS imports from those links and keeps the best cover (the same as middle-clicking its URL button). It then posts `{ mcAs: 1, token, type: 'best', best }` to the release page, where `best` is `{ provider, w, h, bytes, of, thumb, full }`: `thumb` is a data URL at most 500 px across (a blob URL would die with the frame), and `full` the image itself as a data URL (2400 px across when the file is over 12 MB), for MC's full-screen view. A click on either cover in the card shows it full screen, with ← / → (or ‹ ›) to the other one; the current front comes as the archive's own image, `existing[].full`. The frame also sends `existing`: the covers already there and typed Front, measured, so the archive's listing (which can lag) isn't the only word on whether there is one. The probe always sources when the release links a source, and compares the best with the largest current front. If the best is larger, the rows start selected, and with exactly one current front Enter replaces it (`replace: true`: the frame marks it for removal and types the best Front). If not, the rows start unselected as `unsure`. `mc:findings` carries `best` with `larger`, `replace` and `current`, and MC shows both covers in the card with what Execute would do. Apply reuses the probe's best when every selected link was probed and the best came from a selected one (the best of more sources is also the best of fewer). Otherwise it sources again, and compares again, then posts `{ type: 'enter', note, replace }`. The frame runs Enter edit and answers `{ type: 'entered', ok, errs, total, error }`, without reloading. The apply answer can take minutes, so AS sends `mc:progress` while it works, and each one restarts MC's 15 s wait. The import itself goes through ROpdebee's ECAU, which the harness doesn't load, so the spec checks the frame and the messages, not a real cover.
- **Credit Hoarder** (`ch`): per track, info only (`capabilities: ['probe']`; it never writes from here), and Ask mode by default. The probe reads the same sidebar links as AS, so it makes no MusicBrainz request, and reads the credits of every linked source of Discogs, Qobuz, Deezer and Apple (one that fails is logged and left out). Each track gets `state: 'info'`, `credits` (a count) and `list` (`{ name, role, sources }`): one entry per name and role, merged across the sources, mapped by each source's own track order per medium. The release's own credits come as one more finding with no `track` (`key: 'release'`, `level: 'release'`), shown in MC's Release credits card. Only Discogs has them; a credit Discogs gives for some tracks names them in its role ("(tracks 1 to 3)"). Nothing is cached for CH's own page yet: its caches are per page, and CH opens on edit-relationships. The adapter lives in `credit_hoarder/src/mc-adapter.js`.

  `mc:provider` and `mc:findings` also carry `open`: `[{ label, icon, url, title }]`, CH's import sources among the release's links, the same choice as its toolbar, plus All when there are more than one. The Release credits card shows them as **Import credits:** icons drawn like CH's toolbar (a square per source, then an orange ⚛ All). Each opens `/release/<mbid>/edit-relationships#ch-import=<source>`, where CH drops the hash (so a reload doesn't import again) and presses that source's toolbar button, so the pre-flight starts at once. It waits up to 10 s for the button, because Titles joins the toolbar late.

### Execute

Execute runs the steps in order and sends `mc:apply` to every provider that has selected findings and lists `apply` among its capabilities. The lanes of a parallel step run together. A provider that doesn't answer `mc:applied` within 15 s counts as failed, and the next step runs anyway. A provider still working sends `mc:progress`, which restarts the wait and shows its note above the card's rows (the findings stay). What a provider applied shows as linked from then on: its rows join the linked icons, an IS link joins the track's linked icons, and an IS ISRC becomes the track's. A batch handed to Falcon turns linked item by item, as `falcon:status` reports each one done or skipped; a failed one stays picked. Dry run sends the same with `dry: true`. Each card shows its provider's outcome above its rows.

A click on a card's icon or title, at the left of its header (one button), switches the card off and on; nothing else is added to the header. An off card folds to its header, its icon greyed, and Execute and its count leave out what is selected in it: Tracks holds the per-track providers without a card of their own (IS, Fusion). The selections stay, for when the card is on again. The switches are for this page only and never saved.

### Still to specify

- Live status in the sidebar's lanes during Execute (the cards show it already).

## Consolidation

[#702](https://github.com/majkinetor/musicbrainz-userscripts/issues/702). A release MusicBrainz doesn't have yet is compared across the platforms on `/release/add#mc=<token>`, a page every member script already runs on (MC, PC, AS and IS by `/release/*`, FC and Apollo by `/release/add*`). MC runs there in its consolidation mode (the `/* ── consolidation` block, `cc*` functions, the `CC` state) and nothing of its release mode. Every other script stays as it is on `/release/add`, except PC's seed mode, which needs `#mc=`.

| Event | From | `detail` |
| --- | --- | --- |
| `fc:consolidate` | FC | the album Consolidate stored: `{ v, token, created, source, sourceName, platform, id, page, url, rel }`, `rel` as an import reads it (finished: type, labels, Various Artists, script) with `urlForms` on each artist and label link; or `{ token, error }`. Also on `<html data-fc-consolidate>`, and sent again on `fc:consolidate-request` |
| `mc:probe` | MC | `{ run, only: ['pc'], seed }`: `seed` is `{ barcode, title, artist, tracks, format, year, label }` |
| `mc:findings` | PC | the album links PC found, with `seed: true`: PC's release findings, none `linked` |
| `mc:read` | MC | `{ url, run }`: read this album page headless |
| `mc:read-progress` | FC | `{ url, run, n, total }` |
| `mc:read-result` | FC | `{ url, run, ok, provider: { id, name, abbr, artistLinkType }, rel, ms }`, or `{ url, run, ok: false, error }` |
| `fc:seed` | MC | `{ rel, platform, editNote, run, dry }`: FC stores the handoff and posts `rel` to `/release/add?first_contact=<token>` in this tab |
| `fc:seeded` | FC | `{ run, token }`, before it posts |

- **PC's seed mode**: PC passes its page guard on `/release/add#mc=`, builds its panel in a hidden `#mb-pc-seed-host`, and scans nothing until a seed probe. The seed stands for the release record (`mbData`) a release page gives; `mbid` is `seed-<token>`, so its caches are the seed's. Each seed probe clears them and scans anew; it answers the release findings only (no artist or label links, barcodes, master).
- **Sources**: the source first, then each platform PC found (the source's own platform once: the album read stands). They group by barcode as on a release page (leading zeros aside). Taken in by default: the source's lane, and each platform without a barcode whose track count is the source's (or unknown); a link PC marks `mismatch` never. FC reads the taken ones, three at a time; one silent for 90 s has failed. Spotify isn't read (`CC_UNREAD`): FC reads it through its web player only.
- **Fields** vote: each value counts the platforms that give it; the most wins, a tie goes to PC's platform order (the source first). A platform that gives none doesn't vote; Discogs's `[none]` and `[no label]` count as none. A type FC guessed (`typeGuessed`) only counts when no platform gives one. A value clicked is `CC.pick[field]`.
- **Tracks**: the track count most platforms give (a tie: the source's) is the tracklist, in the medium layout of the first platform with that count. Platforms with that count line up by position; others by ISRC, then by a normalised title only one row has. What lines up with nothing is an extra row (`x<n>`), merged by title, left out unless taken (`CC.extraTake`); it goes at the end. In a row, tracks are one **version** when the title is the same (case and punctuation count) and, where both give one, so are the ISRC and the length within 1 s of one already in the version (4:34, 4:35, 4:36 chain into one). The version most platforms have wins; a click sets `CC.rowPick[row] = platform`.
- **Seed**: the winning values; each credit (the release's and each track's) from the winning group, with each artist's links collected across the platforms by a normalised name: the source's own link stays `url`, the others go in `alt` (`{ url, urlForms, platform }`). Every taken platform's link goes in `urls`: a read one with FC's link types, Spotify plain. The edit note lists the platforms read and linked. Status Official, packaging None, country and annotation the source's.
- **Already in MusicBrainz** (`ccCheckInMb`): once the sources are known, one `/ws/2/url?resource=…&inc=release-rels` lookup of every album link, 50 to a request (approved on [#702](https://github.com/majkinetor/musicbrainz-userscripts/issues/702)). Several links answer `{ urls: [...] }` and leave out those MB doesn't know; one link answers the url itself, or 404. Each release found is then looked up (`/ws/2/release/<id>?inc=media`) for its formats and track count, and goes in `CC.inMb.releases` with the links that point to it. It is **this album** (`same`, `ccSameRelease`) unless its barcode (leading zeros aside), its formats in kind (`ccFmtKind`: digital, CD, vinyl, cassette, …) or its track count differ from the source's, each where both give one: a warning banner above the fields. The others are listed as other editions in a plain note under it.
- **After saving**: Add release writes `mc.after` to the tab's `sessionStorage` (`{ created, title, tracks, isrcs, ticks: { is, as, pc } }`) when the `consAfter` setting is on. The release page the editor's submit lands on reads it once (`afterSave`): younger than 3 hours and its title in the page's h1, or it is dropped. MC then opens and probes; `isrcs` goes with the probe, and ISRC Scout takes each as found (`source: 'Mission Control'`) where the recording hasn't it, asking its sources only for the rest. A provider not ticked starts with nothing taken in.

## Layout

**Auto** beside Probe (`autoProbe` in the settings, off by default) probes as soon as MC opens, once discover has had its moment. There is no source link in the header: a release MusicBrainz doesn't have yet is consolidated in a mode of its own ([Consolidation](#consolidation)).

The layout follows variant F of the round-2 mockups (`dev/mockups/mission_control/round2/variant-f.html`). The sidebar flags and the Fusion and CH modes live in `GM_setValue('mc.settings')`, but the settings window shows only `autoProbe` and `reloadAfter`: the sidebars toggle in place (click the stepper; a track opens the inspector) and the modes are set on the stepper's segmented switch.

`reloadAfter` (off by default) reloads the release page after a real Execute that sent something and had no failed step. A batch handed to Falcon runs in the page, so the reload waits until every Falcon batch stops running, and is dropped if any item ended other than done or skipped.
