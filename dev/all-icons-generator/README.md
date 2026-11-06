# All icons generator

Lays every userscript's icon side by side, fitted to the same box. Use it to check that the icons read as one set: same visual size, centred, legible down to toolbar size on light and dark backgrounds.

[See the page on GitHub](https://htmlpreview.github.io/?https://github.com/majkinetor/musicbrainz-userscripts/blob/main/dev/all-icons-generator/preview.html) (main's committed `preview.html`).

```powershell
node dev/all-icons-generator/gen.mjs
```

It writes:

| File           | What                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `norm/*.svg`   | each script's icon fitted to the shared box                                                                            |
| `preview.html` | one self-contained page: all icons at 128, 48, 28 and 16 px, toolbar strips and every animation, on white and on black |
| `preview.png`  | a screenshot of `preview.html`, kept up to date by hand                                                                |

The console prints each demo's CSS size, then each icon's fill ratio and the margin it got.

## Animations

Under the icons, each theme shows the animations the scripts play, running:

- **Folded dock**: live dock entries peeking out and sliding back, and their busy states.
- **Busy icons**: each icon beside the busy icon that stands in for it.
- **Every other animation**, on the script's own element in its animated state, with its name and the script's below.

Each demo is listed in `demos.mjs`: the script, the markup, and which of the script's rules it needs. `css-of.mjs` reads those rules and their `@keyframes` out of the script's source, so a demo plays the CSS the script ships. Every demo runs in a frame of its own, so no script's rules reach another's. A one-off animation, such as a flash, replays every few seconds.

To add one, add an entry to `demos.mjs`. A demo that warns "no @keyframes found" isn't picking up the script's rules: its selector test or its markup is off.

## How icons are found

Each script's `@icon` (from `<script>.user.js` or `dist/<script>.user.js`) is used as shipped; a script without an embedded `data:` icon is left out.

| Setting | What                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------- |
| `SWAP`  | a file to show in place of a script's `@icon`: a candidate icon under review, or Mammoth's `icon.svg` for its emoji |
| `SKIP`  | scripts left out of the set: Discogs Credits (frozen) and Bandcamp Player Enhanced                                  |

To try a candidate against the whole set, add it to `SWAP` with a short note; the note shows under the icon.

## How icons are fitted

Each icon is drawn at 512 px and measured: its drawn bounding box and how much of that box is filled. The longer side then fills the icon, less a margin:

| Icon                         | Margin |
| ---------------------------- | ------ |
| wide or tall (sides < 0.8)   | 2%     |
| square, solid (fill > 0.85)  | 7%     |
| square, mostly solid (> 0.6) | 5%     |
| square, open line shapes     | 3%     |

> [!NOTE]
> Solid tiles and discs look heavier than open line shapes of the same size, so they get more margin. A wide or tall icon already looks smaller, its short side well short of the box, so it gets the least.

`preview.png` isn't written by `gen.mjs`; screenshot `preview.html` at 1300 px wide (full page) after regenerating.
