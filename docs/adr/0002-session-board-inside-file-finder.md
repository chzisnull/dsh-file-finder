# ADR 0002 — The session board lives inside `dsh-file-finder`

Status: accepted (0.13.0)

## Context

The plugin already owns a set of additive surfaces over DSH: the Browser, the
Viewer/Editor and the Desktop opener. A second feature was requested on top of
it: counts of the sessions awaiting the user, running, and finished unread at
the sidebar foot, a board that lists them and opens one, and ⇧⌘G.

`dsh-file-finder` is a *file* plugin by name. Two things could have gone
differently:
1. ship the board as a second plugin with its own settings section and npm
   package, keeping one domain per plugin;
2. build it into this plugin, accepting that the package now carries two
   domains.

DSH itself already models the facts the board needs (`SessionStatus` with
`running`, `pendingInteraction` and `completionUnread`), so the board needs no
host work: three client services (`sessions`, `uiSession`, `workspaces` for the
archive set), one navigation service (`uiWorkspace`) and three additive slots
(`sidebar.footer.action`, `shell.overlay`, `settings.section`).

## Decision

The board ships **inside `dsh-file-finder`** as a second feature, in the same
client bundle and the same settings section, and it reads DSH's session status
directly instead of inventing a state of its own.

## Consequences

- One install, one settings page, one enable switch per surface; a user who
  wants file searching does not need a second package, and uninstalling the
  plugin removes both features together.
- The package description and README now cover two domains. The glossary keeps
  them apart (`File surface` versus `Session state`), and the board's copy never
  calls itself a file feature.
- "Finished" means *finished and not yet looked at* — DSH's `completionUnread`,
  a client-side fact that is cleared by opening the session or reloading the
  page. A stable "all finished sessions" counter was rejected because it would
  be a large, almost static number with no action attached.
- The counts exclude what the user cannot act on: blank placeholders, archived
  sessions and subagent sessions.
- Rows show DSH's Workspace title when the session belongs to one (falling back
  to the cwd folder name), and the search matches title and workspace.
- Column order is a proxy: awaiting sessions are sorted by the oldest
  `updatedAt` (longest wait), running and finished by the newest. DSH exposes no
  completion timestamp, so "newest completion" is really "newest activity".
- ⇧⌘G is served by the plugin's own keydown listener; the registered command
  declares no default binding, because a default that collides with another
  plugin's default breaks the whole Web boot (ADR 0001's additive rule, and the
  regression guard in `test/boot-safety.test.mjs`).
- A host that lacks `uiSession` still gets running/idle from
  `sessions.list`, and a host without `uiWorkspace` simply cannot navigate; the
  region renders nothing when the switch is off.
