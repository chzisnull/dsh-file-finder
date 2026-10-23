# 文件查看面：用插件自己的查看器，保留切回原生

## Problem Statement

用户日常在 DSH 里看文件。插件现在的 Browser（搜索 + 目录浏览）和 Viewer（语法着色、文件内查找、图片/视频/PDF/HTML/Markdown）已经比 DSH 右侧栏的原生预览更合手，但两者是割裂的：从 DSH 自己的入口（右侧栏 Files tree、聊天里的文件链接）打开文件时仍然是原生预览，用户没法让「看文件」这件事默认落到自己更喜欢的界面上，也没法在两种体验之间按自己的习惯选择。

用户提出三点约束：

1. 希望插件能替代自己平时的原生文件查看；
2. 需要能切回原生，或者切回插件的查看器；切换粒度是**全局默认**，不做逐次切换；
3. **一定不能影响 DSH 更新**——插件不能改 DSH 的行为，也不能让 DSH 后续版本的改进被插件遮住。

「都以弹框形式」不是硬要求，侧栏/浮动面板形态可以接受。

## Solution

给插件一个全局的 **Open mode** 偏好，决定「打开文本文件时用哪个 File surface」：

- **Native preview**（默认）——沿用现在的行为：回车把文件交给 DSH 右侧栏预览；DSH 不可用时退回 Viewer 并提示；
- **Viewer**——回车在插件自己的只读 Viewing surface 里打开，带语法着色、文件内查找和媒体渲染；
- **Editor**——回车直接进内置编辑器。

媒体类文件（图片、视频、音频、PDF、HTML、Markdown）无论 Open mode 是什么都进 Viewer；Viewer 渲染不了的类型（如 Office 文档）优先交给 Native preview。

Browser 继续作为日常入口：⌘P / ⇧⌘F 打开，空查询就是目录浏览；另外增加一条独立命令「打开文件浏览器」，方便绑自己的键。

插件**不接管任何 DSH 自己的界面**：不注册文档渲染器、不注册 tab 类型、不 shadow Files tree、不 patch 任何 DSH 模块。原生预览和 Files tree 始终归 DSH 所有，所以 DSH 更新照常生效，插件停用/卸载后 DSH 回到原样。这条边界记在 ADR 0001。

## User Stories

1. As a DSH user who prefers the plugin's viewer, I want a single global setting that makes Enter open files in the plugin's Viewer, so that I do not have to switch surfaces file by file.
2. As a DSH user, I want the default to stay Native preview after upgrading, so that the plugin does not silently change how files open.
3. As a DSH user, I want to switch the global Open mode back to Native preview at any time, so that I can return to DSH's own rendering when I need it.
4. As a DSH user, I want the Open mode to persist across sessions, so that I set it once.
5. As a DSH user with a legacy settings blob, I want my previous "Sidebar preview" choice to keep working after the rename, so that upgrading changes nothing for me.
6. As a DSH user, I want "Reset to defaults" to put Open mode back to Native preview, so that I can undo my choice.
7. As a DSH user, I want Enter on an image/video/audio/PDF/HTML/Markdown file to always open the plugin's Viewer, so that media does not depend on which Open mode I picked for text.
8. As a DSH user, I want Cmd/Ctrl+Enter to open the editor when Enter opens a viewer, so that I can jump from reading to editing in one keystroke.
9. As a DSH user, I want Cmd/Ctrl+Enter to open a read-only surface when Enter opens the editor, so that the complement of the default is always the other side of view/edit.
10. As a DSH user, I want a file type the plugin's Viewer cannot render (for example an Office document) to open in DSH's native preview instead of a dead end, so that I can still read it.
11. As a DSH user whose DSH has no right sidebar or no live session, I want a clear notice and a read-only fallback, so that choosing Native preview never leaves me with nothing.
12. As a DSH user, I want the plugin's Browser to remain my entry point with ⌘P and ⇧⌘F, so that searching and browsing do not change.
13. As a DSH user, I want a separate "Open file browser" command I can bind myself, so that I can reach the Browser without typing a query first.
14. As a DSH user, I want no default key binding claimed for that new command, so that DSH's shortcut registry keeps booting cleanly.
15. As a DSH user, I want the settings card to explain that the choice is global and that media always uses the Viewer, so that I am not surprised later.
16. As a DSH user, I want the Viewer's existing "open in the right sidebar" action to stay available, so that I can still send a single file to the native preview without changing my global default.
17. As a DSH user, I want the plugin to leave DSH's Files tree and document preview untouched, so that a DSH update that improves them still reaches me.
18. As a DSH user, I want to be able to disable or uninstall the plugin and have DSH behave exactly as before, so that trying the plugin is low risk.
19. As a DSH user, I want the change to take effect with a page refresh and no application restart, so that switching surfaces is cheap.
20. As a DSH user reading a text file in the Viewer, I want syntax colours, in-file find and Esc-to-go-back to keep working, so that choosing the Viewer does not lose features.
21. As a DSH user editing a file, I want the editor's save/version-conflict behaviour to stay unchanged, so that the new setting does not touch data safety.
22. As a DSH user with a 200 KB+ file, I want the existing large-file degradation to apply in the Viewer, so that the new default never makes a big file slow.

