// Host-side contract tests for cross-restart session activity.
//
// These exercise the public HTTP route the panel uses (`POST
// /dsh-file-finder/session-activity`) through fake request/response objects,
// with a durable per-record storage double that validates every stored value
// with the real zod schema the plugin declares. A "restart" is a new host
// opening the same directory, not a fresh in-memory map.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

import {
  SESSION_ACTIVITY_DOMAIN,
  SESSION_ACTIVITY_READ_LIMIT,
} from '../activity.js'
import * as plugin from '../index.js'

const ROUTE = '/dsh-file-finder/session-activity'

// ── A storage-domain double with the documented public shape ───────────────
// It is intentionally a real per-record store (one JSON document per key) so
// the persistence assertions test the plugin's durable write path rather than
// a shared Map that survives a "restart" by accident. Every read and write
// goes through the plugin's real zod schema.
function createFakeStorage(root, options = {}) {
  const spec = SESSION_ACTIVITY_DOMAIN
  const domainDir = join(root, spec.name, 'records')
  let opened = false
  let openCount = 0
  let closeCount = 0

  return {
    get openCount() { return openCount },
    get closeCount() { return closeCount },
    async open(incoming) {
      if (options.failOpen) {
        throw Object.assign(new Error('backend unavailable'), { code: 'backend-unavailable' })
      }
      if (options.gate) await options.gate
      if (opened) throw Object.assign(new Error('already open'), { code: 'already-open' })
      if (!incoming || incoming.name !== spec.name) {
        throw new Error('the plugin opened an unexpected domain')
      }
      opened = true
      openCount += 1
      const records = new Map()
      let names = []
      try {
        names = await readdir(domainDir)
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error
      }
      for (const name of names) {
        if (!name.endsWith('.json')) continue
        const key = decodeURIComponent(name.slice(0, -5))
        const raw = JSON.parse(await readFile(join(domainDir, name), 'utf8'))
        try {
          records.set(key, spec.tables.records.valueSchema.parse(raw))
        } catch (error) {
          throw Object.assign(new Error(`invalid stored record ${key}`), { code: 'invalid-record', cause: error })
        }
      }

      let closed = false
      const assertOpen = () => {
        if (closed) throw Object.assign(new Error('domain closed'), { code: 'closed' })
      }
      const table = {
        get(key) {
          assertOpen()
          if (options.failGet) throw Object.assign(new Error('read failed'), { code: 'read-failed' })
          return records.get(key)
        },
        entries() {
          assertOpen()
          return records.entries()
        },
        async put(key, value) {
          assertOpen()
          if (options.failPut) throw Object.assign(new Error('disk full'), { code: 'write-failed' })
          const parsed = spec.tables.records.valueSchema.parse(value)
          await mkdir(domainDir, { recursive: true })
          const target = join(domainDir, `${encodeURIComponent(key)}.json`)
          const temporary = `${target}.${process.pid}.tmp`
          await writeFile(temporary, JSON.stringify(parsed), 'utf8')
          await rename(temporary, target)
          records.set(key, parsed)
        },
      }
      return {
        name: spec.name,
        table(name) {
          if (name !== 'records') throw new Error(`unknown table ${name}`)
          return table
        },
        async close() {
          if (closed) return
          closed = true
          opened = false
          closeCount += 1
        },
      }
    },
  }
}

// ── Fake Cordis host ────────────────────────────────────────────────────────
function session(id, parentSession) {
  return {
    id,
    header: { id, ...(parentSession === undefined ? {} : { parentSession }) },
  }
}

