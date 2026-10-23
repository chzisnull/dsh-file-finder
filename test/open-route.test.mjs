// Exercises the Desktop opener: the workspace containment check, the
// executable-type refusal, the no-desktop answer, the path the host finally
// gives DSH's opener, and the two ways the agent must never reach it.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { Readable } from 'node:stream'
import {
  desktopOpenerCapability,
  fileKindOf,
  isBlockedForDesktopOpener,
  openWithDesktopOpener,
  readFile,
} from '../index.js'

const ROOT = '/workspace'

const plugin = await import('../index.js')

function targetOf(value) {
  const normalized = path.posix.normalize(String(value))
  return { targetKey: normalized, displayPath: normalized }
}

const CONTENTS = new Map([
  [`${ROOT}/notes.md`, '# Notes\n'],
  [`${ROOT}/page.html`, '<!doctype html><h1>hi</h1>'],
  [`${ROOT}/install.command`, '#!/bin/sh\necho hi\n'],
])

function fakeContext(options = {}) {
  const calls = []
  const controller = {
    canOpenWorkspacePath() {
      return options.openable === false ? false : true
    },
    async openWorkspacePath(request) {
      calls.push(request)
      return { opened: true }
    },
  }
  const ctx = {
    fs: {
      async resolve(value) { return targetOf(value) },
      contains(parent, child) {
        return child.targetKey === parent.targetKey || child.targetKey.startsWith(`${parent.targetKey}/`)
      },
      async stat(target) {
        if (!CONTENTS.has(target.targetKey)) return undefined
        return { type: 'file', size: CONTENTS.get(target.targetKey).length, version: '1' }
      },
      async readText(target) { return CONTENTS.get(target.targetKey) },
      processPath(target) { return target.displayPath },
    },
    get(name) {
      if (name !== 'sessionController') return undefined
      if (options.controller === 'missing') return undefined
      return controller
    },
  }
  return { ctx, calls }
}

function fakeResponse() {
  return {
    statusCode: 200,
    headers: {},
    writableEnded: false,
    body: null,
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value },
    end(body) { this.writableEnded = true; this.body = body === undefined ? null : body },
    on() {},
  }
}

function fakeRequest(body) {
  const stream = Readable.from([Buffer.from(JSON.stringify(body))])
  stream.method = 'POST'
  stream.headers = { 'content-type': 'application/json' }
  return stream
}

/** Capture the registered routes and the agent tool from one apply(). */
function registeredPlugin(ctx) {
  const routes = new Map()
  const tools = []
  const host = {
    // The real plugin context carries the filesystem alongside the web server.
    fs: ctx.fs,
    effect(callback) { callback(); return () => {} },
    get(name) { return ctx.get(name) },
    webServer: {
      register(spec) {
        routes.set(spec.path, spec.handler)
        return () => {}
      },
    },
    tools: { register(spec) { tools.push(spec); return () => {} } },
  }
  plugin.apply(host)
  return { routes, tools }
}

test('the system opener is not offered to the agent tool', () => {
  const { tools } = registeredPlugin(fakeContext().ctx)
  const tool = tools.find((spec) => spec.name === 'file_finder')
  assert.ok(tool, 'the file_finder tool is registered')
  const actions = tool.parameters.properties.action.enum
  assert.equal(actions.includes('open'), false, 'an agent must not launch a desktop application')
  assert.ok(actions.includes('read'), 'the read action stays available')
})

test('the agent cannot reach the opener even by naming the action', async () => {
  const { tools } = registeredPlugin(fakeContext().ctx)
  const tool = tools.find((spec) => spec.name === 'file_finder')
  await assert.rejects(
    () => tool.execute({ action: 'open', root: ROOT, path: `${ROOT}/notes.md` }, { agent: {}, signal: new AbortController().signal }),
    /agent/,
  )
})

test('the route hands an ordinary file to the desktop opener', async () => {
  const { ctx, calls } = fakeContext()
  const { routes } = registeredPlugin(ctx)
  const response = fakeResponse()
  await routes.get('/dsh-file-finder/open')(fakeRequest({ root: ROOT, path: `${ROOT}/notes.md` }), response)
  assert.equal(response.statusCode, 200)
  assert.deepEqual(JSON.parse(response.body), { ok: true, path: `${ROOT}/notes.md` })
  assert.deepEqual(calls, [{ path: `${ROOT}/notes.md` }])
})

