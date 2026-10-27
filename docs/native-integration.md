# Reusing DSH's native file surfaces from `dsh-file-finder`

Status: research reference for the plugin rewrite; the recommendations in §8 and
Appendix B are implemented in `client.js` v0.2.0.
Scope: how this plugin can open search results in DSH's own right-sidebar document
preview (`ctx.sidebarRight.openResource`), get the current session id, resolve
optional services, use the baseline UI primitives, and reload client code — while
keeping its own host-side search.
Audience: whoever edits `client.js` / `index.js`. Nothing here changes the host
protocol: the custom `/dsh-file-finder/*` routes and the `file_finder` agent tool
stay as they are.

---

## 0. Which DSH actually runs (read this first)

There are two DSH installations on this machine and they are **different versions**:

| Install | Version | Evidence |
|---|---|---|
| Desktop app runtime (`/Applications/DeepSeek Harness.app`) | **0.2.1-rc.2** | `app.asar:/dsh/desktop-runtime.json` → `release.version`; all `@deepseek-ai/dsh-*` packages in the archive are `0.2.1-rc.2` |
| nvm global CLI (`$NVM_NODE/lib/node_modules/@deepseek-ai/dsh`) | **0.1.6-alpha.2** | `node -e "console.log(require('…/dsh/package.json').version)"` |

The running GUI is the desktop app (`http://127.0.0.1:59279`), so **0.2.1-rc.2
behavior is authoritative**. Verified on this machine:

```bash
$ lsof -nP -iTCP:59279 -sTCP:LISTEN
DeepSeek  97156  <user>  24u  IPv4  …  TCP 127.0.0.1:59279 (LISTEN)
$ ps -o command= -p 97156
/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness --expose-internals \
  /Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/index.js \
  /Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh \
  $HOME/.dsh/profiles/desktop
```

That process line names both the asar runtime root and the desktop profile, so the
packaged 0.2.1-rc.2 code and the linked local plugin are what the GUI is using.
The 0.1.6 tree is still useful because it ships the `.d.ts` contracts that the
packaged runtime strips; every contract cited from it was re-verified against the
0.2.1 bundle. Where behavior differs, the 0.2.1 citation is given first.

Citation shorthand used below. `NVM_NODE` resolves the active Node's nvm prefix; set
`NVM_NODE` or `DSH_CLI_ROOT` when your install lives elsewhere.

```bash
# 0.1.6 type contracts (on disk)
NVM_NODE=${NVM_NODE:-$(dirname "$(dirname "$(command -v node)")")}
B=${DSH_CLI_ROOT:-$NVM_NODE/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai}
# 0.2.1 runtime (inside the asar; paths are logical archive paths)
A="/Applications/DeepSeek Harness.app/Contents/Resources/app.asar"
# e.g. app.asar:/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js:2119
```

Appendix A has a short Python reader for `$A` so every `app.asar:` line number
below is reproducible without installing `asar`.

> Practical consequence: do not copy `.d.ts` bodies from `$B` into the plugin and
> assume the packaged app matches. The two surfaces used here
> (`openResource` + `params: { line }`, and `sessions.list`) are behaviorally
> equivalent in both versions; keep it that way when upgrading.

---

## 1. Opening a file in the native preview

### 1.1 Address grammar (verified)

`app.asar:/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar-documentpreview/lib/client.js:35`
(`FILE_ADDRESS_PREFIX = "dsh-resource://file/"`) and `:64` (`parseFileAddress`).

Two scopes exist:

```
dsh-resource://file/session/<sessionId>/<path>     ← the only previewable scope
dsh-resource://file/absolute/<path>                ← parseable, but no tab type claims it
```

`parseFileAddress` rules (`:64-100`):

- Everything after the first `?` or `#` is discarded, so **those characters must
  be percent-encoded inside the path**.
- `session` requires a non-empty session id and at least one path segment.
- Every id/segment is `decodeURIComponent`-ed; a malformed `%` sequence makes the
  whole parse return `undefined`.
- The path is not resolved: `.`/`..` survive.
- Absolute POSIX paths round-trip as a double slash: `session/<id>//Library/...`
  parses back to `/Library/...`.

The builder in `sidebar-files` is the reference implementation
(`app.asar:/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar-files/lib/client.js:378`
`sessionFileAddress`, `:410` `fileAddressFor`; identical logic in 0.1.6 at
`$B/dsh-client-ui-sidebar-files/lib/client.js:152` and `:205`):

```js
function encodeSegment(segment) {
  return encodeURIComponent(segment).replace(/%3A/gi, ':')   // keep "C:" literal
}
function encodePath(path) {
  return path.split('/').map(encodeSegment).join('/')
}
// absolute path inside cwd → workspace-relative; outside cwd → absolute, still session scope
function sessionFileAddress(sessionId, path) {
  const normalized = path.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')
  return `dsh-resource://file/session/${encodeSegment(sessionId)}/${encodePath(normalized)}`
}
function fileAddressFor(sessionId, cwd, path) {
  const normalized = path.replace(/\\/g, '/')
  const root = (cwd || '').replace(/\\/g, '/').replace(/\/+$/, '')
  if (root && normalized === root) return sessionFileAddress(sessionId, '')
  if (root && normalized.startsWith(`${root}/`)) return sessionFileAddress(sessionId, normalized.slice(root.length + 1))
  return sessionFileAddress(sessionId, normalized)
}
```

Examples (session `sess_abc`, cwd `/Library/aiProject/dsh-file-finder`):

| Input path | Address |
|---|---|
| `/Library/aiProject/dsh-file-finder/client.js` | `dsh-resource://file/session/sess_abc/client.js` |
| `/Library/aiProject/other/x.js` | `dsh-resource://file/session/sess_abc//Library/aiProject/other/x.js` |
| `src/a b#c.ts` | `dsh-resource://file/session/sess_abc/src/a%20b%23c.ts` |

**Never build an `absolute` address.** The shipped `text` type vetoes it:
`canOpen: (address) => parseFileAddress(address)?.scope === "session"`
(`app.asar:…/sidebar-documentpreview/lib/client.js:1085`; 0.1.6
`$B/…/lib/client.js:1050`). No other shipped type claims `dsh-resource://file/**`
(the only other file-ish claim in the runtime is `dsh-resource://changes-review/**`
in `ui-deliverables`), so an `absolute` address throws instead of opening.

### 1.2 Calling `openResource`

