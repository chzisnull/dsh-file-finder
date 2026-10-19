# dsh-file-finder

A DeepSeek Harness plugin for finding workspace files without leaving DSH: search by file name or by file content, then open the result in DSH's own right-sidebar preview — or in the built-in editor when you need to change something.

[中文文档](README.zh.md)

## What it does

- **Search by file name**, including a path fragment such as `src/view`.
- **Search by content**, with one result row per matching line.
- **Open natively**: Enter opens the file in DSH's right-sidebar document preview, the same surface the Files tab uses, and jumps to the matching line for content hits.
- **Edit in place** when you need to: ⌘/Ctrl+Enter opens the built-in editor, which saves through DSH's workspace filesystem and refuses to overwrite a file that changed after it was loaded.
- **Native shortcuts**: Cmd/Ctrl+P and Cmd/Ctrl+Shift+F, like VS Code, without claiming a default binding in DSH's shortcut registry.
- **A redesigned settings page** with cards, keycaps, steppers, and switches, plus an "Opening" preference that chooses whether Enter previews or edits.
- **Polished interaction**: a frosted command palette, spring-eased mode switch, selected-row rail, loading skeletons, and reduced-motion support.

## File system: it already uses DSH's

There is no second filesystem hidden in this plugin:

| Operation | Owner |
| --- | --- |
| Walking, reading, writing workspace files | DSH's `ctx.fs` seam (`index.js`) |
| Search and ranking | This plugin (DSH exposes no reusable search service) |
| Opening and viewing a file | DSH's right-sidebar document preview, via `ctx.sidebarRight.openResource()` and a `dsh-resource://file/session/<sessionId>/<path>` address |
| Editing and conflict checks | This plugin's editor, over the same `ctx.fs` seam |

When the native preview is unavailable (no live Session, or a shell without the right sidebar), the finder falls back to its own editor and says so. The **Settings → File Finder** page lets you make the editor the default action instead.

## Shortcuts

| Action | Default keys |
| --- | --- |
| Search by file name | Cmd/Ctrl+P |
| Search by content | Cmd/Ctrl+Shift+F |

The commands are registered with DSH's shortcut service so you can assign your own keys in **Settings → Edit shortcuts**, but they declare **no default binding**. DSH's registry throws when one command's default overlaps another's, and it throws from inside the *other* plugin's `apply()`, so claiming Cmd+Shift+F here took the whole Web UI boot down (`Conflicting shortcut defaults: session.fork and files.searchContent`). The VS Code keys above are served by this plugin's own keydown handler instead.

Note that Cmd+Shift+F is DSH's own "fork session" binding; this plugin uses it for content search, so rebind `session.fork` in **Settings → Edit shortcuts** if you relied on it.

## Settings

**Settings → File Finder** covers:

- Shortcut reference with one-click try buttons
- Case sensitivity
- Extra ignored directory names (with live chips)
- Name and content result limits (steppers)
- The default Enter action: **Sidebar preview** or **Built-in editor**
- Reset to defaults; changes save automatically

## Editing

Choose a result and press Cmd/Ctrl+Enter (or set the built-in editor as the default action). Save writes the full text back through the workspace filesystem and refuses to overwrite a file that changed after it was loaded. Reload, then save again, to take the newer version. The editor is for UTF-8 text under about 1 MB. Binary files and common build or dependency directories are skipped.

## Install

From this directory, after the plugin is on disk:

```sh
dsh plugin add /Library/aiProject/dsh-file-finder
```

Or install the GitHub archive once it has been pushed. Restart or refresh the DSH page if the new client module does not appear immediately.

The same operations are available to the agent as the `file_finder` tool.

## Development

```sh
node --check index.js
node --check client.js
npm test
```

`npm test` covers the search helpers, the shortcut-default regression guard, and the UI contract (native preview address, palette hooks, reduced-motion rules).

The native-integration research — address grammar, session derivation, service access, HMR behavior, and the keep-vs-delegate matrix — is documented in [docs/native-integration.md](docs/native-integration.md).

`preview/` is a dev-only harness that renders the palette and settings page outside DSH with the real DSH theme tokens, and captures light/dark screenshots with Playwright:

```sh
node preview/screenshot.mjs
```

It is not part of the published package.

## License

MIT
