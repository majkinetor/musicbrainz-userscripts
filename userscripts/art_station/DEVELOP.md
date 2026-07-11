# Develop

*Reference for maintainers*.

## Server communication (internals)

The low-level MusicBrainz / archive.org traffic behind **Enter edit**. Below, `<art>` is `cover-art` on releases and `event-art` on events, and `<mbid>` is the release/event MBID.*

Art Station never screen-drives MB's edit UI. For each edit it reads the relevant edit **form once** for its hidden fields (CSRF token, the type-id vocabulary) and POSTs the same fields the form itself would, with `credentials: same-origin`. `getPostForm(url)` GETs the page and returns the parsed `<form>` (action + hidden inputs); `copyHidden()` copies those into the request body.

### Sourcing art from a provider

The **Source** popover doesn't touch MB directly. It seeds ROpdebee's *Enhanced Cover Art Uploads* by setting its `x_seed.image.0.url` params on a **hidden `/release/<mbid>/add-cover-art` iframe**, then polls the ECAU-restructured page for the resulting preview blob (giving up after 45 s) and harvests it into the gallery as a staged new cover. ECAU performs the actual fetch; nothing is submitted at this stage.

### Uploading a new cover — 3-step pipeline per image

`uploadStep` → `registerStep`:

1. **Sign** — `GET /ws/js/<art>-upload/<mbid>?mime_type=<mime>` → `{ action, image_id, formdata, nonce }`. Reserves an id and fetches an Internet Archive S3 policy. Concurrent sign calls for the same release **race and 500**, so signing is **serialised through a gate** (`_signGate`) and retries transient 5xx/429 with backoff + jitter.
2. **Upload** — `POST <action>` (an archive.org S3 URL) as **multipart**: the returned `formdata` policy fields + the file. Uses `XMLHttpRequest` (for upload progress + a 5-min timeout); the live XHR is registered on the run's `AbortController` so **Cancel** aborts it mid-upload. Runs in **parallel** (concurrency 4).
3. **Register** — `POST /release/<mbid>/add-<art>` with `add-<art>.id` (= `image_id`), `.nonce`, `.mime_type`, `.position`, `.type_id` (repeated per type), `.comment`, `.edit_note`. Creates the *add artwork* edit. Also runs in **parallel** (#362).

### Ordering — the reorder edit

`add-<art>.position` only places the whole upload as **one group**, so it does *not* reliably interleave several new covers (or a new cover slotted among existing ones). A single **reorder** edit fixes it:

> `POST /release/<mbid>/reorder-<art>` — the full artwork list: `reorder-<art>.artwork.<n>.id` + `.artwork.<n>.position` for every non-deleted cover, new ones referenced by their post-upload `image_id`.

It runs **last**, after every register, and is **re-run whenever a failed upload is retried** (it re-reads `MODEL` live, so a late success lands in the right slot). Because the reorder is authoritative for order, the register step doesn't need to be sequential.

### Other edits

- **Retype / comment** — `POST /release/<mbid>/edit-<art>/<id>` with `edit-<art>.type_id` / `.comment`.
- **Remove** — `POST /release/<mbid>/remove-<art>/<id>` (a 404 is treated as *already removed*, not an error).

Every edit body also carries `.edit_note` (crediting Art Station and the image's source, if any) and `.make_votable=1` when that box is ticked. **Dry run** prints each request's method / URL / body instead of POSTing.
