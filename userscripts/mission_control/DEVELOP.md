# Mission Control: development

`pnpm test` here runs this script's specs (`--project=mission_control`) on test.musicbrainz.org.

## Provider bus

Mission Control is a planner and a dashboard. What to probe and how to apply it stays in each member script ([#680](https://github.com/majkinetor/musicbrainz-userscripts/issues/680), [#677](https://github.com/majkinetor/musicbrainz-userscripts/discussions/677)). They all run on the same `/release/<mbid>` page, so they talk through events on `document`.

Every `detail` is a **JSON string**, never an object. Each userscript runs in its own sandbox, and Firefox's Xray wrappers hide an object's fields from another realm. Falcon's `falcon:*` events follow the same rule.

| Event | From | `detail` |
|---|---|---|
| `mc:discover` | MC | `{ release, mc }`: the release MBID and MC's version |
| `mc:provider` | provider | `{ id, name, version, capabilities: [...] }` |

`id` is one of `pc`, `is`, `as`, `fusion`, `ch` (the `STEPS` table in the script). A provider listens for `mc:discover` and answers it. It answers again if it loads after MC asked, so the load order doesn't matter.

### Still to specify

These come with the first adapter (step 3 of #680):

- `probe(ctx)`: read-only findings, each with what exists, what is missing and what the provider would add, per track or per release.
- `apply(ctx, selection)`: runs the ticked findings and reports an outcome for each. Form-driven writes go to Falcon as a batch.
- Progress events for the Execute view, so the parallel lanes can show live status.

## Layout

The layout follows variant F of the round-2 mockups (`dev/mockups/mission_control/round2/variant-f.html`). The sidebar flags and the Fusion and CH modes live in `GM_setValue('mc.settings')`.
