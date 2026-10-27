# dsh-file-finder

A DSH plugin that finds, browses and shows workspace files. This glossary fixes
the names used for the surfaces that display a file, so settings, docs and code
do not drift apart.

## Language

**File surface**:
One of the three interfaces that can show a file — Native preview, Viewer or
Editor. A file is always shown through exactly one surface at a time.
_Avoid_: file system, viewer mode, 查看方式

**Browser**:
The plugin's panel for finding workspace files: search by name or content, and
directory browsing when the query is empty.
_Avoid_: 文件系统, file manager, file tree, palette

**Viewer**:
The plugin's read-only file surface, rendered in the Browser overlay. Handles
text with syntax colours and in-file find, plus images, video, audio, PDF,
HTML and Markdown.
_Avoid_: previewer, 预览器, built-in preview

**Editor**:
The plugin's writable text surface. Saves through DSH's workspace filesystem
with a version check.
_Avoid_: 内置编辑器 as a separate concept, code editor

**Native preview**:
DSH's own right-sidebar document tab, opened through the sidebar service.
Owned by DSH; the plugin can only ask it to open, not restyle or embed it.
_Avoid_: 原生文件查看, native viewer, sidebar preview as a distinct thing

**Files tree**:
DSH's own workspace directory tree in the right sidebar. Owned by DSH and
outside this plugin's control.
_Avoid_: 原生文件树, native browser

**Open mode**:
The single global preference that chooses which File surface Enter uses for a
text file. Media always opens in the Viewer regardless of it.
_Avoid_: 打开方式 as a per-file setting, default view

**Session board**:
The plugin's overlay that lists the user's sessions in three columns — the ones
awaiting the user, the ones running, and the ones that finished unread — and
opens any of them. It is a view of DSH's session status, not a second store.
_Avoid_: 会话看板 as a task tracker, dashboard, kanban as a separate product

**Status region**:
The three counts at the sidebar foot (awaiting / running / finished) that open
the Session board, filtered to the count that was clicked. Collapses to a
stacked dot rail when the sidebar is in its 56px form.
_Avoid_: badge bar, status widget, notification tray

**Session state**:
The one state a session contributes to the counts, taken from DSH's own facts in
this order: awaiting the user (pending approval, question or plan review),
running, finished-unread, idle. Exactly one state per session, so the three
counts add up to the number of sessions with something to show.
_Avoid_: status (reserved for DSH's `SessionStatus` fields), 已完成 as "all
idle sessions"

**Desktop opener**:
The action that hands one file to the operating system's default application
through DSH's session controller. It is not a File surface: the file leaves DSH
and the panel has no further say. The plugin resolves the path inside the
workspace, refuses the script/app-bundle/installer extensions the OS would
execute, and hides the control when the host reports no desktop.
_Avoid_: opening in "the system" as a File surface, calling it a preview
