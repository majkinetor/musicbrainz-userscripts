# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## How each platform is read

| Platform      | Read through                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Apple Music   | the catalogue its web player uses, anonymously; the older iTunes search (no barcode) when that can't be reached                 |
| YouTube Music | the catalogue its web player uses, anonymously                                                                                  |
| Amazon Music  | the catalogue its web player uses, as a guest; amazon.com's (US)                                                                |
| Audiomack     | the API its web player uses, no login                                                                                           |
| 7digital      | the catalogue its web store uses, no login; the UK store, then the US one                                                       |
| Qobuz         | its API when signed in; otherwise the store page, scraped (slower, throttled)                                                   |
| Deezer        | its API; the answer to a barcode lookup is checked against the barcode asked for, since it sometimes returns an unrelated album |

**Apple Music storefronts.** A release is looked for in several storefronts at once: the release's own link's, the US, UK, Germany, France, Japan, Brazil and Australia. When none has it, every Apple storefront is tried at once, which takes about a second. The log names the storefront a match came from, and the link keeps it.

## Artists and labels

MusicBrainz is asked once which of the found links it already has, and on whom, one request per 100 links: when the scans finish, for the count on **Artists & labels**, and the table reuses that answer. With *Count the links to add* off, it is asked only when the table opens. A match cached before the feature existed is read again once, on the next scan of the release.