function createHost(options = {}) {
  const routes = new Map()
  const tools = []
  const listeners = new Map()
  const rootDisposers = []
  const scopeDisposers = []
  const warnings = []
  const sessions = options.sessions || []
  const sessionMap = new Map(sessions.map((item) => [item.id, item]))
  const storage = options.storage
    || createFakeStorage(options.storageRoot || '', options.storageOptions)
  const query = options.query || {
    calls: 0,
    readCalls: 0,
    async listSessions() {
      this.calls += 1
      return [...sessionMap.values()].map((item) => ({
        header: item.header,
        live: true,
        persisted: false,
      }))
    },
    async readSession() {
      this.readCalls += 1
      throw new Error('history scanning is outside the first version')
    },
  }
  const connection = options.connection === null
    ? undefined
    : (options.connection || {
      requestRejection() {
        return options.rejection
      },
    })

  tools.register = (spec) => {
    tools.push(spec)
    return () => {}
  }
  const host = {
    routes,
    tools,
    listeners,
    warnings,
    fs: {},
    sessions: {
      get(id) { return sessionMap.get(id) },
      list() { return [...sessionMap.values()] },
    },
    sessionQuery: options.query === null ? undefined : query,
    storageDomain: options.noStorage ? undefined : storage,
    storage,
    query,
    connection,
    webServer: {
      register(spec) {
        if (routes.has(spec.path)) throw new Error(`duplicate route ${spec.path}`)
        routes.set(spec.path, spec)
        return () => routes.delete(spec.path)
      },
    },
    get(name) {
      if (name === 'connection') return this.connection
      if (name === 'sessionQuery') return this.sessionQuery
      if (name === 'storageDomain') return this.storageDomain
      if (name === 'sessions') return this.sessions
      return undefined
    },
    effect(callback) {
      const disposer = callback()
      if (typeof disposer === 'function') rootDisposers.push(disposer)
      return disposer || (() => {})
    },
    on(event, listener) {
      const set = listeners.get(event) || new Set()
      set.add(listener)
      listeners.set(event, set)
      return () => set.delete(listener)
    },
    logger: {
      warn(...args) { warnings.push(args) },
      error(...args) { warnings.push(args) },
    },
    inject(dependencies, callback) {
      host.injectCallback = callback
      const available = dependencies.every((name) => host.get(name) !== undefined)
      if (!available) {
        host.injectReady = null
        return Promise.resolve()
      }
      const scope = {
        get(name) { return host.get(name) },
        effect(inner) {
          const disposer = inner()
          if (typeof disposer === 'function') scopeDisposers.push(disposer)
          return disposer || (() => {})
        },
        on(event, listener) { return host.on(event, listener) },
        logger: host.logger,
      }
      host.injectReady = Promise.resolve(callback(scope))
      return host.injectReady
    },
    emitSessionEvent(target, event) {
      for (const listener of listeners.get('session/event') || []) listener(target, event)
    },
    async remount() {
      if (!host.injectCallback) throw new Error('the plugin never asked for storageDomain')
      const scope = {
        get(name) { return host.get(name) },
        effect(inner) {
          const disposer = inner()
          if (typeof disposer === 'function') scopeDisposers.push(disposer)
          return disposer || (() => {})
        },
        on(event, listener) { return host.on(event, listener) },
        logger: host.logger,
      }
      await host.injectCallback(scope)
    },
    async unmountStorage() {
      const pending = scopeDisposers.splice(0).reverse()
      for (const dispose of pending) await dispose()
    },
    async dispose() {
      for (const dispose of rootDisposers.splice(0).reverse()) await dispose()
      await host.unmountStorage()
      routes.clear()
      listeners.clear()
    },
  }
  return host
}

function fakeResponse() {
  return {
    statusCode: 200,
    headers: {},
    writableEnded: false,
    body: null,
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value },
    end(body) {
      this.writableEnded = true
      this.body = body === undefined ? null : String(body)
    },
    on() {},
  }
}

function fakeRequest(body, method = 'POST') {
  const payload = body === undefined
    ? []
    : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]
  const stream = Readable.from(payload)
  stream.method = method
  stream.headers = { 'content-type': 'application/json' }
  return stream
}

async function call(host, body, method = 'POST') {
  const route = host.routes.get(ROUTE)
  assert.ok(route, 'the session-activity route is registered')
  const response = fakeResponse()
  await route.handler(fakeRequest(body, method), response)
  return {
    status: response.statusCode,
    value: response.body === null ? null : JSON.parse(response.body),
  }
}

async function withClock(run, initial = 0) {
  const original = Date.now
  let current = initial
  Date.now = () => current
  try {
    return await run({
      set(value) { current = value },
      get() { return current },
      advance(by) { current += by },
    })
  } finally {
    Date.now = original
  }
}

