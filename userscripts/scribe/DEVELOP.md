# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md); the release Markdown format is in [RELEASE_MD_SPEC.md](RELEASE_MD_SPEC.md).

## The userscript and the helper

A normal page can't call a `http://localhost` service from `https://` (mixed content, CORS). The userscript uses `GM_xmlhttpRequest` instead, which the userscript manager runs outside the page. Saving is a long poll: the userscript keeps a request open, and the helper answers it when the file's modified time changes.

```
hotkey ─POST /open {id,content}→ helper ─writes the file, opens your editor
       ─GET /result?id (long poll)→ helper ─waits for a save…
       ←──── 200 {content} ───────  the text goes back into the field
```
