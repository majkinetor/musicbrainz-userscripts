# Mission Control: development

`pnpm test` here runs this script's specs (`--project=mission_control`) on test.musicbrainz.org.

## Provider bus

Mission Control is a planner and a dashboard. What to probe and how to apply it stays in each member script ([#680](https://github.com/majkinetor/musicbrainz-userscripts/issues/680), [#677](https://github.com/majkinetor/musicbrainz-userscripts/discussions/677)). They all run on the same `/release/<mbid>` page, so they talk through events on `document`.

Every `detail` is a **JSON string**, never an object. Each userscript runs in its own sandbox, and Firefox's Xray wrappers hide an object's fields from another realm. Falcon's `falcon:*` events follow the same rule.

| Event | From |  |
|---|---|---|
|  | MC | : the release MBID and MC's version |
|  | provider |  |
|  | MC | :  lists the provider ids asked |
|  | provider |  |
|  | provider |  |

 is one of , , , ,  (the  table in the script). A provider answers , and also sends  once when it loads, so the load order doesn't matter.

Each probe has a  id, and MC drops progress or findings that carry an older one. A provider ignores a probe for another release, or one whose  leaves it out. Fusion and CH are only asked in Auto mode.

### Findings

One finding per thing the provider looked at:

| Field | |
|---|---|
|  | unique within the provider (PC: the platform key, also its ST-ICONS name) |
|  | label to show |
|  | what was found, if anything |
|  |  ·  ·  ·  ·  |
|  | for : what holds it back |

 rows start ticked.  and  rows can be ticked by hand,  ones can't, and  collapses into one line of icons.

### Adapters

- **Platform Check** (): PC already scans on load, so a probe waits for the scan that's running (or the last one) and never starts a second. The states mirror PC's own panel:  is a link the release has,  is a ✓ that link confidence lets through, and  is held back by barcode or format confidence.

### Still to specify

- : runs the ticked findings and reports an outcome for each. Form-driven writes go to Falcon as a batch.
- Per-track findings (ISRC Scout, Fusion, CH) for the matrix columns.

## Layout

The layout follows variant F of the round-2 mockups (`dev/mockups/mission_control/round2/variant-f.html`). The sidebar flags and the Fusion and CH modes live in `GM_setValue('mc.settings')`.