async function temporaryRoot(t) {
  const path = await mkdtemp(join(tmpdir(), 'dff-session-activity-'))
  t.after(() => rm(path, { recursive: true, force: true }))
  return path
}

// ── The durable form ───────────────────────────────────────────────────────
test('the durable domain is a real zod per-record table holding no message body', () => {
  assert.equal(SESSION_ACTIVITY_DOMAIN.name, 'file_finder_session_activity')
  assert.equal(SESSION_ACTIVITY_DOMAIN.version, 1)
  assert.equal(SESSION_ACTIVITY_DOMAIN.layout, 'per-record')
  assert.equal(SESSION_ACTIVITY_READ_LIMIT, 200)

  const schema = SESSION_ACTIVITY_DOMAIN.tables.records.valueSchema
  assert.equal(typeof schema.parse, 'function')
  assert.equal(typeof schema.safeParse, 'function')
  assert.deepEqual(Object.keys(schema.shape).sort(), ['activityAt', 'visitedAt'])
  assert.equal(schema.safeParse({ activityAt: 1, visitedAt: 2 }).success, true)
  assert.equal(
    schema.safeParse({ activityAt: 1, visitedAt: 2, text: 'secret' }).success,
    false,
    'strict records must reject any body-shaped extra field',
  )
})

// ── Routing and the agent tool boundary ────────────────────────────────────
test('the session-activity route is registered but is not an agent tool action', async () => {
  const host = createHost({ sessions: [session('s1')] })
  plugin.apply(host)

  assert.ok(host.routes.has(ROUTE))
  assert.equal(host.routes.get(ROUTE).kind, 'exact')
  assert.ok(host.routes.has('/dsh-file-finder/roots'), 'the original routes stay registered')

  const tool = host.tools.find((item) => item.name === 'file_finder')
  assert.ok(tool, 'the original tool stays registered')
  const actions = tool.parameters.properties.action.enum
  assert.equal(actions.includes('session-activity'), false)
  assert.equal(actions.includes('sessionActivity'), false)
  assert.equal(actions.includes('visit'), false)

  await host.dispose()
})

test('the new route fails closed when the connection service is missing', async () => {
  const host = createHost({ sessions: [session('s1')], connection: null })
  plugin.apply(host)
  const answer = await call(host, { action: 'visit', id: 's1' })
  assert.equal(answer.status, 503)
  assert.equal(answer.value.ok, false)
  assert.equal(answer.value.code, 'connection-unavailable')
  await host.dispose()
})

test('a rejected non-owner connection never reaches authorization or storage', async () => {
  for (const status of [401, 403]) {
    const host = createHost({ sessions: [session('s1')], rejection: status })
    plugin.apply(host)
    const callsBefore = host.query.calls
    const answer = await call(host, { action: 'read', ids: ['s1'] })
    assert.equal(answer.status, status)
    assert.equal(answer.value.ok, false)
    assert.equal(answer.value.code, status === 403 ? 'forbidden' : 'unauthorized')
    assert.equal(host.query.calls, callsBefore, 'authorization was not consulted')
    await host.dispose()
  }
})

test('the route only accepts POST', async () => {
  const host = createHost({ sessions: [session('s1')] })
  plugin.apply(host)
  const answer = await call(host, undefined, 'GET')
  assert.equal(answer.status, 405)
  assert.equal(answer.value.code, 'method-not-allowed')
  await host.dispose()
})

// ── Visits ─────────────────────────────────────────────────────────────────
test('a cold persisted session can be visited and the host clock wins', async (t) => {
  const root = await temporaryRoot(t)
  const host = createHost({
    storageRoot: root,
    sessions: [],
    query: {
      calls: 0,
      readCalls: 0,
      async listSessions() {
        this.calls += 1
        return [{ header: { id: 'cold' }, live: false, persisted: true }]
      },
      async readSession() {
        this.readCalls += 1
        throw new Error('history scanning is outside the first version')
      },
    },
  })
  plugin.apply(host)
  await host.injectReady

  await withClock(async (clock) => {
    clock.set(1000)
    const visited = await call(host, {
      action: 'visit',
      id: 'cold',
      visitedAt: 9_999_999,
      activityAt: 8_888_888,
      at: 7_777_777,
      time: 6_666_666,
    })
    assert.deepEqual(visited.value, { ok: true, visitedAt: 1000 })

    const read = await call(host, { action: 'read', ids: ['cold'] })
    assert.deepEqual(read.value, {
      ok: true,
      records: { cold: { activityAt: 0, visitedAt: 1000 } },
    })
  })

  assert.equal(host.query.readCalls, 0, 'the first version never scans message history')
  await host.dispose()
})

