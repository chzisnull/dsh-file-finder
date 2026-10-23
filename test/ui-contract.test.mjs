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

test('a missing native preview falls back to a plugin surface', () => {
  // Both fallback notices are user-visible contract; the browser matrix pins
  // which surface receives the file.
  assert.match(source, /previewUnavailable/)
  assert.match(source, /previewUnavailableOther/)
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

test('the stored Open mode is exactly native, viewer or editor', () => {
  // Native preview stays the default, so upgrading changes nothing.
  assert.match(source, /const DEFAULTS = \{[^}]*openMode: SURFACE\.NATIVE/)
  // One enum owns the three stored values; the legacy `preview` spelling is
  // gone from the values and from every comparison.
  const enumBlock = source.match(/const SURFACE = \{([^}]*)\}/)
  assert.ok(enumBlock, 'SURFACE must declare the stored values')
  for (const value of ['native', 'viewer', 'editor']) {
    assert.ok(enumBlock[1].includes(`'${value}'`), `SURFACE must contain ${value}`)
  }
  assert.doesNotMatch(enumBlock[1], /'preview'/)
  assert.doesNotMatch(source, /openMode === 'preview'/)
  assert.doesNotMatch(source, /openMode: 'preview'/)
  assert.doesNotMatch(source, /openModePreview/)
})

test('the settings row offers the three File surfaces in both languages', () => {
  // Every label and hint exists in the zh and en dictionaries.
  for (const key of ['openModeNative', 'openModeViewer', 'openModeEditor', 'openModeNativeHint', 'openModeViewerHint', 'openModeEditorHint', 'openModeRowHint']) {
    const hits = source.match(new RegExp(`${key}:`, 'g')) || []
    assert.equal(hits.length, 2, `${key} must exist in the zh and en dictionaries`)
  }
  // The labels are the glossary's File surfaces.
  assert.match(source, /openModeNative: '原生预览'/)
  assert.match(source, /openModeNative: 'Native preview'/)
  assert.match(source, /openModeViewer: '查看器'/)
  assert.match(source, /openModeViewer: 'Viewer'/)
  assert.match(source, /openModeEditor: '编辑器'/)
  assert.match(source, /openModeEditor: 'Editor'/)
  // The row hint says the choice is global and that media always uses the Viewer.
  assert.match(source, /openModeRowHint: '[^']*全局[^']*图片[^']*查看器[^']*'/)
  assert.match(source, /openModeRowHint: '[^']*text[^']*Viewer[^']*'/)
})

test('the plugin registers nothing into DSH file surfaces', () => {
  // ADR 0001: additive only. The plugin asks the sidebar to open a file; it
  // never claims a tab type, a document renderer or a resource type.
  for (const api of ['sidebarRightTabs', 'documentPreviews', 'resources.register']) {
    assert.ok(!source.includes(api), `${api} must stay out of the client`)
  }
  assert.match(source, /sidebarRight\.openResource\(/)
})

test('the Open mode is only interpreted by the surface resolver', () => {
  // The browser matrices pin the decision table; at source level, no caller
  // gets to branch on the mode (or on the removed `preview` value) itself.
  assert.doesNotMatch(source, /prefsState\.openMode ===/)
  assert.doesNotMatch(source, /draft\.openMode ===/)
  assert.doesNotMatch(source, /openMode === 'preview'/)
})

test('each File surface fallback has its own bilingual notice', () => {
  // Text that cannot use the native preview lands in the Viewer and says so.
  assert.match(source, /previewUnavailable: '[^']*查看器[^']*'/)
  assert.match(source, /previewUnavailable: '[^']*Viewer[^']*'/)
  // A kind the Viewer cannot render has the native-unavailable notice...
  assert.match(source, /previewUnavailableOther: '[^']*查看器[^']*'/)
  assert.match(source, /previewUnavailableOther: '[^']*Viewer[^']*'/)
  // ...and a successful native open of that kind has a different notice that
  // says the type opens in the native preview.
  assert.match(source, /previewNativeOther: '[^']*原生预览[^']*'/)
  assert.match(source, /previewNativeOther: '[^']*native preview[^']*'/)
  const nativeNotice = (source.match(/previewNativeOther: '([^']*)'/) || [])[1]
  const unavailableNotice = (source.match(/previewUnavailableOther: '([^']*)'/) || [])[1]
  assert.ok(nativeNotice && unavailableNotice && nativeNotice !== unavailableNotice,
    'the success and unavailable notices must not be the same string')
})

test('notices and hints use the glossary term Native preview', () => {
  // Both dictionaries carry every native-preview message.
  for (const key of ['previewUnavailable', 'previewUnavailableOther', 'previewNativeOther', 'previewUnavailableAction', 'saveBeforePreview', 'openInSidebar', 'previewUnsupportedHint', 'openModeNativeHint']) {
    const hits = source.match(new RegExp(`${key}:`, 'g')) || []
    assert.equal(hits.length, 2, `${key} must exist in the zh and en dictionaries`)
  }
  // The glossary's term, not "sidebar preview"/"侧栏预览".
  assert.match(source, /previewUnavailable: '[^']*原生预览/)
  assert.match(source, /previewUnavailable: '[^']*native preview/)
  assert.doesNotMatch(source, /侧栏预览/)
  assert.doesNotMatch(source, /sidebar preview/i)
  assert.doesNotMatch(source, /right-sidebar preview/i)
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
  assert.ok(block.includes('shortcutBrowse'), 'the label must resolve through the dictionary')
  // The aliases cover English and Chinese so either query finds the command.
  for (const alias of ['browse files', 'file browser', '目录浏览']) {
    assert.ok(block.includes(`'${alias}'`), `files.browse must answer to "${alias}"`)
  }
  // It must not claim a default key; boot-safety checks every registered
  // command's `defaults` map as well.
  assert.doesNotMatch(block, /defaults/, 'files.browse must not declare a default binding')
  // Both dictionaries carry the command label.
  assert.match(source, /shortcutBrowse: '打开文件浏览器'/)
  assert.match(source, /shortcutBrowse: 'Open file browser'/)
})

