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
The plugin's overlay for the user's sessions, opened as one dialog with two
peer tabs. The Status board keeps three columns — awaiting the user, running,
and finished unread — and opens any of them. Recent sessions lists every session
the user can act on, idle ones included, newest first. It is a view of DSH's
session status plus the plugin's own recency facts, not a second store.
_Avoid_: 会话看板 as a task tracker, dashboard, kanban as a separate product,
"all finished sessions"

**Status region**:
The three counts at the sidebar foot (awaiting / running / finished unread) and
the Recent entry beside them. A count opens the Status board; the Recent entry
opens Recent sessions and stays usable when all three counts are zero. Collapses
to a stacked dot rail when the sidebar is in its 56px form.
_Avoid_: badge bar, status widget, notification tray, a fourth count

**Session state**:
The one state a session contributes, taken from DSH's own facts in this order:
awaiting the user (pending approval, question or plan review), running,
finished unread, idle. Exactly one state per session. The counts only cover the
sessions with something to show, so the three numbers add up to them; idle is
not one of the counts and appears only in Recent sessions. Finished unread means
a background run that ended and has not been looked at yet — opening the session
or reloading the page clears it — not that the task succeeded, and not a
historical completion list. A session's state includes its subagent descendants:
a running subagent keeps the parent running and a waiting subagent makes the
parent awaiting, while the parent still counts once.

**Subagent rollup**:
The rule that attaches subagent activity to the session it belongs to instead of
counting subagents separately, walking the `parentId` chain the way DSH's own
session list does.
_Avoid_: status (reserved for DSH's `SessionStatus` fields), 已完成 as "all
idle sessions"

**Recent sessions**:
The second peer tab of the Session board: one record per session across every
workspace of the current DSH instance, ranked by the newest of Activity time,
Access time and DSH's session summary time. Blank placeholders, archived
sessions and subagent sessions never get a record; idle sessions always do. The
summary time is only an approximation of when the session was last active,
because DSH exposes no completion time, so the row marks it as such. The first
50 records are shown with a show-more action, and search covers the title and
workspace of every eligible session, not only the visible page.
_Avoid_: history, completed tasks, 历史任务, a fourth column

**Recent entry**:
The "Recent" (最近) control at the sidebar foot that opens the Session board on
Recent sessions. It remains enabled when all three counts are zero. ⇧⌘G and the
count controls still open the Status board.
_Avoid_: recent badge, a count of idle sessions, a new shortcut

**Activity time**:
The time the plugin's host records for a session's key activity — a user or
assistant message, a run starting or ending, and similar milestones, but not
each streamed token. It is the plugin's own persisted fact, not a DSH-native
session status and not DSH's `updatedAt`, and it survives a restart.
_Avoid_: stream time, updatedAt, DSH status timestamp

**Access time**:
The time the plugin records when the user opens a session from the board or
switches the main view to another one. The first view restored at startup is not
a visit, and anything done while the page is not loaded cannot be observed, so
it is an approximation. It is the plugin's own persisted fact, not a read
receipt from DSH and not DSH's `updatedAt`. The code names the act a **visit**
(the route action, `createVisitTracker`) and the stored stamp `visitedAt`; both
mean this Access time.
_Avoid_: last opened, read state, updatedAt

**Desktop opener**:
The action that hands one file to the operating system's default application
through DSH's session controller. It is not a File surface: the file leaves DSH
and the panel has no further say. The plugin resolves the path inside the
workspace, refuses the script/app-bundle/installer extensions the OS would
execute, and hides the control when the host reports no desktop.
_Avoid_: opening in "the system" as a File surface, calling it a preview
