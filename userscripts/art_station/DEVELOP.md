# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## Server communication (internals)

The low-level MusicBrainz / archive.org traffic behind **Enter edit**. Below, `<art>` is `cover-art` on releases and `event-art` on events, and `<mbid>` is the release/event MBID.*

Art Station never screen-drives MB's edit UI. For each edit it reads the relevant edit **form once** for its hidden fields (CSRF token, the type-id vocabulary) and POSTs the same fields the form itself would, with `credentials: same-origin`. `getPostForm(url)` GETs the page and returns the parsed `<form>` (action + hidden inputs); `copyHidden()` copies those into the request body.

### Sourcing art from a store

The **URL (N)** imports, Ctrl+V, the picker's `addImageUrl` and Mission Control's apply don't touch MB. They go through the shared [image maximizer](../../dev/imgmax/README.md) (`// <ST-IMGMAX>`, #717): it reads the store's page or API for the cover(s), turns each into its largest version, and downloads it through `GM_xmlhttpRequest`. Art Station keeps JPEG, PNG, GIF and PDF (anything else is skipped with a log line), drops images under 200 px (store logos), and stages the rest as new covers with `_provUrl` (the page), `_provImageUrl` (the image taken) and `_provMaxFrom` (the image the store gave, when a bigger one was taken), which the cover's add edit note lists. Nothing is submitted at this stage.

On the add page, `x_seed.image.<n>.url` / `.types` / `.comment` and `x_seed.origin` (the seeding parameters Enhanced Cover Art Uploads defined, which Harmony and others link with) are read by Art Station and sourced the same way; the type ids map to names through the add form's checkboxes, and the origin goes into the commit note as *Seeded from …*. Rows another script drops into MB's native uploader are still harvested.

### Uploading a new cover — 3-step pipeline per image

`uploadStep` → `registerStep`:

1. **Sign** — `GET /ws/js/<art>-upload/<mbid>?mime_type=<mime>` → `{ action, image_id, formdata, nonce }`. Reserves an id and fetches an Internet Archive S3 policy. Concurrent sign calls for the same release **race and 500**, so signing is **serialised through a gate** (`_signGate`) and retries transient 5xx/429 with backoff + jitter.
2. **Upload** — `POST <action>` (an archive.org S3 URL) as **multipart**: the returned `formdata` policy fields + the file. Uses `XMLHttpRequest` for the upload progress, which also feeds the commit window's upload rate (#698), and the *Upload timeout* setting (#560); the live XHR is registered on the run's `AbortController` so **Cancel** aborts it mid-upload. Runs in **parallel** (concurrency 4).
3. **Register** — `POST /release/<mbid>/add-<art>` with `add-<art>.id` (= `image_id`), `.nonce`, `.mime_type`, `.position`, `.type_id` (repeated per type), `.comment`, `.edit_note`. Creates the *add artwork* edit. Also runs in **parallel** (#362).

### Open removals

The covers with a remove edit open for votes ([#787](https://github.com/majkinetor/musicbrainz-userscripts/issues/787)) come from one read of `<release>/open_edits` per gallery, through the browser-check gate. MusicBrainz translates its labels, so the page is read by structure: an `.edit-list` whose header is `.edit-header.open.remove-<art>`, the edit's `/edit/<n>` link, the artwork id from the `a.artwork-image` link (`…/<id>.<ext>`), and the closing time from the `title` (`YYYY-MM-DD HH:MM UTC`) of `.edit-expiration [title]`. Only the first page is read. Such a cover gets `_rmOpen = { edit, until }`: a chip on its card, and it can't be marked for removal again (it still counts in the reorder).

### Ordering — the reorder edit

`add-<art>.position` only places the whole upload as **one group**, so it does *not* reliably interleave several new covers (or a new cover slotted among existing ones). A single **reorder** edit fixes it:

> `POST /release/<mbid>/reorder-<art>` — the full artwork list: `reorder-<art>.artwork.<n>.id` + `.artwork.<n>.position` for every non-deleted cover, new ones referenced by their post-upload `image_id`.
>
> It must list **every** image the form lists: one left out (a cover marked for removal, whose remove edit is still open for votes) gets the form back with "The edit could not be applied because the images have changed" ([#784](https://github.com/majkinetor/musicbrainz-userscripts/issues/784)). So the covers the gallery drops go last. Like an add, an edit counts as entered only when MusicBrainz redirects away from its form; a 200 is the form again (its error) or the browser check.

It runs **last**, after every register, and is **re-run whenever a failed upload is retried** (it re-reads `MODEL` live, so a late success lands in the right slot). Because the reorder is authoritative for order, the register step doesn't need to be sequential.

### Other edits

- **Retype / comment** — `POST /release/<mbid>/edit-<art>/<id>` with `edit-<art>.type_id` / `.comment`.
- **Remove** — `POST /release/<mbid>/remove-<art>/<id>` (a 404 is treated as *already removed*, not an error).

Every edit body also carries `.edit_note` (crediting Art Station and the image's source, if any) and `.make_votable=1` when that box is ticked. **Dry run** (the ▾ menu on **Submit edits**) prints each request's method / URL / body instead of POSTing.

## Plugin API

Another userscript can add its own source. It appears as **Import from &lt;name&gt;** in the URL panel, and its images are staged like any other. A site script that's logged in to a fan site, say, can fetch with its own session and hand the images over:

```js
window.ArtStation?.registerProvider({
  name: 'SpringsteenLyrics',              // the button label
  id: 'springsteen',                      // optional de-dupe key (defaults to name)
  icon: 'https://example.com/favicon.ico',// optional
  match: 'springsteenlyrics.com',         // optional: string | string[] | RegExp | (url) => boolean
  async run(ctx) {                        // ctx = { mbid, entity: 'release'|'event', artist, title, url, link, links }
    return [{ url: 'https://…/front.jpg', types: ['Front'], comment: '' }];
  },
});
```

- **`match`** shows the button only when the release or event links a matching URL; those are passed as `ctx.link` and `ctx.links`.
- Each returned item is `{ types?, comment? }` plus one image: **`url`** or **`dataUrl`** (preferred: Art Station fetches it itself), or **`blob`** with its **`source`** URL.
- If your manager isolates `window` between scripts, dispatch `artstation:register-provider` with the provider as `detail` instead.

## Zips

A zip is unpacked in the browser. Stored and deflated entries are read; an encrypted or ZIP64 archive is skipped with a message.

## Repeating failures

*Automatically repeat failures* (#566) re-runs only the failed operations until they succeed or the allowance runs out (10 minutes or 10 attempts by default), since Internet Archive uploads are unreliable and a failed booklet is expensive to redo by hand. The gap starts as the window spread over the allowance (10 min / 10 tries = a minute) and backs off: doubled from the 10th attempt, tripled from the 100th, the shape of Anakunda's [MB Auto-retry on upload to CAA error](https://greasyfork.org/en/scripts/475225-mb-auto-retry-on-upload-to-caa-error). Backing off never makes a run outlast its window.

*Upload timeout* (#560) replaced a fixed 5 minutes, which a 50–100 MB PDF booklet could outlast when the Archive was slow, while MusicBrainz's own uploader, which sets no timeout, got through.

## Mammoth

The detailed view's comment field carries `class="mmth-pin"` and `data-mmth-key="art-station-comment"`, so [Mammoth](../mammoth/DEVELOP.md)'s baby attaches to it, with its own list of saved comments.
