# Mission Control: development

`pnpm test` here runs this script's specs (`--project=mission_control`) on test.musicbrainz.org.

## Provider bus

Mission Control is a planner and a dashboard. What to probe and how to apply it stays in each member script ([#680](https://github.com/majkinetor/musicbrainz-userscripts/issues/680), [#677](https://github.com/majkinetor/musicbrainz-userscripts/discussions/677)). They all run on the same `/release/<mbid>` page, so they talk through events on `document`.

Every `detail` is a **JSON string**, never an object. Each userscript runs in its own sandbox, and Firefox's Xray wrappers hide an object's fields from another realm. Falcon's `falcon:*` events follow the same rule.

| Event | From | `detail` |
|---|---|---|
| `mc:discover` | MC | `{ release, mc }`: the release MBID and MC's version |
| `mc:provider` | provider | `{ id, name, version, release, capabilities: [...] }` |
| `mc:probe` | MC | `{ release, run, only, links }`: `only` lists the provider ids asked; `links`, the album links selected in PC's card |
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

| Field | |
|---|---|
| `key` | unique within the provider (PC: the platform key, which is also its ST-ICONS name) |
| `name` | the label to show |
| `url` | what was found, if anything |
| `state` | `new` · `linked` · `withheld` · `unsure` · `none` |
| `why` | for `withheld` / `unsure`: what holds it back |
| `icon` | the ST-ICONS key, when it isn't `key` |
| `track` | the recording MBID, for a per-track finding |
| `kind` | a second kind of per-track finding beside the main one (IS: `link`) |
| `barcode` | PC: the barcode the platform gives; `mc:findings` carries the release's own as `barcode` too. MC groups the release's links by barcode, a lane each (leading zeros aside, as PC compares them): each shown in one form (12 digits when it fits, else 13); the release's own first in green, then the others by size, then the platforms that gave none under an empty barcode. What a lane is goes in its barcode's tooltip. A lane is one line of platform icons that toggle one by one, with *take all in*; a click opens it into rows. A linked link with a barcode sits in its lane as a ✓ icon (the release's own Discogs, say) |
| `entity` | `{ type, mbid, name }`: the artist or label a PC link is for |

`new` rows start selected. `withheld` and `unsure` rows can be selected by hand, `linked` ones can't, and the `none` rows collapse into one line of icons. There are no tick boxes: a click on a row (or a matrix cell) takes it in or leaves it out, and a taken-in one is tinted with a ✓. A link inside a row only opens.

### Adapters

- **Platform Check** (`pc`): PC already scans on load, so a probe waits for the scan that's running (or the last one) and never starts a second. If a rescan replaces that scan, the probe waits for the new one. The states mirror PC's own panel: `linked` is a link the release already has, `new` is a ✓ that link confidence lets through, and `withheld` is held back by barcode or format confidence. Apply hands the selected links to Falcon as one release item, with PC's own edit note. A withheld link selected by hand is noted as forced, as with a middle-click on +. Without Falcon on the page, apply fails and says why. A dry run queues the batch in Falcon without running it.

  The probe also reports the Artists & labels links ([#671](https://github.com/majkinetor/musicbrainz-userscripts/issues/671)): one finding per link, keyed `ent:<type>:<mbid>:<url>`, with `entity` set. MusicBrainz is asked which of them it already has through the same cached `/ws/2/url` lookup as PC's count. A link it has on this entity is `linked`, one it has on someone else is `withheld`. MC lists them under their own sub-heading in the card, which is now called Release and entity links. Apply puts the selected ones in the same Falcon batch as the release's links, one item per artist or label, with PC's link types.

  Execute sends the batch with `headless: true` and `tag: 'mc:pc:<run>'`. Falcon keeps its panel off-screen (its workers live in it) and reports every change to the batch as `falcon:status` (`{ tag, running, items }`). MC lists the items in the card with their status and any error. When one fails, the card offers **Open Falcon**, which sends `falcon:show`. A dry run isn't headless: it queues the batch in Falcon's panel without running it.

- **ISRC Scout** (`is`): per track. `key` and `track` are the recording MBID. The probe runs without IS's dialog. It imports one album source, in the order of the dialog's **Find everything**: the fastest first (one-request sources such as Qobuz, Audiomack and Apple Music before per-track ones such as Deezer and 7digital, then Spotify), the next one when a source fails or gives nothing, and never a link pulled from the release group. It takes only that source's first batch, as the dialog does before it pauses, and maps each ISRC to a track the way the dialog does (by position, then by a title that's unambiguous). The states are `new`; `unsure` (the recording already has another ISRC); `linked`; and `none`. A finding also carries `isrc`, `existing`, `source`, and the recording's current links (`links`, `linkUrls`). The probe then runs Find links without the dialog (`TrackLinks.findHeadless`), trying the ISRCs it just found as well as MusicBrainz's, so one probe does what the dialog does in two steps. Each link it finds is a finding of its own: `kind: 'link'`, keyed `link:<recording>:<url>`, `state: 'new'`. The matrix shows them as + icons after the linked ones. Apply submits the selected ISRCs through IS's own OAuth web-service call, with its usual edit note, then the selected links in one `/ws/js/edit/create` POST, as the dialog's Submit does.
- **Fusion** (`fusion`): per track, and slow, so it runs in Ask mode by default. The probe loads the release group's recordings and auto-matches them with Fusion's own settings, including its Cutoff (MC has none of its own), without AcoustID enrichment (the Fusion window does that; the release group's ISRCs come with its recordings). As the window does, it then asks MB which grouped recordings have open edits ([#529](https://github.com/majkinetor/musicbrainz-userscripts/issues/529)). It reports, for each track of this release, the group the track falls in, as `new`. As in the window, a group with an open edit on a member is dropped and its recordings stay ungrouped (`none`); a track whose own recording has an open edit carries `pending: true`, which MC shows as *⏳ pending* linked to its open edits, like the window's pool badge. The finding carries what Fusion's group shows: `tier` (strict · normal · loose · manual), `cutoff`, `signals` (Fusion's `signalsAll`: what every pair agrees on) and `any` (what some pair agrees on), `checked` (`{ isrc, acoustid }`: whether every member's were looked up), `self` (this track's recording) and `matches` (the others), each `{ gid, title, artist, release, pos, of, more, len, ms, isrcs, acoustids, pending }`, and `why`.

  The matrix cell shows the count, which opens the comparison under the row: the signal chips, one line per recording with what differs marked (length, title, artist) and what is shared marked ✓ (ISRC, AcoustID), and its open edits linked. **Check** sends `mc:check`: Fusion looks up the group's ISRCs and AcoustIDs, a few requests instead of the release group's, recomputes the group, and answers `mc:update`. **Open in Fusion** sends `mc:open`: Fusion opens its window and puts the group on the board (its members leave any group they sat in). Apply merges the selected tracks' groups one at a time through `mergeGroup`, because MB's merge queue is one per session.

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

## Layout

**Auto** beside Probe (`autoProbe` in the settings, off by default) probes as soon as MC opens, once discover has had its moment. There is no source link in the header any more: consolidating releases MusicBrainz doesn't have yet will be a mode of its own later.

The layout follows variant F of the round-2 mockups (`dev/mockups/mission_control/round2/variant-f.html`). The sidebar flags and the Fusion and CH modes live in `GM_setValue('mc.settings')`, but the settings window shows only `autoProbe` and `reloadAfter`: the sidebars toggle in place (click the stepper; a track opens the inspector) and the modes are set on the stepper's segmented switch.

`reloadAfter` (off by default) reloads the release page after a real Execute that sent something and had no failed step. A batch handed to Falcon runs in the page, so the reload waits until every Falcon batch stops running, and is dropped if any item ended other than done or skipped.
