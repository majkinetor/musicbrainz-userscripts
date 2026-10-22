# Guess case

`mbuGuessCase` is MusicBrainz's guess case without MusicBrainz's editors ([#785](https://github.com/majkinetor/musicbrainz-userscripts/issues/785)): its own code (`root/static/scripts/guess-case` in [musicbrainz-server](https://github.com/metabrainz/musicbrainz-server)), ported to one self-contained function in [`guess-case.mjs`](guess-case.mjs). It needs no page, no cookie and no network, and gives MusicBrainz's results. On top of them it has more language modes and a few rules of ours, which can be turned off.

## Use

| Where                 | How                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A script in this repo | add the two marker lines `// <ST-GUESSCASE>` and `// </ST-GUESSCASE>`; [`sync-guesscase.mjs`](sync-guesscase.mjs) (run by the pre-commit hook) fills them |
| Node                  | `import mbuGuessCase from './guess-case.mjs'`                                                                                                             |

```js
mbuGuessCase('the dark side of the moon (2011 remaster)');                  // 'The Dark Side of the Moon (2011 remaster)'
mbuGuessCase('la vie en rose', { language: 'fra' });                        // 'La vie en rose'
mbuGuessCase('song by korn', { entity: 'release', mode: 'Sentence' });      // 'Song by korn'
mbuGuessCase.sortName('John Smith', { entity: 'artist', isPerson: true });  // 'Smith, John'
```

## API

| Member                                 |                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `mbuGuessCase(title, options)`         | the title in guess case                                                           |
| `mbuGuessCase.sortName(name, options)` | the sort name MusicBrainz's editors guess; `isPerson` reorders a person's names   |
| `mbuGuessCase.modeFor(language)`       | the mode for a language: ISO 639-3 (`'fra'`) or MusicBrainz's language id (`134`) |
| `mbuGuessCase.modes`                   | the mode names                                                                    |

| Option          | Default         |                                                                                                                                                                      |
| --------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity`        | `'track'`       | `track`, `recording`, `release`, `release_group`, `work`, `artist`, `label`, `area`, `place`, `event`, `series`, `genre`, `instrument`: MusicBrainz's handler for it |
| `mode`          | from `language` | a name from `modes`; wins over `language`                                                                                                                            |
| `language`      | none: English   | ISO 639-3 or MusicBrainz's language id, through `modeFor`                                                                                                            |
| `keepUpperCase` | `true`          | a word in capitals stays (MusicBrainz's *Keep all-uppercase words uppercased*)                                                                                       |
| `romanUpper`    | `false`         | roman numerals in capitals (MusicBrainz's *Uppercase Roman numerals*)                                                                                                |
| `extras`        | `true`          | our rules on top; `false` gives exactly MusicBrainz's result                                                                                                         |
| `byScript`      | `true`          | with no `mode`, a title is guessed by its script and `detect` (see [Our rules](#our-rules))                                                                          |
| `detect`        | none            | with `byScript`, a function giving a Latin title's (or part's) language, ISO 639-3, or `null` for `language`'s mode                                                  |
| `separator`     | `'/'`           | what splits a title into parts for `byScript`; empty never splits                                                                                                    |

## Modes

| Mode                         | Language          |                                                                             |
| ---------------------------- | ----------------- | --------------------------------------------------------------------------- |
| English                      | `eng`, and none   | MusicBrainz's: every word capitalised but articles and short prepositions   |
| French                       | `fra`             | MusicBrainz's: sentence case, spaces before `; : ! ?` and inside guillemets |
| Turkish                      | `tur`             | MusicBrainz's: capitalised as English, with Turkish's dotted and dotless i  |
| Sentence                     | any other         | MusicBrainz's: a capital only at the start of a sentence                    |
| Spanish, Italian, Portuguese | `spa` `ita` `por` | ours: Sentence under the language's name                                    |
| Dutch                        | `nld`             | ours: Sentence, with *IJ* as one capital (*IJsland*)                        |

German gets Sentence: its nouns can't be told from the other words.

## Our rules

With `extras` (the default), on titles (`track`, `recording`, `release`, `release_group`, `work`):

- **Version words in brackets lowercased** where MusicBrainz misses them: *official music video*, *lyric video*, *slowed*, *sped up*, *reverb*, *nightcore*, *bootleg*, *mashup*, *flip* and the like (from chaban's [Guess Case Improver](https://github.com/chaban-mb/userscripts)). One written in capitals stays with `keepUpperCase`.
- **CamelCase kept** with `keepUpperCase`: a word of the input with a capital inside it (*KoRn*, *JoJo*, *DeBarge*) keeps it.
- **Per title** with `byScript`, when no `mode` is given: a title written mostly in Cyrillic, Greek or Armenian gets Sentence whatever the language, as the guidelines want for Cyrillic (a release in English, in several languages or in none would capitalise every word). A Latin title gets the mode of the language `detect` names for it, if any ([#804](https://github.com/majkinetor/musicbrainz-userscripts/issues/804)). A title whose parts, split by `separator`, differ has each part guessed on its own: *love story / история любви* → *Love Story / История любви*. From a [forum thread](https://community.metabrainz.org/t/guess-case-for-cyrillic-need-a-fix/814912).

## Tests

[`guess-case.spec.mjs`](guess-case.spec.mjs): `pnpm test --project=guesscase`.

- `@unit`: every title in [`titles.json`](titles.json) (real MusicBrainz titles, their lowercased and uppercased copies, hand-written edge cases), through the track and release handlers, in every MusicBrainz mode and option, must give what MusicBrainz gave, stored in [`mb-guesses.json`](mb-guesses.json). Then our rules and modes.
- `@sandbox`: MusicBrainz's own guess case in the sandbox's release editor, asked again: it fails when MusicBrainz has changed its guess case. `GUESSCASE_RECORD=1` writes `mb-guesses.json` from it instead; port MusicBrainz's change before recording.

The port follows musicbrainz-server at `7224306c` (2026-10-14). MusicBrainz's guess case is GPL-2.0 or later.