## Implementation Decisions

**Open mode preference**

- `openMode` becomes an enum with exactly three stored values: `native`, `viewer`, `editor`. Default `native`.
- Stored under the existing settings key; legacy `preview` migrates to `native`, `editor` stays `editor`, anything else becomes `native`. Reset restores `native`.
- One settings row: the existing segmented control gains a third option, each option keeps a one-line hint, and the row hint states the choice is global and that media always uses the Viewer.

**Surface resolver**

A single resolver chooses the File surface for both Enter and ⌘/Ctrl+Enter, so the two keys can never disagree:

| File kind | Open mode | Enter | ⌘/Ctrl+Enter |
| --- | --- | --- | --- |
| text | native | Native preview, fallback Viewer + notice | Editor |
| text | viewer | Viewer | Editor |
| text | editor | Editor | Native preview, fallback Viewer + notice |
| media (image, video, audio, PDF, HTML, Markdown) | any | Viewer | Viewer |
| other (Office, archives, undecodable) | any | Native preview if available, else Viewer's unsupported state | same |

- The Viewer keeps its existing "open in the right sidebar" button: it is an explicit one-off action, not a second switching mechanism. There is deliberately no modifier that toggles between Viewer and Native preview, because switching granularity is global-only.
- "Native preview available" is the existing probe: sidebar service present and the resource address accepted. A missing service or a rejected address produces the existing unavailable notice and the fallback above.

**DSH boundary**

- The plugin registers nothing into DSH's file surfaces: no `sidebarRightTabs` tab type, no `documentPreviews` renderer, no `resources` type, no shadowing of the Files tree. It only calls the documented `sidebarRight.openResource`.
- No new host routes *for the file surfaces themselves*. The feature lives in the client (settings, resolver, copy) plus docs and tests; the only host change is additive — the existing read-error response now also carries its error `code`, so the client can tell a too-large/not-text read from other failures instead of matching localized copy. One route was added later by Amendment A (Desktop opener) below.
- Because the plugin changes nothing in DSH, switching the setting off — or uninstalling — restores DSH behaviour with no cleanup.

**Commands and entry**

- Existing commands stay as they are; the Browser keeps its ⌘P / ⇧⌘F entries and empty-query browsing.
- New command id `files.browse`, label "Open file browser" / "打开文件浏览器", aliases such as "browse files" and "file browser", no default key binding.

**Copy**

- New strings (zh/en): the three surface labels, one hint per option, the row hint about the global scope and media behaviour, the fallback notice for "this type opens in the native preview", and the new command label/aliases.
- Existing "Sidebar preview" label is renamed to "Native preview" so the setting matches the glossary.

## Testing Decisions

A good test asserts observable behaviour: which surface is on screen after a key, what the user is told when a surface is unavailable, and what survives a reload. It does not assert internal function names or module structure.

**Seam 1 — browser harness (existing, highest).** Extend the palette browser check harness, which already mounts the real overlay against a fake workspace and can open both surfaces. Add a recording fake `sidebarRight` service to the fake context so "native preview opened" is observable, and seed the settings blob before mounting. Cases: the three Open modes × text; media forced to Viewer; Office/binary kinds routed to native; native unavailable → Viewer + notice; ⌘/Ctrl+Enter complement for each mode; Esc still backs out of whichever surface opened.

