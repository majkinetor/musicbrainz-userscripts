# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## Other scripts' tools

Apollo offers a button another userscript adds to the release editor as one of its tools: it shows in **Tools ▾** and **Customize…**, can be pinned, reordered and shown as icon or text, and appears only while the providing script is there. Two ways in:

- **Recognised buttons** are adopted unmodified, matched by their visible text, such as kellnerd's *Guess punctuation*. Adopting another is a one-line registry entry in Apollo.
- **The convention**: any element with `class="apollo-tool"` is offered, with no change to Apollo.

```html
<button class="apollo-tool" data-apollo-label="My tool" data-apollo-icon="★">…</button>
```

| Attribute           |                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------- |
| `data-apollo-label` | the tool's name; default the element's text                                             |
| `data-apollo-icon`  | a glyph, or a `data:` or `http(s)` image URL; default 🔧                                 |
| `data-apollo-id`    | keeps the tool's place on the bar; default the element's `id`, then a slug of the label |

Apollo clicks the element, then re-reads the tracklist. This suits tools without parameters, or that open their own settings on a click; a tool whose controls would have to sit inline in Apollo's bar isn't supported.

## Discogs artist links

Before the name search, each track artist is matched by its Discogs URL, taken from the release's Discogs tracklist, against MusicBrainz's URL relationships. One linked MusicBrainz artist is applied (**DISC**); several are offered to pick from.

Featured artists split out of the title count too. Discogs credits them as extra artists whose role varies (*Featuring* on some releases, *Vocals*, *Backing Vocals*, *Rap* or *MC* on others), so Apollo reads any performing role (vocals, rap, voice, performer, narration, choir; not producers, remixers or instrumentalists) and matches a featured artist by its Discogs link, keyed to its credited name, by title, or by position when the titles differ but the track counts agree. That link is often the only bridge, since the split name is frequently just an alias.

Already-linked artists are verified through MusicBrainz's internal entity endpoint, so the rate-limited URL lookup runs only for artists missing a link, and a fully linked release is near-instant. Clearing or reverting all artists doesn't re-check; the next **Match** does.

## Auto confirm

When another site seeds the add or edit release form, MusicBrainz shows a confirmation page before the editor; *Auto confirm release submissions* clicks its submit button. It folds in chaban's [Auto click confirm form submission](https://greasyfork.org/en/scripts/536999), acts only on that page (`.confirm-seed`), and `?skip_confirmation` on a seed URL bypasses it once.

## MusicBrainz's browser check

Since 2026-09 musicbrainz.org's website side, `/ws/js/*` included, answers with a *Verifying your browser* page until the browser has solved its proof-of-work; ws/2 isn't checked. A pass sets the `__meb_verified` cookie for 24 hours, bound to the IP. The release editor never reloads, so once the cookie lapses or the IP changes, every `/ws/js` read gets that page (HTTP 200, HTML) instead of JSON ([#733](https://github.com/majkinetor/musicbrainz-userscripts/issues/733)).

Apollo's `/ws/js` reads go through `mbWebFetch`: on that page it loads the same URL in one fresh hidden iframe, where MusicBrainz's own script passes the check and renews the cookie for the whole browser, then retries. A frame that doesn't clear within 20 seconds gives a toast to open any MusicBrainz page in another tab, which does the same. The page is recognised by its title and its `<noscript>` text, never by `/__meb_verify`, which ordinary pages also post to.