test('the route answers an executable type with the refusal code', async () => {
  const { ctx, calls } = fakeContext()
  const { routes } = registeredPlugin(ctx)
  const response = fakeResponse()
  await routes.get('/dsh-file-finder/open')(fakeRequest({ root: ROOT, path: `${ROOT}/install.command` }), response)
  const value = JSON.parse(response.body)
  assert.equal(value.ok, false)
  assert.equal(value.code, 'denied')
  assert.deepEqual(calls, [])
})

test('an ordinary file is handed to the desktop opener by its host path', async () => {
  const { ctx, calls } = fakeContext()
  const value = await openWithDesktopOpener(ctx, ROOT, `${ROOT}/notes.md`, new AbortController().signal)
  assert.deepEqual(value, { ok: true, path: `${ROOT}/notes.md` })
  assert.deepEqual(calls, [{ path: `${ROOT}/notes.md` }])
})

test('a path outside the workspace never reaches the desktop', async () => {
  const { ctx, calls } = fakeContext()
  await assert.rejects(
    () => openWithDesktopOpener(ctx, ROOT, '/elsewhere/notes.md'),
    (error) => error.code === 'outside',
  )
  assert.deepEqual(calls, [])
})

test('an executable type is refused instead of being run', async () => {
  const { ctx, calls } = fakeContext()
  await assert.rejects(
    () => openWithDesktopOpener(ctx, ROOT, `${ROOT}/install.command`),
    (error) => error.code === 'denied',
  )
  assert.deepEqual(calls, [])
})

test('a host without a desktop opener reports that instead of failing silently', async () => {
  for (const options of [{ controller: 'missing' }, { openable: false }]) {
    const { ctx, calls } = fakeContext(options)
    await assert.rejects(
      () => openWithDesktopOpener(ctx, ROOT, `${ROOT}/page.html`),
      (error) => error.code === 'no-desktop',
    )
    assert.deepEqual(calls, [])
  }
})

test('a missing file is not opened', async () => {
  const { ctx, calls } = fakeContext()
  await assert.rejects(
    () => openWithDesktopOpener(ctx, ROOT, `${ROOT}/gone.md`),
    (error) => error.code === 'not-file',
  )
  assert.deepEqual(calls, [])
})

test('the capability answer carries both rules the panel needs', () => {
  const able = desktopOpenerCapability(fakeContext().ctx)
  assert.equal(able.canOpen, true)
  assert.ok(Array.isArray(able.blockedExtensions))
  for (const extension of ['command', 'app', 'exe', 'jar', 'sh']) {
    assert.ok(able.blockedExtensions.includes(extension), `${extension} must stay blocked`)
  }
  // The browser list follows the host platform: DSH only forces the browser on
  // macOS, so the panel must not promise one elsewhere.
  assert.ok(Array.isArray(able.browserExtensions))
  if (process.platform === 'darwin') {
    for (const extension of ['html', 'htm', 'svg']) assert.ok(able.browserExtensions.includes(extension))
  } else {
    assert.deepEqual(able.browserExtensions, [])
  }
  assert.equal(desktopOpenerCapability(fakeContext({ openable: false }).ctx).canOpen, false)
})

test('the blocked list is applied by extension, case-insensitively', () => {
  assert.equal(isBlockedForDesktopOpener('/w/install.command'), true)
  assert.equal(isBlockedForDesktopOpener('/w/Tool.EXE'), true)
  assert.equal(isBlockedForDesktopOpener('/w/bundle.app'), true)
  assert.equal(isBlockedForDesktopOpener('/w/notes.md'), false)
  assert.equal(isBlockedForDesktopOpener('/w/archive.zip'), false)
})

test('the read answer no longer has to carry a per-file capability', async () => {
  const { ctx } = fakeContext()
  const value = await readFile(ctx, ROOT, `${ROOT}/page.html`)
  assert.equal(value.kind, fileKindOf('page.html'))
  assert.equal('canOpen' in value, false, 'the panel applies the capability list from roots')
})