Contract: `$B/dsh-client-ui-sidebar-right/lib/types/client/service.d.ts:95`

```ts
openResource(address: string, options?: SidebarRightOpenResourceOptions): void
```

Options that matter here (`service.d.ts:54-73`):

- `params?: SidebarRightResourceParams` — "delivered as `navigation.params`".
  The `file` provider contributes `{ line?: number }`
  (`$B/dsh-client-ui-sidebar-right/lib/types/client/contract/params.d.ts:6`).
  Values are **not validated at runtime** (`params.d.ts:9`), so keep the shape clean.
- `revealIfOpened?: boolean` — resource tabs "reveal an existing (kind, contentId)
  by default; `false` permits duplicates" (`service.d.ts:62-65`).
- `kind?: string` — force a tab type. **Do not pass it**: without `kind` the
  registry ranks claims (extension > builtin > fallback,
  `$B/dsh-client-ui-sidebar-right/lib/types/client/tab-registry.d.ts:31-43`,
  `:204`), so a future high-priority file viewer can win. The shipped text
  viewer is `fallback` (`app.asar:…/sidebar-documentpreview/lib/client.js:1084`).

Fully self-contained snippet (works in the plugin's plain-JS factory; no React
required beyond the component that renders results):

```js
function sidebarRightOf(ctx) {
  try {
    const service = typeof ctx.get === 'function' ? ctx.get('sidebarRight') : ctx.sidebarRight
    return service && typeof service.openResource === 'function' ? service : undefined
  } catch {
    return undefined
  }
}

/**
 * Open `path` in DSH's right-sidebar preview.
 * @returns {boolean} true when the intent was accepted; false when the caller
 *   should fall back (no service, no on-screen session, no claiming type).
 */
function openNativePreview(ctx, target, line) {
  const service = sidebarRightOf(ctx)
  if (!service) return false
  if (!target || typeof target.sessionId !== 'string' || !target.sessionId) return false
  let address
  try {
    address = fileAddressFor(target.sessionId, target.cwd, target.path)
  } catch {
    return false
  }
  const options = Number.isInteger(line) && line >= 1 ? { params: { line } } : undefined
  try {
    service.openResource(address, options)
    return true
  } catch (error) {
    // Wiring errors are the documented behavior for "no claim"/"no surface".
    console.warn('dsh-file-finder: native preview unavailable', error)
    return false
  }
}
```

`openResource` is **synchronous**; there is no promise to await and no
"opened" event. A resolved read failure is not an exception: the preview tab
opens and shows a failure line (`failureLine` maps
`workspace-file/not-found | too-large | not-text | not-regular-file`; see
`app.asar:…/sidebar-documentpreview/lib/client.js` region
`function failureLine(t, failure)`). So "returned true" means "tab accepted",
not "file readable".

### 1.3 What throws (and why nothing half-opens)

`app.asar:/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js`:

| Condition | Code | Message |
|---|---|---|
| no conversation on screen, a global panel is active, or the rightbar store is not adopted yet | `:2479 require()` → `:2482` | `sidebarRight: no session surface is mounted` |
| address does not start with `dsh-resource://` | `:2178 placeResource` → `:2179` | `sidebarRight: no registered tab type claims "<address>"` |
| scheme ok, but no registered type claims it (e.g. documentpreview disabled, or an `absolute` address) | `:4587 claim()` | `sidebarRight: no registered tab type claims "<address>"` |
| only if `kind` was forced and is missing / refuses | `:4587 claim()` | `sidebarRight: no tab type is registered as "<kind>"` / `tab type "<kind>" refuses "<address>"` |

`openResource` runs `require()` first (`:2119-2121`), then claims the address,
then commits the store intent — a throw leaves no tab, no navigation record and
no expansion. Safe to catch and fall back.

"When is there no on-screen session?" `require()` reads the controller's
`mounted` snapshot (`:2479-2486`). That snapshot is maintained by
`app.asar:…/sidebar-right/lib/client.js:4836`:

```js
const selected = views.source.getSnapshot().find((view) => view.selected)
show(layout.panelInfo.getSnapshot().activePanelId === null ? selected?.sessionId : void 0)
```

So it is `undefined` when no conversation is selected **and also while any global
panel (Settings, Plugin manager, …) is open**. That is a real case for a global
hotkey overlay; treat it as a normal fallback path, not an error.

### 1.4 Line jumps

The opener passes `params.line`; the body reads it at
`app.asar:…/sidebar-documentpreview/lib/client.js:644`:

```js
const line = navigation.params !== void 0 && "line" in navigation.params ? navigation.params.line : void 0
```

`line` is **1-based** (the host emits `line: index + 1` for content hits; see
`index.js:66`). The scroll/highlight effect is `:680-700`: it waits for paged
content (`if (line > loadedThrough && !current.eof) loadPage(...)`), then
`scrollToLine` (`:480`) scrolls the plain-text row or the highlighted code row,
and `:540-542` paints `data-textpreview-target` + the `lineTarget` highlight.

Caveats:

- `line` only acts for the `text-pages` renderer (`:686` — `mode !== "text-pages"`
  marks the navigation handled and returns). Images/PDF/Office ignore it; harmless.
- Re-opening the **same address** with a new line increments the navigation
  revision (`app.asar:…/sidebar-right/lib/client.js:1839` `navigate`), so the
  body scrolls again rather than being a no-op.
- A huge file is paged toward the target line, one page at a time; the read cap
  can still produce the `too-large` failure line instead of a jump.

### 1.5 Duplicate tabs / reveal

Default resources **reveal**, they do not duplicate:
`app.asar:…/sidebar-right/lib/client.js:2218`

```js
const revealed = layout === void 0 ? void 0
  : … placement.revealIfOpened === false ? void 0
  : findContentTab(layout, claim.contentId, claim.kind)
```

`claim.contentId` is the address itself
(`$B/…/tab-registry.d.ts:117-129`), so two files with the same basename in
different directories are two tabs. Passing `{ revealIfOpened: false }` would
allow duplicates — don't; reveal is what users expect from "open result".

### 1.6 The column expands

`app.asar:…/sidebar-right/lib/client.js:1000-1003` (`openContent`) begins with
`planSetExpanded(state, true)`, and the seat reports that through
`syncPresentation` → `layout.openRightbar(...)` (`:4887-4888`). So a collapsed
right column opens by itself; the caller does not toggle it first.

