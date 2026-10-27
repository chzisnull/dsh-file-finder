#!/usr/bin/env node
/**
 * Browser check for the session board in dsh-file-finder.
 *
 * Serves the repository and mounts `preview/session-board-check.html`, which
 * gives the plugin the three things it reads from DSH (`sessions.list`,
 * `uiSession.sessionStatus`, `workspaces.list`) and a fake `uiWorkspace`. It
 * verifies the counts, the state derivation (blank, subagent and archived rows
 * excluded), the ordering inside each column, the filtered open from a pill,
 * navigation through a row, the ⇧⌘G toggle, search, Escape, live updates, the
 * collapsed rail, and the two settings switches.
 *
 *   node preview/session-board-check.mjs
 *
 * Preview-only: not part of the published plugin.
 */
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(HERE, '..')
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


async function main() {
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
    const browserContext = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await browserContext.newPage()
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(String(error && error.message ? error.message : error)))
    await page.goto(`http://127.0.0.1:${port}/preview/session-board-check.html`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction(() => Boolean(window.__SESSION_BOARD_CHECK__), undefined, { timeout: 25000 })
    const result = await page.evaluate(() => window.__SESSION_BOARD_CHECK__)
    if (!result || !Array.isArray(result.results) || result.results.length === 0) {
      check('fixture produced results', false, result && result.error)
    } else {
      for (const item of result.results) check(item.name, item.ok, item.detail)
    }
    if (result && result.error) check('fixture completed', false, result.error)
    check('no page errors', pageErrors.length === 0, pageErrors.join(' | '))
    await page.screenshot({ path: 'preview/shots/session-board-check.png' }).catch(() => {})

    // The two settings switches, each on a fresh page so the seed applies.
    for (const [scenario, expectRegion, expectBoard] of [
      ['off', false, false],
      ['no-region', false, true],
      ['no-shortcut', true, false],
    ]) {
      const scoped = await browserContext.newPage()
      const scopedErrors = []
      scoped.on('pageerror', (error) => scopedErrors.push(String(error && error.message ? error.message : error)))
      await scoped.goto(`http://127.0.0.1:${port}/preview/session-board-check.html?settings=${scenario}`, { waitUntil: 'load', timeout: 30000 })
      await scoped.waitForFunction(() => Boolean(window.__SESSION_BOARD_CHECK__), undefined, { timeout: 25000 })
      const outcome = await scoped.evaluate(() => ({
        region: Boolean(document.querySelector('[data-dff-region]')),
        board: Boolean(document.querySelector('[data-dff-board]')),
        error: (window.__SESSION_BOARD_CHECK__ || {}).error,
      }))
      check(`${scenario}: the count region ${expectRegion ? 'shows' : 'is hidden'}`, outcome.region === expectRegion, String(outcome.region))
      await scoped.keyboard.press('Meta+Shift+G')
      await new Promise((resolve) => setTimeout(resolve, 260))
      const opened = await scoped.evaluate(() => Boolean(document.querySelector('[data-dff-board]')))
      check(`${scenario}: the shortcut ${expectBoard ? 'still opens the board' : 'is inert'}`, opened === expectBoard, String(opened))
      check(`${scenario}: no page errors`, scopedErrors.length === 0, scopedErrors.join(' | '))
      await scoped.close()
    }
    await browserContext.close()
  } finally {
    await browser.close()
    await new Promise((done) => server.close(done))
  }
  if (failures.length) {
    console.error(`\nSession board check failed: ${failures.join(', ')}`)
    process.exitCode = 1
  } else {
    console.log(`\nSession board check passed (${checks} checks)`)
  }
}

await main()
