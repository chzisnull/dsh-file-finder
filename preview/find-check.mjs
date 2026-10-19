#!/usr/bin/env node
/**
 * Browser check for the built-in editor's line gutter and in-file find.
 *
 * Serves the repository, mounts the editor through the preview harness, and
 * verifies with Playwright that the gutter numbers match the file, that
 * Cmd/Ctrl+F opens the find widget, that matches are highlighted and counted,
 * that Enter/Shift+Enter move through them, that the case toggle and the
 * no-result state work, and that Escape closes the widget and returns focus.
 *
 *   node preview/find-check.mjs
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
  const failures = []
  let checks = 0
  const check = (name, ok, detail) => {
    checks += 1
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail === undefined ? '' : ` — ${detail}`}`)
    if (!ok) failures.push(name)
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 820 } })
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(String(error && error.message ? error.message : error)))
    await page.goto(`http://127.0.0.1:${port}/preview/index.html?theme=light&lang=zh#editor`, { waitUntil: 'load' })
    await page.waitForFunction(() => document.documentElement.dataset.previewReady === '1', undefined, { timeout: 30000 })
    await page.waitForSelector('[data-dff-editor]', { timeout: 10000 })

    const gutter = await page.evaluate(() => {
      const text = document.querySelector('[data-dff-gutter]')
      const editor = document.querySelector('[data-dff-editor]')
      return {
        present: Boolean(text),
        numbers: text ? text.textContent.trim().split('\n').length : 0,
        lines: editor ? editor.value.split('\n').length : 0,
        marker: Boolean(document.querySelector('.dff-line-marker')),
        firstNumber: text ? text.textContent.trim().split('\n')[0] : '',
      }
    })
    check('line gutter renders', gutter.present && gutter.marker, JSON.stringify(gutter))
    check('gutter numbers match the file', gutter.numbers === gutter.lines, `${gutter.numbers} vs ${gutter.lines}`)
    check('gutter starts at 1', gutter.firstNumber === '1', gutter.firstNumber)

    await page.locator('[data-dff-editor]').click()
    await page.keyboard.press('Meta+f')
    await page.waitForSelector('[data-dff-find]', { timeout: 5000 })
    check('Cmd/Ctrl+F opens in-file find', true)
    check('find input takes focus', await page.evaluate(() => document.activeElement === document.querySelector('[data-dff-find-input]')))

    await page.locator('[data-dff-find-input]').fill('needle')
    await page.waitForTimeout(250)
    const found = await page.evaluate(() => ({
      count: document.querySelector('[data-dff-find-count]').textContent,
      marks: document.querySelectorAll('.dff-editor-mirror mark.dff-find-hit').length,
      current: document.querySelectorAll('.dff-editor-mirror mark.is-current').length,
      markedText: [...document.querySelectorAll('.dff-editor-mirror mark')].map((node) => node.textContent),
    }))
    check('match count is shown', /^\d+\/\d+/.test(found.count), found.count)
    check('every match is highlighted', found.marks > 1, String(found.marks))
    check('exactly one current match', found.current === 1, String(found.current))
    check('highlights cover the query', found.markedText.every((text) => text === 'needle'), JSON.stringify(found.markedText.slice(0, 3)))

    const before = found.count
    await page.locator('[data-dff-find-input]').press('Enter')
    await page.waitForTimeout(150)
    const after = await page.locator('[data-dff-find-count]').textContent()
    check('Enter moves to the next match', before !== after, `${before} → ${after}`)
    await page.locator('[data-dff-find-input]').press('Shift+Enter')
    await page.waitForTimeout(150)
    const back = await page.locator('[data-dff-find-count]').textContent()
    check('Shift+Enter moves back', back === before, `${after} → ${back}`)

    await page.locator('[data-dff-find-case]').click()
    check('case toggle is pressed', (await page.locator('[data-dff-find-case]').getAttribute('aria-pressed')) === 'true')
    await page.locator('[data-dff-find-case]').click()

    await page.locator('[data-dff-find-input]').fill('ZZZ-not-here')
    await page.waitForTimeout(200)
    check('no-result state', (await page.locator('[data-dff-find-count]').textContent()) === '无结果')

    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    check('Escape closes find', (await page.locator('[data-dff-find]').count()) === 0)
    check('focus returns to the editor', await page.evaluate(() => document.activeElement === document.querySelector('[data-dff-editor]')))
    check('no page errors', pageErrors.length === 0, pageErrors.join(' | '))
    await page.close()

    if (failures.length) {
      console.error(`\nEditor find check failed: ${failures.join(', ')}`)
      process.exitCode = 1
    } else {
      console.log(`\nEditor find check passed (${checks} checks)`)
    }
  } finally {
    await browser.close()
    await new Promise((done) => server.close(done))
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error)
  process.exitCode = 1
})