Read-only warning: the workspace-files service behind the preview exposes **no
mutations** (`app.asar:/dsh/node_modules/@deepseek-ai/dsh-api-workspace-files/lib/index.js:163`,
"read-only file previews … this service exposes no mutations"). The plugin's
editor + `/dsh-file-finder/write` route remain the only write path.

---

## 2. Getting the current session id on the client

### 2.1 There is no supported `current` field

`SessionListState` in this runtime is
`{ ids, byId, phase, subagentsByParent, jobsBySession }`
(type: `$B/dsh-api-session-controller/lib/types/client/sessions/service.d.ts:42-62`;
public face `ISessions.list` at `:101` / `$B/.../contract/sessions.d.ts:45`).
There is **no** `current` on the installed types. Selection is expressed by the
local retention source:

- `SessionSummary.retainedBy` — `…/sessions/service.d.ts:29`;
- `SessionRetainInfo.retainedBy` — `…/contract/sessions.d.ts:36-41`.

DSH itself derives the main-view session from `retainedBy.mainView`:

- `app.asar:/dsh/node_modules/@deepseek-ai/dsh-client-ui-session/lib/client.js:917`
  (`publishMain`): current row if `retainInfo(id).retainedBy.mainView > 0`, else
  the first `byId` row with `retainedBy.mainView > 0`;
- `app.asar:/dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js:60`
  (`DocumentTitle`): `Object.values(state.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id`.

The second one is the cleanest citation for "the supported client-side
derivation": it is a shipped component reading the `useSessions` standard hook.

### 2.2 Primary helper (click-time, service based)

The plugin already has `serviceOf(ctx, name)`; its `sessionOf(ctx)` is the right
shape. Keep it (the row's `retainedBy` is the same data
`retainInfo(id).getSnapshot().retainedBy` exposes, so no extra call is needed):

```js
function serviceOf(ctx, name) {
  if (!ctx) return undefined
  try {
    if (typeof ctx.get === 'function') return ctx.get(name)
  } catch { /* optional service */ }
  return ctx[name]
}

/** The session the main view is showing, plus its workspace root. */
function sessionOf(ctx) {
  const sessions = serviceOf(ctx, 'sessions')
  const list = sessions && sessions.list && sessions.list.getSnapshot && sessions.list.getSnapshot()
  if (!list || !list.byId) return { id: '', cwd: '' }

  const byId = list.byId
  const ids = Array.isArray(list.ids) && list.ids.length ? list.ids : Object.keys(byId)
  for (const id of ids) {
    const row = byId[id]
    if (row && Number((row.retainedBy && row.retainedBy.mainView) || 0) > 0) {
      return { id: row.id || id, cwd: typeof row.cwd === 'string' ? row.cwd : '' }
    }
  }
  // Non-host rows (locally known generations) may be missing from ids.
  for (const key of Object.keys(byId)) {
    const row = byId[key]
    if (row && Number((row.retainedBy && row.retainedBy.mainView) || 0) > 0) {
      return { id: row.id || key, cwd: typeof row.cwd === 'string' ? row.cwd : '' }
    }
  }
  return { id: '', cwd: '' }
}
```

Why this is robust:

- `list` is a `SnapshotStore`/`ObservableSnapshot` — `getSnapshot()` is cheap and
  stable; `subscribe(fn)` exists if the UI needs to react.
- If more than one row ever reports `mainView > 0` (should not happen), the
  `ids` order matches DSH's own `.find()` behavior.
- `cwd` is only a hint for producing prettier addresses; the address is still
  correct with an absolute path when `cwd` is `''`.

### 2.3 Inside the overlay React tree: `useSessions` prop

`shell.overlay` is a **root-scope list** seat
(`$B/dsh-client-ui-layout/lib/types/client/index.d.ts:80-83`;
0.2.1 declaration `app.asar:…/dsh-client-ui-layout/lib/client.js:643`). Root-scope
slot props are `ScopeStandardProps<'root'> = object & GlobalStandardProps`
(`$B/dsh-client-ui-slots/lib/types/index.d.ts:217`; base interface at `:206-207`),
and the global standard props include `useSessions`
(merged in `$B/dsh-client-ui-session/lib/types/client/index.d.ts:71-76`).
`AppFrame` and `DocumentTitle` are proof that root occupants receive it.

So the palette can do this without touching a service:

```js
// module scope, not inside the component (stable selector)
function mainSessionIdOf(state) {
  if (!state || !state.byId) return ''
  const ids = Array.isArray(state.ids) && state.ids.length ? state.ids : Object.keys(state.byId)
  for (const id of ids) {
    const row = state.byId[id]
    if (row && Number((row.retainedBy && row.retainedBy.mainView) || 0) > 0) return row.id || id
  }
  return ''
}

// inside the overlay component:
//   const sessionId = props.useSessions ? props.useSessions(mainSessionIdOf) : ''
```

`useSessions` takes a selector; return a **primitive** (the id) to keep the
snapshot stable. Read `cwd` at click time from `sessionOf(ctx)` (2.2) rather than
selecting an object.

Recommendation: use `props.useSessions` for rendering/revalidation, and
`sessionOf(ctx)` in the click handler. They read the same store; the click-time
read also covers the case where the user switched conversations while the
palette was open.

### 2.4 Internal fallback (do not build on it)

`ui-sidebar-right` itself takes the main session from
`ctx.uiSession.adapter.current`:

`app.asar:…/sidebar-right/lib/client.js:4810-4813`

```js
const current = ctx.uiSession.adapter.current
const sync = () => { views.select(current.getSnapshot().key) }
const unsubscribe = current.subscribe(sync)
```

`getSnapshot().key` is the session id. This works today (`uiSession` is provided
by `dsh-client-ui-session`), but `adapter` is not part of the published
`ISessions`/type surface — it is an in-product seam. Use only as a last-resort
fallback if `sessions.list` is unavailable:

```js
function internalMainSessionId(ctx) {
  const uiSession = serviceOf(ctx, 'uiSession')
  const source = uiSession && uiSession.adapter && uiSession.adapter.current
  const snapshot = source && typeof source.getSnapshot === 'function' ? source.getSnapshot() : undefined
  return snapshot && typeof snapshot.key === 'string' ? snapshot.key : ''
}
```

Nothing in the runtime exposes a simpler public "active session" accessor; the
`retainedBy.mainView` scan **is** the supported derivation, and it is what the
shipped title and sidebar use.

---