test('the Desktop opener follows the host capability, never a client guess', () => {
  // The host answers both halves of the capability (roots: canOpen and the
  // blocked type list); the panel applies it and keeps no copy of either rule.
  assert.match(source, /dsh-file-finder\/open/)
  assert.match(source, /ready: data\.canOpen === true/)
  assert.match(source, /blocked: Array\.isArray\(data\.blockedExtensions\)/)
  assert.match(source, /desktop\.blocked\.includes\(extOf\(file\.path\)\)/)
  assert.match(source, /'data-dff-open': 'default'/)
  // Its words: the action, its failure and the dirty-editor reason.
  for (const key of ['openInDefaultApp', 'openInBrowser', 'openDefaultFailed', 'openBeforeDirty']) {
    assert.match(source, new RegExp(`${key}: '[^']+'`), `${key} must be localized`)
  }
  // The browser wording exists only where the host says the platform forces a
  // browser, and never as a client-side extension rule.
  assert.match(source, /browser: Array\.isArray\(data\.browserExtensions\)/)
  assert.match(source, /desktop\.browser\.includes\(extOf\(file\.path\)\)/)
  // A dirty draft must never be handed to another application, and a click says
  // why instead of vanishing.
  assert.match(source, /desktopOpenerButton\(\{ blocked: dirty \}\)/)
  assert.match(source, /if \(dirty\) \{\s*setNotice\(t\('openBeforeDirty'\)\)/)
})

test('the Desktop opener stays off the agent tool and keeps the host refusal list', () => {
  const host = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
  assert.match(host, /agent: false/)
  assert.match(host, /const AGENT_ACTIONS = /)
  assert.match(host, /enum: AGENT_ACTIONS/)
  // The refusal list is the safety boundary for types the OS would execute, and
  // it is served to the panel instead of being copied into the client.
  assert.match(host, /const DESKTOP_OPENER_BLOCKED_EXT = new Set\(\[/)
  assert.match(host, /'command'/)
  assert.match(host, /export function desktopOpenerCapability\(ctx\)/)
  assert.match(host, /export function isBlockedForDesktopOpener\(/)
  assert.doesNotMatch(source, /'command', 'workflow'/, 'the client must not keep its own blocked list')
})
