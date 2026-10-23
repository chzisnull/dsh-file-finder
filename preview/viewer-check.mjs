#!/usr/bin/env node
/**
 * Browser check for the built-in viewer in dsh-file-finder.
 *
 * Serves the repository and mounts `preview/viewer-check.html`, which drives the
 * palette against a fake workspace and opens a Markdown file, an image, an HTML
 * page, a video, a binary file and a script. It verifies the viewer picks the
 * right surface for each kind, that media goes through the raw route, that HTML
 * is sandboxed, that read-only kinds offer no Save, and that the desktop opener
 * follows the host's answer through its idle, opening, failed and hidden states.
 *
 *   node preview/viewer-check.mjs
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
    const page = await browser.newPage({ viewport: { width: 1200, height: 820 } })
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(String(error && error.message ? error.message : error)))
    await page.goto(`http://127.0.0.1:${port}/preview/viewer-check.html`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction(() => Boolean(window.__VIEWER_CHECK__), undefined, { timeout: 25000 })
    const result = await page.evaluate(() => window.__VIEWER_CHECK__)
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
    console.error(`\nViewer check failed: ${failures.join(', ')}`)
    process.exitCode = 1
  } else {
    console.log(`\nViewer check passed (${checks} checks)`)
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error)
  process.exitCode = 1
})