## 3. Reaching `sidebarRight` from this Module Loader plugin

### 3.1 `ctx.get()` needs no `inject` declaration

The plugin's export currently declares
`inject: ['slots', 'locale']` (`client.js:728`). That list is about **load
ordering**, not about what the context can read later. Cordis's reflection layer
offers an undeclared, optional lookup:

`$B/cordis/lib/types/reflect.d.ts:10-16`

```ts
get<K extends string & keyof this>(name: K, strict?: boolean): undefined | this[K]
get(name: string, strict?: boolean): any
```

Returns `undefined` when the service is not (yet) provided. So
`ctx.get('sidebarRight')` is legal in a plugin that never injected
`sidebarRight`, and it is exactly how the working third-party reference plugin
resolves optional services:

- `~/.dsh/local-plugins/dsh-workbench/src/client/runtime.ts:513-533`
  captures `ctx.get('sessions')` at apply time and keeps `ctx` for click-time
  lookups;
- `…/src/client/runtime.ts:538` — `getPluginCtx()?.get('uiWorkspace')`;
- `…/src/client/session.ts:168` — `ctx.get('uiWorkspace')`.

That plugin's hard deps are `export const inject = ['slots', 'sessions']`
(`…/src/client/index.ts:56`); `uiWorkspace` is deliberately not injected because
it "may mount after this bundle's apply" (`index.ts:58-61`).

### 3.2 Do not hard-inject `sidebarRight`

`ctx.inject(['sidebarRight'], cb)` would defer the whole callback until
`@deepseek-ai/dsh-client-ui-sidebar-right` is mounted
(`$B/cordis/lib/types/registry.d.ts:101-111`: "the callback is unloaded and
re-run whenever a required service changes"). If a user disables that package,
the plugin would silently lose every surface that lives in that callback. Since
the preview is an optional enhancement, keep the package out of both:

- `inject` in the client module export: keep `['slots', 'locale']`;
- `package.json` `dsh.client.inject`: leave empty (it currently is);
- resolve `sidebarRight` **at click time** with `ctx.get` and feature-detect.

If you prefer the declarative form for a *sub-feature* (e.g. render a "preview"
hint only when the service exists), the soft form is:

```js
if (typeof ctx.inject === 'function') {
  ctx.inject(['sidebarRight'], (scoped) => {
    scoped.effect(() => { /* register a hint; skipped entirely when absent */ })
  })
}
```

But do not wrap the palette or the search logic in it.

### 3.3 Optional-safe access pattern

```js
function sidebarRightOf(ctx) {
  let service
  try {
    service = typeof ctx.get === 'function' ? ctx.get('sidebarRight') : ctx.sidebarRight
  } catch {
    return undefined
  }
  return service && typeof service.openResource === 'function' ? service : undefined
}
```

Use only the documented `ISidebarRight` subset
(`$B/…/sidebar-right/lib/types/client/service.d.ts:81-145`): `openResource`,
`openTab`, `close`, `active`, `isExpanded`, `toggleExpanded`, `focus`, `split`,
`float`, `dock`. The controller instance also has `openResourceIn`,
`openTabIn`, `tabsIn`, `tabDomain`, `openTabs` — internal seams used by tab
bodies; do not call them from a plugin (`:199-216` explicitly marks
`openResourceIn`/`openTabIn`/`closeIn` "Not part of `ISidebarRight`").

---

## 4. `@deepseek-ai/dsh-client-ui-primitives`

### 4.1 It is an implicit baseline external (verified in the running shell)

The shell builds the frozen module table in its platform bundle:

`app.asar:/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-CN7NIWNw.js:190`
(search for `function SZ()`):

```js
function SZ(){return{
  react, "react/jsx-runtime", "react-dom", "react-dom/client",
  "@deepseek-ai/cordis", zod, "@tanstack/react-virtual",
  "@deepseek-ai/dsh-client-store",
  "@deepseek-ai/dsh-client-ui-slots",
  "@deepseek-ai/dsh-client-ui-primitives": zU,
  "@deepseek-ai/dsh-client-ui-dockkit": xZ
}}
```

`zU` is the frozen primitives namespace; it contains `FileTypeIcon: VA`
(line 134 has `function VA(e){const{size:t=28,className:r}=e,…`).

The loader's `require` checks this seed **before** anything else:
`app.asar:/dsh/node_modules/@deepseek-ai/dsh-client-modules/lib/client.js:836-841`

```js
const require = (spec) => {
  edges.add(spec)
  if (this.seed.has(spec)) return this.seed.get(spec)
  ...
  throw new Error(`client-modules: require("${spec}") missed the module table …`)
}
```

Docs agree: `$B/dsh-client-ui-workspace/README.md` (the packaged copy in
`app.asar:/dsh/node_modules/@deepseek-ai/dsh-client-ui-workspace/README.md`,
section **"Dynamic client package"**) states verbatim:

> "A Module Loader package (`factory(require)`, as in the real Loader/Web
> fixture) gets `@deepseek-ai/dsh-client-ui-primitives` as an implicit baseline
> external: resolve `MenuItemButton` through the loader's `require`, do not list
> the primitive as a runtime dependency or bundle another copy…"

### 4.2 `package.json` changes: none

- Do **not** add `dsh.client.external` for primitives. `external` is for
  non-baseline module requests; a specifier naming a static-table key is allowed
  but "adds no graph edge"
  (`app.asar:…/dsh-client-modules/lib/index.js:414-433`).
- Do **not** add it to `dependencies` (that would invite a second copy).
- No `dsh.client.inject` entry is needed: the primitives are not a package row.
- A `devDependency` on primitives is fine only if a build step needs the types;
  this repo has no build step and no TS, so nothing to add.

The current declaration is already correct:
`package.json` → `"dsh": { "client": { "platform": "web" } }` (no `external`, no
`inject`), and `exports["./client"] = "./client.js"`.

### 4.3 `FileTypeIcon` shape

Type contract: `$B/dsh-client-ui-primitives/lib/types/FileTypeIcon.d.ts:10-19`

```ts
type FileTypeIconProps = IconProps & (
  { readonly path: string; readonly context?: FileTypeProjectContext }
  | { readonly kind: FileTypeKind }
)
type FileType = CodeFileType | 'code' | 'excel' | 'folder' | 'html' | 'image'
               | 'markdown' | 'other' | 'pdf' | 'ppt' | 'video' | 'word'
```

