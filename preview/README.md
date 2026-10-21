# dsh-file-finder · visual preview harness

A dev-only harness that renders the plugin's two client surfaces **outside DSH**, with the real DSH
design tokens, so the command palette and the settings page can be reviewed (and screenshotted)
without booting a full Harness session.

- `shell.overlay` — command palette: name results, content results, empty state, loading state, editor
- `settings.section` — File Finder settings page

> **Scope:** this directory is development tooling. It is not part of the published plugin package
> (`package.json#files` does not include `preview/`), it never runs in DSH, and it must not be
> imported by `client.js` or `index.js`.

## Quick start

```bash
node preview/screenshot.mjs
```

The runner is self-contained: it regenerates the theme, checks the vendored React build, serves the
repository root on a random loopback port, drives Chromium once, writes the PNGs, and exits non-zero
if a required state is missing or a selector/text check fails.

Each run rewrites `preview/shots/`:

| file | viewport | theme |
| --- | --- | --- |
| `palette-name-{light,dark}.png` | 1440×900 @2x | name-search results |
| `palette-content-{light,dark}.png` | 1440×900 @2x | content-search hits with line badges |
| `palette-browse-{light,dark}.png` | 1440×900 @2x | palette opened with no query (workspace listing + breadcrumb) |
| `palette-empty-{light,dark}.png` | 1440×900 @2x | no-match state |
| `palette-loading-{light,dark}.png` | 1440×900 @2x | pending request: skeleton + spinner |
| `editor-{light,dark}.png` | 1440×900 @2x | built-in editor view |
| `editor-dirty-{light,dark}.png` | 1440×900 @2x | unsaved draft + destructive-action confirm banner |
| `editor-find-{light,dark}.png` | 1440×900 @2x | in-file find: query, match count, highlighted hits |
| `settings-{light,dark}.png` | 1100×760 @2x | settings.section page (narrow) |
| `settings-wide-{light,dark}.png` | 1440×900 @2x | settings.section page (wide) |
| `settings-tall-{light,dark}.png` | 1100×1400 @2x | whole settings page for review (all cards + footer) |
| `palette-open-motion-light.png` | 1440×900 @2x | extra frame with motion enabled (opening) |

`preview/shots/manifest.json` records the `client.js` SHA-256, timings, dimensions, per-shot
warnings, console errors and any failures. Hand the manifest to the reviewer with the PNGs.

### Browse manually

```bash
node preview/screenshot.mjs --serve
```

This prints a loopback URL for every state and keeps the server alive until Ctrl+C. Append
`?theme=dark`, `?motion=on` or `?lang=zh` to inspect other variants:

```
http://127.0.0.1:<port>/preview/index.html?theme=dark&motion=off#palette-content
http://127.0.0.1:<port>/preview/index.html?theme=light&motion=off#settings
```

## URL contract

| hash | state |
| --- | --- |
| `#palette-name` | palette opened in name mode, query `index` |
| `#palette-content` | palette opened in content mode, query `parser` (13 hits) |
| `#palette-browse` | palette opened with no query (workspace listing + breadcrumb) |
| `#palette-empty` | query `zzzznomatch` (mock returns no rows) |
| `#palette-loading` | query `parser`, but the mock search request never resolves |
| `#editor` | name search, first result opened in the built-in editor |
| `#editor-dirty` | editor made dirty, then "back to search" so the confirm banner shows |
| `#settings` | `settings.section` mounted on a fake DSH settings page |

Query parameters: `theme=light|dark`, `motion=off|on` (default `off`), `lang=en|zh`,
`capture=open` (signal ready as soon as the palette mounts; used for the motion frame).

The palette is opened the same way a user opens it: a synthetic `Cmd/Ctrl+P` / `Cmd/Ctrl+Shift+F`
keydown, with the registered shortcut command as a fallback. It is never forced open through
internal state, so a broken registration or shortcut is visible in the screenshots.

## How it fakes DSH

`preview/mount.js` installs a small fake `ctx` before calling the plugin's `apply(ctx)`:

- `effect()` runs immediately and keeps the cleanup;
- `locale.register()` / `locale.bind()` back the plugin's `t()` with the zh/en dictionaries the
  plugin registers (`?lang=` selects the table, the key is the fallback);
- `inject(['shortcuts'], …)` captures registered shortcut commands;
- `slots.inject()` / `slots.register()` capture the `shell.overlay` and `settings.section`
  components, which are then mounted with ReactDOM;
- `get('sessions')` returns a snapshot with `ids` plus `retainedBy.mainView` (and a legacy
  `current`) that both resolve to `ses_demo`, whose cwd is `/workspace/dsh-file-finder`;
- `document.addEventListener` is left to the browser (the plugin installs its own key handler).

`window.fetch` is intercepted for these local endpoints (the real Host implementation lives in
`index.js` and is never started):

| endpoint | fixture |
| --- | --- |
| `POST /dsh-file-finder/roots` | three workspaces, one with a long path |
| `POST /dsh-file-finder/search-name` | 10 mixed-extension hits, including a deep `packages/…/index.tsx` path |
| `POST /dsh-file-finder/search-content` | 6 files / 13 line hits with line numbers |
| `POST /dsh-file-finder/read` | a realistic 35-line `index.js` |
| `POST /dsh-file-finder/write` | success, plus a version-conflict response for `client.js` |

