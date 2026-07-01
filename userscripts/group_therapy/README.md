# Group Therapy <img src="./icon.svg" align="left" width="40" height="40">

Batch operations and various helpers on the MusicBrainz *Edit relationships* page.

- Install: [latest](./group_therapy.user.js)

## Features

- Batch delete role, entity, both
- Highlight role or entity everywhere and show tooltip with overall counts
- Copy/move credits from recording to recordings, work to works, release to release
- Works on existing and newly-added relationships

## Batch delete

Right-click a relationship's **(x)** button for a menu that removes a whole group in one go, each option showing how many it will remove:

- *Remove this one*
- *Remove “\<role\>” — all tracks*
- *Remove “\<target\>” — everywhere*
- *Remove “\<role\>” + “\<target\>”*

Each option shows its **blast radius** — the count and which tracks (or the release) it touches, e.g. *guitar — all tracks (14) · tracks 1–12*.

If you've **selected recordings/works** (ticked their checkboxes), the group options are **scoped to just those** — so *Remove “guitar”* removes it only from the selected recordings, and the menu notes the scope.

### Copy / Move

Tick the destination recordings (MB's own recording checkboxes), then
  
#### From recording/work

Right-click the source recording's checkbox for a menu (its header shows which tracks you're copying to):
- *Copy* — duplicate this recording's credits onto every ticked recording with credits updated if there are already some
- *Move* — the same, then remove them from the source. 

**Right-click a work's checkbox** to copy/move that work's own credits (writer, composer, lyricist, …) onto the selected works.

The menu lists each credit with a **checkbox** (all on by default) — untick any you don't want to copy, or **right-click a credit to select only that role** (e.g. just the composers). Copy/Move act on the ticked credits, and the count updates live.

##### Format-aware cleansing

When the destination recordings all share one **format**, credits whose role doesn't suit that format start **unticked** in the checklist (re-tick to override), and the menu notes how many — so you don't carry, say, a vinyl-only production credit onto a digital edition. The rules are a configurable map of **format-name → role-name** substrings (case-insensitive). The default only unticks vinyl/lacquer roles on a *digital* edition; override the whole map with the **`gt-format-exclude`** GM value (a JSON object), e.g. `{"digital":["lacquer","vinyl mastering"],"cd":["lacquer"]}`.

#### From release 

The **⧉ Copy from release…** button next to the *Release relationships* heading opens a picker: choose one of this **release group's** other releases — each shown with its **date · country · format · track count** so you can tell editions apart — or paste any release URL/MBID. It pulls that release's release-level credits (artists + labels, with credited-as, attributes and dates) onto this one; MB merges any it already has.

### Highlight

Hover any entity name or role label to light up every matching occurrence on the page (existing rels blue/white, newly-added blue/yellow), with a tooltip showing the count and which  tracks / the release it appears on, e.g. *48× · tracks 1–12*.

## Shortcuts

| Where | Action |
| --- | --- |
| right-click a relationship's **×** | open the group-delete menu |
| right-click a recording's **checkbox** | copy / move its credits to the ticked recordings |
| right-click a work's **checkbox** | copy / move that work's credits (writer/composer/…) to the ticked works |
| hover an entity name / role label | highlight all matches + show a count tooltip |

The recording/work checkboxes and the `×` buttons carry a faint green accent and a tooltip so the
right-click features are discoverable.

## Under the hood

Group Therapy drives MusicBrainz's own relationship editor: it reads each relationship straight off the
rendered rows (via their React state) and writes changes through MB's reducer — the same mechanism
[Credit Hoarder](../credit_hoarder/README.md) uses to dispatch credits. Nothing is submitted for you;
every change lands in the editor for you to **review and save**.

The small MB-editor dispatch helper is **bundled directly into this single file** rather than shared as a
separate module, so Group Therapy stays a one-file, dependency-free userscript. If that helper is ever
extracted into a standalone library for both scripts to import, it will live **outside** either userscript
and be documented on its own.