`IconProps` is `{ size?: number; className?: string }`
(`$B/…/lib/types/icons/props.d.ts:2-8`). In the running 0.2.1 shell the default
size is **28** and classification happens when `path` is present
(`app.asar:…/assets/index-CN7NIWNw.js:134`):

```js
function VA(e){const{size:t=28,className:r}=e,i="path"in e?classify(e.path,e.context):e.kind; …}
```

Usage inside the plugin factory (require it once, at factory scope):

```js
// top of factory(require)
const React = require('react')
const { FileTypeIcon } = require('@deepseek-ai/dsh-client-ui-primitives')
const h = React.createElement

// in the result row renderer
h(FileTypeIcon, { path: item.path, size: 14, className: 'dff-file-icon' })
```

The icon is decorative ("the caller owns the accessible name",
`FileTypeIcon.d.ts:36-41`), so put the file name in visible text / `title`.

---

## 5. Hot reload: does editing `client.js` update the running desktop app?

Short answer: **yes, in place, with no page reload and no build step** — this
plugin's `client.js` is already the served artifact. Mechanism verified from the
running runtime; the final UI swap was not observed end-to-end because the GUI
requires auth (see "Confidence" below).

### 5.1 The chain

1. The Host serves each plugin's `client.js` from its real path. For a linked
   package, `exports["./client"]` resolves to
   `/Library/aiProject/dsh-file-finder/client.js`; the Host snapshots stats and
   bytes at activation
   (`app.asar:…/dsh-client-modules/lib/index.js:814-838`
   `captureArtifactBaseline` / `initialBundleSnapshot`).
2. `dsh-client-hmr` stat-polls every graph row's bundle every `pollIntervalMs`
   (default **500 ms**) and compares `mtimeMs`, `ctimeMs`, `size`
   (`app.asar:…/dsh-client-hmr/lib/index.js:22`, `:37-38`, `:79-89`).
3. On a difference it calls `ctx.clientModules.rebuilt(id)`
   (`:46-59`). `rebuilt` captures a fresh stat baseline and derives the revision
   from **mtime + ctime + size** (`app.asar:…/dsh-client-modules/lib/index.js:194-197`
   `artifactRevision`); only when that revision changed does it re-read the file
   bytes and publish the new graph row (`:625-640` `rebuilt`). "Bundle content
   changes reach the graph only through `rebuilt()`"
   (`…/dsh-client-modules/lib/index.js:619-624`).
4. `rebuilt` notifies listeners; the HMR SSE endpoint `/plugins/events` pushes a
   `rebuilt` frame (`…/dsh-client-hmr/lib/index.js:145-160`).
