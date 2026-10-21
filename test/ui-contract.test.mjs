// Guards the UI seams that are easy to break while refactoring client.js:
// the native DSH preview integration, the automation hooks the preview harness
// relies on, the optional primitives dependency, and reduced-motion support.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

test('files open through the native DSH document preview', () => {
  assert.match(source, /dsh-resource:\/\/file\/session\//)
  assert.match(source, /sidebarRight\.openResource\(/)
  assert.match(source, /params: \{ line: item\.line \}/)
  assert.match(source, /dsh-file-finder\/read/)
})

test('a missing native preview falls back to the built-in editor', () => {
  assert.match(source, /previewUnavailable/)
  assert.match(source, /async function openEditor\(item\)/)
})

test('the palette and settings expose stable automation hooks', () => {
  for (const hook of [
    'data-dff-palette',
    'data-dff-input',
    'data-dff-result',
    'data-dff-list',
    'data-dff-editor',
    'data-dff-settings',
    'data-dff-mode',
  ]) {
    assert.ok(source.includes(hook), `${hook} must stay in the rendered markup`)
  }
})

test('primitives are an optional baseline external with a fallback', () => {
  assert.match(source, /try \{\s*primitives = require\('@deepseek-ai\/dsh-client-ui-primitives'\)/)
  assert.match(source, /function FallbackFileChip\(props\)/)
})

test('motion respects the reduced-motion preference', () => {
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/)
})

test('the live Session is derived the way DSH derives it', () => {
  assert.match(source, /Array\.isArray\(list\.ids\)/)
  assert.match(source, /row\.retainedBy\.mainView/)
  assert.doesNotMatch(source, /list\.current/)
})

test('previewing from a dirty editor never discards the draft', () => {
  assert.match(source, /saveBeforePreview/)
  assert.match(source, /if \(dirty\) \{\s*setNotice\(t\('saveBeforePreview'\)\)/)
})

test('the search field takes focus as soon as the overlay mounts', () => {
  assert.match(source, /autoFocus: true/)
  assert.match(source, /useLayoutEffect\(\(\) => \{\s*if \(!presence\.mounted/)
  assert.match(source, /retryA/)
  assert.match(source, /panelRef\.current\.contains\(active\)/)
})

test('the default opening mode is the native preview', () => {
  assert.match(source, /openMode: 'preview'/)
  assert.match(source, /source\.openMode === 'editor' \? 'editor' : 'preview'/)
})

test('one resolver maps kind, Open mode and key onto a File surface', () => {
  // The surface decision lives in one place: file kind class × stored Open
  // mode × primary/secondary key. Enter and Cmd/Ctrl+Enter can never disagree.
  assert.match(source, /function resolveSurface\(kind, openMode, primary\) \{/)
  // Media ignores the Open mode; kinds the Viewer cannot render prefer native.
  assert.match(source, /if \(kind === 'media'\) return 'viewer'/)
  assert.match(source, /if \(kind === 'other'\) return 'native'/)
  // Text follows the Open mode, and the secondary key is its complement.
  assert.match(source, /if \(mode === 'viewer'\) return primary \? 'viewer' : 'editor'/)
  assert.match(source, /if \(mode === 'editor'\) return primary \? 'editor' : 'native'/)
  assert.match(source, /return primary \? 'native' : 'editor'/)
  // The stored legacy `preview` value is the native branch; unknown values
  // fall back to the same default.
  assert.match(source, /function surfaceOpenMode\(value\) \{\s*if \(value === 'viewer'\) return 'viewer'\s*if \(value === 'editor'\) return 'editor'\s*return 'native'\s*\}/)
  // Both open handlers consult the resolver instead of branching on the mode.
  assert.match(source, /async function openSurface\(item, primary\) \{[\s\S]*?resolveSurface\(surfaceKindOf\(item\.path\), prefsState\.openMode, primary\)/)
  assert.match(source, /async function openPrimary\(item\) \{\s*if \(busy\) return\s*await openSurface\(item, true\)/)
  assert.match(source, /async function openSecondary\(item\) \{\s*if \(busy\) return\s*await openSurface\(item, false\)/)
  assert.doesNotMatch(source, /if \(prefsState\.openMode === 'preview'\)/)
})

test('every settings change is persisted immediately', () => {
  assert.match(source, /prefs\.save\(next\)/)
  assert.match(source, /localStorage\.setItem\(SETTINGS_KEY/)
})

test('the DS Bot bridge detects its host through the boot graph', () => {
  assert.match(source, /window\.__DSH_BOOT__/)
  assert.match(source, /const BOT_MODULE_ID = 'ds-bot'/)
  assert.match(source, /const botReady = botBridge\.detect\(\)/)
})

test('the DS Bot command and key handler are inert without DS Bot', () => {
  // The command is registered inside the `if (botReady)` branch, not before it.
  assert.match(source, /if \(botReady\) \{\s*scoped\.effect\(\(\) => register\(shortcut\(\s*'files\.toggleBotMode'/)
  // The keydown listener is installed under the same gate.
  assert.match(source, /if \(botReady\) \{\s*ctx\.effect\(\(\) => \{\s*document\.addEventListener\('keydown', onBotKey, true\)/)
  assert.match(source, /function onBotKey\(event\) \{\s*if \(event\.defaultPrevented \|\| event\.repeat \|\| event\.isComposing \|\| event\.altKey\) return/)
})

test('the DS Bot bridge drives the controls DS Bot renders itself', () => {
  assert.match(source, /document\.querySelector\('\.bt-return'\)/)
  assert.match(source, /document\.querySelector\('\.bt-account'\)/)
  assert.match(source, /\.bt-account-menu/)
  assert.match(source, /\[role="menuitem"\]/)
  assert.match(source, /'KeyB'/)
})

test('the built-in editor renders a line gutter', () => {
  assert.match(source, /data-dff-gutter/)
  assert.match(source, /dff-line-marker/)
  assert.match(source, /const EDITOR_LINE_HEIGHT = 20/)
  assert.match(source, /function trackActiveLine\(\)/)
})

test('the built-in editor finds inside the file', () => {
  assert.match(source, /function findEditorMatches\(/)
  assert.match(source, /data-dff-find/)
  assert.match(source, /dff-editor-mirror/)
  assert.match(source, /is-current/)
  // Cmd/Ctrl+F is handled both in the textarea and at panel level.
  assert.match(source, /event\.key\.toLowerCase\(\) === 'f'/)
  assert.match(source, /function onFindKey\(event\)/)
  assert.match(source, /function moveFind\(delta\)/)
})

test('the built-in viewer renders media, documents and HTML', () => {
  assert.match(source, /function previewKindOf\(name\)/)
  assert.match(source, /function rawUrlFor\(rootPath, filePath\)/)
  assert.match(source, /'data-dff-viewer': 'image'/)
  assert.match(source, /'data-dff-viewer': 'video'/)
  assert.match(source, /'data-dff-viewer': 'pdf'/)
  assert.match(source, /sandbox: 'allow-scripts'/)
  assert.match(source, /MarkdownText/)
  assert.match(source, /rewriteMarkdownAssets/)
  assert.match(source, /function viewerView\(\)/)
})

test('holding Cmd resolves same-file identifiers and navigates', () => {
  assert.match(source, /const INTEL_MAX_BYTES = 200 \* 1024/)
  assert.match(source, /function utf8Length\(/)
  assert.match(source, /function buildIntelIndex\(/)
  assert.match(source, /function buildIntelSegments\(/)
  assert.match(source, /function resolveIntel\(/)
  assert.match(source, /function jumpIntel\(/)
  assert.match(source, /function navBack\(/)
  // The back stack stores the clicked identifier, not the stale caret.
  assert.match(source, /jumpIntel\(declaration\.offset, true, segment\.start\)/)
  assert.match(source, /function adjustNavStack\(/)
  assert.match(source, /data-dff-intel-layer/)
  assert.match(source, /data-dff-intel-tip/)
  assert.match(source, /data-dff-nav-back/)
  assert.match(source, /event\.key === '\['/)
})

test('the editor colours syntax without giving up the textarea', () => {
  assert.match(source, /const TOKEN_MAX_BYTES = 200 \* 1024/)
  assert.match(source, /const TOKEN_BUFFER_LINES = 40/)
  assert.match(source, /const LANGUAGE_BY_EXTENSION = /)
  assert.match(source, /function languageOf\(/)
  assert.match(source, /function scanTokens\(/)
  assert.match(source, /const TOKEN_SPECS = \{/)
  // Markup files colour what hides inside them.
  assert.match(source, /function scanMarkupTokens\(text, framework\)/)
  assert.match(source, /scanMarkupTokens\(text, 'vue'\)/)
  assert.match(source, /scanMarkupTokens\(text, 'svelte'\)/)
  assert.match(source, /function fenceLanguageOf\(/)
  assert.match(source, /function findMatchingBrace\(/)
  assert.match(source, /function measureTokenWindow\(/)
  assert.match(source, /data-dff-token-layer/)
  assert.match(source, /data-dff-plain/)
  // IME composition, find and large files must fall back to visible text.
  assert.match(source, /onCompositionStart: \(\) => setComposing\(true\)/)
  assert.match(source, /color: transparent; caret-color: var\(--dsw-alias-label-primary, CanvasText\)/)
  assert.match(source, /\.dff-editor-mirror\.is-tinted \{ color: transparent; \}/)
  // Both DSH themes get their own palette.
  assert.match(source, /--dff-syn-keyword/)
  assert.match(source, /body\[data-ds-dark-theme\] \.dff-code \{/)
})

test('the panel browses directories and keeps one action table on the host', () => {
  assert.match(source, /const browsing = Boolean\(request\.open && view === 'search' && !query\.trim\(\) && root\)/)
  assert.match(source, /data-dff-browse/)
  assert.match(source, /data-dff-crumbs/)
  assert.match(source, /emptyBrowseState/)
  assert.match(source, /isInsidePath\(/)
  // Escape walks back one screen at a time, from outside the panel too.
  assert.match(source, /function handleEscape\(/)
  assert.match(source, /addEventListener\('keydown', onWindowKeyDown, true\)/)
  assert.match(source, /dsh-file-finder:escape/)
  const host = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
  assert.match(host, /const ACTIONS = \{/)
  assert.match(host, /function isIgnoredDir\(/)
  assert.match(host, /crumbs,/)
  assert.doesNotMatch(host, /const routes = \['roots'/)
})

test('the Open file browser command browses with no default key', () => {
  const start = source.indexOf("'files.browse'")
  assert.notEqual(start, -1, 'files.browse must be registered')
  const block = source.slice(start, source.indexOf(')))', start))
  // The label resolves through the locale dictionary, so the command reads in
  // both languages.
  assert.match(block, /\(\) => t\('shortcutBrowse'\)/)
  // The aliases cover English and Chinese so either query finds the command.
  for (const alias of ['browse files', 'file browser', '目录浏览']) {
    assert.ok(block.includes(`'${alias}'`), `files.browse must answer to "${alias}"`)
  }
  // Running it opens the Browser with an empty query, its directory browsing
  // state.
  assert.match(block, /\(\) => store\.openSearch\('name'\)/)
  // It must not claim a default key, and the shared helper keeps the map empty.
  assert.doesNotMatch(block, /defaults/, 'files.browse must not declare a default binding')
  assert.match(source, /function shortcut\(id, label, aliases, run\) \{\s*return \{\s*id,\s*label,\s*aliases,\s*defaults: \{\},/)
  // Both dictionaries carry the command label.
  assert.match(source, /shortcutBrowse: '打开文件浏览器'/)
  assert.match(source, /shortcutBrowse: 'Open file browser'/)
})
