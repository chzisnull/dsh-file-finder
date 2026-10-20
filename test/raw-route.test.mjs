// Exercises the read-only byte route the built-in viewer uses for images,
// video, audio, PDFs and HTML previews, with a fake filesystem and response.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { fileKindOf, parseRange, serveRaw } from '../index.js'

const ROOT = '/workspace'
const FILES = new Map([
  [`${ROOT}/logo.png`, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])],
  [`${ROOT}/page.html`, Buffer.from('<!doctype html><html><body><h1>hi</h1></body></html>')],
  [`${ROOT}/plain.txt`, Buffer.from('plain text')],
])

function fakeContext(sizes = {}) {
  return {
    fs: {
      async resolve(value) {
        const normalized = path.posix.normalize(String(value))
        return { targetKey: normalized, displayPath: normalized }
      },
      contains(parent, child) {
        return child.targetKey === parent.targetKey || child.targetKey.startsWith(`${parent.targetKey}/`)
      },
      async stat(target) {
        if (!FILES.has(target.targetKey)) return undefined
        return { type: 'file', size: sizes[target.targetKey] ?? FILES.get(target.targetKey).length, version: '1' }
      },
      async readBytes(target) {
        return FILES.get(target.targetKey)
      },
      async readByteRange(target, range) {
        return FILES.get(target.targetKey).subarray(range.offset, range.offset + range.length)
      },
      processPath(target) {
        return target.displayPath
      },
    },
  }
}

function fakeResponse() {
  const headers = {}
  return {
    statusCode: 200,
    headers,
    body: null,
    ended: false,
    setHeader(name, value) { headers[String(name).toLowerCase()] = value },
    end(body) { this.ended = true; this.body = body === undefined ? null : body },
  }
}

function tokenFor(value) {
  return Buffer.from(value).toString('base64url')
}

async function call(url, options = {}) {
  const response = fakeResponse()
  const request = { method: options.method || 'GET', url, headers: options.headers || {} }
  await serveRaw(fakeContext(options.sizes), request, response)
  return response
}

test('parseRange understands open, bounded and suffix ranges', () => {
  assert.deepEqual(parseRange('bytes=2-5', 10), { start: 2, end: 5 })
  assert.deepEqual(parseRange('bytes=4-', 10), { start: 4, end: 9 })
  assert.deepEqual(parseRange('bytes=-3', 10), { start: 7, end: 9 })
  assert.equal(parseRange('bytes=9-2', 10), 'invalid')
  assert.equal(parseRange('bytes=20-', 10), 'invalid')
  assert.equal(parseRange('items=0-1', 10), null)
})

test('the raw route serves bytes with the right type', async () => {
  const response = await call(`/dsh-file-finder/ws/${tokenFor(ROOT)}/logo.png`)
  assert.equal(response.statusCode, 200)
  assert.equal(response.headers['content-type'], 'image/png')
  assert.equal(response.headers['accept-ranges'], 'bytes')
  assert.equal(response.body.length, 12)
})

test('the raw route answers range requests with a bounded window', async () => {
  const response = await call(`/dsh-file-finder/ws/${tokenFor(ROOT)}/logo.png`, { headers: { range: 'bytes=0-3' } })
  assert.equal(response.statusCode, 206)
  assert.equal(response.headers['content-range'], 'bytes 0-3/12')
  assert.deepEqual([...response.body], [0x89, 0x50, 0x4e, 0x47])
})

test('the raw route rejects reversed and out-of-range windows', async () => {
  const response = await call(`/dsh-file-finder/ws/${tokenFor(ROOT)}/logo.png`, { headers: { range: 'bytes=99-' } })
  assert.equal(response.statusCode, 416)
  assert.equal(response.headers['content-range'], 'bytes */12')
})

test('the raw route refuses to leave the workspace', async () => {
  await assert.rejects(
    call(`/dsh-file-finder/ws/${tokenFor(ROOT)}/..%2Foutside.png`),
    /路径超出当前工作区/,
  )
})

test('the raw route refuses oversized full reads but keeps ranges', async () => {
  const huge = { [`${ROOT}/logo.png`]: 70 * 1024 * 1024 }
  const full = await call(`/dsh-file-finder/ws/${tokenFor(ROOT)}/logo.png`, { sizes: huge })
  assert.equal(full.statusCode, 413)
  const ranged = await call(`/dsh-file-finder/ws/${tokenFor(ROOT)}/logo.png`, { sizes: huge, headers: { range: 'bytes=0-9' } })
  assert.equal(ranged.statusCode, 206)
  assert.equal(ranged.headers['content-range'], 'bytes 0-9/73400320')
})

test('the raw route serves html as a sandbox-friendly document', async () => {
  const response = await call(`/dsh-file-finder/ws/${tokenFor(ROOT)}/page.html`)
  assert.equal(response.statusCode, 200)
  assert.match(String(response.headers['content-type']), /text\/html/)
  assert.match(String(response.body), /<h1>hi<\/h1>/)
})

test('served HTML carries the escape bridge and keeps a matching length', async () => {
  const response = await call(`/dsh-file-finder/ws/${tokenFor(ROOT)}/page.html`)
  const body = String(response.body)
  assert.match(body, /dsh-file-finder:escape/)
  // The forwarder is placed before the closing body tag.
  assert.ok(body.indexOf('dsh-file-finder:escape') < body.lastIndexOf('</body>'))
  assert.equal(Number(response.headers['content-length']), Buffer.from(body).length)
})

test('non-HTML bytes are served untouched', async () => {
  const response = await call(`/dsh-file-finder/ws/${tokenFor(ROOT)}/plain.txt`)
  assert.equal(response.statusCode, 200)
  assert.equal(String(response.body), 'plain text')
})

test('fileKindOf still routes the editor-facing kinds', () => {
  assert.equal(fileKindOf('a.png'), 'image')
  assert.equal(fileKindOf('a.md'), 'markdown')
  assert.equal(fileKindOf('a.ts'), 'text')
})