5. The browser half invalidates the old module, prefetches the new
   single-resource script, drains the old fiber, and remounts the plugin with
   **fresh React state**; dependants reload automatically
   (`$B/dsh-client-hmr/README.md:30-36`, `:64-70`, `:114-118`; `README.md:48`:
   "The edited UI shows immediately with no page reload… React state inside the
   reloaded plugin is lost, while session, workspace, and connection state
   survives").

It is active in this desktop build: the Web bundle mounts the row unconditionally —
`app.asar:/dsh/node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml:214-218`
("The client-plugin reload chain, always mounted: it is idle until a rebuild
watcher (`pnpm run dev:web`) actually rewrites client bundles."), and the
desktop profile includes that bundle (`~/.dsh/profiles/desktop/package.json`
→ `dsh.profile.bundles` includes `@deepseek-ai/dsh-web-app`).
The HMR browser half is `immediately: true`
(`app.asar:…/dsh-client-hmr/package.json` → `dsh.client.immediately`).

The comment's "idle until a rebuild watcher rewrites" describes the *build*
watcher; HMR's own stat poll does not know about build stamps — it reacts to any
mtime/ctime/size change, including a hand edit. That is why a plain-JS plugin
works without a build.

### 5.2 Refresh ladder (what the user should do)

| Change | What to do |
|---|---|
| `client.js` (UI, preview call, settings page) | Save the file. Within ~1 s the plugin swaps; the palette may close because its React state is gone — press ⌘/Ctrl+P again. No page reload. |
| …if the swap does not happen | Settings → Plugins → Plugin list: check for a page-local sync error and use **Retry**. Then toggle `dsh-file-finder` **off → on**; that removes and re-adds the Loader row and the Host re-reads `client.js` (`initialBundleSnapshot` runs on entry add). If the row is not toggleable, restart the app. |
| `index.js` (host routes, tool, search) | Never HMR'd (only client bundles are watched). Toggle the plugin off/on (restarts the host fiber) or restart the desktop app. |
| `package.json` (dsh.client, exports, deps) | Restart the app: package metadata is cached per Loader specifier "until restart" (`$B/dsh-client-modules/README.md:72`). |
| A page reload (⌘R) alone | Re-fetches the bundle the Host already holds; it does **not** re-read `client.js` from disk if HMR missed the change. Useful only after the Host already advanced the revision. |
| Changing files inside `app.asar` | Not supported: signed, read-only archive. Never edit it. |

"Do not run a build" is the safe answer for this repo: `package.json` has no
`build` script, `files` ships `client.js` directly, and no bundler config exists.
If a build is ever added, the supported reload command is a watch process using
the shared Client tsdown preset — the shipped docs name `pnpm run dev:web`
(`$B/dsh-client-hmr/README.md:32`) — but that applies to DSH's own workspace, not
to this linked package.

### 5.3 Confidence

- **Verified from code/config**: the poll, `rebuilt`, revision derivation, SSE
  frames, swap semantics, and the fact that `client-hmr` is mounted in this
  desktop build.
- **Not directly observed**: the visual swap in the running page. The GUI at
  `http://127.0.0.1:59279` requires authentication and this research did not
  attempt to bypass it. Treat the ladder above as the operational procedure and
  confirm once with a trivial edit while the palette is open.

There is **no supported command or service method** for "rebuild this client
module" from a plugin. `ctx.clientModules.rebuilt(id)` is Host-side and is
documented as the HMR watch's registration hook, not an API
(`…/dsh-client-modules/lib/index.js:619-624`). Toggling the plugin is the safe
manual equivalent.

---

## 6. Caveats and limits

1. **Preview is read-only.** `workspaceFiles` exposes no mutations
   (`app.asar:…/dsh-api-workspace-files/lib/index.js:163`); the preview has no
   editor. Keep the plugin editor for writes and keep its version check.
2. **Files outside the workspace.** Reads and stats follow the composed
   filesystem and explicitly allow paths outside the workspace
   (`…/dsh-api-workspace-files/lib/index.js:421` on `read`, `:480` on `stat`);
   directory listings and change observations are workspace-confined (`:495`
   `list`, `:524` `changes`, `:69`/`:581` `outside-workspace`). So a result from
   another root still previews through a **session-scope** address — but it will
   not appear in the Files tree.
3. **No session, or a global panel is open.** `openResource` throws
   `no session surface is mounted` (`…/sidebar-right/lib/client.js:2479-2486`).
   This includes the Settings / Plugin-manager screens
   (`…/sidebar-right/lib/client.js:4836`).
4. **documentpreview disabled, or an `absolute` address.** No type claims it →
   `no registered tab type claims "<address>"` (`:2179`, `:4587`). Fall back.
5. **The opener targets the on-screen session, the reader targets the address's
   session.** The tab is created in the mounted session's layout, but the body
   reads through `hostFileOf(tab.contentId)` — the session id *inside the
   address* (`app.asar:…/sidebar-documentpreview/lib/client.js:228`, `:600`).
   They normally match; if the user changed conversations with the palette open,
   they may not. Recompute `sessionId` at click time.
6. **Line 1 / non-text / big files.** `params.line` only highlights/scrolls for the
   `text-pages` renderer (`:644`, `:686`); images/PDF/Office ignore it.
   Over-large files open a tab that reports `too-large` inside the preview
   (`failureLine`), not a thrown error — the palette must not assume success
   means content is visible.
7. **Duplicate result rows.** Repeated Enter on the same address reveals the tab
   and increments the navigation revision (scrolls again). It does not create a
   second tab (`…/sidebar-right/lib/client.js:1839`, `:2218`).
8. **Right column collapsed.** No action needed: `openContent` expands it in the
   same intent (`…/sidebar-right/lib/client.js:1000-1003`).
9. **Palette lifetime.** The preview is outside the overlay; close the palette on
   success, and keep it open on failure so the fallback editor can render.
10. **Unsaved editor → preview.** If "preview current file" is offered from the
    editor, route it through the existing dirty-confirm flow; do not discard
    `draft` silently.

---

## 7. Integration matrix: keep vs delegate

| Capability | Owner | Why |
|---|---|---|
| File-name / content search | **Plugin** (Host half, `ctx.fs`) | No reusable search exists — see 7.1. DSH's only file APIs are `workspaceFiles` `read/stat/list/changes` and the host-only `ctx.fs`. |
| Search palette, modes, ranking, ignore rules, limits | **Plugin** | No DSH file-search palette or slot was found; `ui-sidebar-files` is a directory tree only (it renders a tree from `workspaceFiles.list`, no filter/search). |
| Result → open / preview | **Delegate** (`ctx.sidebarRight.openResource`) | Native tab, correct renderer per suffix, line highlight, reload, scroll retention, copy, floating/docked panes. |
| Line jump | **Delegate** (`params: { line }`) | Native paging + `scrollToLine`; re-implementing it in the overlay duplicates work. |
| File-type glyph | **Delegate** (`FileTypeIcon` from primitives) | Baseline external, same colors/shape as Files tree and preview chips. |
| Editing / saving | **Plugin** | Preview is read-only; the plugin's `/write` route already does version-checked writes (`FS_STALE_VERSION`). |
| Shortcuts | **Plugin** (`ctx.shortcuts` + keydown) | Already registered; DSH shortcut settings can rebind them. |
| Preferences / settings page | **Plugin** (`settings.section`) | Search tuning is plugin-specific. `openMode` (preview vs editor) is a plugin preference, not a DSH one. |
| Workspace root discovery | **Plugin** (Host `roots` action) | The client has a workspace registry, but search still has to be authorized on the Host; the existing route returns `{path,title,source}` and is already wired to the picker. |
| Diagnostics / errors | **Plugin** | Preview failures surface inside the tab; the plugin only needs the open/fallback signal. |

### 7.1 Why the host search must stay (verified)

There is no client-callable file search service anywhere in this runtime:

- **Runtime service inventory** (all `Cordis.Service` names found in every
  `lib/index.js` / `lib/client.js` of `app.asar:/dsh/node_modules/@deepseek-ai`):
  `fs`, `workspaceFiles`, `workspaceRegistry`, `workspaces`,
  `workspaceController`, `sessionQuery`, `tools`, `resources`, `remote`, … —
  **no** `search`, `fileSearch`, `grep`, `glob`, or `workspaceSearch` service.
- `workspaceFiles` (the browser's `remote.workspaceFiles`) has exactly five
  methods: `read`, `readBytes`, `stat`, `list`, `changes` — described as
  "read-only file previews, workspace directory listings, and the filesystem
  observation change feed" (`app.asar:…/dsh-api-workspace-files/lib/index.js:163-172`;
  methods at `:426` `read`, `:447` `readBytes`, `:484` `stat`, `:495` `list`, `:524` `changes`). It is a provider for the `file`
  resource protocol, not a query API.
- `ctx.fs` (`dsh-fs`) is a **Host** service (`app.asar:…/dsh-fs/lib/index.js:60`;
  no `./client` export in its `package.json`) and cannot be reached from a
  Module Loader bundle.
- `dsh-tool-fs-search` (the `glob`/`grep` implementation) is **model-facing
  tools**, not a service: its `package.json` description is "Model-facing
  filesystem discovery tools (glob, grep)"; its module only calls
  `ctx.tools.register(tool)` (`app.asar:…/dsh-tool-fs-search/lib/index.js:847`)
  with `inject = ['tools','systemPrompt','subprocess','workingDirectory']`
  (`:1212`), and it provides no service. Its `package.json` has no `./client`
  export.
- `ui-sidebar-files` renders a lazy directory tree and opens files; it exposes no
  filter/search command (`app.asar:…/dsh-client-ui-sidebar-files/lib/client.js`,
  `FilesBody` region around `function FilesBody(...)`).

Could the browser use `ctx.remote.workspaceFiles.read` instead of the plugin's
`/read` route for the fallback editor? Yes — the document preview does exactly
that (`app.asar:…/sidebar-documentpreview/lib/client.js:242-244`). It is not
required, and it does not change the conclusion: **reads can be delegated, search
cannot**.

---

## 8. Recommended click behavior

Enter on a result:

1. If `openMode` is `preview` (default): call `openNativePreview` with the
   result's session, cwd, path and 1-based line.
2. On `true`: close the palette (the search state is already persisted in the
   overlay store; reopening is cheap).
3. On `false`: keep the palette open, show the localized "preview unavailable"
   notice, and open the built-in editor for the same result.
4. If `openMode` is `editor`: invert — Enter opens the editor; the secondary
   chord tries the preview first.

Secondary chord: `⌘/Ctrl+Enter` opens the other surface. Current
`onSearchKey` already implements exactly this split; the only additions are the
notice/fallback ordering and a click-time session read.

Recommended handler shape (self-contained; matches the current palette):

```js
function openResult(ctx, item, session, preferPreview) {
  const tryPreview = () => {
    const current = session && session.id ? session : sessionOf(ctx)
    if (!current.id) return false
    return openNativePreview(ctx, { sessionId: current.id, cwd: current.cwd, path: item.path }, item.line)
  }
  if (preferPreview && tryPreview()) return 'preview'
  return 'editor'
}
```

Wiring in the component:

```js
function onSearchKey(event) {
  // … ArrowUp/Down handled above
  if (event.key === 'Enter' && flat[selected]) {
    event.preventDefault()
    const item = flat[selected]
    const session = sessionOf(ctx)                       // click-time, not memoized
    const secondary = event.metaKey || event.ctrlKey
    const wantPreview = (prefsState.openMode === 'preview') !== secondary

    if (wantPreview && openNativePreview(ctx, {
      sessionId: session.id, cwd: session.cwd, path: item.path,
    }, item.line)) {
      store.close()
      return
    }
    if (wantPreview) setNotice(t('previewUnavailable'))  // fall through to editor
    void openEditor(item)
  }
}
```

Fallback rules:

- `sidebarRight` missing or `openResource` not a function → editor, no noise
  (older host / disabled sidebar package).
- No session id → editor (the host `/read` route only needs `root`, so the
  fallback still works when no conversation is selected but a root is chosen).
- `openResource` throw → editor + `previewUnavailable` notice; log the error at
  `console.warn` for diagnostics.
- Preview opened but content fails (deleted/binary/too large) → the native tab
  already renders the DSH failure line; nothing for the plugin to do.
- From the editor's "preview" action with `dirty === true` → run the existing
  discard/keep confirmation first.

Optional polish (not required for the integration): style result rows with
`FileTypeIcon` (4.3) and keep the existing relative-directory subtitle.

---

## 9. Handing a file to the desktop's default application

DSH ships the platform half of "open with the system app": the host's
`sessionController.openWorkspacePath({ path })` (Remote name
`session/openWorkspacePath`) runs `@deepseek-ai/dsh-native-command`'s
`openNativePath`. Verified against the packages on disk:

- macOS runs `open <path>`; `.html`, `.htm`, `.xhtml` and `.svg` are handed to
  the **default browser** explicitly (LaunchServices' `https` handler) instead
  of the file association. Linux runs `xdg-open` (or `$BROWSER` for those four
  extensions), Windows `Invoke-Item`, WSL translates the path first. The button
  therefore names the browser ("用浏览器打开") only on macOS, where DSH really
  forces one, and says "用默认应用打开" elsewhere, where the OS association
  decides.
- Nothing goes through a shell, and `canOpenNativePath()` answers false on a
  headless Linux host — which is what makes hiding the control the right failure
  mode rather than a broken click. `sessionController.canOpenWorkspacePath()`
  adds the deployment override (`nativeOpen`).

The plugin owns only three things, all in `index.js`:

1. `resolveInside` — the same workspace containment every other action uses;
2. `DESKTOP_OPENER_BLOCKED_EXT` — `open` **executes** files with a script, app
   bundle or installer extension (`.command`, `.app`, `.sh`, `.exe`, `.pkg`, …),
   so those extensions are refused by name before anything is spawned. The
   refusal is filename-based: an executable with another suffix is not detected,
   which is why the route re-checks instead of trusting the panel;
3. the capability read — `roots` answers `canOpen` (this host reaches a desktop),
   `blockedExtensions` (the refusal list above) and `browserExtensions` (the
   extensions DSH forces into the default browser, which is only macOS), and the
   panel applies all three, so none of the rules is copied into `client.js`.

`/dsh-file-finder/open` is the one action marked `agent: false` in `ACTIONS`
(the tool enum is built from `AGENT_ACTIONS`): an agent must not launch a GUI
application on the user's machine.

Verified DSH sources (nvm global 0.1.6-alpha.2, same surface as the packaged
0.2.1-rc.2 the GUI runs):

- `@deepseek-ai/dsh-native-command/lib/types/path-opener.js` —
  `BROWSER_DOCUMENTS`, `openNativePathWithIntent`, `canOpenNativePath`
- `@deepseek-ai/dsh-api-session-controller/lib/types/index.js` —
  `openWorkspacePath`, `canOpenWorkspacePath`
- `@deepseek-ai/dsh-api-session-controller/lib/typert.remote-client.d.ts` —
  the wire name `session/openWorkspacePath`
- `@deepseek-ai/dsh-client-ui-deliverables/lib/client.js` — the toolbar button
  `diff.openNative` ("用默认应用打开"), whose copy and retry-on-the-button
  behaviour this plugin follows

Known boundary: availability is DSH's answer, not a reachability probe. A macOS
host reached over SSH reports available while the window would open on the
remote machine; the plugin documents that instead of inventing its own
detection. Opening an HTML file opens the one on disk (`file://`), so a page
that needs a local dev server renders empty — that is the page's dependency, not
the opener's.

## 10. Session status, navigation and the sidebar foot (session board)

The session board (0.13.0) is a pure client view over facts DSH already keeps.
It reads four surfaces, all of them declared in package types:

| Read | Shape | Used for |
| --- | --- | --- |
| `ctx.sessions.list` | `ObservableSnapshot<SessionListState>` (`ids`, `byId`) | titles (`displayTitle`), workspace (`cwd`), recency, `blank`, `origin: 'subagent'` |
| `ctx.uiSession.sessionStatus` | `HostObservable<Map<SessionId, SessionStatus>>` | `running`, `pendingInteraction` (kinds `approval`, `question`, `plan-review`), `completionUnread` |
| `ctx.workspaces.list` | snapshot with `items` (`title`, `sessionIds`) and `archivedSessionIds` | workspace titles in rows and search, and dropping archived sessions from the counts |
| `ctx.uiWorkspace.openSession(id)` | navigation | opening a row |

Two slots carry the UI: `sidebar.footer.action` (a `list` slot whose owner share
is `{ wide }`, so the counts know about the 56px rail) and `shell.overlay` (a
`list`, click-through layer — the board opts back into pointer events).

**State priority.** One state per session, in this order: awaiting the user →
running → finished → idle. That is DSH's own precedence in `ui-workspace`
(`sessionStatuses()`), so the counts cannot disagree with the dots in the
session list.

**Subagent rollup.** Subagent sessions carry `origin: 'subagent'` and a
`parentId`; they never become rows. Their `running`/`pendingInteraction` facts
bubble up the chain — the same walk `indexSubagentDescendants` in
`ui-workspace` performs for its "N subagents running" label — so a parent whose
own Agent stopped but whose subagents still work reads as running, and a parent
with a subagent waiting for approval reads as awaiting. DSH itself shows these
as two facts (parent dot plus subagent label); with only three counters we merge
them, and the row keeps the label (`2 subagents`, `a subagent needs you`).

**`completionUnread` is client-only.** It is a per-page `Set` in
`ui-session`: a session is added when a running Agent stops while the user is
elsewhere, and removed when that session becomes the main view or the page
reloads. "Finished" therefore means *finished and not yet looked at*, not
"historically completed". A stable historical counter would need Host data and
was rejected as a non-actionable number.

**Degradation.** A shell without `uiSession` still answers `running` from
`sessions.list` rows; a shell without `uiWorkspace` cannot navigate. Nothing in
the board is required for the file surfaces to work, and the plugin registers
nothing in DSH's file registries (ADR 0001/0002).

## Appendix A — reproducing the asar citations

```bash
python3 - <<'PY'
import json
P = "/Applications/DeepSeek Harness.app/Contents/Resources/app.asar"
f = open(P, "rb")
f.seek(16); header, end = json.JSONDecoder().raw_decode(f.read().decode("utf-8", "replace"))
data = 16 + end
data += (-data) % 4
def read(path):
    node = header["files"]
    for part in path.strip("/").split("/"):
        node = node[part]
        if "files" in node: node = node["files"]
    f.seek(data + int(node["offset"])); return f.read(int(node["size"])).decode("utf-8", "replace")
# e.g. print(read("/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js")[:2000])
PY
```

Search inside the archive without extracting it:

```bash
grep -a -b -o "sidebarRight: no session surface is mounted" \
  "/Applications/DeepSeek Harness.app/Contents/Resources/app.asar"
```

Version checks:

```bash
# nvm global CLI
node -e "console.log(require('$NVM_NODE/lib/node_modules/@deepseek-ai/dsh/package.json').version)"

# desktop runtime (uses the same reader as above)
python3 - <<'PY'
import json
P = "/Applications/DeepSeek Harness.app/Contents/Resources/app.asar"
f = open(P, "rb")
f.seek(16); header, end = json.JSONDecoder().raw_decode(f.read().decode("utf-8", "replace"))
data = 16 + end; data += (-data) % 4
def read(path):
    node = header["files"]
    for part in path.strip("/").split("/"):
        node = node[part]
        if "files" in node: node = node["files"]
    f.seek(data + int(node["offset"])); return f.read(int(node["size"])).decode("utf-8", "replace")
print(json.loads(read("/dsh/desktop-runtime.json"))["release"]["version"])   # 0.2.1-rc.2
PY
```

Key anchors used in this document (grep for them in the asar or in `$B`):

| Anchor | File |
|---|---|
| `dsh-resource://file/` | `…/sidebar-documentpreview/lib/client.js:35`, `…/sidebar-files/lib/client.js:363` |
| `sidebarRight: no session surface is mounted` | `…/sidebar-right/lib/client.js:2482` |
| `sidebarRight: no registered tab type claims` | `…/sidebar-right/lib/client.js:2179`, `:4599` |
| `revealIfOpened` / `findContentTab` | `…/sidebar-right/lib/client.js:2218` |
| `navigation.params` + `line` | `…/sidebar-documentpreview/lib/client.js:644`, `:686` |
| `text` type `canOpen` | `…/sidebar-documentpreview/lib/client.js:1079-1085` |
| `retainedBy.mainView` | `…/dsh-client-ui-session/lib/client.js:917`, `…/dsh-client-ui-layout/lib/client.js:60` |
| `function SZ()` (platform seed) | `…/dsh-web-frontend/dist/assets/index-CN7NIWNw.js:190` |
| `function VA(` (FileTypeIcon) | `…/dsh-web-frontend/dist/assets/index-CN7NIWNw.js:134` |
| `if (this.seed.has(spec))` | `…/dsh-client-modules/lib/client.js:838` |
| `always mounted` (client-hmr) | `…/dsh-web-app/cordis.patch.yml:214` |
| `async read(workspaceFileScope` | `…/dsh-api-workspace-files/lib/index.js:426` |
| `ctx.tools.register(tool)` | `…/dsh-tool-fs-search/lib/index.js:847` |

## Appendix B — notes on the in-progress `client.js`

At the time of writing, `client.js` already contains `encodeSegment`,
`sessionFileAddress`, `fileAddressFor`, `sessionOf`, `openNative`, `openPrimary`,
`openSecondary`, `previewCurrent`, and the `openMode: 'preview'` default. Those
match the verified contracts above. Three review points:

1. `openNative` omits `params` when `item.line <= 1`. That is harmless (line 1 is
   the first row, already visible) but `line >= 1` is the honest condition if
   "line 1 is a target" ever matters.
2. `previewCurrent()` closes the palette after a successful open. If
   `view === 'editor' && dirty`, that discards `draft` without the existing
   confirm flow — route it through `confirmClose`/discard first.
3. `sessionOf(ctx)` is fine as a memo keyed on the open token, but a click-time
   call (as in §8) also covers a conversation switch while the palette is open.
   Also, `list.current` is kept as a legacy branch; it does not exist in
   0.2.1 and can be dropped when convenient (keep the `retainedBy.mainView`
   scan).

**Applied in the shipped v0.2.0 `client.js`:** `params.line` is passed for line 1
too; previewing from a dirty editor shows a save-first notice instead of
discarding; the Session is read at click time; the legacy `list.current` branch
was removed in favor of the `ids` + `retainedBy.mainView` derivation in §2.2;
reload and back-to-search also run through the same unsaved-changes banner.
