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

On an artist's alias editor, **Fetch from Discogs** reads the artist URLs in `#sidebar ul.external_links` from the aliases page the editor already loads (the add-alias page has no sidebar). Only a click requests `api.discogs.com/artists/<id>` through GM, without a token. The importer is built into the shared alias editor, so Apollo's page and Event Horizon's page and popup use it alike; a caller can override it with an `importAliases` provider. `namevariations` and `aliases[].name` become unsaved rows. Names already present (trimmed, NFC, case-insensitive) and the form's default artist name are skipped; locale and type stay unset. The source URLs are appended to the shared edit note, preserving its text. All linked artists must load successfully before rows are added; failures leave the button available to retry. No MusicBrainz lookup is added.

Before the name search, each track artist is matched by its Discogs URL, taken from the release's Discogs tracklist, against MusicBrainz's URL relationships. One linked MusicBrainz artist is applied (**DISC**); several are offered to pick from.

Featured artists split out of the title count too. Discogs credits them as extra artists whose role varies (*Featuring* on some releases, *Vocals*, *Backing Vocals*, *Rap* or *MC* on others), so Apollo reads any performing role (vocals, rap, voice, performer, narration, choir; not producers, remixers or instrumentalists) and matches a featured artist by its Discogs link, keyed to its credited name, by title, or by position when the titles differ but the track counts agree. That link is often the only bridge, since the split name is frequently just an alias.

Already-linked artists are verified through MusicBrainz's internal entity endpoint, so the rate-limited URL lookup runs only for artists missing a link, and a fully linked release is near-instant. Clearing or reverting all artists doesn't re-check; the next **Match** does.

## Alias editor

Discogs import strips a final space and `(digits)` from source names before duplicate checks, sort-name guessing and locale recognition; other parentheses are preserved. A caller can supply `heading: () => element` for the submission pulse. The shared editor pulses that heading from the start of the batch until all writes finish, with a static tint for reduced motion; Event Horizon supplies the popup header or Aliases section header.

The editor calls its `keepLog` callback after imports, locale actions and submission, so successful fetch-based edits are retained without relying on a native form-submit event. Apollo passes its own `Log.keep()` and `flush()`. Event Horizon supplies a dedicated Apollo logger with the same `apollo:session:` history prefix, preserving its own active logger and issue-log registration. Locale actions record the alias and resulting code or the lack of a confident supported match.

Clearing a locale also clears its primary flag, cancels pending recognition and sets a row-local `localeCleared` marker. Automatic recognition and the submit-time flush skip that row until its name changes or an explicit recognition action resets the marker. The marker is not submitted as an alias property.

Alias and sort-name fields are auto-sized textareas: wrapping changes the display, while pasted line breaks become spaces. The shared editor sizes them on edits and width changes. Arrow keys stay inside a name until the caret reaches its start or end, then move to the same column in the adjacent row.

Discogs imports retain a source URL on each new row for its linked platform icon; this provenance is local to the review session, not a MusicBrainz alias property.

Independent new aliases submit with at most four concurrent form POSTs through the shared request gate. Existing aliases and primary-locale changes submit in order first. The editor is inert while submitting, and successes are marked clean while failures retain their error and stay dirty for retry. There is no automatic write retry after an uncertain response. The sandbox concurrency test observes overlapping real requests and reads all aliases back.

Locale recognition uses the same lande 1.0.10 vendor model as release language recognition. Its source is `dev/aliases/lande-vendor.js`; `sync-aliases.mjs` fills both scripts' `ST-LANDE` blocks and String Theory deduplicates them. No request is sent. The model is initialized only on first recognition; results below 80% confidence or with fewer than four letters are left empty. ISO 639-3 results are canonicalized with `Intl.Locale` and accepted only when the base language is a supported form locale; regions are never guessed. The GM option `mbu.aliasAutoLocale` defaults off, stays with the providing script, and applies after typing pauses, on import and on opening the editor. It preserves manually chosen locales; a locale automatically assigned during this session is cleared and recognized again when its name changes. Right-clicking any locale recognition button processes only empty rows. All results remain unsaved edits until submission.

## Auto confirm

When another site seeds the add or edit release form, MusicBrainz shows a confirmation page before the editor; *Auto confirm release submissions* clicks its submit button. It folds in chaban's [Auto click confirm form submission](https://greasyfork.org/en/scripts/536999), acts only on that page (`.confirm-seed`), and `?skip_confirmation` on a seed URL bypasses it once.

## MusicBrainz's browser check

