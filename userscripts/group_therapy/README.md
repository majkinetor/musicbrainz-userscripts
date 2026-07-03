# Group Therapy <img src="./icon.svg" align="left" width="40" height="40">

Batch operations and various helpers on the MusicBrainz *Edit relationships* page.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/group_therapy/group_therapy.user.js) or [latest](./group_therapy.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)
- [View Users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=edit_note_content&conditions.0.operator=includes&conditions.0.args.0=Group+Therapy)


<details><summary>Screenshots</summary>
<img width="650" src="./screenshots/copy.png" /> 
<img width="500" src="./screenshots/remove.png" /><br>
<img width="500" src="./screenshots/remove-work.png" /><br>
<img width="500" src="./screenshots/copy-release.png" /><br>
<img width="800" src="./screenshots/consolidation.png" /><br>
<img width="500" src="./screenshots/highlight.png" /><br>
<img width="650" src="./screenshots/edit-note.png" />
</details>

**Note**: [Uncheck checkboxes with Esc](https://github.com/chaban-mb/userscripts/blob/main/docs/USERSCRIPTS.md#musicbrainz-uncheck-checkboxes-with-esc) is valuable companion script.

## Features

- Batch delete role, entity, both
- Highlight role or entity everywhere and show tooltip with overall counts
- Copy/move credits from recording to recordings, work to works, release to release
- Consolidate release-level credits across an entire release group (matrix + one-click apply)
- Works on existing and newly-added relationships

## Batch delete

Right-click a relationship's **(x)** button for a menu that removes a whole group in one go, each option showing how many it will remove:

- *Remove this one*
- *Remove “\<role\>” — all tracks*
- *Remove “\<target\>” — everywhere*
- *Remove “\<role\>” + “\<target\>”*

Each option shows its **blast radius** — the count and which tracks (or the release) it touches, e.g. *guitar — all tracks (14) · tracks 1–12*.

If you've **selected recordings/works** (ticked their checkboxes), the group options are **scoped to just those** — so *Remove “guitar”* removes it only from the selected recordings, and the menu notes the scope.

<img width="500" src="./screenshots/remove.png" />

<img width="500" src="./screenshots/remove-work.png" />

### Copy / Move

Tick the destination recordings (MB's own recording checkboxes), then
  
#### From recording/work

Right-click the source recording's checkbox for a menu (its header shows which tracks you're copying to):
- *Copy* — duplicate this recording's credits onto every ticked recording with credits updated if there are already some
- *Move* — the same, then remove them from the source. 

**Right-click a work's checkbox** to copy/move that work's own credits (writer, composer, lyricist, …) onto the selected works.

The menu lists each credit with a **checkbox** (all on by default) — untick any you don't want to copy, or **right-click a credit to select only that role** (e.g. just the composers). Copy/Move act on the ticked credits, and the count updates live.

<img width="650" src="./screenshots/copy.png" /> 

#### From release 

The **⧉ Copy from release…** button next to the *Release relationships* heading opens a picker: choose one of this **release group's** other releases — each shown with its **date · country · format · track count** so you can tell editions apart (with an **↗** to open that release in a new tab first) — or use the **＋** to reveal a field and **paste** any release URL/MBID (it acts on paste, no button). It then shows a **checklist** of that release's release-level credits (artists + labels, with credited-as, attributes and dates); pick which to copy onto this release (MB merges any it already has).

**Format-aware cleansing** — since the source may be a different edition, credits whose role doesn't suit **this** release's format start **unticked** (re-tick to override), so you don't carry a vinyl-only production credit onto a digital edition. Two layers, both configurable:
- **`gt-format-exclude`** — a *format-name → role-name* substring map; the default unticks pressed/printed/manufactured/vinyl roles on a *digital* edition. Override with a GM value (JSON object).
- **`gt-format-only`** — a *role-name → the format families it belongs to* map, for roles that suit exactly one format; the default makes *lacquer cutting* vinyl-only and *glass mastering* optical-only (CD/DVD/SACD/Blu-ray), so they're unticked on every other format.

<img width="500" src="./screenshots/copy-release.png" /><br>

#### Relase Group Consolidation

The **▦ Consolidate RG…** button (next to *Copy from release…*) can spread release-level credits across **every** release in the group at once. It reads all the releases in parallel and builds a **role × release matrix**: one row per distinct credit, one column per release — labelled A, B, C… with a compact **format badge** (Digital / Vinyl / CD / Cassette) — and a green cell wherever the credit already exists.

- **Select** what to add: click a **cell** to toggle it, a **column-header letter** to select every addable credit for that release, or **Auto select** for the whole matrix (**Clear** resets). Credits that are format-specific for a release (e.g. *lacquer cut* on a CD) are held back and shown as `·` — click to force one in.
- The footer shows the plan (*N additions across M releases*). **Apply** creates them as real relationship edits — one batched submission per target release (auto-applied if you're an auto-editor, else queued), each carrying a **detailed edit note** that lists every added credit under the Group Therapy signature.

This is **release-level only** (recordings are already shared across a group). It uses MB's internal edit API, so the additions are submitted directly rather than staged in the editor.

With more than 10 releases in a group you must pick releases to be consolidated manually.

<img width="800" src="./screenshots/consolidation.png" />

### Highlight

Hover any entity name or role label to light up every matching occurrence on the page (existing rels blue/white, newly-added blue/yellow), with a tooltip showing the count and which  tracks / the release it appears on, e.g. *48× · tracks 1–12*.

<img width="500" src="./screenshots/highlight.png" />

## Edit note

When (and only when) you actually **use** Group Therapy on a page, it stamps MB's edit-note field with a signature line and, under it, an accumulating list of what it did — e.g. *Copied 2 credits from track 1 to tracks 2–5*, *Removed guitar (14)*, *Copied release credits from “The Vibe! Vol. 9”*. Any note already in the field (from another script, or your own text) is preserved ahead of ours, the signature is written once, and identical action lines aren't repeated. Nothing is submitted — it's there for you to review before you save.

<img width="650" src="./screenshots/edit-note.png" />

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
