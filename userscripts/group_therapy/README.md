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

  It never fabricates a removal — it clicks MB's own **×** buttons, so React handles each exactly like
  a manual click (works on existing **and** newly-added relationships).

- **Highlight** — hover any entity name or role label to light up every matching occurrence on the
  page (existing rels blue/white, newly-added blue/yellow), with a tooltip showing the count and which
  tracks / the release it appears on, e.g. *48× · tracks 1–12*.

### Planned

- **Copy / Move recording credits** to other recordings (or the release), and clone a whole release's
  credits from another release (format-aware).

## Shortcuts

| Where | Action |
| --- | --- |
| right-click a relationship's **×** | open the group-delete menu |
| hover an entity name / role label | highlight all matches + show a count tooltip |
