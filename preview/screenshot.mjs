#!/usr/bin/env node
/**
 * Standalone visual harness for dsh-file-finder.
 *
 *   node preview/screenshot.mjs          capture every state in light + dark
 *   node preview/screenshot.mjs --serve  serve the harness for manual browsing
 *
 * The runner:
 *  1. regenerates preview/theme.css from the installed DSH theme bundle;
 *  2. self-heals preview/vendor/*.js from the local React 18.3.1 UMD builds;
 *  3. serves the repository root (so /preview/* and /client.js are same-origin)
 *     with a tiny Node static server;
 *  4. drives Chromium through Playwright, one page per state, and fails loudly
 *     when a required selector is missing or the PNG is empty;
 *  5. writes preview/shots/<state>-<theme>.png plus a manifest for review.
 *
 * Preview-only: nothing here ships with the plugin.
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { extname, dirname, join, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(HERE, '..')
const SHOTS_DIR = join(HERE, 'shots')
const THEME_SCRIPT = join(HERE, 'extract-theme.mjs')
const CLIENT_FILE = join(PROJECT_ROOT, 'client.js')
const THEME_SUFFIX = 'node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js'
const THEME_SOURCE = process.env.DSH_THEME_FILE ||
  join(homedir(), '.nvm/versions/node', process.version, 'lib', THEME_SUFFIX)
const DEVICE_SCALE_FACTOR = 2
const NAV_TIMEOUT = 30000
const READY_TIMEOUT = 30000

const MAIN_VIEWPORT = { width: 1440, height: 900 }
const SETTINGS_VIEWPORT = { width: 1100, height: 760 }

/** Required captures. Each writes <key>-<theme>.png. */
const CAPTURES = [
  { key: 'palette-name', hash: 'palette-name', viewport: MAIN_VIEWPORT },
  { key: 'palette-content', hash: 'palette-content', viewport: MAIN_VIEWPORT },
  { key: 'palette-browse', hash: 'palette-browse', viewport: MAIN_VIEWPORT },
  { key: 'palette-empty', hash: 'palette-empty', viewport: MAIN_VIEWPORT },
  { key: 'palette-loading', hash: 'palette-loading', viewport: MAIN_VIEWPORT },
  { key: 'editor', hash: 'editor', viewport: MAIN_VIEWPORT },
  { key: 'editor-dirty', hash: 'editor-dirty', viewport: MAIN_VIEWPORT },
  { key: 'editor-find', hash: 'editor-find', viewport: MAIN_VIEWPORT },
  { key: 'settings', hash: 'settings', viewport: SETTINGS_VIEWPORT },
  { key: 'settings-wide', hash: 'settings', viewport: MAIN_VIEWPORT },
  // Taller viewport so the whole settings page (all cards + reset footer) is
  // visible in one review image; the required 1100×760 shot is `settings`.
  { key: 'settings-tall', hash: 'settings', viewport: { width: 1100, height: 1480 } },
  // The session board: the counts at the sidebar foot, then the board itself.
  { key: 'session-region', hash: 'session-region', viewport: MAIN_VIEWPORT },
  { key: 'session-board', hash: 'session-board', viewport: MAIN_VIEWPORT },
  // Narrower viewport: the board stacks its three columns into one.
  { key: 'session-board-narrow', hash: 'session-board-narrow', viewport: { width: 1024, height: 860 } },
]

/** One extra frame captured with motion enabled, light theme only. */
const MOTION_CAPTURE = {
  key: 'palette-open-motion',
  hash: 'palette-name',
  viewport: MAIN_VIEWPORT,
  query: { motion: 'on', capture: 'open' },
  theme: 'light',
  optional: true,
}

const REQUIRED_KEYS = [
  'palette-name',
  'session-region',
  'session-board',
  'palette-content',
  'palette-browse',
  'palette-empty',
  'editor',
  'editor-dirty',
  'editor-find',
  'settings',
]

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

class HarnessError extends Error {}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
function runThemeExtractor() {
  const result = spawnSync(process.execPath, [THEME_SCRIPT], { stdio: 'inherit', cwd: PROJECT_ROOT })
  if (result.status !== 0) {
    throw new HarnessError(`theme extraction failed (exit ${result.status}); see the error above`)
  }
}

