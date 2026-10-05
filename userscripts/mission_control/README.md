# Mission Control <img src="icon.svg" align="left" width="48">

One window on a release page that asks the other scripts what's missing, shows everything in one review, and applies the changes you tick, in order.

> **Work in progress ([#680](https://github.com/majkinetor/musicbrainz-userscripts/issues/680)).** This version is the window only. No provider is connected yet, so Probe only checks which providers are installed, and Execute stays disabled.


## Features

- **[Window](#window)**: a full-window overlay with a track matrix, an execution order and a track inspector.
- **[Execution order](#execution-order)**: providers run in a fixed order, some of them in parallel.
- **[Optional steps](#optional-steps)**: the slow Fusion and Credit Hoarder fetches can run automatically, on request, or not at all.

## Window

Open it with the ◎ button in the bottom-right corner of a release page.

- **Header**: on the left the source link and **Probe**; in the middle the release, with a badge per provider; on the right the sidebar toggles, Log, Help, ⚙ and ✕.
- **Tracks**: one row per track, with a column for each track-level provider: ISRCs and recording links (ISRC Scout), duplicates in the release group (Fusion), and credits (Credit Hoarder).
- **Release-level cards** under the tracks: platforms and artists (Platform Check) and cover art (Art Station).
- **Inspector** (right): what each provider found for the selected track.
- **Footer**: how many changes are ticked, with **Dry run** and **Execute**.

Each sidebar can be hidden with its header toggle or its ×, for a more focused view. Hiding the execution order shows it as a single strip under the header instead. When the strip is too narrow for every step, the steps shrink to icons, and their names move to tooltips.

## Execution order

| Step | Provider |
|---|---|
| 1 | Platform Check: platforms and artist links |
| 2 | ISRC Scout and Art Station, in parallel |
| 3 | Fusion: merge suggestions *(optional)* |
| 4 | Credit Hoarder: credits *(optional, info only)* |

ISRC Scout and Art Station run side by side because they call different services with separate rate limits. Credit Hoarder never writes from here. Mission Control shows how many credits it found and keeps them ready, so Credit Hoarder opens straight to its review.

## Optional steps

Fusion scans the whole release group and Credit Hoarder fetches credits for every track. Either can take minutes, so each has a switch, in the sidebar and in ⚙:

| Mode | Effect |
|---|---|
| Auto | fetched during Probe |
| Ask *(default)* | its card waits for a Fetch button |
| Off | the step and its column are dropped |

## Shortcuts

| Key | Action |
|---|---|
| Esc | close the window |

## Notes

- How the scripts talk to each other: [DEVELOP.md](DEVELOP.md).
