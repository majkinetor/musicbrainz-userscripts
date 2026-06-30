# Release ⇄ Markdown — format spec (Phase 1)

Edit (most of) a MusicBrainz release as a **single document** in your external editor,
instead of EE-ing dozens of individual inputs. Export the release → edit → save →
parse + apply back through MB's release-editor model.

Two interchangeable representations of the **same** data model:
- **Markdown** (default) — readable, edit-friendly; ~99% round-trips with a tolerant parser.
- **JSON / YAML** (toggle) — verbose, less readable, **100% precise**. The escape hatch for
  the few Markdown ambiguities below.

---

## Global conventions (Markdown mode)

- **`- **Label**: value`** = one single-valued field. **Value is literal** to end-of-line —
  no Markdown interpretation except resolving `[ref]` entity links.
- **Reference links = entities.** `[Display]` inline; defined at the foot:
  `[Display]: https://musicbrainz.org/<type>/<mbid> (Main Name)`
  - URL ⇒ **MBID + entity type** (artist / label / recording / release / release-group).
  - Link **text** = **credited-as / display name**.
  - Link **title** `(Main Name)` = the entity's real name — shows as a hover tooltip; informational, **not applied**.
  - `[Display]` **with** a footer def ⇒ **existing** entity (identity = the MBID).
  - `[Display]` **without** a footer def ⇒ **new** entity to create (name = Display, no MBID).
- **Escaping** (kept to the absolute minimum):
  - In a **value/display**: only `\[` `\]` `\\` when the literal text contains them
    (e.g. the area literally named `\[Worldwide\]`, the `\[unknown\]` artist).
  - In a **track title**: a `[` does **not** need escaping (it sits before the ` — ` delimiter
    and the title is read literally). Escape only (a) a literal spaced em-dash ` — ` inside the
    title, and (b) a `[X]` that collides with an existing footer label (cosmetic — avoids a
    spurious link in the rendered preview; the parser already treats it literally).
- A small **non-editable header** carries the release MBID + export timestamp + format version
  (so the parser confirms it's the right release and can detect format drift).

---

## Sections (fixed set; the parser keys on the known titles — order-independent, so sections can be moved around; verbatim sections are closed by `<!-- /end -->`)

### Release information  *(single fields)*
```
- **Title**: Summer Sol V
- **Disambiguation**: remastered
- **Status**: Official
- **Packaging**: Plastic Sleeve
- **Barcode**: 0712345678901        (digits, or `none`)
- **Language**: English
- **Script**: Latin
- **Artist**: [Various Artists]      (a credit — links + join text, like a track credit)
- **Release group**: [Summer Sol V]  (link existing only in Phase 1)
```

### Release events  *(array of date, country)*
```
- 2020-07-03, Worldwide
- 2020-07-03, American Samoa
```
Country = plain area name (escape brackets if the name has them, e.g. `\[Worldwide\]`). Not a link.

### Labels  *(array of label, cat#)*
```
- [Sol Selectas] — SS001
```
Cat# lives **inline with the label**, never in the link def (a label def is global; cat# is per-use).

### Annotation  /  ### Edit note  *(verbatim section)*
The body runs from the header to an explicit **end marker** — an HTML comment, invisible in
every Markdown renderer and effectively impossible to type by accident:
```
### Annotation
Any Markdown here renders normally — even a line like `## Tracklist` is safe.
<!-- /end -->
```
Because the close is explicit (not "next header"), the body can contain **anything**, including
lines that look like structural headers, and the whole section can be **repositioned** anywhere
in the document. (`<!-- /end -->` chosen over a bare `<end region>`: HTML comments are invisible
in all renderers; a non-standard tag can be shown or stripped by sanitizing ones.)

### External links  *(array, with optional per-link attributes as sub-bullets)*
```
- [Discogs]
- [Bandcamp]
  - purchase for download · 2023-01-01 → 2026-01-03
  - stream for free · ended
- [Spotify]
  - stream for free
```

---

## Tracklist

```
### Medium 1
- **Format**: Digital Media
- **Title**: <medium title>

1. <TITLE> — <CREDIT> (<LEN>) → [Recording]
```

Per-track line grammar (everything after the title is optional):

| part | rule |
|---|---|
| `TITLE` | literal text **before** the spaced em-dash ` — ` (U+2014). No bold. |
| ` — ` | title / rest separator. |
| `CREDIT` | links + literal join text, e.g. `[Sabo] feat. [Helia Jamali],[Z]`. Text between/around links = **join phrases**. A `[Name]` with no footer def = **new** artist. |
| `(LEN)` | `(m:ss)` or `(h:mm:ss)`. |
| `→ [Recording]` | link an **existing** recording. Omitted = leave as-is (default). No `→ +`. |

**Delimiter rule:** the title ends at the **first ` — ` whose remainder is a valid rest** —
i.e. the remainder starts with `[`, a `(m:ss)`, `→`, a join word, or is empty. (This is what lets a
title contain a hyphen, brackets, etc. without escaping.)

All of these parse:
```
Il Prossima Volta — [Sabo] feat. [Helia Jamali] (10:01) → [Vimana]
Il Prossima Volta — [Sabo] (10:01) → [Vimana]
Il Prossima Volta — (10:01)
Il Prossima Volta
— (10:01)
— [New Sabo]
— feat.
```

---

## Residual Markdown ambiguities  →  JSON/YAML mode is the precise fallback
1. A title literally containing ` — [` or ` — (` (spaced em-dash then bracket/paren) can mis-split. Rare; exporter warns.
2. Two **different** entities credited with the **same display name** on one release → reference-link
   labels must be unique, so one needs a suffixed label (pollutes credited-as) or an inline link. The likeliest real snag.

(The annotation/edit-note "looks like a header" problem is gone — the explicit `<!-- /end -->`
marker makes those sections content-safe and repositionable.)

---

## Out of scope (Phase 1)
- Relationships (recording- & release-level rels, attributes, dates) — omitted / read-only.
- Creating **new recordings** (only linking existing via `→`).
- Creating new release-group / release-artist (link existing only).

## Round-trip rules (the backbone)
- **Idempotent:** export → import unchanged ⇒ **zero** edits. First test to write.
- **Atomic + dry-run diff** with line-numbered errors before any submit; never half-apply.
- **Apply via MB's release-editor model** (`window.MB.releaseEditor`) — the same setters Apollo drives.

## Build order
1. **Exporter** (model → Markdown) — eyeball the format on real releases first.
2. **Parser** (Markdown → data model) + **differ** (vs the live model) + **dry-run diff UI**.
3. **Applier** (model writes) + idempotency/golden round-trip tests.
4. **JSON/YAML** mode (same model, exact).
