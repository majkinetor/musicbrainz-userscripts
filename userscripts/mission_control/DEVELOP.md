# Mission Control: development

`pnpm test` here runs this script's specs (`--project=mission_control`) on test.musicbrainz.org.

## Provider bus

Mission Control is a planner and a dashboard. What to probe and how to apply it stays in each member script ([#680](https://github.com/majkinetor/musicbrainz-userscripts/issues/680), [#677](https://github.com/majkinetor/musicbrainz-userscripts/discussions/677)). They all run on the same `/release/<mbid>` page, so they talk through events on `document`.

Every `detail` is a **JSON string**, never an object. Each userscript runs in its own sandbox, and Firefox's Xray wrappers hide an object's fields from another realm. Falcon's `falcon:*` events follow the same rule.

| Event | From | `detail` |
|---|---|---|
| `mc:discover` | MC | `{ release, mc }`: the release MBID and MC's version |
| `mc:provider` | provider | `{ id, name, version, release, capabilities: [...] }` |
| `mc:probe` | MC | `{ release, run, only, source }`: `only` lists the provider ids asked |
| `mc:progress` | provider | `{ id, run, state: 'busy', note }` |
| `mc:findings` | provider | `{ id, run, release, findings: [...] }` |
| `mc:apply` | MC | `{ id, run, release, keys, dry }`: the ticked finding keys of one provider |
| `mc:applied` | provider | `{ id, run, ok, sent, note }` |

`id` is one of `pc`, `is`, `as`, `fusion`, `ch` (the `STEPS` table in the script). A provider answers `mc:discover`, and also sends `mc:provider` once when it loads, so the load order doesn't matter.

Each probe has a `run` id, and MC drops progress or findings that carry an older one. A provider ignores a probe for another release, or one whose `only` leaves it out. Fusion and CH are only asked in Auto mode.

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

`new` rows start ticked. `withheld` and `unsure` rows can be ticked by hand, `linked` ones can't, and the `none` rows collapse into one line of icons.

### Adapters

- **Platform Check** (`pc`): PC already scans on load, so a probe waits for the scan that's running (or the last one) and never starts a second. If a rescan replaces that scan, the probe waits for the new one. The states mirror PC's own panel: `linked` is a link the release already has, `new` is a ✓ that link confidence lets through, and `withheld` is held back by barcode or format confidence. Apply hands the ticked links to Falcon as one release item, with PC's own edit note. A withheld link ticked by hand is noted as forced, as with a middle-click on +. Without Falcon on the page, apply fails and says why. A dry run queues the batch in Falcon without running it.

- **ISRC Scout** (`is`): per track. `key` and `track` are the recording MBID. The probe runs without IS's dialog. It imports one album source: the first one with a link in MB, or one Platform Check found with confidence. It takes only that source's first batch, as the dialog does before it pauses, and maps each ISRC to a track the way the dialog does (by position, then by a title that's unambiguous). The states are `new`; `unsure` (the recording already has another ISRC); `linked`; and `none`. A finding also carries `isrc`, `existing`, `source`, and the recording's current links (`links`, `linkUrls`). Apply submits the ticked ISRCs through IS's own OAuth web-service call, with its usual edit note.
- **Fusion** (`fusion`): per track, and slow, so it runs in Ask mode by default. The probe loads the release group's recordings and auto-matches them with Fusion's own settings, without ISRC or AcoustID enrichment (the Fusion window does that). It reports, for each track of this release, the group the track falls in: `new` with `matches` (the other recordings) and `why` (the signals). Apply merges the ticked tracks' groups one at a time through `mergeGroup`, because MB's merge queue is one per session. The adapter's groups never touch Fusion's own board.

Ask-mode providers aren't asked on Probe. Their matrix column shows a **Fetch** button that probes just that provider, within the current run.

### Not on the release page

Art Station and Credit Hoarder have their own pages, so their `@match` now includes the release page as well. There they start no UI: only the adapter, which then returns.

- **Art Station** (`as`): release level. The probe reads the Cover Art Archive listing (the card's `summary`) and the release's own external links (the sidebar block headed "External links", not the release group's). It offers each linked platform AS can source from, with `icon` naming its ST-ICONS key. Rows start ticked only when there's no front cover. Apply opens `/release/<mbid>/cover-art?mc_source=[links]`, where AS imports from those links and keeps the best cover (the same as middle-clicking its URL button), for you to review and enter.

### Execute

Execute runs the steps in order and sends `mc:apply` to every provider that has ticked findings and lists `apply` among its capabilities. The lanes of a parallel step run together. A provider that doesn't answer `mc:applied` within 15 s counts as failed, and the next step runs anyway. Dry run sends the same with `dry: true`. Each card shows its provider's outcome above its rows.

### Still to specify

- Credit Hoarder (per track, info only).

## Layout

The layout follows variant F of the round-2 mockups (`dev/mockups/mission_control/round2/variant-f.html`). The sidebar flags and the Fusion and CH modes live in `GM_setValue('mc.settings')`.