**Seam 2 — source contract (existing).** Extend the UI contract test that already guards settings/shortcut/editor seams: assert the enum and migration, the resolver's decision table, the new command id with no default binding, and that no DSH registry is registered.

**Seam 3 — screenshots (existing).** The settings capture already renders the settings card; update it to the three-option row. No new capture key.

No new seams are introduced, and no host-level tests are added because the host is untouched.

## Out of Scope

- Registering a document renderer, a right-sidebar tab type or a resource type with DSH, or shadowing the Files tree. Technically possible through public plugin APIs (the tab registry has an `extension` band above `builtin`, and document renderers rank plugin-first), but rejected by ADR 0001 because it would mask DSH updates.
- Embedding DSH's native preview inside the plugin's overlay (no public component export exists).
- Automatically floating or docking the native preview (`float`/`dock` are documented but remaining DSH-owned layout).
- Any per-file, per-directory or per-extension override; switching granularity is the single global Open mode.
- Replacing DSH's own entry points (Files tree rows, chat file links) with plugin UI.
- Cross-file/semantic navigation, search ranking, and browse semantics.
- New host routes, new filesystem access, or changes to save/version handling for the file surfaces. (Amendment A adds exactly one route, the Desktop opener, and no filesystem access beyond the existing workspace containment check.)

## Further Notes

- The constraint "must not affect DSH updates" is the deciding factor for the boundary above; the reasoning and the rejected alternatives live in ADR 0001.
- The plugin's Viewer remains an overlay inside DSH; "弹框" is accepted but not required, and the Native preview stays in DSH's right sidebar (possibly floated by the user).
- Known limitation: file kinds DSH renders but the Viewer does not (Office/Excel) are routed to the native preview; if DSH is unavailable they show the Viewer's existing unsupported state.
- Only client files change, so the feature takes effect after a page refresh, not an application restart.
- Version bump after implementation: 0.11.0.

## Amendment A — Desktop opener (0.12.0)

**What changed.** The Viewer and the Editor gained one action, the **Desktop opener**: it hands the current file to the operating system through DSH's `sessionController.openWorkspacePath`, so a web page lands in whatever the OS opens HTML with and every other file in the app registered for its type. This reverses the "no new host routes" rule for exactly one route, deliberately.

**Why it is still inside the boundary.** The plugin still registers nothing with DSH and shadows nothing: it calls one documented host service and adds one route of its own (`POST /dsh-file-finder/open`, in the existing `ACTIONS` table). The platform half — browser preference, WSL translation, credential-scrubbed launch, "is there a desktop" — stays DSH's. A plugin that spawned `open` itself would be the thing ADR 0001 warns about; calling the host keeps DSH free to change its own launcher.

**Behaviour bound by this amendment.**

- The host answers the capability, not the client: `roots` returns `canOpen` (this host reaches a desktop), `blockedExtensions` (script/app-bundle/installer extensions the OS would execute rather than open) and `browserExtensions` (the extensions DSH really forces into the default browser — macOS only). The panel applies all three and keeps no copy of any rule; `read` no longer carries a per-file answer.
- Refused extensions never get the control, including in the Viewer's unsupported state. The refusal is filename-based by design; the route re-checks so a bypass cannot launch anything.
- Availability is `canOpenWorkspacePath()`'s answer: a controller without that method counts as unavailable.
- The action is `agent: false`: the `file_finder` agent tool never offers it, and a direct call through the tool is rejected.
- A draft with unsaved changes keeps the control inert (its tooltip says why, and a click shows the same reason as a notice) until the file is saved.
- Copy names the browser only where `browserExtensions` says the platform forces one; everywhere else it says "用默认应用打开" / "Open in default app". Both aria labels still carry the file name.
- Failure is a retry on the control itself ("打开失败，点击重试"); success is silent.
- Availability is DSH's answer, not a reachability probe: a macOS host reached over SSH reports available while the window opens on the remote machine. Opening an HTML file opens the one on disk, so a page needing a local dev server renders empty.

**Not changed.** Native preview, Files tree, Open mode, media routing and every other surface stay as specified above. Only client files and one additive host action change, so the feature takes effect after a page refresh, not an application restart.