async function exists(path) {
  try {
    await access(path, fsConstants.R_OK)
    return true
  } catch {
    return false
  }
}

async function ensureVendor() {
  await mkdir(join(HERE, 'vendor'), { recursive: true })
  const entries = [
    {
      file: 'react.development.js',
      env: 'REACT_DEVELOPMENT_FILE',
      candidates: [
        process.env.REACT_DEVELOPMENT_FILE,
        join(PROJECT_ROOT, 'node_modules/react/umd/react.development.js'),
        join(homedir(), '.dsh/local-plugins/dsh-workbench/node_modules/react/umd/react.development.js'),
        '/usr/local/lib/node_modules/react/umd/react.development.js',
        '/opt/homebrew/lib/node_modules/react/umd/react.development.js',
      ],
    },
    {
      file: 'react-dom.development.js',
      env: 'REACT_DOM_DEVELOPMENT_FILE',
      candidates: [
        process.env.REACT_DOM_DEVELOPMENT_FILE,
        join(PROJECT_ROOT, 'node_modules/react-dom/umd/react-dom.development.js'),
        join(homedir(), '.dsh/local-plugins/dsh-workbench/node_modules/react-dom/umd/react-dom.development.js'),
        '/usr/local/lib/node_modules/react-dom/umd/react-dom.development.js',
        '/opt/homebrew/lib/node_modules/react-dom/umd/react-dom.development.js',
      ],
    },
  ]
  for (const entry of entries) {
    const destination = join(HERE, 'vendor', entry.file)
    if (await exists(destination)) continue
    const source = entry.candidates.find(Boolean)
    let copied = false
    for (const candidate of entry.candidates.filter(Boolean)) {
      if (await exists(candidate)) {
        await copyFile(candidate, destination)
        console.log(`[setup] copied ${entry.file} from ${candidate}`)
        copied = true
        break
      }
    }
    if (!copied) {
      throw new HarnessError(
        `missing preview/vendor/${entry.file}. Set ${entry.env} to a local React 18.3.1 UMD build. ` +
        `Tried: ${entry.candidates.filter(Boolean).join(', ')} (first candidate was ${source})`,
      )
    }
  }
}

async function readClientFingerprint() {
  const { readFile } = await import('node:fs/promises')
  const hash = createHash('sha256')
  hash.update(await readFile(CLIENT_FILE))
  const info = await stat(CLIENT_FILE)
  return { sha256: hash.digest('hex'), bytes: info.size, mtime: info.mtime.toISOString() }
}

// ---------------------------------------------------------------------------
// Static server
// ---------------------------------------------------------------------------
function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://preview.invalid')
      let pathname = decodeURIComponent(url.pathname)
      if (pathname.endsWith('/')) pathname += 'index.html'
      const filePath = resolve(PROJECT_ROOT, `.${pathname}`)
      if (filePath !== PROJECT_ROOT && !filePath.startsWith(`${PROJECT_ROOT}${sep}`)) {
        response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
        response.end('forbidden')
        return
      }
      const info = await stat(filePath)
      if (!info.isFile()) throw new Error('not a file')
      response.writeHead(200, {
        'content-type': MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
        'content-length': info.size,
      })
      createReadStream(filePath).pipe(response)
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(`not found: ${request.url}`)
    }
  })
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', () => {
      resolveListen({ server, port: server.address().port })
    })
  })
}

// ---------------------------------------------------------------------------
// Playwright resolution (global install, no network and no package installs)
// ---------------------------------------------------------------------------
function loadPlaywright() {
  const require = createRequire(import.meta.url)
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright',
    join(homedir(), '.nvm/versions/node', process.version, 'lib/node_modules/playwright'),
    '/usr/local/lib/node_modules/playwright',
    '/opt/homebrew/lib/node_modules/playwright',
  ].filter(Boolean)
  const errors = []
  for (const candidate of candidates) {
    try {
      return require(candidate)
    } catch (error) {
      errors.push(`${candidate}: ${error.code || error.message}`)
    }
  }
  throw new HarnessError(
    'cannot resolve Playwright. Run with NODE_PATH="$(npm root -g)" ' +
    `or set PLAYWRIGHT_MODULE. Tried:\n  ${errors.join('\n  ')}`,
  )
}

