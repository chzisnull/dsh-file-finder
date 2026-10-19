# dsh-file-finder

A DeepSeek Harness plugin for finding and editing workspace text files without leaving DSH.

- Search by file name
- Search by file content
- Change either shortcut in **Settings → Edit shortcuts**
- Open a result and edit the text file in DSH

Chinese documentation: [README.zh.md](README.zh.md)

## Shortcuts

The commands are registered with DSH's shortcut service, so saved overrides survive reloads and can be cleared from the shortcut reference.

| Action | Desktop default | Web default |
| --- | --- | --- |
| Search by file name | Cmd/Ctrl+P | Cmd/Ctrl+P |
| Search by content | Cmd/Ctrl+Shift+F | Cmd/Ctrl+Shift+F |

These match VS Code: Cmd/Ctrl+P opens files by name, and Cmd/Ctrl+Shift+F searches file contents. Change them in Settings → Edit shortcuts. The File Finder page is in Settings.

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
