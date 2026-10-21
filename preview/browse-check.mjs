#!/usr/bin/env node
/**
 * Browser check for the empty-query directory browser and the Open-mode table.
 *
 * Serves the repository and mounts `preview/browse-check.html`, which opens the
 * palette against a fake workspace tree. It verifies that an empty query lists
 * the current directory, that folders sort first, that clicking, Enter/ArrowRight
 * and Backspace move between levels, that the breadcrumb follows, that typing
 * switches to search and clearing returns to the folder, and that opening a file
 * still lands in the editor.
 *
 * The fixture seeds the plugin's settings before mount and installs a recording
 * fake `sidebarRight` service, so the check also verifies which key asks for the
 * native preview. Short fixtures pin the Open-mode table — text × native /
 * viewer / editor × Enter and Cmd/Ctrl+Enter — plus the legacy `preview` value
 * and the fallback when the host has no right sidebar.
 *
 * A second matrix pins kind routing: images, video, audio, PDF, HTML and
 * Markdown open in the Viewer for both keys under every Open mode; Office,
 * archive and binary kinds go to the native preview when it exists, and fall
 * back to the Viewer's unsupported state with their own notice when it does
 * not.
 *
 *   node preview/browse-check.mjs
 *
 * Preview-only: not part of the published plugin.
 */
import { existsSync, createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(HERE, '..')
const THEME_CSS = resolve(HERE, 'theme.css')
const THEME_SCRIPT = resolve(HERE, 'extract-theme.mjs')

// The colour assertions compare real token values, so the DSH theme bundle has
// to be extracted first (the screenshot run does the same).
function ensureTheme() {
  if (existsSync(THEME_CSS)) return
  console.log('[setup] generating preview/theme.css from the installed DSH theme bundle')
  const result = spawnSync(process.execPath, [THEME_SCRIPT], { stdio: 'inherit', cwd: PROJECT_ROOT })
  if (result.status !== 0) throw new Error(`theme extraction failed (exit ${result.status})`)
}
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://preview.invalid')
      let pathname = decodeURIComponent(url.pathname)
      if (pathname.endsWith('/')) pathname += 'index.html'
      const filePath = resolve(PROJECT_ROOT, `.${pathname}`)
      if (filePath !== PROJECT_ROOT && !filePath.startsWith(`${PROJECT_ROOT}${sep}`)) {
        response.writeHead(403).end('forbidden')
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
      response.writeHead(404).end(`not found: ${request.url}`)
    }
  })
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', () => resolveListen({ server, port: server.address().port }))
  })
}

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
  throw new Error(`cannot resolve Playwright. Tried:\n  ${errors.join('\n  ')}`)
}

async function runFixture(browser, port, query) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 820 } })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(String(error && error.message ? error.message : error)))
  try {
    await page.goto(`http://127.0.0.1:${port}/preview/browse-check.html${query}`, {
      waitUntil: 'load',
      timeout: 30000,
    })
    await page.waitForFunction(() => Boolean(window.__BROWSE_CHECK__), undefined, { timeout: 25000 })
    const result = await page.evaluate(() => window.__BROWSE_CHECK__)
    return { result, pageErrors }
  } finally {
    await page.close()
  }
}

async function main() {
  ensureTheme()
  const { chromium } = loadPlaywright()
  const { server, port } = await startStaticServer()
  const browser = await chromium.launch({ headless: true })
  const failures = []
  let checks = 0
  const check = (name, ok, detail) => {
    checks += 1
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail === undefined || detail === null ? '' : ` — ${detail}`}`)
    if (!ok) failures.push(name)
  }
  try {
    // The main fixture drives browsing (seeded `editor` mode keeps Enter in the
    // writable editor). The short fixtures pin the Open-mode table: text × the
    // three modes × Enter and Cmd/Ctrl+Enter, the legacy `preview` value, the
    // fallback when DSH has no right sidebar, and the media/unsupported-kind
    // routing matrices.
    const fixtures = [
      { label: 'editor mode', query: '?openMode=editor' },
      { label: 'open matrix · native', query: '?openMode=native&scenario=open-matrix' },
      { label: 'open matrix · viewer', query: '?openMode=viewer&scenario=open-matrix' },
      { label: 'open matrix · editor', query: '?openMode=editor&scenario=open-matrix' },
      { label: 'media matrix · native', query: '?openMode=native&scenario=media-matrix' },
      { label: 'media matrix · viewer', query: '?openMode=viewer&scenario=media-matrix' },
      { label: 'media matrix · editor', query: '?openMode=editor&scenario=media-matrix' },
      { label: 'unsupported kinds · native available', query: '?openMode=viewer&scenario=other-native' },
      { label: 'unsupported kinds · native unavailable', query: '?openMode=viewer&sidebar=off&scenario=other-unavailable' },
      { label: 'legacy preview value', query: '?openMode=preview&scenario=legacy-preview-enter' },
      { label: 'native unavailable', query: '?openMode=native&sidebar=off&scenario=native-unavailable' },
      { label: 'native unavailable from editor mode', query: '?openMode=editor&sidebar=off&scenario=native-unavailable' },
    ]
    for (const fixture of fixtures) {
      const { result, pageErrors } = await runFixture(browser, port, fixture.query)
      const prefix = `${fixture.label}: `
      if (!result || !Array.isArray(result.results) || result.results.length === 0) {
        check(`${prefix}fixture produced results`, false, result && result.error)
      } else {
        for (const item of result.results) check(prefix + item.name, item.ok, item.detail)
      }
      if (result && result.error) check(`${prefix}fixture completed`, false, result.error)
      check(`${prefix}no page errors`, pageErrors.length === 0, pageErrors.join(' | '))
    }
  } finally {
    await browser.close()
    await new Promise((done) => server.close(done))
  }
  if (failures.length) {
    console.error(`\nBrowse mode check failed: ${failures.join(', ')}`)
    process.exitCode = 1
  } else {
    console.log(`\nBrowse mode check passed (${checks} checks)`)
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error)
  process.exitCode = 1
})
