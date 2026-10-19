#!/usr/bin/env node
/**
 * Browser check for the optional DS Bot bridge in dsh-file-finder.
 *
 * Serves the repository, opens `preview/bot-check.html` twice — once with a
 * boot graph that includes DS Bot's client module and once without — and lets
 * the fixture drive the shortcut against DS Bot's real selectors. It verifies
 * that the command, the key handler and the settings card appear only when
 * DS Bot is part of the boot, and that the shortcut flips both directions.
 *
 *   node preview/bot-check.mjs
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
  let failed = false
  try {
    for (const variant of ['on', 'off']) {
      const page = await browser.newPage()
      const consoleErrors = []
      page.on('pageerror', (error) => consoleErrors.push(String(error && error.message ? error.message : error)))
      const response = await page.goto(`http://127.0.0.1:${port}/preview/bot-check.html?bot=${variant}`, {
        waitUntil: 'load',
        timeout: 30000,
      })
      if (!response || !response.ok()) throw new Error(`fixture did not load: ${response && response.status()}`)
      await page.waitForFunction(() => Boolean(window.__BOT_CHECK__), undefined, { timeout: 15000 })
      const result = await page.evaluate(() => window.__BOT_CHECK__)
      console.log(`\n[ds-bot ${variant}] ${result.passed ? 'PASS' : 'FAIL'}`)
      for (const item of result.results) console.log(`  ${item.ok ? 'ok  ' : 'FAIL'} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`)
      if (result.errors.length) console.log(`  errors: ${result.errors.join(' | ')}`)
      if (consoleErrors.length) console.log(`  page errors: ${consoleErrors.join(' | ')}`)
      if (!result.passed || consoleErrors.length) failed = true
      await page.close()
    }
  } finally {
    await browser.close()
    await new Promise((done) => server.close(done))
  }
  if (failed) {
    console.error('\nDS Bot bridge check failed')
    process.exitCode = 1
  } else {
    console.log('\nDS Bot bridge check passed')
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error)
  process.exitCode = 1
})