// ---------------------------------------------------------------------------
// In-page metrics and per-state validation
// ---------------------------------------------------------------------------
function collectInfo() {
  const pick = (selectors) => {
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element) return element
    }
    return null
  }
  const pickAll = (selectors) => {
    for (const selector of selectors) {
      const list = Array.from(document.querySelectorAll(selector))
      if (list.length) return list
    }
    return []
  }
  const panel = pick(['[data-dff-palette]', '.dff-panel'])
  const input = pick(['[data-dff-input]', '.dff-input'])
  const results = pickAll(['[data-dff-result]', '.dff-result'])
  // Browse rows reuse the result styling, so only the search hook counts here.
  const resultRows = pickAll(['[data-dff-result]'])
  const editor = pick(['[data-dff-editor]', '.dff-editor', 'textarea.dff-editor'])
  const settings = pick(['[data-dff-settings]', '.dff-page'])
  const selected = results.find((element) =>
    element.matches('.is-selected, [aria-selected="true"], [data-state="selected"], [data-selected="true"]') ||
    element.getAttribute('aria-selected') === 'true')
  const markedMode = pick([
    '[data-dff-mode][aria-selected="true"]',
    '[data-dff-mode].is-selected',
    '[data-dff-mode][data-state="active"]',
    '[data-dff-mode][aria-checked="true"]',
  ])
  const selectedTab = pick(['.dff-tab[aria-selected="true"]', '.dff-tab.is-selected', '[role="tab"][aria-selected="true"]'])
  let mode = panel ? panel.getAttribute('data-dff-mode') : null
  if (mode !== 'name' && mode !== 'content') {
    const value = markedMode ? markedMode.getAttribute('data-dff-mode') : null
    mode = value === 'name' || value === 'content' ? value : null
  }
  if (!mode && selectedTab) mode = /content|内容/i.test(selectedTab.textContent || '') ? 'content' : 'name'

  const rectOf = (element) => {
    if (!element) return null
    const box = element.getBoundingClientRect()
    return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) }
  }
  const text = panel ? panel.innerText : document.body.innerText
  const banner = pick(['.dff-banner', '[data-dff-banner]'])
  return {
    hasPanel: Boolean(panel),
    panelCount: document.querySelectorAll('[data-dff-palette], .dff-panel').length,
    hasInput: Boolean(input),
    resultCount: resultRows.length,
    browseCount: document.querySelectorAll('[data-dff-browse]').length,
    hasCrumbs: Boolean(document.querySelector('[data-dff-crumbs]')),
    hasSelectedResult: Boolean(selected),
    hasEditor: Boolean(editor),
    hasFind: Boolean(document.querySelector('[data-dff-find]')),
    findMarks: document.querySelectorAll('.dff-editor-mirror mark.dff-find-hit').length,
    editorLength: editor ? String(typeof editor.value === 'string' ? editor.value : editor.innerText || '').length : 0,
    hasSettings: Boolean(settings),
    dirtyState: Boolean(document.querySelector('[data-state="dirty"]')),
    hasConfirmBanner: Boolean(banner),
    confirmBannerText: banner ? banner.innerText : '',
    hasRegion: Boolean(document.querySelector('[data-dff-region]')),
    regionPills: document.querySelectorAll('.dff-region-pill').length,
    hasBoard: Boolean(document.querySelector('[data-dff-board]')),
    boardCols: document.querySelectorAll('[data-dff-board-col]').length,
    boardRows: document.querySelectorAll('[data-dff-board-row]').length,
    boardRect: rectOf(document.querySelector('[data-dff-board]')),
    headingCount: document.querySelectorAll('h1, h2, h3').length,
    controlCount: document.querySelectorAll('button, input, select, textarea').length,
    mode,
    text,
    bodyText: document.body.innerText,
    loadingSignal: Boolean(document.querySelector(
      '[data-dff-loading], [aria-busy="true"], [role="status"], ' +
      '.dff-spinner, .dff-skeleton, [class*="spinner"], [class*="skeleton"], [class*="loading"]',
    )),
    panelRect: rectOf(panel),
    settingsRect: rectOf(settings),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    documentOverflowX: document.documentElement.scrollWidth - window.innerWidth,
  }
}

