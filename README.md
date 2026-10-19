# dsh-file-finder

A DeepSeek Harness plugin for finding and editing workspace text files without leaving DSH.

- Search by file name
- Search by file content
- Change either shortcut in **Settings → Edit shortcuts**
- Open a result and edit the text file in DSH

Chinese documentation: [README.zh.md](README.zh.md)

## Shortcuts

The commands are registered with DSH's shortcut service so you can assign your own keys in **Settings → Edit shortcuts**, but they declare **no default binding**. DSH's registry throws when one command's default overlaps another's, and it throws from inside the *other* plugin's `apply()`, so claiming Cmd+Shift+F here took the whole Web UI boot down (`Conflicting shortcut defaults: session.fork and files.searchContent`). The VS Code keys below are served by this plugin's own keydown handler instead.

| Action | Default keys |
| --- | --- |
| Search by file name | Cmd/Ctrl+P |
| Search by content | Cmd/Ctrl+Shift+F |

These match VS Code. Note that Cmd+Shift+F is DSH's own "fork session" binding; this plugin uses it for content search, so rebind `session.fork` in **Settings → Edit shortcuts** if you relied on it. The File Finder page is in Settings.

## Editing

Choose a result to open it. Save writes the full text back through the workspace filesystem and refuses to overwrite a file that changed after it was loaded. Reload, then save again, to take the newer version. The editor is for UTF-8 text under about 1 MB. Binary files and common build or dependency directories are skipped.

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

## License

MIT
