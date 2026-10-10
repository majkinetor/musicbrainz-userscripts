# Shared UI — components, icons, and the checks that keep them honest

The widgets every script shares (#563), the platform icon set (#404), and the
live checks for both. Colours come from [`../tokens/`](../tokens/README.md).

| File | What it is |
|---|---|
| `ui-components.mjs` | the components: help link, toast, config header, log window, overlay, dismissal, the scoped control defaults — **the only file you edit** |
| `platform-icons.mjs` | the platform icon set (Spotify, Discogs, …) |
| `sync-ui.mjs` | inlines the components into every `// <ST-UI>` carrier |
| `sync-icons.mjs` | the same for `// <ST-ICONS>` |
| `verify-ui-live.mjs` | drives each component in a real page and asserts the contract |
| `verify-theme-live.mjs` | with a dark theme on, is any control in our windows still light? |
| `verify-contrast-live.mjs` | is every label readable? (four theme modes, see below) |
| `shoot-ui.mjs` | 46 numbered screenshots into `../screens/ui/`, light and dark |

```bash
node dev/ui/sync-ui.mjs             # the pre-commit hook runs this for you
node dev/ui/verify-ui-live.mjs
node dev/ui/verify-contrast-live.mjs --userstyle
```

The live checks run against `test.musicbrainz.org` and abort every POST.

## The log window and the toast

Every script's activity log is `mbuLog()`: the last 20,000 lines of the session (about 4 MB), in a floating window you drag by its title bar and resize from its corner, with **Clear** (empties it, counts and all), **⛶** full screen (or double-click the title bar) and **⧉ Copy** (the whole log as Markdown, ready for a GitHub issue). Older lines past the limit are dropped, and the Markdown says how many.

A line can carry a **category** (`LOG.cat('Spotify').warn(…)`): a quiet tag before the message, and `[Spotify]` in the Markdown. A row of filters appears under the header only when there is a choice: the levels (error, warn, info, debug; ok counts as info) once two have lines, the categories once there are two. Click one to see only those lines, again to see all. The **Filter** box in the title bar shows only the lines with its text (message or category; Escape empties it), together with those filters. Copy always takes the whole log. Platform Check tags each line with its platform, Falcon with its worker.

`LOG.pre(text)` keeps a block as written: line breaks, spacing, monospace (Falcon's run summary table). `LOG.mount(el, { tools })` draws the same viewer into a script's own panel, without the window buttons, with an optional `tools` element of the script's in its toolbar (Falcon's Log tab).

Every viewer has a **debug** switch, remembered per script and off by default: off, `LOG.debug()` lines are not recorded at all. `LOG.debugOn()` / `LOG.setDebug(v)` read and set it.

**History** (#705) is opt-in, per script (`o.history`; only Falcon so far). Only a session the script marks with `LOG.keep()` is stored, in the page's `localStorage` under `<prefix><id>`, within 100 ms of each line, so a crashed tab keeps its log. A long session keeps its first and last lines and says how many went between; the newest *keep* sessions stay. The viewer gets a session list (date and `LOG.name()`; `LOG.refresh()` redraws it, only when it changed) and **Clear history**; a past session is read-only, and Copy takes it. `LOG.session()` starts a new one, `LOG.resume(LOG.last())` carries one on across a navigation.

`mbuToast(msg, { action: { label, onClick } })` puts one button on a toast: it then takes clicks and stays up 12 s. A script uses it to ask for the log when something goes wrong in the wild, as Apollo does for #638.

## The four theme worlds

`verify-contrast-live.mjs` runs one of four, and they are not
interchangeable — each caught bugs the others could not:

| Flag | The world |
|---|---|
| *(none)* | a dark userstyle that sets `--background`/`--text` **and** paints the page |
| `--novars` | a dark userstyle that paints the page and defines **no** variables |
| `--light` | no userstyle at all |
| `--userstyle` | kellnerd's real "Dark Side of MusicBrainz", fetched from his repo |

The last one exists because our own inventions were fair models of *a*
userstyle and none was a model of the one people actually run. It inverts every
button and non-text input on the page with a `filter`, which is applied at paint
time and therefore **invisible to computed style** — `getComputedStyle` reports
the colour we asked for while the screen shows its inverse. There is a dedicated
assertion for it.

## Two habits these encode

- **A check that measured nothing must FAIL, not pass.** Both the contrast check
  and the UI suite once scored "ok" on windows that never opened; the contrast
  check now takes a census of how many of our elements were on screen.
- **Do not reason about CSS — render it.** MusicBrainz's stylesheet is
  cross-origin and unreadable from script, so inspecting our own CSS proves
  nothing about what wins.

## Scoping: the ROOTS list

Some rules must reach plain elements (`input`, `button`, `select`) rather than
our own classes, and a bare `button` rule would restyle MusicBrainz's page —
which is not ours to restyle. Those rules are scoped to `ROOTS`, the list of
containers our windows live in. **A window missing from that list is a window
the theme does not reach**, which is how most of #564's reports happened. Add
new containers there, or give the container `.mbu-ui` — the opt-in hook that
needs no edit here.

Specificity in that file is deliberate and load-bearing; the comments explain
each choice, including why the element part sits *outside* `:where()`.