function validateState(stateKey, info, pushWarning) {
  const fail = (message) => { throw new HarnessError(message) }
  const requirePaletteShell = () => {
    if (!info.hasPanel) {
      fail('palette panel not found. Expected [data-dff-palette] or .dff-panel. ' +
        'The registrations are mounted, so this points at the component or the open shortcut.')
    }
    if (!info.hasInput) {
      fail('palette search input not found. Expected [data-dff-input] or .dff-input.')
    }
  }

  switch (stateKey) {
    case 'palette-open': {
      requirePaletteShell()
      break
    }
    case 'palette-name': {
      requirePaletteShell()
      if (info.resultCount < 5) fail(`expected at least 5 name-result rows, found ${info.resultCount}`)
      if (info.mode && info.mode !== 'name') fail(`palette is in "${info.mode}" mode, expected "name"`)
      if (!info.mode) pushWarning('could not confirm the active search mode from the DOM')
      if (!info.hasSelectedResult) pushWarning('no highlighted/selected result row is visible')
      break
    }
    case 'palette-content': {
      requirePaletteShell()
      if (info.resultCount < 5) fail(`expected at least 5 content-result rows, found ${info.resultCount}`)
      if (info.mode && info.mode !== 'content') fail(`palette is in "${info.mode}" mode, expected "content"`)
      if (!info.mode) pushWarning('could not confirm the active search mode from the DOM')
      if (!info.hasSelectedResult) pushWarning('no highlighted/selected result row is visible')
      break
    }
    case 'palette-browse': {
      requirePaletteShell()
      if (info.resultCount !== 0) fail(`expected no search-result rows in browse mode, found ${info.resultCount}`)
      if (info.browseCount < 3) fail(`expected at least 3 browsable entries, found ${info.browseCount}`)
      if (!info.hasCrumbs) fail('the directory breadcrumb is missing from the empty-query palette')
      const browseText = `${info.text}\n${info.bodyText}`
      if (/No matches|没有匹配结果/.test(browseText)) fail('browse palette renders the no-match copy')
      break
    }
    case 'palette-empty': {
      requirePaletteShell()
      if (info.resultCount !== 0) fail(`expected an empty result list, found ${info.resultCount} rows`)
      if (!/No matches|没有匹配结果|No results/i.test(`${info.text}\n${info.bodyText}`)) {
        fail('empty-state message not found. Expected the noResult dictionary text ("No matches" / "没有匹配结果").')
      }
      break
    }
    case 'palette-loading': {
      requirePaletteShell()
      if (info.resultCount !== 0) fail(`expected no result rows while the mock request is pending, found ${info.resultCount}`)
      if (!info.loadingSignal && !/Searching|正在搜索|Loading/i.test(`${info.text}\n${info.bodyText}`)) {
        pushWarning('no loading affordance matched (aria-busy/status/spinner/"Searching…")')
      }
      break
    }
    case 'editor-dirty': {
      if (!info.hasEditor) fail('editor not found for the dirty state')
      if (info.editorLength < 40) fail(`editor looks empty (text length ${info.editorLength})`)
      if (!info.dirtyState && !/Unsaved|未保存/.test(info.text)) {
        fail('the editor is not marked dirty (no "Unsaved" state)')
      }
      if (!info.hasConfirmBanner || !/unsaved changes|未保存的修改/i.test(info.confirmBannerText)) {
        fail('the unsaved-changes confirmation banner is missing after a destructive action')
      }
      break
    }
    case 'editor': {
      // The editor replaces the search view: the panel stays, the search input
      // and result rows do not. Only the panel and the editor must be present.
      if (!info.hasPanel && !info.hasEditor) {
        fail('neither the palette panel nor the editor is present')
      }
      if (!info.hasEditor) fail('editor not found. Expected [data-dff-editor] or .dff-editor.')
      if (info.editorLength < 40) fail(`editor looks empty (text length ${info.editorLength})`)
      break
    }
    case 'editor-find': {
      if (!info.hasEditor) fail('editor not found for the in-file find shot')
      if (!info.hasFind) fail('find widget not found. Expected [data-dff-find].')
      if (info.findMarks < 1) fail(`no match highlight was rendered (found ${info.findMarks})`)
      break
    }
    case 'session-region': {
      if (!info.hasRegion) fail('the session counts did not render in the sidebar foot')
      if (info.regionPills !== 3) fail(`expected three count pills, found ${info.regionPills}`)
      if (info.hasBoard) fail('the board must stay closed for the region shot')
      break
    }
    case 'session-board':
    case 'session-board-narrow': {
      if (!info.hasRegion) fail('the session counts did not render in the sidebar foot')
      if (!info.hasBoard) fail('the session board did not open on the shortcut')
      if (info.boardCols !== 3) fail(`expected three board columns, found ${info.boardCols}`)
      if (info.boardRows < 8) fail(`board looks empty (${info.boardRows} rows)`)
      if (info.documentOverflowX > 2) fail('the board overflows horizontally')
      break
    }
    case 'settings': {
      if (!info.hasSettings) fail('settings page not found. Expected [data-dff-settings] or .dff-page.')
      if (!/File Finder|文件查找/.test(info.bodyText)) {
        fail('settings title text not found (expected "File Finder" / "文件查找")')
      }
      if (info.headingCount < 2) pushWarning(`only ${info.headingCount} heading(s) on the settings page`)
      if (info.controlCount < 4) pushWarning(`only ${info.controlCount} interactive controls on the settings page`)
      break
    }
    default:
      fail(`unknown preview state "${stateKey}"`)
  }

  if (info.documentOverflowX > 2) {
    pushWarning(`document overflows horizontally by ${info.documentOverflowX}px`)
  }
  if (info.panelRect) {
    const { x, y, width, height } = info.panelRect
    if (x < -1 || y < -1 || x + width > info.viewport.width + 1 || y + height > info.viewport.height + 1) {
      pushWarning(`palette panel is partially outside the viewport (${JSON.stringify(info.panelRect)})`)
    }
  }
}

