# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## Workers

MusicBrainz sends no `X-Frame-Options` or CSP `frame-ancestors`, so its edit pages can be framed. Falcon's panel hosts a handful of same-origin `<iframe>` workers: the panel's script reaches straight into each one's DOM, checks the form, submits, and once MusicBrainz redirects off `/edit`, loads the next queued entity into a fresh iframe on that worker. The worker count never grows with the queue, and nothing opens or closes per item.

Each worker opens MusicBrainz's own **seed URL** (`?edit-<type>.url.0.text=…&…link_type_id=…`), so the page fills the form itself as it renders, instead of Falcon typing into it. Falcon touches the form only for what seeding can't express: a relationship type MusicBrainz left unresolved, a second type on a URL that needs two, and clearing rows MusicBrainz couldn't classify, which would otherwise disable the submit button for the whole group. A URL MusicBrainz finds ambiguous (a Bandcamp track: purchase or streaming?) fails with that reason rather than blocking its group.

Where MusicBrainz has an API, Falcon uses it instead of a form: cover art (sign → upload → register, the same as [Art Station](../art_station/DEVELOP.md)) and aliases.

The release editor (`/release/<mbid>/edit`, `/release/add`) is [Apollo Editor](../apollo_editor/README.md)'s page, so Falcon's corner icon stays off it.

## Name lookups

Entity names resolve through the shared MusicBrainz request gate: a few at a time, backing off together on a 429 or 503 by its `Retry-After`. They **yield to a run**: Start drops the lookups still pending, since names are cosmetic and the workers' page loads draw on the same per-IP rate limit. Rows keep the label they have until the run finishes, then resolution resumes.

## Cover art

Every candidate is measured, and the largest wins, then the smallest file. A provider's advertised size is used only for a candidate that can't be fetched at all: Harmony's captions don't describe the linked image (Tidal advertised 3000×3000 for a 1280×1280 file, Spotify 2000×2000 for a 640×640 one). A store's URL is first maximised to the largest size the store serves (#719). The edit note names the source URL, its measured size, the candidates it was chosen over, and for a Harmony batch the page it came from, so a voter can judge the pick.

As soon as a release item is queued, the Cover Art Archive is checked, and the row warns when the release already has art: unlike a link, a cover isn't idempotent.

## Series

A series' contents are relationships, not a browsable collection (there is no `/ws/2/release-group?series=…`), so its membership is one request. The two expansions aren't: *every release in those groups* is a browse per group, and *the release groups of those releases* a lookup per release, which is why both are off by default.

## Aliases

Each alias is its own MusicBrainz edit, submitted through `/<entity>/<mbid>/add-alias`; localising a 20-track release is 40 edits, which is why the bulk path is a JSON file. Before each item Falcon reads the entity's aliases and skips any whose name, locale and type already match: MusicBrainz accepts exact duplicates without complaint. When that read fails, the aliases are held back rather than risking duplicates, and **Retry failed** picks them up later. `type` is matched against the form's own list, as MusicBrainz names it for that entity (`Recording name`, `Search hint`, `Legal name` on artists).

## Harmony

**Auto send** holds back when the page isn't a completed import (no `release_mbid` in the URL: the release doesn't exist in MusicBrainz yet), while Harmony is still rendering its actions (it waits for the count to stop changing, as the *Send N to Falcon* label does), and when there is nothing to send. Its countdown on the button matters most with *Open from Harmony in new tab* off, where a send navigates the tab away.

**When Harmony errors.** Harmony builds its actions page in one pass: the release lookup, the merge, then a browse of the release's artists, recordings and labels. When any of it fails the rest is abandoned, but the page still answers `200 OK` and renders, short of actions (#590); Harmony has no retry of its own. Only a MusicBrainz error gets a reload: a provider that fails to parse can fail forever (`Beatport: Failed to extract embedded player JSON` was seen blocking six providers that had answered fine). Harmony's message box renders a `<span class="provider">` chip for a provider error and none for a MusicBrainz one, which is what tells them apart.

