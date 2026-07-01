# Group Therapy <img src="./icon.svg" align="left" width="40" height="40">

**Group Therapy** is a subtle relationship-editor helper for the MusicBrainz **Edit relationships**
page. Chrome-light on purpose — it adds context menus and hover affordances, not another toolbar.

---

**NOTE: Experimental — work in progress ([#338](https://github.com/majkinetor/musicbrainz-userscripts/issues/338))**

---

- Install: [`group_therapy.user.js`](./group_therapy.user.js)

## Features

- **Batch delete** — right-click a relationship's **×** for a menu that removes a whole group in one
  go, each option showing how many it will remove:
  - *Remove this one*
  - *Remove “\<role\>” — all tracks*
  - *Remove “\<target\>” — everywhere*
  - *Remove “\<role\>” + “\<target\>”*

  Each option shows its **blast radius** — the count and which tracks (or the release) it touches,
  e.g. *guitar — all tracks (14) · tracks 1–12*.

  It never fabricates a removal — it clicks MB's own **×** buttons, so React handles each exactly like
  a manual click (works on existing **and** newly-added relationships).

- **Highlight** — hover any entity name or role label to light up every matching occurrence on the
  page (existing rels blue/white, newly-added blue/yellow), with a tooltip showing the count and which
  tracks / the release it appears on, e.g. *48× · tracks 1–12*.

- **Copy / move credits** — tick the destination recordings (MB's own recording checkboxes), then
  **right-click the source recording's checkbox** for a menu (its header shows which tracks you're
  copying to):
  - *Copy* — duplicate this recording's credits onto every ticked recording. Covers artists,
    ℗/© **labels**, recorded-at **places**, etc. — with role, credited-as, **attributes** (instruments/
    vocals) and **dates** (e.g. the ℗ year) preserved. MB merges any it already has.
  - *Move* — the same, then remove them from the source.
  - **Right-click a work's checkbox** to copy/move that recording's **works** the same way.

  It reads each credit straight off MB's own rendered relationship (so nothing is lost) and adds them
  through MB's editor — **review and save** like any manual edit; nothing is submitted for you.

- **Clone from another release** — the **⧉ Clone from release…** button next to the *Release
  relationships* heading pulls that release's release-level credits (artists + labels, with credited-as,
  attributes and dates) onto this one. Paste any MB release URL or MBID; MB merges any it already has.

### Planned

- Per-track clone across releases (match by position) and a format-exclusion map.

## Shortcuts

| Where | Action |
| --- | --- |
| right-click a relationship's **×** | open the group-delete menu |
| right-click a recording's **checkbox** | copy / move its credits to the ticked recordings |
| right-click a work's **checkbox** | copy / move that recording's works to the ticked recordings |
| hover an entity name / role label | highlight all matches + show a count tooltip |
