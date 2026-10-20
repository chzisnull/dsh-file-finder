#!/usr/bin/env node
/**
 * Browser check for the syntax colours in the built-in editor.
 *
 * Serves the repository and mounts `preview/token-check.html`, which opens a
 * TypeScript, HTML, CSS, JSON and Markdown file against a fake workspace. It
 * verifies each family gets its own token colours, that the textarea keeps the
 * caret while its text is hidden behind the layer, that the coloured window
 * follows the scrollbar, that IME composition and in-file find temporarily
 * reveal the plain text, and that files over the 200 KB budget degrade.
 *
 *   node preview/token-check.mjs
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
    const page = await browser.newPage({ viewport: { width: 1200, height: 820 } })
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(String(error && error.message ? error.message : error)))
    await page.goto(`http://127.0.0.1:${port}/preview/token-check.html`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction(() => Boolean(window.__TOKEN_CHECK__), undefined, { timeout: 25000 })
    const result = await page.evaluate(() => window.__TOKEN_CHECK__)
    if (!result || !Array.isArray(result.results) || result.results.length === 0) {
      check('fixture produced results', false, result && result.error)
    } else {
      for (const item of result.results) check(item.name, item.ok, item.detail)
    }
    if (result && result.error) check('fixture completed', false, result.error)
    check('no page errors', pageErrors.length === 0, pageErrors.join(' | '))
    await page.close()
  } finally {
    await browser.close()
    await new Promise((done) => server.close(done))
  }
  if (failures.length) {
    console.error(`\nSyntax colour check failed: ${failures.join(', ')}`)
    process.exitCode = 1
  } else {
    console.log(`\nSyntax colour check passed (${checks} checks)`)
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error)
  process.exitCode = 1
})