- A MusicBrainz error reloads the page up to 5 times (`falcon:harmonyReloadMax`), waiting 5 s doubling to at most 60 s, plus up to a second of jitter; 15 s to start when the server asked for less traffic.
- Retries exhausted, a provider error, or one a reload can't fix (a malformed MBID, a release that isn't there): the batch is sent anyway, as *Send N to Falcon (partial)*, with the reason as its edit note.

**Reload after a clean run** does nothing when anything failed, came back partial or waits on a manual review, since the queue doesn't survive a reload. The log does (it lives in the session store); the consumed `falcon=` is dropped from the URL and `tport=` kept, so MusicBrainz still draws its tagger button.

## Picard

*Automatically send to Picard* calls Picard's `http://127.0.0.1:<port>/openalbum?id=<mbid>` once a run finishes (#578), so Picard reads the release with Falcon's links, ISRCs and cover already on it, once per release per tab. Picard needs *Browser integration* on that port; when it isn't reachable, the log says so. The MusicBrainz URL *Send to Falcon* opens always carries `&tport=<port>`, ticked or not, which is what makes MusicBrainz draw its own tagger button.

## Disc IDs

MusicBrainz has no web route to attach a disc ID; the documented one is Picard, which reads a rip log, works out the disc ID and opens `/cdtoc/attach` (#591). Falcon's log parsers are ports of [Picard's](https://github.com/metabrainz/picard/tree/master/picard/disc). A disc ID is a SHA-1 over the TOC, so it is computed in the browser, without libdiscid, and the log never leaves the machine.

- It refuses where Picard refuses: a partial rip (non-consecutive track numbers), a non-standard track sequence, an unknown file. A trailing data track is dropped as Picard drops it.
- A drop goes straight to `/cdtoc/attach?toc=…&id=…&tracks=…` with the medium chosen, skipping the release and medium pickers. The medium's internal row id comes from the page's Remove/Move links when it already has a disc ID, else from MusicBrainz's medium list in the background. Landing on the picker anyway, Falcon ticks the medium and presses **Attach CD TOC**; when MusicBrainz doesn't offer the medium (it lists only mediums whose track count matches the TOC), the picker is left up.
- On the confirmation page Falcon signs the edit note (*Disc ID computed from a CD rip log*), keeping what is there and not signing twice. **Enter edit** is the user's.

## Handoff

Another script hands Falcon a queue in the [JSON model](README.md#json-model), read as **Import** reads a file: the root `note` becomes the batch edit note, and an item carries whatever a row can.

- **Link**: append `?falcon=<base64(JSON)>` to any musicbrainz.org URL. Falcon opens with the queue seeded and doesn't start it.
- **Events**, on a page where Falcon already runs, dispatched on `document` with the JSON as a string `detail`:

| Event           |                                                  |
| --------------- | ------------------------------------------------ |
| `falcon:import` | queue it; Falcon answers with `falcon:import-ok` |
| `falcon:run`    | queue it and start the queue                     |
| `falcon:show`   | open the panel                                   |

Keys at the JSON's root for `falcon:run`:

| Key                     |                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `"closeWhenDone": true` | the panel closes when the run finishes with every item done, and the corner icon turns green until the next run starts                                       |
| `"headless": true`      | the panel stays out of sight while the batch runs                                                                                                            |
| `"tag"`                 | Falcon reports each change to the batch's items as a `falcon:status` event: `{ tag, running, items }`, each item with its type, MBID, name, status and error |

A batch handed over this way (event or link) adds an entity already queued to its row rather than queueing it twice, so sending the same batch again doesn't run it twice; **Import** restores a file as it is.

[Mission Control](../mission_control/DEVELOP.md#execute) runs its links, a barcode and catalog numbers this way and shows the progress in its own cards. [Platform Check](../platform_check/README.md#artists-and-labels) sends its artist and label links by event, and falls back to `?falcon=` in a new tab when no Falcon answers.
