# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## Other scripts' tools

Apollo offers a button another userscript adds to the release editor as one of its tools. A few known scripts' buttons are recognised by their text; any element with `class="apollo-tool"` is offered too:

```html
<button class="apollo-tool" data-apollo-label="My tool" data-apollo-icon="★">…</button>
```

| Attribute           |                                    |
| ------------------- | ---------------------------------- |
| `data-apollo-label` | the tool's name                    |
| `data-apollo-icon`  | a glyph or an image URL; default 🔧 |
| `data-apollo-id`    | keeps the tool's place on the bar  |

Apollo clicks the element and re-reads the tracklist, so this suits tools without inline settings.
