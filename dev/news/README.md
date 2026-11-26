# News

Writes the project's Announcements discussions into one file, `news.json`, for the project site. String Theory's *What's new* reads that file, so it makes no GitHub API calls and never meets GitHub's limit of 60 anonymous requests an hour ([#1123](https://github.com/majkinetor/musicbrainz-userscripts/issues/1123)). You manage the announcements on GitHub only.

[`.github/workflows/pages.yml`](../../.github/workflows/pages.yml) runs it and deploys `docs/` with the file to GitHub Pages, at <https://milic.info/musicbrainz-userscripts/news.json>. The site's [`news.html`](../../docs/news.html) shows every announcement from that file, at <https://milic.info/musicbrainz-userscripts/news.html>, with a contents list of the posts, a filter by script (`?script=Falcon`) and a link to each post (`news.html#1122`).

A link preview in a chat or a forum never sees the `#1122` part, so the script also writes one small page for each post, `news/<id>.html`. Each page is a copy of `news.html` that shows that post alone, with an *All announcements* link. It carries the post's title, the start of its text and its first image in the preview tags. A post's title on `news.html` links to that page, so the link a reader copies is <https://milic.info/musicbrainz-userscripts/news/1122>. `--site` sets the site address in the preview tags.

## What it does

- Every run is a full rebuild from GitHub's current state. An edited post carries its new text. A deleted post, a post moved out of Announcements and a post labeled `skip changelog` are not in the file.
- Each post has its number (`id`), `title`, `url`, creation time (`at`), last edit time (`edited`), rendered body (`html`), label names (`labels`), the issue from its `Issue: #N` line (`issue`), and that issue's channel (`channel`): `stable` with the `released` label, else `latest`.
- Each post also has its script's name (`script`) and icon address (`icon`), from its `area | …` label, for the site's page. String Theory works these out itself.
- The script copies every script's icon into the site, at `news/icons/<script>.svg` or `.png`, and `icon` points there. The site does not depend on `raw.githubusercontent.com`.
- The posts are newest first. `generated` is the time of the build.
- If GitHub fails after three tries, the script exits with an error. The workflow then deploys nothing, and the site keeps the last file.

## When it runs

The workflow runs on these events:

- every change to a discussion: created, edited, deleted, transferred, moved to another category, labeled, unlabeled, pinned, unpinned
- a `released` label added to or removed from an issue
- a push to `main` that changes `docs/`, `dev/news/` or the workflow
- once a day, and by hand (Actions → pages → Run workflow)

A push made with a workflow's own token starts no workflow. For that reason, `metrics.yml` starts this one after it commits `docs/stats.html`.

Pages' source must be "GitHub Actions" (Settings → Pages), because this workflow is the only deploy.

## Running it

From the repo root, with a token that can read the repo:

```sh
GH_TOKEN=$(gh auth token) node dev/news/build.mjs --out news.json
```

`--out` sets the file (default `docs/news.json`). The post pages go in a `news/` folder beside it. Git ignores both. `--repo owner/name` reads another repository.
