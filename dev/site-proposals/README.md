# GitHub Pages — proposals

Three takes on a landing page for the toolset. Each is a **single self-contained
HTML file** with no build step, no dependencies and no external CSS or JS. Open
one in a browser to see it.

| File | Direction |
|---|---|
| [`a-console.html`](a-console.html) | **Console** — dark, dense, monospace accents. Reads as a developer tool: everything on one screen, one screenshot, install link on every row. |
| [`b-editorial.html`](b-editorial.html) | **Editorial** — light, centred, generous whitespace. Reads as a product page. Scripts grouped by what they are *for* rather than listed flat. |
| [`c-gallery.html`](c-gallery.html) | **Gallery** — screenshot-led, two-column feature cards, and the usage numbers as a chart. The most "look what it does" of the three. |

All three carry the same content: the pitch, install, the script list with icons
and one-line descriptions, links to GitHub / docs / statistics, and the usage
numbers.

## What is real in them

Everything. The numbers come from the `dev/script-metrics` pipeline against the
`20260905` database snapshot, 2026-05 onward:

- **499,632** edits, **136** editors, **12** userscripts
- **99.9%** — of *closed* edits applied (99.877%, so the rounding is honest);
  611 failed and 1,024 still open are excluded from that denominator, not hidden
- Per-script bars in variant C are the real per-script totals

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
- **Whether it stays one page.** All three are single-page. Per-script pages
  would be a bigger job and would duplicate the READMEs.

## Regenerating the numbers

```powershell
cd dev/script-metrics
.\run.ps1 -ReportOnly     # rebuild out/metrics.json from the cached database
```

Then update the figures in whichever variant is chosen. Only variant C has more
than the headline numbers.
