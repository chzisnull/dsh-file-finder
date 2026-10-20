# dsh-file-finder

A DeepSeek Harness plugin for finding workspace files without leaving DSH: search by file name or by file content, then open the result in DSH's own right-sidebar preview — or in the built-in editor when you need to change something.

[中文文档](README.zh.md)

## What it does

- **Browse when there is nothing to search**: with an empty query the palette lists the current workspace directory — folders first, then files — and you can walk into a folder (Enter or →), go back up (Backspace) or jump with the breadcrumb. Typing switches to the normal search, and clearing the query returns to the folder you were browsing.
- **Search by file name**, including a path fragment such as `src/view`.
- **Search by content**, with one result row per matching line.
- **Open natively**: Enter opens the file in DSH's right-sidebar document preview, the same surface the Files tab uses, and jumps to the matching line for content hits.
- **Edit in place** when you need to: ⌘/Ctrl+Enter opens the built-in editor, which saves through DSH's workspace filesystem and refuses to overwrite a file that changed after it was loaded.
- **Native shortcuts**: Cmd/Ctrl+P and Cmd/Ctrl+Shift+F, like VS Code, without claiming a default binding in DSH's shortcut registry.
- **Optional DS Bot bridge**: when the DS Bot plugin is installed, Cmd/Ctrl+Shift+B flips between Bot mode and classic Agent mode; without it neither the shortcut nor its settings card exists.
- **Preview, not just text**: images, video, audio, PDFs, HTML pages and Markdown open in the built-in viewer; HTML runs in a sandbox, Markdown is rendered with DSH's own renderer, and relative images inside a Markdown file resolve to the workspace.
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
| Toggle DS Bot / classic Agent mode (only with the DS Bot plugin installed) | Cmd/Ctrl+Shift+B |

The commands are registered with DSH's shortcut service so you can assign your own keys in **Settings → Edit shortcuts**, but they declare **no default binding**. DSH's registry throws when one command's default overlaps another's, and it throws from inside the *other* plugin's `apply()`, so claiming Cmd+Shift+F here took the whole Web UI boot down (`Conflicting shortcut defaults: session.fork and files.searchContent`). The VS Code keys above are served by this plugin's own keydown handler instead.

Note that Cmd+Shift+F is DSH's own "fork session" binding; this plugin uses it for content search, so rebind `session.fork` in **Settings → Edit shortcuts** if you relied on it.

In the browser Web shell (not the desktop app), Cmd+Shift+B is DSH's right-sidebar toggle. With DS Bot installed this plugin takes that key for the mode switch, so assign a different key to `files.toggleBotMode` in **Settings → Edit shortcuts** if you need the sidebar binding there. On the desktop app the combination is free.

## DS Bot mode switch (optional)

When the DS Bot plugin (`ds-bot`) is part of the running boot, this plugin also offers **Toggle Bot / classic Agent mode** on Cmd/Ctrl+Shift+B, plus a matching card in **Settings → File Finder**.

DS Bot keeps its surface switch private — it exposes no client service — so the bridge does the two things another plugin safely can: it detects `ds-bot` in the boot graph, and it drives the controls DS Bot renders itself (the account menu's surface-switch entry to leave Bot mode, and the DS Bot return pill to come back). Nothing is patched or forked, and DS Bot's own `ds-bot:surface` preference stays authoritative.

Without DS Bot nothing is registered or shown: the command never reaches **Settings → Edit shortcuts**, the settings card stays hidden, and Cmd/Ctrl+Shift+B is left to whatever else owns it.

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

Files that are not text open in the built-in viewer instead: images, video and audio render inline (byte ranges, so video seeking works), PDFs open in the platform frame, HTML pages run in a sandboxed iframe whose scripts cannot reach DSH, and Markdown is rendered with DSH's Markdown renderer, with an **Edit source** button that hands the file to the text editor.

Hold **Cmd/Ctrl** in the editor and every identifier that resolves gains a dotted underline and a pointer: hovering shows its kind, its declaration and the line, and Cmd/Ctrl-click jumps to the definition. **Cmd/Ctrl+[** (or the back button in the header) returns to where you came from. Resolution is same-file for now — the declaration scan covers JS/TS, Python, Go, Rust, Java/C-like, HTML anchors and a generic fallback; project-wide TypeScript resolution is the next phase.

Text is coloured lexically: keywords, types, strings, numbers, comments, calls, properties and HTML/CSS/JSON/Markdown markup each get their own colour in both DSH themes. Markup files also colour what hides inside them — Vue/Svelte/HTML `<script>` blocks run the script scanner, `<style>` blocks the CSS one, and Vue `{{ }}` expressions and directive values (`:prop`, `@click`, `v-if`) are coloured as code — and a Markdown fenced block is coloured as the language it names. The textarea keeps the caret, selection and IME; only the visible lines are painted, so a large file scrolls without lag. Files over 200 KB fall back to plain text and say so in the header, and an open in-file search keeps the colours behind its highlight.

The editor shows a line-number gutter and highlights the caret's line. **Cmd/Ctrl+F** opens in-file search: every match is highlighted, the current one more strongly, with a match count, previous/next buttons, and a **Aa** case-sensitivity toggle. Enter and Shift+Enter step through matches, Escape closes the search and returns focus to the text.

## Install

The plugin is published to npm as **`dsh-file-finder`**, so **Settings → Plugins → Add plugin** resolves the package name directly:

```sh
dsh plugin add dsh-file-finder
```

Or install from this checkout:

```sh
dsh plugin add /Library/aiProject/dsh-file-finder
```

Restart or refresh the DSH page if the new client module does not appear immediately.

The same operations are available to the agent as the `file_finder` tool.

## Development

```sh
node --check index.js
node --check client.js
npm test
```

`npm test` covers the search helpers, the shortcut-default regression guard, and the UI contract (native preview address, palette hooks, reduced-motion rules, the DS Bot bridge, and the editor's line gutter, in-file find and syntax colours).

Browser checks are split by feature:

```sh
npm run check:find
npm run check:viewer
npm run check:intel
npm run check:tokens
```

The DS Bot bridge also has a browser check that runs the real key handler against DS Bot's real selectors, with and without `ds-bot` in the boot graph:

```sh
node preview/bot-check.mjs
```

The native-integration research — address grammar, session derivation, service access, HMR behavior, and the keep-vs-delegate matrix — is documented in [docs/native-integration.md](docs/native-integration.md).

`preview/` is a dev-only harness that renders the palette and settings page outside DSH with the real DSH theme tokens, and captures light/dark screenshots with Playwright:

```sh
node preview/screenshot.mjs
```

It is not part of the published package.

## License

MIT
