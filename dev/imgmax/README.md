# Image maximizer

`ImageMaximizer` finds the largest cover image behind a store page or an image URL ([#717](https://github.com/majkinetor/musicbrainz-userscripts/issues/717)). It's one self-contained class in [`image-maximizer.js`](image-maximizer.js): no DOM, no userscript API, and its network access goes through a function you give it.

## Use

| Where                 | How                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A script in this repo | add the two marker lines `// <ST-IMGMAX>` and `// </ST-IMGMAX>`; [`sync-imgmax.mjs`](sync-imgmax.mjs) (run by the pre-commit hook) fills them                                        |
| Any userscript        | `// @require https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/dev/imgmax/image-maximizer.js`, plus `@grant GM_xmlhttpRequest` and `@connect *` |
| Node                  | `import ImageMaximizer from './image-maximizer.js'`                                                                                                                                  |

```js
const max = new ImageMaximizer({
  request: ImageMaximizer.gmRequest(GM_xmlhttpRequest),   // omit for global fetch
  log: (level, message) => console.log(level, message),   // optional: 'debug' | 'info' | 'warn'
});
const images = await max.fetchImages('https://www.deezer.com/en/album/6575789', { minSize: 200 });
// [{ blob, url, original, page, types: ['Front'], comment: '', width: 1200, height: 1200 }]
```

## API

| Member                                     |                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `new ImageMaximizer({ request, log })`     | both optional                                                                             |
| `candidates(imageUrl)`                     | bigger versions of an image, largest first, the URL itself last; synchronous, no network  |
| `platform(url)`                            | `{ id, name }` of the store a page belongs to, or `null`                                  |
| `find(url)`                                | the images behind a URL, unmaximised: `[{ url, types, comment, page }]`                   |
| `fetchImages(url, { minSize })`            | downloads the largest version of each; throws when there is none                          |
| `fetchLargest(imageUrl)`                   | the first candidate that answers with an image: `{ blob, url, width, height }`, or `null` |
| `ImageMaximizer.metaImage(html, base)`     | a page's `og:image` (then `twitter:image`, `image_src`)                                   |
| `ImageMaximizer.dimensions(arrayBuffer)`   | `{ type, width, height }` from a JPEG, PNG, GIF or WebP header                            |
| `ImageMaximizer.gmRequest(gmXhr, timeout)` | a `request` made from `GM_xmlhttpRequest` / `GM.xmlHttpRequest`                           |
| `ImageMaximizer.fetchRequest`              | the default `request`, on global `fetch`                                                  |

`types` uses MusicBrainz's cover art type names (`Front`, `Back`, `Booklet`, `Medium`, …) where the store tells.

### `request`

`request(url, { type, headers })` returns a promise of `{ status, url, contentType, text }` for `type: 'text'`, or `{ status, url, contentType, blob }` for `type: 'blob'`. It resolves for any HTTP status and rejects only on a network failure.

## Stores

A store page goes to its resolver; any other page to its `og:image`; an image URL is downloaded as it is, after its bigger versions.

| Store          | Read from                                                         | Largest version                            |
| -------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| Apple Music    | iTunes lookup API                                                 | the stored size (`9999x9999bb` request)    |
| Deezer         | public album API                                                  | the stored size (`4000x0` request)         |
| Spotify        | oEmbed                                                            | the `82c1` size code                       |
| Bandcamp       | the page                                                          | `_0`, the original                         |
| Tidal          | the web player's API, in your country and then others             | `origin.jpg`                               |
| Qobuz          | the API when it answers (adds booklets), else the cover's address | `_org`                                     |
| Beatport       | the page's data                                                   | `0x0`, the stored size                     |
| Discogs        | the site's own API, else the public API (max 600 px)      | as given                                   |
| Amazon         | the product page                                                  | the image without size modifiers           |
| VGMdb          | the scan gallery, captions as types                               | `media.vgm.io`                             |
| Melon          | the app's album API                                               | `_org`, the original                       |
| Bugs           | the page's cover                                                  | `original`, the upload                     |
| 7digital, Juno | the page's `og:image`                                             | `_800`, `/full/…-BIG`                      |

Image URLs on SoundCloud, YouTube, Google and Cover Art Archive thumbnails are maximised too.

Discogs' full size, Amazon, VGMdb, Juno and 7digital sit behind bot checks: they answer a browser that has passed them, which is where a userscript's requests come from. A Cloudflare check comes back as the error *Cloudflare check; open the page once in this browser, then retry*.

## Tests

`pnpm test --project=imgmax` runs the unit specs (no network). `IMGMAX_LIVE=1 pnpm test --project=imgmax` also checks the stores that answer a plain request.
