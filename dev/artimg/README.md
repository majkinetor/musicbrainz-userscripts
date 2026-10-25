# Artist image

`ArtistImage` finds an artist's picture, or a label's logo, through the entity's URL relationships, and caches the answer ([#834](https://github.com/majkinetor/musicbrainz-userscripts/issues/834)). It's one class in [`artist-image.js`](artist-image.js). Its storage is a pair of functions you give it.

## Use

| Where                 | How                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A script in this repo | add the two marker lines `// <ST-ARTIMG>` and `// </ST-ARTIMG>`; [`sync-artimg.mjs`](sync-artimg.mjs) (run by the pre-commit hook) fills them                                |
| Any userscript        | `// @require https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/dev/artimg/artist-image.js`, plus `@grant GM_getValue` and `GM_setValue` |
| Node                  | `import ArtistImage from './artist-image.js'` (no storage: nothing is cached)                                                                                                |

```js
const ai = new ArtistImage(
  { get: GM_getValue, set: GM_setValue },
  { log: (m) => console.warn(m) },
);
// urls: the entity's URL relationships, e.g. from ws/2 ?inc=url-rels
const img = await ai.find(mbid, urls);
// { src: 'https://i.discogs.com/…', from: 'Discogs', url: 'https://www.discogs.com/artist/82730' } or null
```

## API

| Member                            |                                                                             |
| --------------------------------- | --------------------------------------------------------------------------- |
| `new ArtistImage(store, options)` | `store`: `{ get(key, default), set(key, value) }`, both optional            |
| `find(mbid, urls)`                | the first image in order, from the cache or the providers; `null` when none |
| `findAll(mbid, urls)`             | every provider's image, in order; `[]` when none                            |
| `cached(mbid)`                    | the cached answer (an image or `null`), `undefined` when none or it expired |
| `cachedAll(mbid)`                 | the cached images in order, `undefined` when none or it expired             |
| `sorted(images)`                  | the images in the current order                                             |
| `forget(mbid)`                    | drops the cached answer, so the next `find` asks the providers again        |
| `ArtistImage.PROVIDERS`           | the providers, in the order they are tried                                  |

| Option      | Default      |                                                                  |
| ----------- | ------------ | ---------------------------------------------------------------- |
| `key`       | `mbu:artimg` | the storage key; the whole cache is one value                    |
| `hitDays`   | 30           | how long a found image is kept                                   |
| `missDays`  | 7            | how long "no image" is kept                                      |
| `max`       | 2000         | entries kept; the oldest go first                                |
| `providers` | `PROVIDERS`  | a list of your own instead                                       |
| `order`     | `PROVIDERS`' | provider keys, or a function returning them; one left out is off |
| `http`      | `fetch`      | `url => Promise<{ ok, json(), text() }>`                         |
| `log`       | none         | `message => …`, called when a provider fails                     |

## Cache

Every provider with a matching URL is asked, and every image found is kept, so a new order needs no new requests. Only the image URLs are kept; the browser's HTTP cache keeps the image itself, so a repeat visit usually loads it without the network, though the browser may evict it. A failed request is not cached: the next `find` tries again.

## Platforms

| Platform    | Matches                                                                                    | Image                                                                               |
| ----------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Discogs     | `discogs.com/artist/<id>`, `/label/<id>`                                                   | the primary image from `api.discogs.com`, else the first                            |
| Deezer      | `deezer.com/artist/<id>`                                                                   | `picture_big` (500×500) from `api.deezer.com`                                       |
| Wikipedia   | `commons.wikimedia.org/wiki/File:…`, `wikidata.org/wiki/Q…`, `<lang>.wikipedia.org/wiki/…` | the Commons file itself, else the item's P18, else the article's page image (500px) |
| Tidal       | `tidal.com/artist/<id>`                                                                    | the artist page's `og:image` (750×750)                                              |
| Apple Music | `music.apple.com/artist/<id>`                                                              | the artist page's `og:image`, as a 500×500 square                                   |
| SoundCloud  | `soundcloud.com/<user>`                                                                    | the profile page's `og:image` (500×500), not the default avatar                     |

Deezer's API and Tidal's, Apple Music's and SoundCloud's pages send no CORS headers: in a userscript, pass a `GM_xmlhttpRequest`-based `http` and `@connect` their hosts.

A provider is `{ key, name, re, get }`: `re` (or a list of them, tried in order) matches a relationship URL, and `get(match, http)` resolves to an image URL or `null`. Add one to `PROVIDERS` in [`artist-image.js`](artist-image.js); its place in the list is its default order.
