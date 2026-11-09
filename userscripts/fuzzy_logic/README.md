# Fuzzy Logic <img src="icon.svg" align="left" width="48">

Everyone has an opinion on genre: collect them from linked pages and cast yours in one batch.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/fuzzy_logic/fuzzy_logic.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/fuzzy_logic/fuzzy_logic.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)

## Features

- **[Collecting](#collecting)** genres and tags from the pages linked to a release, release group, artist, label or recording.
- **[Voting](#voting)** on everything you selected at once, optionally on the release group and every recording too.
- **[Mapping](#mapping)** turns a source's names into MusicBrainz genres.
- **[Ignore and favourites](#ignore-and-favourites)** hide the noise and keep your usual tags on offer.

## Collecting

Open **Fuzzy Logic** from String Theory's dock. It reads the entity's links, up to 20 per source, and lists what it finds with the original names and the sources that gave each tag.

Sources: Bandcamp, Discogs, Deezer, Apple Music, AllMusic, Beatport, Wikidata, SoundCloud, VocaDB, Last.fm, RateYourMusic and Album of the Year.

RateYourMusic and Album of the Year block automated reads, so their genres are read when you open a linked RYM or AOTY page yourself and kept for the next collect. A link you never opened shows "not read yet" in the source list.

The row of source buttons shows what each one gave. Click a source to leave its tags out, click again to bring them back.

**Genres** shows only MusicBrainz genres and your favourites. **All** shows every collected tag.

With [Collect tags when a page opens](#settings) on, the launcher's badge counts the new genres before you open the window.

Event Horizon's tag editor gets a small Fuzzy Logic button beside its close button, showing the count. Votes made from there go through Event Horizon.

## Voting

Genres you haven't voted for yet start out selected. Click a row to select or unselect it, or use **Select all**. Tags you already voted for are marked.

**Vote N** upvotes the selected tags and **Withdraw** takes your votes back. Both need you to be logged in. Reload the page to see the result. With Event Horizon, a vote shows right away, but after **Withdraw** you still need to reload.

On a release, the checkbox next to the switch votes on its release group and every recording too.

A tag with a comma can't be selected, because MusicBrainz splits it: map it first.

## Mapping

Right-click a row, or use its menu, for **Map *tag* to…**. Separate several targets with `;`. The same menu has **Ignore**, **Favourite** and **Open on *source***.

**Mapping suggestions** at the end of the list offer rules for tags that look like a known genre. **Add** saves the rule.

Rules live in the **Mapping** tab of the settings, where **+ Rule**, **Import**, **Export** and **Defaults** manage them. The first match wins. `/regex/` works on the left and `$1` on the right.

| Collected              | Becomes              |
| ---------------------- | -------------------- |
| Folk, World, & Country | folk; world; country |
| Funk / Soul            | funk; soul           |
| Stage & Screen         | soundtrack           |
| Brass & Military       | brass band; military |
| Children's             | children's music     |

## Ignore and favourites

The **Lists** tab of the settings holds both.

**Ignore** tags are never shown. `/regex/` works. The defaults are `seen live`, `favorites`, `non-music` and any tag made only of digits.

**Favourites** are always offered, collected or not.

## Settings

The ⚙ in the window, a right-click on the launcher, or the menu command **Fuzzy Logic settings**.

| Setting                        | Default | What it does                                                             |
| ------------------------------ | ------- | ------------------------------------------------------------------------ |
| Collect tags when a page opens | off     | Collects in the background. Off, collecting starts when the window opens |
| Sources                        | all on  | Which sources are read                                                   |

## Shortcuts

| Gesture     | Where    | What it does       |
| ----------- | -------- | ------------------ |
| Click       | tag row  | Select or unselect |
| Right-click | tag row  | Tag menu           |
| Right-click | launcher | Settings           |