function inspectPng(buffer, viewport) {
  if (!buffer || buffer.length < 8) throw new HarnessError('screenshot buffer is empty')
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new HarnessError('screenshot is not a PNG')
  }
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  if (!width || !height) throw new HarnessError('PNG has zero dimensions')
  const expectedWidth = viewport.width * DEVICE_SCALE_FACTOR
  const expectedHeight = viewport.height * DEVICE_SCALE_FACTOR
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new HarnessError(`PNG is ${width}x${height}, expected ${expectedWidth}x${expectedHeight}`)
  }
  if (buffer.length < 20000) {
    // A blank 2880×1800 frame compresses to only a few KiB; real UI shots of
    // this harness are >150 KiB. This is a cheap "did anything render?" guard.
    throw new HarnessError(`PNG is suspiciously small (${buffer.length} bytes); the page may have rendered blank`)
  }
  return { width, height, bytes: buffer.length }
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------
async function captureState({ page, baseUrl, spec, theme, consoleErrors, pageErrors, failedRequests }) {
  const query = spec.query || {}
  const url = new URL(`${baseUrl}/preview/index.html`)
  url.searchParams.set('theme', theme)
  url.searchParams.set('motion', query.motion || 'off')
  url.searchParams.set('lang', 'en')
  if (query.capture) url.searchParams.set('capture', query.capture)
  url.hash = spec.hash

  page.setDefaultTimeout(NAV_TIMEOUT)
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message))
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.url()} (${request.failure()?.errorText || 'failed'})`)
  })

  await page.goto(url.toString(), { waitUntil: 'load', timeout: NAV_TIMEOUT })

  try {
    await page.waitForSelector('html[data-preview-ready="1"]', { state: 'attached', timeout: READY_TIMEOUT })
  } catch {
    const pageTitle = await page.title().catch(() => '?')
    throw new HarnessError(
      `the harness never signalled ready (title "${pageTitle}"). ` +
      `page errors: ${pageErrors.join(' | ') || 'none'}; ` +
      `failed requests: ${failedRequests.join(' | ') || 'none'}`,
    )
  }

  const mountError = await page.getAttribute('html', 'data-preview-error')
  if (mountError) {
    throw new HarnessError(`mount failed: ${mountError.split('\n').slice(0, 12).join('\n')}`)
  }

  const warnings = await page.evaluate(() => {
    try { return JSON.parse(document.documentElement.dataset.previewWarnings || '[]') } catch { return [] }
  })
  const pluginConsoleErrors = await page.evaluate(() => {
    try { return JSON.parse(document.documentElement.dataset.previewConsoleErrors || '[]') } catch { return [] }
  })

  // Let fonts, React effects and any final layout settle.
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((done) => {
    requestAnimationFrame(() => requestAnimationFrame(done))
  })))

  const info = await page.evaluate(collectInfo)
  const pushWarning = (message) => warnings.push(message)
  const validationKey = query.capture === 'open'
    ? 'palette-open'
    : spec.key.startsWith('settings') ? 'settings' : spec.key
  validateState(validationKey, info, pushWarning)

  const buffer = await page.screenshot({
    type: 'png',
    animations: query.motion === 'on' ? 'allow' : 'disabled',
    caret: 'hide',
  })
  const png = inspectPng(buffer, spec.viewport)

  const unexpected = consoleErrors.filter((text) =>
    !/client-ui-primitives|falling back|\[preview\]/i.test(text))
  if (unexpected.length) warnings.push(`unexpected console error(s): ${unexpected.slice(0, 3).join(' | ')}`)
  if (pageErrors.length) warnings.push(`page error(s): ${pageErrors.slice(0, 3).join(' | ')}`)

  return {
    buffer,
    png,
    warnings,
    pluginConsoleErrors,
    mode: info.mode,
    resultCount: info.resultCount,
    panelRect: info.panelRect,
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function printTable(rows, failures) {
  const lines = []
  const header = ['STATE', 'THEME', 'PNG', 'SIZE', 'KB', 'STATUS']
  const widths = [24, 7, 34, 12, 8, 8]
  const format = (cells) => cells.map((cell, index) => String(cell).padEnd(widths[index])).join('  ')
  lines.push(format(header))
  lines.push(widths.map((width) => '─'.repeat(width)).join('  '))
  for (const row of rows) {
    lines.push(format([
      row.key,
      row.theme,
      `${row.key}-${row.theme}.png`,
      `${row.width}×${row.height}`,
      (row.bytes / 1024).toFixed(1),
      'ok',
    ]))
    for (const warning of row.warnings) lines.push(`    ! ${warning}`)
  }
  for (const failure of failures) {
    lines.push(format([failure.key, failure.theme, '—', '—', '—', 'FAILED']))
    lines.push(`    ✗ ${failure.message.split('\n')[0]}`)
  }
  console.log(`\n${lines.join('\n')}\n`)
  if (rows.length) {
    const totalKb = rows.reduce((sum, row) => sum + row.bytes, 0) / 1024
    console.log(`${rows.length} shot(s), ${totalKb.toFixed(1)} KiB total → ${SHOTS_DIR}`)
  }
}

async function main() {
  const args = new Set(process.argv.slice(2))
  if (args.has('--help') || args.has('-h')) {
    console.log('usage: node preview/screenshot.mjs [--serve] [--help]')
    return
  }

  console.log('[setup] regenerating preview/theme.css from the installed DSH theme bundle')
  runThemeExtractor()
  await ensureVendor()
  await mkdir(SHOTS_DIR, { recursive: true })

  const { server, port } = await startStaticServer()
  const baseUrl = `http://127.0.0.1:${port}`
  const clientFingerprint = await readClientFingerprint()

  if (args.has('--serve')) {
    console.log(`\n[serve] ${baseUrl}/preview/index.html?theme=light&motion=off#palette-name`)
    for (const themeName of ['light', 'dark']) {
      for (const spec of CAPTURES) {
        console.log(`        ${baseUrl}/preview/index.html?theme=${themeName}&motion=off#${spec.hash}`)
      }
    }
    console.log('\n[serve] Ctrl+C to stop')
    await new Promise((resolveStop) => {
      const stop = () => { server.close(resolveStop) }
      process.once('SIGINT', stop)
      process.once('SIGTERM', stop)
    })
    return
  }

  const playwright = loadPlaywright()
  const { chromium } = playwright
  console.log(`[setup] client.js sha256 ${clientFingerprint.sha256.slice(0, 16)}… (${clientFingerprint.bytes} bytes)`)
  console.log(`[setup] serving ${baseUrl}`)

  const browser = await chromium.launch({ headless: true })
  const rows = []
  const failures = []

  try {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport: MAIN_VIEWPORT,
        deviceScaleFactor: DEVICE_SCALE_FACTOR,
        colorScheme: theme,
        // Deterministic shots disable motion via ?motion=off + Playwright's
        // animations:'disabled'; the one motion frame needs the animation to
        // actually run, so the context must not force reduced motion.
        reducedMotion: 'no-preference',
      })
      const captures = [...CAPTURES]
      if (theme === 'light') captures.push(MOTION_CAPTURE)

      for (const spec of captures) {
        if (spec.theme && spec.theme !== theme) continue
        const consoleErrors = []
        const pageErrors = []
        const failedRequests = []
        const page = await context.newPage()
        try {
          await page.setViewportSize(spec.viewport)
          const capture = await captureState({
            page, baseUrl, spec, theme, consoleErrors, pageErrors, failedRequests,
          })
          const file = `${spec.key}-${theme}.png`
          await writeFile(join(SHOTS_DIR, file), capture.buffer)
          rows.push({
            key: spec.key,
            theme,
            file,
            ...capture.png,
            warnings: capture.warnings,
            pluginConsoleErrors: capture.pluginConsoleErrors,
            mode: capture.mode,
            resultCount: capture.resultCount,
            panelRect: capture.panelRect,
          })
          console.log(`[shot] ${file} — ${capture.png.width}×${capture.png.height}, ${(capture.png.bytes / 1024).toFixed(1)} KiB`)
        } catch (error) {
          failures.push({
            key: spec.key,
            theme,
            message: error instanceof Error ? error.message : String(error),
          })
          console.error(`[shot] FAILED ${spec.key}-${theme}: ${error instanceof Error ? error.message : error}`)
        } finally {
          await page.close().catch(() => {})
        }
      }
      await context.close()
    }
  } finally {
    await browser.close().catch(() => {})
    await new Promise((resolveClose) => server.close(resolveClose))
  }

  printTable(rows, failures)

  const capturedKeys = new Set(rows.map((row) => row.key))
  const missing = REQUIRED_KEYS.filter((key) => !capturedKeys.has(key))
  const clientAfter = await readClientFingerprint()
  const manifest = {
    generatedAt: new Date().toISOString(),
    clientJs: clientAfter,
    clientChangedDuringRun: clientAfter.sha256 !== clientFingerprint.sha256,
    themeSource: THEME_SOURCE,
    harness: { version: 1, deviceScaleFactor: DEVICE_SCALE_FACTOR, viewports: { main: MAIN_VIEWPORT, settings: SETTINGS_VIEWPORT } },
    shots: rows.map((row) => ({
      state: row.key,
      theme: row.theme,
      file: `shots/${row.file}`,
      width: row.width,
      height: row.height,
      bytes: row.bytes,
      searchMode: row.mode,
      resultRows: row.resultCount,
      panelRect: row.panelRect,
      warnings: row.warnings,
      pluginConsoleErrors: row.pluginConsoleErrors,
    })),
    failures,
    missingRequiredStates: missing,
  }
  await writeFile(join(SHOTS_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  if (clientAfter.sha256 !== clientFingerprint.sha256) {
    console.error('[warn] client.js changed while the screenshots were running; re-run for a coherent set')
  }
  if (missing.length) console.error(`[fail] missing required state(s): ${missing.join(', ')}`)
  if (failures.length) {
    console.error(`[fail] ${failures.length} capture(s) failed`)
    for (const failure of failures) console.error(`  ${failure.key}-${failure.theme}: ${failure.message}`)
  }
  if (failures.length || missing.length) {
    process.exitCode = 1
    return
  }
  console.log('[done] all required states rendered')
}

main().catch((error) => {
  console.error(`[fatal] ${error instanceof Error ? error.stack || error.message : error}`)
  process.exitCode = 1
})