test('a visit to an id the authoritative corpus does not list is refused', async () => {
  const host = createHost({
    sessions: [session('s1')],
    query: {
      calls: 0,
      async listSessions() {
        this.calls += 1
        return []
      },
    },
  })
  plugin.apply(host)
  await host.injectReady
  const answer = await call(host, { action: 'visit', id: 's1' })
  assert.equal(answer.value.ok, false)
  assert.equal(answer.value.code, 'not-found')
  await host.dispose()
})

// ── Activity rollup ────────────────────────────────────────────────────────
test('key events roll up through parentSession and never persist a body', async (t) => {
  const root = await temporaryRoot(t)
  const parent = session('p')
  const child = session('c', 'p')
  const grandchild = session('g', 'c')
  const host = createHost({ storageRoot: root, sessions: [parent, child, grandchild] })
  plugin.apply(host)
  await host.injectReady

  await withClock(async (clock) => {
    clock.set(100)
    // A different object with the same id: resolution must use ids, not object identity.
    host.emitSessionEvent(
      { id: 'g', header: { id: 'g', parentSession: 'c' } },
      {
        type: 'assistant/message',
        data: {
          message: { role: 'assistant', content: [{ type: 'text', text: 'TOP SECRET' }] },
          usage: { inputTokens: 10, outputTokens: 20 },
        },
      },
    )

    let read = await call(host, { action: 'read', ids: ['p', 'c', 'g'] })
    for (const id of ['p', 'c', 'g']) {
      assert.deepEqual(read.value.records[id], { activityAt: 100, visitedAt: 0 })
    }

    clock.set(200)
    host.emitSessionEvent(child, {
      type: 'user/message',
      data: { content: [{ type: 'text', text: 'ANOTHER SECRET' }] },
    })
    read = await call(host, { action: 'read', ids: ['p'] })
    assert.deepEqual(read.value.records.p, { activityAt: 200, visitedAt: 0 })

    clock.set(300)
    for (const type of [
      'step/start', 'step/end', 'tool/call', 'tool/result',
      'assistant/attempt', 'llm/retry', 'request/header',
    ]) {
      host.emitSessionEvent(child, { type, data: { tokenUsage: 99 } })
    }
    read = await call(host, { action: 'read', ids: ['p'] })
    assert.equal(read.value.records.p.activityAt, 200, 'token and unrelated events do not bump activity')

    clock.set(400)
    host.emitSessionEvent(child, { type: 'turn/start', data: { turn: 1 } })
    clock.set(500)
    host.emitSessionEvent(child, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
    read = await call(host, { action: 'read', ids: ['p'] })
    assert.equal(read.value.records.p.activityAt, 500)
  })

  const domainDir = join(root, SESSION_ACTIVITY_DOMAIN.name, 'records')
  const files = await readdir(domainDir)
  assert.deepEqual(files, ['p.json'], 'one per-record document for the root session')
  const stored = await readFile(join(domainDir, files[0]), 'utf8')
  assert.equal(stored.includes('TOP SECRET'), false)
  assert.equal(stored.includes('ANOTHER SECRET'), false)
  assert.equal(stored.includes('tokenUsage'), false)
  assert.deepEqual(Object.keys(JSON.parse(stored)).sort(), ['activityAt', 'visitedAt'])

  assert.equal(host.query.readCalls, 0)
  await host.dispose()
})

test('parent chains handle cycles, self-parents and missing parents', async (t) => {
  const root = await temporaryRoot(t)
  const x = session('x', 'y')
  const y = session('y', 'x')
  const self = session('self', 'self')
  const orphan = session('o', 'ghost')
  const host = createHost({ storageRoot: root, sessions: [x, y, self, orphan] })
  plugin.apply(host)
  await host.injectReady

  await withClock(async (clock) => {
    clock.set(100)
    host.emitSessionEvent(x, { type: 'user/message', data: {} })

    let read = await call(host, { action: 'read', ids: ['x', 'y'] })
    assert.equal(read.value.records.x.activityAt, 100)
    assert.equal(read.value.records.y.activityAt, 100, 'both cycle members resolve to one root')

    clock.set(200)
    host.emitSessionEvent(self, { type: 'assistant/message', data: {} })
    read = await call(host, { action: 'read', ids: ['self'] })
    assert.equal(read.value.records.self.activityAt, 200)

    clock.set(300)
    host.emitSessionEvent(orphan, { type: 'turn/start', data: { turn: 1 } })
    read = await call(host, { action: 'read', ids: ['o', 'ghost'] })
    assert.equal(read.value.records.o.activityAt, 300)
    assert.equal(read.value.records.ghost, undefined, 'an unlisted ancestor is never exposed')
  })

  await host.dispose()
})

test('an event for a live but unauthorized session cannot be read or visited', async (t) => {
  const root = await temporaryRoot(t)
  const allowed = session('s1')
  const secret = session('secret')
  const host = createHost({
    storageRoot: root,
    sessions: [allowed, secret],
    query: {
      calls: 0,
      async listSessions() {
        this.calls += 1
        return [{ header: allowed.header, live: true, persisted: false }]
      },
    },
  })
  plugin.apply(host)
  await host.injectReady

  await withClock(async (clock) => {
    clock.set(100)
    host.emitSessionEvent(secret, { type: 'user/message', data: {} })
    const read = await call(host, { action: 'read', ids: ['s1', 'secret'] })
    assert.deepEqual(read.value.records, {}, 'the record exists but is filtered by authorization')
    const visit = await call(host, { action: 'visit', id: 'secret' })
    assert.equal(visit.value.ok, false)
    assert.equal(visit.value.code, 'not-found')
  })

  await host.dispose()
})

// ── Read limits and validation ─────────────────────────────────────────────
test('read is capped at 200 and returns only the requested ids', async (t) => {
  const root = await temporaryRoot(t)
  const sessions = ['s1', 's2', 's3'].map((id) => session(id))
  const host = createHost({ storageRoot: root, sessions })
  plugin.apply(host)
  await host.injectReady

  await withClock(async (clock) => {
    clock.set(100)
    await call(host, { action: 'visit', id: 's1' })
    clock.set(200)
    await call(host, { action: 'visit', id: 's2' })

    const read = await call(host, { action: 'read', ids: ['s1', 's3'] })
    assert.deepEqual(read.value.records, { s1: { activityAt: 0, visitedAt: 100 } })

    const tooMany = await call(host, {
      action: 'read',
      ids: Array.from({ length: SESSION_ACTIVITY_READ_LIMIT + 1 }, (_, index) => `id-${index}`),
    })
    assert.equal(tooMany.value.ok, false)
    assert.equal(tooMany.value.code, 'too-many')

    const exactly = await call(host, {
      action: 'read',
      ids: Array.from({ length: SESSION_ACTIVITY_READ_LIMIT }, (_, index) => `id-${index}`),
    })
    assert.equal(exactly.value.ok, true)
    assert.deepEqual(exactly.value.records, {})
  })

  await host.dispose()
})

test('malformed ids, actions, bodies and oversized requests are refused', async (t) => {
  const root = await temporaryRoot(t)
  const host = createHost({ storageRoot: root, sessions: [session('s1')] })
  plugin.apply(host)
  await host.injectReady

  const cases = [
    [{ action: 'read', ids: 's1' }, 'invalid-id'],
    [{ action: 'read', ids: [123] }, 'invalid-id'],
    [{ action: 'visit' }, 'invalid-id'],
    [{ action: 'visit', id: '' }, 'invalid-id'],
    [{ action: 'visit', id: 'x'.repeat(201) }, 'invalid-id'],
    [{ action: 'delete', id: 's1' }, 'unknown-action'],
    [{}, 'unknown-action'],
    [[], 'invalid-body'],
    ['not json', 'invalid-body'],
  ]
  for (const [body, code] of cases) {
    const answer = await call(host, body)
    assert.equal(answer.value.ok, false, JSON.stringify(body))
    assert.equal(answer.value.code, code, JSON.stringify(body))
  }

  const huge = JSON.stringify({
    action: 'read',
    ids: Array.from({ length: 300 }, (_, index) => `id-${index}-${'x'.repeat(300)}`),
  })
  const answer = await call(host, huge)
  assert.equal(answer.value.ok, false)
  assert.equal(answer.value.code, 'too-large')

  await host.dispose()
})

// ── Storage failures and degradation ──────────────────────────────────────
test('a missing storageDomain keeps the original plugin working and reports the loss', async () => {
  const host = createHost({ sessions: [session('s1')], noStorage: true })
  plugin.apply(host)

  assert.ok(host.routes.has('/dsh-file-finder/roots'))
  assert.ok(host.routes.has('/dsh-file-finder/session-activity'))
  assert.ok(host.tools.some((item) => item.name === 'file_finder'))

  const read = await call(host, { action: 'read', ids: ['s1'] })
  assert.equal(read.value.ok, false)
  assert.equal(read.value.code, 'storage-unavailable')
  const visit = await call(host, { action: 'visit', id: 's1' })
  assert.equal(visit.value.ok, false)
  assert.equal(visit.value.code, 'storage-unavailable')

  await host.dispose()
})

test('a host without ctx.inject still boots and reports storage unavailable', async () => {
  const host = createHost({ sessions: [session('s1')], noStorage: true })
  host.inject = undefined
  assert.doesNotThrow(() => plugin.apply(host))
  assert.ok(host.routes.has('/dsh-file-finder/roots'))
  const read = await call(host, { action: 'read', ids: ['s1'] })
  assert.equal(read.value.code, 'storage-unavailable')
  await host.dispose()
})

test('a storage open failure is reported rather than treated as an empty success', async () => {
  const host = createHost({
    sessions: [session('s1')],
    storageOptions: { failOpen: true },
  })
  plugin.apply(host)
  await host.injectReady

  const read = await call(host, { action: 'read', ids: ['s1'] })
  assert.equal(read.value.ok, false)
  assert.equal(read.value.code, 'storage-unavailable')
  const visit = await call(host, { action: 'visit', id: 's1' })
  assert.equal(visit.value.ok, false)
  assert.equal(visit.value.code, 'storage-unavailable')
  assert.ok(host.tools.some((item) => item.name === 'file_finder'))
  assert.ok(host.warnings.length > 0, 'the failure is logged, not swallowed silently')
  await host.dispose()
})

test('a storage read failure is reported instead of an empty success', async () => {
  const host = createHost({
    sessions: [session('s1')],
    storageOptions: { failGet: true },
  })
  plugin.apply(host)
  await host.injectReady

  const read = await call(host, { action: 'read', ids: ['s1'] })
  assert.equal(read.value.ok, false)
  assert.equal(read.value.code, 'storage-failed')
  await host.dispose()
})

test('a write that never lands is reported and never fabricated as a visit', async (t) => {
  const root = await temporaryRoot(t)
  const host = createHost({
    storageRoot: root,
    sessions: [session('s1')],
    storageOptions: { failPut: true },
  })
  plugin.apply(host)
  await host.injectReady

  const visit = await call(host, { action: 'visit', id: 's1' })
  assert.equal(visit.value.ok, false)
  assert.equal(visit.value.code, 'storage-failed')

  const read = await call(host, { action: 'read', ids: ['s1'] })
  assert.equal(read.value.ok, true)
  assert.deepEqual(read.value.records, {}, 'nothing durable is reported as a visit')

  await host.dispose()
})

// ── Restart, initialization and lifecycle ──────────────────────────────────
test('activity and visits survive a host restart', async (t) => {
  const root = await temporaryRoot(t)
  const sessions = [session('s1')]

  const first = createHost({ storageRoot: root, sessions })
  plugin.apply(first)
  await first.injectReady
  await withClock(async (clock) => {
    clock.set(111)
    await call(first, { action: 'visit', id: 's1' })
    clock.set(222)
    first.emitSessionEvent(sessions[0], { type: 'assistant/message', data: {} })
    await first.dispose()
  })

  const second = createHost({ storageRoot: root, sessions })
  plugin.apply(second)
  await second.injectReady
  const read = await call(second, { action: 'read', ids: ['s1'] })
  assert.deepEqual(read.value.records.s1, { activityAt: 222, visitedAt: 111 })
  assert.ok(second.warnings.every((entry) => !String(entry[0]).includes('open failed')))
  await second.dispose()
})

test('events emitted while storage is opening are not silently dropped', async (t) => {
  const root = await temporaryRoot(t)
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const host = createHost({
    storageRoot: root,
    sessions: [session('s1')],
    storageOptions: { gate },
  })
  plugin.apply(host)

  await withClock(async (clock) => {
    clock.set(777)
    host.emitSessionEvent(session('s1'), { type: 'user/message', data: {} })
    release()
    await host.injectReady
    const read = await call(host, { action: 'read', ids: ['s1'] })
    assert.equal(read.value.records.s1.activityAt, 777)
  })

  await host.dispose()
})

test('repeated initialization and shutdown release resources without races', async (t) => {
  const root = await temporaryRoot(t)
  const host = createHost({ storageRoot: root, sessions: [session('s1')] })
  plugin.apply(host)
  await host.injectReady
  assert.equal(host.storage.openCount, 1)
  assert.equal(host.listeners.get('session/event')?.size, 1)

  await withClock(async (clock) => {
    clock.set(100)
    await call(host, { action: 'visit', id: 's1' })

    await host.unmountStorage()
    assert.equal(host.storage.closeCount, 1)
    const unavailable = await call(host, { action: 'read', ids: ['s1'] })
    assert.equal(unavailable.value.code, 'storage-unavailable')

    await host.remount()
    await host.remount()
    assert.equal(host.storage.openCount, 2, 'a duplicate mount does not reopen the domain')

    clock.set(200)
    const visit = await call(host, { action: 'visit', id: 's1' })
    assert.equal(visit.value.visitedAt, 200)
    const read = await call(host, { action: 'read', ids: ['s1'] })
    assert.deepEqual(read.value.records.s1, { activityAt: 0, visitedAt: 200 })
  })

  await host.dispose()
  assert.equal(host.storage.closeCount, 2)
  assert.equal(host.listeners.get('session/event')?.size ?? 0, 0)
  assert.doesNotThrow(() => host.emitSessionEvent({ id: 's1' }, { type: 'user/message', data: {} }))
})

test('concurrent reads, visits and activity never move timestamps backwards', async (t) => {
  const root = await temporaryRoot(t)
  const host = createHost({ storageRoot: root, sessions: [session('s1')] })
  plugin.apply(host)
  await host.injectReady

  await withClock(async (clock) => {
    clock.set(500)
    await call(host, { action: 'visit', id: 's1' })

    clock.set(400)
    host.emitSessionEvent(session('s1'), { type: 'user/message', data: {} })
    let read = await call(host, { action: 'read', ids: ['s1'] })
    assert.equal(read.value.records.s1.visitedAt, 500)
    assert.equal(read.value.records.s1.activityAt, 400)

    clock.set(300)
    host.emitSessionEvent(session('s1'), { type: 'assistant/message', data: {} })
    clock.set(450)
    await call(host, { action: 'visit', id: 's1' })
    read = await call(host, { action: 'read', ids: ['s1'] })
    assert.equal(read.value.records.s1.activityAt, 400)
    assert.equal(read.value.records.s1.visitedAt, 500)

    clock.set(700)
    await Promise.all([
      call(host, { action: 'visit', id: 's1' }),
      Promise.resolve().then(() => {
        host.emitSessionEvent(session('s1'), { type: 'turn/start', data: { turn: 1 } })
      }),
      call(host, { action: 'read', ids: ['s1'] }),
    ])
    read = await call(host, { action: 'read', ids: ['s1'] })
    assert.ok(read.value.records.s1.activityAt >= 700)
    assert.ok(read.value.records.s1.visitedAt >= 700)
  })

  await host.dispose()
})
