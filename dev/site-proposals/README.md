# GitHub Pages — proposals

Sixteen takes on a landing page for the toolset. Each is a **single self-contained
HTML file** with no build step, no dependencies and no external CSS or JS. Open
one in a browser to see it.

The last ten (G–P) are the current set: **minimal rather than crowded**, and no
brutalism — that direction was rejected. Start there.

## The minimal set

Ten directions, each a distinct idea about what a landing page is, ordered
roughly from most structured to least. All ten drop the icons — at this size
they were the crowded part — and none of them uses more than one accent colour.

| File | Direction |
|---|---|
| [`g-swiss.html`](g-swiss.html) | **Swiss** — a real 12-column grid, hairline rules, no boxes and no fills. Micro-labels in the left margin name each band; one red accent. The most *composed* of the ten. |
| [`h-plaintext.html`](h-plaintext.html) | **Plain text** — a document that happens to be a web page. One monospace face, key/value pairs, `##` headings, a single link colour. Reads like a well-set README. |
| [`i-quiet.html`](i-quiet.html) | **Quiet** — no borders, no cards, no fills anywhere. Hierarchy is space and weight alone; the screenshot is the only decoration on the page. |
| [`j-noir.html`](j-noir.html) | **Noir** — dark, warm and centred, a serif display face and one gold accent. Committed to a single look rather than following the system theme. |
| [`k-docs.html`](k-docs.html) | **Docs** — a quiet sticky sidebar carries the whole index, so the page body only holds one thought at a time. The layout that scales if per-script pages ever happen. |
| [`l-serif.html`](l-serif.html) | **Serif** — reads like a short essay: one narrow measure, warm paper, a drop cap, and prose instead of boxes. The list at the end is the only furniture. |
| [`m-split.html`](m-split.html) | **Split** — the left half never moves and holds the whole pitch; the right half is the only thing that scrolls. Nothing is repeated between them. |
| [`n-fullbleed.html`](n-fullbleed.html) | **Full bleed** — a band of the actual UI edge to edge across the top, then plain centred text under it. One image does all the work. |
| [`o-stats.html`](o-stats.html) | **Stats** — the numbers lead. A real per-script bar chart (one hue, every bar labelled) doubles as the index, so the page has one structure rather than two. |
| [`p-bare.html`](p-bare.html) | **Bare** — the minimal pole. First screen is a title, three sentences and the names; scroll once for a single screenshot. That is the whole site. |

## Earlier sets

The first three, before the "minimal, not crowded" steer:

| File | Direction |
|---|---|
| [`a-console.html`](a-console.html) | **Console** — dark, dense, monospace accents. Reads as a developer tool: everything on one screen, one screenshot, install link on every row. |
| [`b-editorial.html`](b-editorial.html) | **Editorial** — light, centred, generous whitespace. Reads as a product page. Scripts grouped by what they are *for* rather than listed flat. |
| [`c-gallery.html`](c-gallery.html) | **Gallery** — screenshot-led, two-column feature cards, and the usage numbers as a chart. The most "look what it does" of the three. |

And three brutalist ones. **This direction was rejected** — kept only so the
ground already covered is on record.

| File | Direction |
|---|---|
| [`d-brutal-terminal.html`](d-brutal-terminal.html) | **Terminal** — black, monospace throughout, acid-yellow highlights, hairline scanlines. Square corners, no shadows, numbered index. |
| [`e-brutal-poster.html`](e-brutal-poster.html) | **Poster** — Swiss/brutalist. A headline that fills the page edge to edge, 3px rules boxing every band, one blue and one red, no images except the plate. |
| [`f-brutal-slab.html`](f-brutal-slab.html) | **Slab** — hard-offset drop shadows on white blocks over concrete grey, orange accent, bar chart in its own slab. The most structured of the three. |

All sixteen carry the same content: the pitch, install, the script list with
one-line descriptions, links to GitHub / docs / statistics, and the usage
numbers. A–F additionally show per-script icons.

## What is real in them

Everything. The numbers come from the `dev/script-metrics` pipeline against the
`20260905` database snapshot, 2026-05 onward:

- **499,632** edits, **136** editors, **12** userscripts
- **99.9%** — of *closed* edits applied (99.877%, so the rounding is honest);
  611 failed and 1,024 still open are excluded from that denominator, not hidden
- Per-script bars in variants C, F and O are the real per-script totals:
  Credit Hoarder 254,892 · ISRC Scout 73,509 · Falcon 63,634 · Group Therapy
  50,091 · Apollo Editor 45,108 · Platform Check 6,753 · Art Station 5,420 ·
  Fusion 206 · Scribe 19

Icons, screenshots and taglines are pulled from the repo itself, so nothing here
is a placeholder.

## Still to decide

- **Where it is served from.** GitHub Pages can publish `/docs` on `main`, the
  repo root, or a `gh-pages` branch. Images currently load from
  `raw.githubusercontent.com/.../main/...` absolute URLs, which work from any of
  them and also work when the file is opened locally. If it ends up served from
  the repo itself, those can become relative paths.
- **How the numbers stay current.** They are baked in today. Options: leave them
  and refresh when `script-metrics` runs, or have the page `fetch()`
  `metrics.json` and fill them in at load. The second only works if that file is
  reachable from wherever Pages serves.
- **Whether it stays one page.** All sixteen are single-page. Per-script pages
  would be a bigger job and would duplicate the READMEs — `k-docs` is the only
  variant whose layout already anticipates them.

## Regenerating the numbers

```powershell
cd dev/script-metrics
.\run.ps1 -ReportOnly     # rebuild out/metrics.json from the cached database
```

Then update the figures in whichever variant is chosen. Variants C, F and O carry
per-script numbers as well as the headline ones.
