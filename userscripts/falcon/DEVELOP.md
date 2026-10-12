# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## Workers

Workers are MusicBrainz edit pages in same-origin iframes. Each is loaded with MusicBrainz's seed parameters, so the page fills itself. Falcon only touches the form for what seeding can't express (a link that needs two types, a row MusicBrainz couldn't classify), and submits. Where MusicBrainz has an API (cover art, aliases), Falcon uses it instead. The worker count never grows with the queue.

The release editor (`/release/<mbid>/edit`, `/release/add`) is [Apollo Editor](../apollo_editor/README.md)'s page, so Falcon's corner icon stays off it.

## Harmony

*Auto send* treats an import as complete once the Harmony page has a `release_mbid`. On a MusicBrainz error Harmony's page is reloaded up to 5 times, backing off from 5 s to 60 s.

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

[Mission Control](../mission_control/DEVELOP.md#execute) runs its links and a barcode this way and shows the progress in its own cards. [Platform Check](../platform_check/README.md#artists-and-labels) sends its artist and label links by event, and falls back to `?falcon=` in a new tab when no Falcon answers.
