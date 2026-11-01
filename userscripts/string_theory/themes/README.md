# Themes

String Theory's themes for MusicBrainz. Each is one CSS file, `<name>.dark.css` or `<name>.light.css`, whose first comment holds a `Theme: <shown name>` line. Every such file here is built into the bundle and shows up in the settings.

## Built-in pairs

| Theme       | Light                                           | Dark                                        |
| ----------- | ----------------------------------------------- | ------------------------------------------- |
| Default     | MusicBrainz's original colours                  | Neutral charcoal                            |
| Solarized   | Cream and blue                                  | Deep teal and blue                          |
| Letterpress | Pale paper, oxblood links and evergreen accents | Warm charcoal, coral links and sage accents |

**Letterpress** adds serif headings, fine rules and square controls, including Event Horizon and the bundled script windows. In String Theory's **Theme** settings, choose it for both **Light theme** and **Dark theme**.

## Customizing

To tweak a theme, change the values in its `:root`. To add one, copy `default.dark.css`, rename it, give it a new `Theme:` name and run `node userscripts/string_theory/build.mjs`.

- Never use `filter` on buttons, inputs or selects: it inverts whatever a script puts on them too. Set `--control` and its siblings instead.
- `--invert-value` on icon images is fine: the scripts' own UI turns it off.
- Keep plain-element rules inside `:where()`, so a script's own styles win.
- A Default must exist for each variant.

`default.dark.css` is based on [Dark Side of MusicBrainz](https://github.com/kellnerd/userstyles) by kellnerd (MIT). The `solarized.*.css` pair puts Ethan Schoonover's [Solarized](https://ethanschoonover.com/solarized/) palette (MIT) on its rules.