The page never touches the real filesystem and never reaches the network.

Plugin settings are seeded in `localStorage` before `client.js` loads (case sensitivity off,
`tmp, coverage` ignored, limits 40/80). `openMode` is seeded to `editor` only for `#editor`, because
the fake host has no native sidebar-preview service; every other state keeps the real default
(`preview`) so the settings page and the "Enter opens …" hints show the shipping default.

`@deepseek-ai/dsh-client-ui-primitives` deliberately throws from `preview/loader-shim.js`: outside
the DSH build its CSS modules cannot resolve. A client that guards the import (as the redesigned
one does) renders its local fallback; one that requires it unguarded fails loudly during mount, which
is the expected signal that the preview cannot judge that build.

## Theme fidelity

`preview/extract-theme.mjs` reads the installed theme bundle
(`@deepseek-ai/dsh-client-ui-theme/lib/client.js`) and copies out the exact token blocks:

1. `base_css_default` — font stack, code font, easing;
2. `design_platform_css_default` — all `--dsw-static-*` and `--dsw-alias-*` tokens, light on `body`
   and dark on `body[data-ds-dark-theme]`;
3. scrollbar tokens / styling;
4. shadow and elevation tokens.

It then appends a small host section (14px base type, `body` font/background, box-sizing) so the
plugin is judged against the same typography as DSH. `preview/theme.css` is generated — do not hand
edit it; it is rewritten on every screenshot run.

Defaults target this machine. Override when the install moves:

```bash
DSH_THEME_FILE=/path/to/dsh-client-ui-theme/lib/client.js node preview/extract-theme.mjs
```

`preview/index.html` also paints a restrained DSH app canvas behind the overlay (sidebar + session
list + conversation + composer) and a DSH settings shell for the section page, so the scrim,
backdrop blur, panel shadow and border have something realistic to sit on.

## Requirements / dependencies

Nothing is installed and no CDN is used.

- Node.js (the repo's test runtime works; ESM).
- Playwright with Chromium. The runner tries `require('playwright')` first, then the active Node's
  nvm global prefix and the usual `/usr/local` / `/opt/homebrew` locations. If your global prefix
  differs:

  ```bash
  NODE_PATH="$(npm root -g)" node preview/screenshot.mjs
  # or
  PLAYWRIGHT_MODULE=/path/to/playwright node preview/screenshot.mjs
  ```

- React 18.3.1 UMD, vendored in `preview/vendor/` (generated, not committed). If those files are
  missing, the runner copies them from a local install it can find (or from
  `REACT_DEVELOPMENT_FILE` / `REACT_DOM_DEVELOPMENT_FILE`).

## Determinism

- One Chromium instance, one fresh context per theme, one page per shot.
- `deviceScaleFactor: 2` (the manifest reports the resulting pixel dimensions).
- `?motion=off` disables transitions/animations; screenshots also pass Playwright's
  `animations: 'disabled'` and hide the caret.
- Readiness is explicit: the mount shim sets `html[data-preview-ready="1"]` only after the surface
  has rendered, fonts are ready, and (for search states) the mocked request has settled. It sets
  `html[data-preview-error]` otherwise, which the runner reports and fails on.
- The runner records the `client.js` digest before and after the run; if the file changed while the
  shots were being taken it warns, because the set is not coherent.

## Limitations

- This is a visual imitation of the DSH host, not the host. Sidebar previews, shortcuts UI, toasts,
  modals, focus management and the real settings navigation are not reproduced.
- The name/content fixtures are chosen to stress long paths, mixed extensions, line numbers and
  scrolling. They are not a correctness test; run `npm test` and verify inside DSH for that.
- The plugin's runtime API calls are mocked, so a Host/Client contract drift can pass here.
- Only the guarded primitives fallback path can be previewed.

## Files

```
preview/
  index.html        host page, app/settings imitation, script order
  mount.js          fake ctx, mocked fetch, URL-state orchestration
  loader-shim.js    window.__ModuleLoader__ + require('react' / 'react-dom' / 'react/jsx-runtime')
  harness.css       preview-only host chrome (never loaded by the plugin in DSH)
  extract-theme.mjs real DSH token extractor → theme.css
  theme.css         generated DSH tokens + host typography
  screenshot.mjs     server + Playwright runner, validation, manifest, table
  find-check.mjs     editor line-gutter + in-file find checks (`npm run check:find`)
  viewer-check.mjs   image/video/audio/PDF/HTML/Markdown viewer checks (`npm run check:viewer`)
  intel-check.mjs    ⌘ hover / same-file jump / back checks (`npm run check:intel`)
  browse-check.mjs   directory browsing + Open-mode surface checks (`npm run check:browse`)
  token-check.mjs    syntax colour / window / IME / large-file checks (`npm run check:tokens`)
  bot-check.mjs      DS Bot bridge checks (`npm run check:bot`)
  vendor/           React 18.3.1 UMD builds
  shots/            generated screenshots + manifest.json
```
