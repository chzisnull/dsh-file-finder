/**
 * Standalone mount harness for dsh-file-finder's two client surfaces.
 *
 * Responsibilities:
 *  - fake the DSH client ctx the plugin's apply() expects (effect, on, get,
 *    locale, slots, optional shortcuts) without any DSH runtime;
 *  - intercept fetch() so the plugin's /dsh-file-finder/* requests get realistic
 *    fixture data (workspaces, name hits, content hits, file text, write);
 *  - mount the registered shell.overlay component and open it through the same
 *    keyboard shortcut users press, or the registered shortcut command;
 *  - mount the registered settings.section component on a fake settings page;
 *  - drive the URL-addressed state (#palette-name, #palette-content, …) and
 *    expose a `data-preview-ready` marker for preview/screenshot.mjs.
 *
 * This file is preview-only and is never part of the published plugin.
 */
(function () {
  'use strict'

  const SUPPORTED_STATES = [
    'palette-name',
    'palette-content',
    'palette-browse',
    'browse-src',
    'palette-empty',
    'palette-loading',
    'editor',
    'editor-dirty',
    'editor-find',
    'viewer',
    'viewer-html',
    'settings',
  ]
  const CWD = '/workspace/dsh-file-finder'

  const params = new URLSearchParams(location.search)
  const requestedState = (location.hash || '').replace(/^#/, '')
  const state = SUPPORTED_STATES.includes(requestedState) ? requestedState : 'palette-name'
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light'
  const lang = params.get('lang') === 'zh' ? 'zh' : 'en'
  const motion = params.get('motion') === 'on' ? 'on' : 'off'
  const captureAtOpen = params.get('capture') === 'open'

  const root = document.documentElement
  const warnings = []
  const consoleErrors = []
  const slotEntries = []
  const shortcuts = []
  const network = []
  const localeDictionaries = {}
  let pendingInjectBucket = null

  root.dataset.previewState = state
  root.dataset.previewTheme = theme
  root.dataset.previewMotion = motion
  root.dataset.previewLang = lang
  root.classList.toggle('preview-motion-off', motion === 'off')
  if (theme === 'dark') document.body.setAttribute('data-ds-dark-theme', '')
  else document.body.removeAttribute('data-ds-dark-theme')

  // Capture plugin-side console output before apply() runs. The guarded
  // primitives fallback is expected to log here in the redesigned client.
  const originalConsoleError = console.error.bind(console)
  console.error = function previewConsoleError() {
    const text = Array.from(arguments).map((item) => {
      if (item instanceof Error) return item.stack || item.message
      if (typeof item === 'string') return item
      try { return JSON.stringify(item) } catch { return String(item) }
    }).join(' ')
    consoleErrors.push(text)
    originalConsoleError.apply(console, arguments)
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  function warn(message) {
    warnings.push(message)
    console.warn(`[preview] ${message}`)
  }

  async function waitFor(check, timeout, label) {
    const started = performance.now()
    for (;;) {
      let value = false
      try { value = check() } catch { value = false }
      if (value) return value
      if (performance.now() - started > timeout) {
        throw new Error(`timed out after ${timeout}ms waiting for ${label}`)
      }
      await sleep(35)
    }
  }

  const SELECTORS = {
    panel: '[data-dff-palette], .dff-panel',
    input: '[data-dff-input], .dff-input',
    result: '[data-dff-result], .dff-result',
    editor: '[data-dff-editor], .dff-editor, textarea.dff-editor',
    settings: '[data-dff-settings], .dff-page',
  }

  function pick(selectors) {
    for (const selector of selectors.split(',').map((item) => item.trim())) {
      const element = document.querySelector(selector)
      if (element) return element
    }
    return null
  }

  function pickAll(selectors) {
    for (const selector of selectors.split(',').map((item) => item.trim())) {
      const list = Array.from(document.querySelectorAll(selector))
      if (list.length) return list
    }
    return []
  }

  function detectMode() {
    const panel = pick(SELECTORS.panel)
    const panelMode = panel && panel.getAttribute('data-dff-mode')
    if (panelMode === 'name' || panelMode === 'content') return panelMode
    const marked = document.querySelector(
      '[data-dff-mode][aria-selected="true"], [data-dff-mode].is-selected, ' +
      '[data-dff-mode][data-state="active"], [data-dff-mode][aria-checked="true"]',
    )
    if (marked) {
      const value = marked.getAttribute('data-dff-mode')
      if (value === 'name' || value === 'content') return value
    }
    const tab = document.querySelector('.dff-tab[aria-selected="true"], .dff-tab.is-selected, [role="tab"][aria-selected="true"]')
    if (tab) return /content|内容/i.test(tab.textContent || '') ? 'content' : 'name'
    return null
  }

  function focusedElement() {
    return document.activeElement instanceof HTMLElement ? document.activeElement : null
  }

  // -------------------------------------------------------------------------
  // Fixtures
  // -------------------------------------------------------------------------
  const ROOTS = [
    { path: CWD, title: 'dsh-file-finder', source: 'workspace' },
    { path: '/workspace/dsh-workbench', title: 'dsh-workbench', source: 'workspace' },
    { path: '/workspace/deepseek-harness/packages/client', title: 'deepseek-harness', source: 'session' },
  ]

  // Directory listing for the browse mode (empty query).
  const BROWSE_TREE = {
    [CWD]: [
      { name: 'docs', path: `${CWD}/docs`, type: 'dir' },
      { name: 'packages', path: `${CWD}/packages`, type: 'dir' },
      { name: 'preview', path: `${CWD}/preview`, type: 'dir' },
      { name: 'src', path: `${CWD}/src`, type: 'dir' },
      { name: 'client.js', path: `${CWD}/client.js`, type: 'file' },
      { name: 'cordis.patch.yml', path: `${CWD}/cordis.patch.yml`, type: 'file' },
      { name: 'index.js', path: `${CWD}/index.js`, type: 'file' },
      { name: 'package.json', path: `${CWD}/package.json`, type: 'file' },
      { name: 'README.md', path: `${CWD}/README.md`, type: 'file' },
    ],
    [`${CWD}/src`]: [
      { name: 'search', path: `${CWD}/src/search`, type: 'dir' },
      { name: 'main.ts', path: `${CWD}/src/main.ts`, type: 'file' },
      { name: 'panel.tsx', path: `${CWD}/src/panel.tsx`, type: 'file' },
    ],
    [`${CWD}/src/search`]: [
      { name: '__tests__', path: `${CWD}/src/search/__tests__`, type: 'dir' },
      { name: 'query-parser.ts', path: `${CWD}/src/search/query-parser.ts`, type: 'file' },
      { name: 'rank.ts', path: `${CWD}/src/search/rank.ts`, type: 'file' },
    ],
    [`${CWD}/docs`]: [
      { name: 'native-integration.md', path: `${CWD}/docs/native-integration.md`, type: 'file' },
    ],
    [`${CWD}/packages`]: [
      { name: 'client', path: `${CWD}/packages/client`, type: 'dir' },
      { name: 'server', path: `${CWD}/packages/server`, type: 'dir' },
    ],
    [`${CWD}/packages/client`]: [],
    [`${CWD}/packages/server`]: [],
    [`${CWD}/preview`]: [
      { name: 'vendor', path: `${CWD}/preview/vendor`, type: 'dir' },
      { name: 'index.html', path: `${CWD}/preview/index.html`, type: 'file' },
      { name: 'mount.js', path: `${CWD}/preview/mount.js`, type: 'file' },
    ],
    [`${CWD}/preview/vendor`]: [],
    [`${CWD}/src/search/__tests__`]: [],
  }

  const NAME_RESULTS = [
    { path: `${CWD}/index.js`, name: 'index.js', score: 0 },
    { path: `${CWD}/preview/index.html`, name: 'index.html', score: 0 },
    { path: `${CWD}/src/search/index.ts`, name: 'index.ts', score: 0 },
    { path: `${CWD}/packages/client/ui-primitives/src/components/command-palette/index.tsx`, name: 'index.tsx', score: 1 },
    { path: `${CWD}/packages/server/src/http/routes/index.ts`, name: 'index.ts', score: 1 },
    { path: `${CWD}/test/index.test.mjs`, name: 'index.test.mjs', score: 1 },
    { path: `${CWD}/dist/assets/index-lP1BfJ4l.css`, name: 'index-lP1BfJ4l.css', score: 2 },
    { path: `${CWD}/docs/guides/plugin-authoring/index.md`, name: 'index.md', score: 2 },
    { path: `${CWD}/scripts/build/index.mjs`, name: 'index.mjs', score: 2 },
    { path: `${CWD}/.github/ISSUE_TEMPLATE/index.yml`, name: 'index.yml', score: 2 },
    { path: `${CWD}/docs/launch/dsh-file-finder-cover.png`, name: 'dsh-file-finder-cover.png', score: 0 },
    { path: `${CWD}/docs/media/fixtures/demo.html`, name: 'demo.html', score: 0 },
  ]

  const CONTENT_RESULTS = [
    {
      path: `${CWD}/index.js`,
      name: 'index.js',
      hits: [
        { line: 12, text: 'export function parseQuery(input, options = {}) {' },
        { line: 48, text: '  const parser = new QueryParser({ caseSensitive: options.caseSensitive })' },
      ],
    },
    {
      path: `${CWD}/src/search/query-parser.ts`,
      name: 'query-parser.ts',
      hits: [
        { line: 7, text: 'export class QueryParser {' },
        { line: 33, text: '  parse(source: string): ParsedQuery {' },
      ],
    },
    {
      path: `${CWD}/src/search/__tests__/parser.test.ts`,
      name: 'parser.test.ts',
      hits: [
        { line: 18, text: "  it('parses a bare filename query', () => {" },
      ],
    },
  ]

  const EDITOR_TEXT = `/**
 * Host half of dsh-file-finder.
 * Search, read, and save stay here so the panel and the agent tool share one
 * implementation.
 */

export const inject = ['webServer', 'tools', 'fs']

const NAME_FILE_CAP = 8000
const NAME_RESULT_CAP = 40
const CONTENT_FILE_CAP = 1500
const CONTENT_FILE_BYTES = 512 * 1024

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.next', '.nuxt', '.turbo', '.cache', 'vendor',
])

export function rankName(query, displayPath, options = {}) {
  const caseSensitive = Boolean(options.caseSensitive)
  const needle = fold(String(query || '').trim(), caseSensitive)
  if (!needle) return null

  const normalized = String(displayPath || '').replaceAll('\\\\', '/')
  const name = normalized.split('/').pop() || normalized
  const nameFold = fold(name, caseSensitive)
  const stem = nameFold.includes('.') ? nameFold.slice(0, nameFold.lastIndexOf('.')) : nameFold

  if (nameFold === needle || stem === needle) return { score: 0, name, path: normalized }
  if (nameFold.startsWith(needle) || stem.startsWith(needle)) return { score: 1, name, path: normalized }
  if (nameFold.includes(needle)) return { score: 2, name, path: normalized }
  if (needle.includes('/') && normalized.toLowerCase().includes(needle)) return { score: 3, name, path: normalized }
  return null
}
`

  // -------------------------------------------------------------------------
  // Mock HTTP API (same routes the Host half exposes)
  // -------------------------------------------------------------------------
  const HOLD_SEARCH = state === 'palette-loading'

  function jsonResponse(body, delay, status) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(new Response(JSON.stringify(body), {
          status: status || 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        }))
      }, delay || 0)
    })
  }
  const neverResponse = () => new Promise(() => {})

  function nameResults(query) {
    const needle = String(query || '').trim().toLowerCase()
    if (!needle || needlessQuery(needle)) return []
    if (needle.includes('index')) return NAME_RESULTS
    return NAME_RESULTS.filter((item) => item.name.toLowerCase().includes(needle))
  }

  function contentResults(query) {
    const needle = String(query || '').trim().toLowerCase()
    if (needle.length < 2 || needlessQuery(needle)) return []
    if (needle.includes('parser')) return CONTENT_RESULTS
    return CONTENT_RESULTS.filter((item) =>
      item.name.toLowerCase().includes(needle) ||
      item.hits.some((hit) => hit.text.toLowerCase().includes(needle)))
  }

  function needlessQuery(needle) {
    return needle === 'zzzznomatch' || needle === 'nothing-here' || needle === 'no-match'
  }

  window.fetch = function previewFetch(input, init) {
    const requestUrl = typeof input === 'string' ? input : (input && input.url) || ''
    let path = requestUrl
    try { path = new URL(requestUrl, location.href).pathname } catch { /* keep raw */ }
    let body = {}
    try {
      if (init && typeof init.body === 'string') body = JSON.parse(init.body)
    } catch { body = {} }
    network.push({ path, body })

    if (path === '/dsh-file-finder/roots') {
      return jsonResponse({ ok: true, roots: ROOTS, current: CWD }, 60)
    }
    if (path === '/dsh-file-finder/list') {
      const dir = String(body.path || CWD)
      const entries = BROWSE_TREE[dir] || []
      const parent = dir === CWD ? null : dir.slice(0, dir.lastIndexOf('/'))
      const crumbs = [{ label: CWD.slice(CWD.lastIndexOf('/') + 1), path: CWD }]
      if (dir !== CWD) {
        let accumulated = CWD
        for (const segment of dir.slice(CWD.length).replace(/^\/+/, '').split('/')) {
          if (!segment) continue
          accumulated = `${accumulated}/${segment}`
          crumbs.push({ label: segment, path: accumulated })
        }
      }
      return jsonResponse({
        ok: true, root: CWD, path: dir, parent, total: entries.length, truncated: false, entries, crumbs,
      }, 60)
    }
    if (path === '/dsh-file-finder/search-name') {
      if (HOLD_SEARCH) return neverResponse()
      return jsonResponse({
        ok: true,
        mode: 'name',
        root: body.root || CWD,
        truncated: false,
        results: nameResults(body.query),
      }, 200)
    }
    if (path === '/dsh-file-finder/search-content') {
      if (HOLD_SEARCH) return neverResponse()
      return jsonResponse({
        ok: true,
        mode: 'content',
        root: body.root || CWD,
        truncated: false,
        results: contentResults(body.query),
      }, 240)
    }
    if (path === '/dsh-file-finder/read') {
      const readPath = String(body.path || `${CWD}/index.js`)
      const image = /\.(png|jpe?g|webp|gif|avif)$/i.test(readPath)
      const html = /\.html?$/i.test(readPath)
      const text = image ? '' : EDITOR_TEXT
      return jsonResponse({
        ok: true,
        path: readPath,
        text,
        version: '7',
        bytes: text.length,
        kind: image ? 'image' : html ? 'html' : 'text',
      }, 120)
    }
    if (path === '/dsh-file-finder/write') {
      if (String(body.path || '').includes('client.js')) {
        return jsonResponse({
          ok: false,
          conflict: true,
          error: 'The file changed outside the editor',
          version: '8',
        }, 120)
      }
      return jsonResponse({
        ok: true,
        path: body.path || `${CWD}/index.js`,
        version: '8',
        operation: 'update',
      }, 120)
    }
    return jsonResponse({ ok: false, error: `[preview] no mock for ${path}` }, 0, 404)
  }

  // -------------------------------------------------------------------------
  // Fake DSH client context
  // -------------------------------------------------------------------------
  const sessions = {
    list: {
      getSnapshot: () => ({
        // Mirror the DSH snapshot shape: newest clients derive the live row
        // from list.ids + retainedBy.mainView; older ones read list.current.
        current: 'ses_demo',
        ids: ['ses_demo', 'ses_other'],
        byId: {
          ses_demo: {
            id: 'ses_demo',
            title: 'File finder palette polish',
            cwd: CWD,
            retainedBy: { mainView: 1 },
          },
          ses_other: {
            id: 'ses_other',
            title: 'Search result ranking review',
            cwd: '/workspace/dsh-workbench',
            retainedBy: { mainView: 0 },
          },
        },
      }),
      subscribe: () => () => {},
    },
  }

  function makeT(namespace) {
    return function t(key) {
      const dictionary = localeDictionaries[namespace] || {}
      const table = dictionary[lang] || dictionary.en || dictionary.zh || {}
      return typeof table[key] === 'string' ? table[key] : key
    }
  }

  const ctx = {
    effect(callback) {
      const dispose = callback()
      return typeof dispose === 'function' ? dispose : () => {}
    },
    on() {
      return () => {}
    },
    get(name) {
      if (name === 'sessions') return sessions
      return undefined
    },
    inject(names, callback) {
      if (!Array.isArray(names) || typeof callback !== 'function') return
      const scoped = {
        effect: ctx.effect,
        on: ctx.on,
        get: ctx.get,
        shortcuts: {
          register(command) {
            shortcuts.push(command)
            return () => {}
          },
        },
      }
      if (names.includes('shortcuts')) callback(scoped)
    },
    locale: {
      register(namespace, dictionary) {
        localeDictionaries[namespace] = dictionary
        return () => { delete localeDictionaries[namespace] }
      },
      bind(namespace) {
        return makeT(namespace)
      },
    },
    slots: {
      getVersion() { return 1 },
      entries(name) {
        return slotEntries.filter((entry) => entry.slot === name).map((entry) => entry.definition)
      },
      subscribe() { return () => {} },
      register(definition, component) {
        const entry = { definition, component }
        if (pendingInjectBucket) pendingInjectBucket.push(entry)
        return entry
      },
      inject(slotName, callback) {
        const bucket = []
        const previous = pendingInjectBucket
        pendingInjectBucket = bucket
        try { callback() } finally { pendingInjectBucket = previous }
        for (const entry of bucket) slotEntries.push({ slot: slotName, ...entry })
        return () => {}
      },
    },
  }
  // serviceOf() falls back to ctx[name]; keep parity with the real context.
  ctx.sessions = sessions

  window.__DFF_SHORTCUTS__ = shortcuts
  window.__DFF_SLOT_ENTRIES__ = slotEntries
  window.__DFF_NETWORK__ = network
  window.__DFF_LOCALE_DICTS__ = localeDictionaries

  // -------------------------------------------------------------------------
  // Palette driving helpers
  // -------------------------------------------------------------------------
  function pressPrimary(code, shift) {
    const isF = code === 'KeyF'
    const event = new KeyboardEvent('keydown', {
      key: isF ? 'F' : 'p',
      code,
      keyCode: isF ? (shift ? 70 : 70) : 80,
      which: isF ? 70 : 80,
      metaKey: true,
      ctrlKey: true,
      shiftKey: Boolean(shift),
      bubbles: true,
      cancelable: true,
      composed: true,
    })
    document.dispatchEvent(event)
  }

  function commandMatches(command, mode) {
    if (!command) return 0
    const id = String(command.id || '').toLowerCase()
    const label = typeof command.label === 'function' ? String(command.label() || '') : String(command.label || '')
    const haystack = `${id} ${label}`.toLowerCase()
    if (mode === 'content') {
      if (id.includes('searchcontent')) return 4
      if (haystack.includes('content')) return 2
      return 0
    }
    if (id.includes('searchname')) return 4
    if (haystack.includes('name')) return 2
    return 0
  }

  function runCommand(command) {
    try {
      const result = typeof command.resolve === 'function' ? command.resolve() : null
      const run = result && typeof result.run === 'function' ? result.run : null
      if (run) { run(); return true }
      if (typeof command.run === 'function') { command.run(); return true }
    } catch (error) {
      console.warn('[preview] shortcut command failed', error)
    }
    return false
  }

  async function ensureMode(mode) {
    if (detectMode() === mode) return
    pressPrimary(mode === 'content' ? 'KeyF' : 'KeyP', mode === 'content')
    try {
      await waitFor(() => detectMode() === mode, 900, `mode switch to ${mode} via shortcut`)
      return
    } catch { /* fall through to clicking the tab */ }

    const candidates = Array.from(document.querySelectorAll('[data-dff-mode], [role="tab"], .dff-tab'))
    const target = candidates.find((element) => {
      const value = element.getAttribute('data-dff-mode')
      if (value) return value.toLowerCase() === mode
      const text = (element.textContent || '').toLowerCase()
      return mode === 'content' ? /content|内容/.test(text) : /name|文件名/.test(text)
    })
    if (target) target.click()
    try {
      await waitFor(() => detectMode() === mode, 1200, `mode switch to ${mode}`)
    } catch {
      warn(`could not confirm "${mode}" mode; the palette may have changed its mode controls`)
    }
  }

  async function openPalette(mode) {
    if (!pick(SELECTORS.panel)) {
      pressPrimary('KeyP', false)
      await sleep(80)
    }
    if (!pick(SELECTORS.panel)) {
      const ordered = shortcuts.slice().sort((left, right) => commandMatches(right, mode) - commandMatches(left, mode))
      for (const command of ordered) {
        runCommand(command)
        await sleep(60)
        if (pick(SELECTORS.panel)) break
      }
    }
    await waitFor(() => pick(SELECTORS.panel), 5000, 'the shell.overlay palette to open (Cmd/Ctrl+P or registered shortcut)')
    await ensureMode(mode)
  }

  async function setQuery(value) {
    const input = await waitFor(() => pick(SELECTORS.input), 5000, 'the palette search input')
    input.focus()
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      // contenteditable input (a possible redesign)
      input.textContent = value
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }))
    }
    return input
  }

  /** True while the palette is showing a search-in-flight affordance. */
  function searchBusy() {
    if (document.querySelector(
      '[data-dff-loading], [aria-busy="true"], ' +
      '[class*="spinner"], [class*="skeleton"], [class*="progress"]',
    )) return true
    const panel = pick(SELECTORS.panel)
    if (!panel) return false
    if (panel.querySelector('.dff-search-tail')) return true
    return /Searching…|正在搜索/.test(panel.innerText || '')
  }

  /**
   * Wait until the mocked search request has actually been issued and the
   * palette has left its busy state. Without this, an empty palette renders
   * "No matches" for one frame before the debounced request flips it to the
   * skeleton, and the screenshot would freeze that transient frame.
   */
  async function waitForSearchSettled() {
    await waitFor(
      () => network.some((item) => item.path === '/dsh-file-finder/search-name' || item.path === '/dsh-file-finder/search-content'),
      5000,
      'the mocked search request to be issued',
    )
    await waitFor(() => !searchBusy(), 8000, 'the search to finish (busy affordance still visible)')
  }

  async function waitForResults(minimum) {
    await waitForSearchSettled()
    await waitFor(() => pickAll(SELECTORS.result).length >= minimum, 4000,
      `at least ${minimum} result rows (check the mock fetch / debounce)`)
    const selected = document.querySelector(
      '[data-dff-result].is-selected, [data-dff-result][aria-selected="true"], ' +
      '[data-dff-result][data-state="selected"], .dff-result.is-selected, .dff-result[aria-selected="true"]',
    )
    if (!selected) warn('no selected/highlighted result row was found')
    return pickAll(SELECTORS.result)
  }

  async function openFirstResult() {
    const input = pick(SELECTORS.input)
    const row = pick(SELECTORS.result)
    if (!row) throw new Error('no result row is available to open')
    row.click()
    try {
      await waitFor(() => pick(SELECTORS.editor), 2500, 'the editor view after clicking a result')
      return
    } catch { /* try keyboard activation */ }
    if (input) {
      input.focus()
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true,
      }))
    }
    await waitFor(() => pick(SELECTORS.editor), 3000, 'the editor view after pressing Enter on a result')
  }

  // -------------------------------------------------------------------------
  // Mounting
  // -------------------------------------------------------------------------
  function findSlotEntry(slotName) {
    return slotEntries.find((entry) => entry.slot === slotName) || null
  }

  async function waitForSlotEntry(slotName, timeout) {
    const started = performance.now()
    for (;;) {
      const entry = findSlotEntry(slotName)
      if (entry) return entry
      if (performance.now() - started > timeout) {
        throw new Error(`client.js did not register a component for slot "${slotName}"`)
      }
      await sleep(30)
    }
  }

  function setSurface(surface) {
    document.body.dataset.surface = surface
    root.dataset.previewSurface = surface
    document.getElementById('app-shell').hidden = surface !== 'app'
    document.getElementById('settings-shell').hidden = surface !== 'settings'
  }

  /**
   * Make the built-in editor dirty, then trigger a destructive action (back to
   * search) so the unsaved-changes confirmation banner is visible. Used by the
   * optional #editor-dirty state.
   */
  async function dirtyEditorAndConfirmBack() {
    const editor = await waitFor(() => pick(SELECTORS.editor), 3000, 'the editor for the dirty state')
    const draft = String(editor.value || editor.innerText || '') + '\n// preview harness: unsaved draft\n'
    editor.focus()
    if (editor instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      setter.call(editor, draft)
    } else {
      editor.textContent = draft
    }
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    await waitFor(
      () => document.querySelector('[data-state="dirty"]') ||
        /Unsaved|未保存/.test((pick(SELECTORS.panel) || {}).innerText || ''),
      3000,
      'the unsaved/dirty editor indicator',
    )

    const back = Array.from(document.querySelectorAll('button')).find((button) =>
      /back|返回/i.test(button.getAttribute('aria-label') || '') || /back|返回/i.test(button.title || ''))
    if (!back) throw new Error('editor "back to search" button not found; cannot open the confirm banner')
    back.click()
    await waitFor(() => {
      const banner = document.querySelector('.dff-banner, [data-dff-banner]')
      return banner && /unsaved changes|未保存的修改/i.test(banner.innerText || '')
    }, 3000, 'the unsaved-changes confirmation banner')
  }

  async function mountPalette() {
    setSurface('app')
    const entry = await waitForSlotEntry('shell.overlay', 1500)
    if (!entry || typeof entry.component !== 'function') {
      throw new Error('the shell.overlay slot did not register a renderable component')
    }
    const container = document.getElementById('overlay-root')
    const reactRoot = ReactDOM.createRoot(container)
    reactRoot.render(React.createElement(entry.component, {}))

    const mode = state === 'palette-content' ? 'content' : 'name'
    await openPalette(mode)

    if (captureAtOpen) return

    if (state === 'palette-browse') {
      await waitFor(
        () => document.querySelectorAll('[data-dff-browse]').length > 0 && Boolean(document.querySelector('[data-dff-crumbs]')),
        6000,
        'the directory listing in the empty-query palette',
      )
      return
    }

    if (state === 'browse-src') {
      await waitFor(
        () => document.querySelectorAll('[data-dff-browse]').length > 0 && Boolean(document.querySelector('[data-dff-crumbs]')),
        6000,
        'the directory listing in the empty-query palette',
      )
      const folder = Array.from(document.querySelectorAll('[data-dff-browse]'))
        .find((row) => /(^|\n)src($|\n)/.test(row.innerText || ''))
      if (!folder) throw new Error('browse-src: no src folder row')
      folder.click()
      await waitFor(
        () => /src/.test((document.querySelector('[data-dff-crumbs]') || {}).innerText || ''),
        5000,
        'the breadcrumb inside src',
      )
      return
    }

    if (state === 'palette-loading') {
      const query = 'parser'
      await setQuery(query)
      await waitFor(
        () => network.some((item) => item.path === '/dsh-file-finder/search-name' || item.path === '/dsh-file-finder/search-content'),
        5000,
        'the held search request (the mock deliberately never responds)',
      )
      const started = performance.now()
      try {
        await waitFor(() => {
          const panel = pick(SELECTORS.panel)
          const text = panel ? panel.innerText || '' : ''
          if (/Searching|正在搜索|Loading…|Loading\.\.\./i.test(text)) return true
          if (document.querySelector(
            '[data-dff-loading], [aria-busy="true"], [role="status"], ' +
            '.dff-spinner, .dff-skeleton, [class*="spinner"], [class*="skeleton"], [class*="loading"]',
          )) return true
          return false
        }, 2500, 'a loading affordance')
      } catch {
        warn('palette-loading: no textual/spinner loading affordance was detected; the shot still captures the pending state')
      }
      if (performance.now() - started < 60) await sleep(120)
      return
    }

    const query = state === 'palette-empty' ? 'zzzznomatch'
      : state === 'editor' || state === 'editor-dirty' || state === 'editor-find' ? 'index'
        : mode === 'content' ? 'parse' : 'index'
    await setQuery(query)

    if (state === 'palette-empty') {
      await waitForSearchSettled()
      await waitFor(() => {
        if (pickAll(SELECTORS.result).length) return false
        const panel = pick(SELECTORS.panel)
        const text = panel ? panel.innerText || '' : ''
        return /No matches|没有匹配结果|No results/i.test(text)
      }, 3000, 'the empty-state message after a query with no matches')
      return
    }

    if (state === 'viewer-html') {
      await setQuery('demo')
      await waitForResults(1)
      const target = pickAll(SELECTORS.result)[0]
      if (!target) throw new Error('viewer-html: no result row for the html fixture')
      target.click()
      await waitFor(
        () => document.querySelector('[data-dff-viewer] iframe'),
        6000,
        'the built-in HTML viewer',
      )
      return
    }

    if (state === 'viewer') {
      await setQuery('cover')
      await waitForResults(1)
      const target = pickAll(SELECTORS.result)[0]
      if (!target) throw new Error('viewer: no result row for the image fixture')
      target.click()
      await waitFor(
        () => document.querySelector('[data-dff-viewer] img'),
        6000,
        'the built-in image viewer',
      )
      return
    }

    if (state === 'editor' || state === 'editor-dirty' || state === 'editor-find') {
      await waitForResults(5)
      await openFirstResult()
      await waitFor(() => {
        const editor = pick(SELECTORS.editor)
        return editor && (editor.value || editor.innerText || '').trim().length > 40
      }, 4000, 'the editor to receive file text')
      if (state === 'editor-dirty') await dirtyEditorAndConfirmBack()
      if (state === 'editor-find') await openEditorFind('needle')
      return
    }

    await waitForResults(5)
  }


  /**
   * Open the built-in editor's in-file find and type a query, so the harness can
   * capture the find widget together with its match highlights.
   */
  async function openEditorFind(query) {
    const editor = pick(SELECTORS.editor)
    if (!editor) throw new Error('editor not found while opening in-file find')
    editor.focus()
    editor.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'f', code: 'KeyF', metaKey: true, bubbles: true, cancelable: true,
    }))
    const input = await waitFor(
      () => document.querySelector('[data-dff-find-input]'),
      2500,
      'the in-file find input',
    )
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, query)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await waitFor(
      () => document.querySelectorAll('.dff-editor-mirror mark.dff-find-hit').length > 0,
      2500,
      'the in-file find to highlight matches',
    )
  }

  async function mountSettings() {
    setSurface('settings')
    const entry = await waitForSlotEntry('settings.section', 1500)
    if (!entry || typeof entry.component !== 'function') {
      throw new Error('the settings.section slot did not register a renderable component')
    }
    const container = document.getElementById('settings-mount')
    const reactRoot = ReactDOM.createRoot(container)
    reactRoot.render(React.createElement(entry.component, { ctx, close() {} }))
    await waitFor(() => pick(SELECTORS.settings), 4000, 'the settings.section page to render')
  }

  async function settle() {
    try { await document.fonts.ready } catch { /* no webfonts in the harness */ }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await sleep(motion === 'off' ? 40 : 0)
  }

  async function markReady() {
    await settle()
    root.dataset.previewWarnings = JSON.stringify(warnings)
    root.dataset.previewConsoleErrors = JSON.stringify(consoleErrors)
    root.dataset.previewReady = '1'
  }

  function reportFailure(error) {
    const message = error && error.stack ? error.stack : String(error)
    root.dataset.previewError = message
    root.dataset.previewWarnings = JSON.stringify(warnings)
    root.dataset.previewConsoleErrors = JSON.stringify(consoleErrors)
    const box = document.getElementById('preview-error')
    if (box) {
      box.hidden = false
      box.textContent = message
    }
    console.error('[preview] could not mount the requested state:', error)
    root.dataset.previewReady = '1'
  }

  async function boot() {
    const moduleExports = window.__DFF_MODULE__
    if (!moduleExports || typeof moduleExports.apply !== 'function') {
      throw new Error('client.js did not expose an apply(ctx) export through window.__ModuleLoader__')
    }
    await moduleExports.apply(ctx)

    if (state === 'settings') await mountSettings()
    else await mountPalette()

    await markReady()
  }

  // Let the harness know which module IDs client.js asked for (diagnostics).
  window.__DFF_PREVIEW__ = {
    state,
    theme,
    lang,
    motion,
    warnings,
    consoleErrors,
    network,
    focused: () => focusedElement(),
  }

  boot().catch(reportFailure)
})()
