# File surfaces stay additive: never register into DSH's own viewer or tree

DSH exposes public extension points that would let this plugin take over file
display: `sidebarRightTabs.register` (an `extension` band wins over the
`builtin` file tree), `documentPreviews.register` (plugin renderers rank ahead
of the builtin one) and `resources.register`. We deliberately use **none** of
them, because the plugin must not change what a DSH update ships.

Instead the plugin renders files only inside its own Browser overlay and asks
DSH's native preview to open when the user chooses it. The plugin chooses the
surface through a global Open mode preference; DSH keeps ownership of the Files
tree and of the right-sidebar document tab.

Considered options:

- **Take over the document preview** (register a renderer or a claiming tab
  type) — rejected: our renderer would keep winning after a DSH update that
  improves its own preview, so updates would become invisible to the user.
- **Shadow the Files tree** — rejected: same masking problem, larger surface to
  keep working across DSH versions.
- **Additive only** (chosen) — the plugin can be installed, disabled or removed
  without leaving DSH in a different state, and every DSH update keeps applying.

Consequence: "use the plugin instead of the native viewer" means the plugin's
Browser/Viewer is the entry for everything the plugin itself opens; files
opened from DSH's own UI still use the native preview. A DSH-wide takeover, if
ever wanted, needs its own decision and would contradict this ADR.