Since 2026-09 musicbrainz.org's website side, `/ws/js/*` included, answers with a *Verifying your browser* page until the browser has solved its proof-of-work; ws/2 isn't checked. A pass sets the `__meb_verified` cookie for 24 hours, bound to the IP. The release editor never reloads, so once the cookie lapses or the IP changes, every `/ws/js` read gets that page (HTTP 200, HTML) instead of JSON ([#733](https://github.com/majkinetor/musicbrainz-userscripts/issues/733)).

The shared request gate handles it, for every script that sends its `/ws/js` reads through `mbnFetch` ([`dev/net/mb-gate.mjs`](../../dev/net/mb-gate.mjs)): on that page it loads the same URL in one fresh hidden iframe, where MusicBrainz's own script passes the check and renews the cookie for the whole browser, then retries. A frame that doesn't clear within 20 seconds gives a toast to open any MusicBrainz page in another tab, which does the same. The page is recognised by its title and its `<noscript>` text, never by `/__meb_verify`, which ordinary pages also post to.

## Archive

At **Enter edit** (a click on the footer's `[data-click="submitEdits"]`) `archiveOnSubmit()`:

1. collects the release's external links (`linkRows()`, through `archiveUrls()`), skipping MusicBrainz, MetaBrainz and archive.org URLs and what First Contact's handoff archives (its `archive.urls`). The imported link itself (the handoff's `url`) is saved: First Contact saves the page as the user had it (`/en/album/…`), and the archive menu looks the link up by its own address. Links the edit note mentions aren't saved, and the note isn't touched (#739): the [archive menu](#archive-menu) finds the snapshots;
2. fires one save per URL through the shared [`<ST-ARCHIVE>`](../../DEVELOP.md#shared-blocks) block (`mbaSave`), without waiting: the page leaves seconds later. Anonymous: `GET https://web.archive.org/save/<url>`. With keys: `POST /save` (Save Page Now 2, screenshot, `if_not_archived_within=30d`), not followed. A second Enter edit on the same page (MB refused the first) doesn't send a URL again.

A site that refuses archive.org (Save Page Now answers `error:no-request`, "The target server blocks access … HTTP status=403") is saved where its data can be read: `mbaSavable()` maps Discogs' `/release|master|artist|label/<id>` to `api.discogs.com/<type>s/<id>`.

The keys are the GM value `mbu.archive`, shared with First Contact ([its notes](../first_contact/DEVELOP.md#archive)); the switch is `archive` in Apollo's own settings. Specs: `test/736-archive.spec.mjs` (`ARCHIVE_LIVE=1` lets one save through to archive.org and looks for its snapshot).

### Archive menu

On a page that isn't the release editor, `main()` ends in `mountArchiveMenus()`: it adds a `.tc-wb` button to each `#sidebar ul.external_links > li` whose link isn't on MusicBrainz, MetaBrainz or archive.org. Apollo matches `/release/*` and `/release-group/*` for it, besides the artist and label pages it already ran on. The menu's links are plain `web.archive.org` addresses, so a page view sends nothing: `/web/<url>` (latest snapshot), `/web/http://web.archive.org/screenshot/<url>` (latest screenshot), `/web/*/<url>` (calendar), `/save/<url>`. A link `mbaSavable()` maps (Discogs) gets the same for its API address. Setting: `archiveMenu`. Spec: `test/736-archive-menu.spec.mjs`.

## Disc IDs

MusicBrainz has no web route to attach a disc ID; the documented one is Picard, which reads a rip log, works out the disc ID and opens `/cdtoc/attach` (#591). The log parsers are ports of [Picard's](https://github.com/metabrainz/picard/tree/master/picard/disc). A disc ID is a SHA-1 over the TOC, so it is computed in the browser, without libdiscid, and the log never leaves the machine.

- It refuses where Picard refuses: a partial rip (non-consecutive track numbers), a non-standard track sequence, an unknown file. A trailing data track is dropped as Picard drops it.
- A drop goes straight to `/cdtoc/attach?toc=…&id=…&tracks=…` with the medium chosen, skipping the release and medium pickers. The medium's internal row id comes from the page's Remove/Move links when it already has a disc ID, else from MusicBrainz's medium list in the background. Landing on the picker anyway, Apollo ticks the medium and presses **Attach CD TOC**; when MusicBrainz doesn't offer the medium (it lists only mediums whose track count matches the TOC), the picker is left up.
- On the confirmation page Apollo signs the edit note (*Disc ID computed from a CD rip log*), keeping what is there and not signing twice. **Enter edit** is the user's.
- Apollo runs on `/cdtoc/attach` for the last two. On a release's Disc IDs tab it starts from `main()`, beside the archive menu. Specs: `test/591-rip-log-discid.spec.mjs` (the parsers against Picard's answers, the zones, the attach URL) and `test/722-german-discids.spec.mjs` (mediums told apart by number in another language).
