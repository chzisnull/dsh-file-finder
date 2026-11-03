/**
 * Host-side session activity: one durable record per root session holding the
 * last activity and the last main-view visit.
 *
 * The durable form is a `ctx.storageDomain` domain in the `per-record` layout
 * (one document per session) with a real zod record schema. No message text,
 * token accounting, tool arguments or other event payload is ever stored: the
 * listener looks at `event.type` only.
 *
 * The panel reads and writes this through
 * `POST /dsh-file-finder/session-activity`; the route is registered in
 * `index.js` and is deliberately absent from the agent tool's action enum.
 */

import { z } from 'zod'

export const SESSION_ACTIVITY_TABLE = 'records'
export const SESSION_ACTIVITY_READ_LIMIT = 200
export const SESSION_ACTIVITY_BODY_LIMIT = 64 * 1024

const ID_LIMIT = 200
const MAX_PARENT_DEPTH = 64
const MAX_BUFFERED_SESSIONS = 4096
const MAX_SETTLE_ROUNDS = 32

/**
 * Key durable events. Everything else (`step/*`, `tool/*`,
 * `assistant/attempt`, `llm/retry`, token-only records) is deliberately
 * ignored: those are frequent, non-durable-looking signals that would make the
 * board jump without a real turn boundary.
 */
export const SESSION_ACTIVITY_EVENT_TYPES = new Set([
  'user/message',
  'assistant/message',
  'turn/start',
  'turn/end',
])

/**
 * The durable record. `strictObject` makes an accidental body-shaped field a
 * schema failure instead of a silently stripped field.
 */
const sessionActivityRecord = z.strictObject({
  activityAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  visitedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
})

/**
 * The domain declaration. It mirrors what `defineDomain`/`domainTable` build
 * (`{ name, version, layout, tables: { table: { valueSchema } } }`) without
 * importing `@deepseek-ai/dsh-storage-domain`: that package is a host peer, and
 * a plugin dependency on it would drag the host's storage/cordis peers into the
 * plugin install. `ctx.storageDomain.open()` accepts this spec shape directly.
 */
export const SESSION_ACTIVITY_DOMAIN = {
  name: 'file_finder_session_activity',
  version: 1,
  layout: 'per-record',
  tables: {
    [SESSION_ACTIVITY_TABLE]: { valueSchema: sessionActivityRecord },
  },
}

/** Stable failure surface for the HTTP handler. */
export class SessionActivityError extends Error {
  constructor(code, message, options) {
    super(message, options)
    this.name = 'SessionActivityError'
    this.code = code
  }
}

function unavailable(message = '活动记录存储不可用') {
  return new SessionActivityError('storage-unavailable', message)
}

function storageFailure(message, error) {
  return new SessionActivityError('storage-failed', message, error === undefined ? undefined : { cause: error })
}

function normalizeStamp(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : undefined
}

function sessionIdOf(session) {
  if (!session || typeof session !== 'object') return undefined
  if (typeof session.id === 'string' && session.id) return session.id
  const header = session.header
  if (header && typeof header === 'object' && typeof header.id === 'string' && header.id) {
    return header.id
  }
  return undefined
}

function headerOfSession(session) {
  const header = session && session.header
  return header && typeof header === 'object' ? header : undefined
}

/** Only a primitive string is an id; a boxed `new String(...)` is not. */
function parentIdOf(header) {
  if (!header || typeof header !== 'object') return undefined
  const parent = header.parentSession
  if (typeof parent !== 'string' || !parent || parent.length > ID_LIMIT) return undefined
  return parent
}

function validateId(id) {
  if (typeof id !== 'string' || !id || id.length > ID_LIMIT) {
    throw new SessionActivityError('invalid-id', '会话 id 不合法')
  }
  // Session ids come from the host, never from a browser form; reject control
  // characters so an id cannot be used to smuggle a line break into logs.
  if (/[\u0000-\u001f\u007f]/.test(id)) {
    throw new SessionActivityError('invalid-id', '会话 id 不合法')
  }
  return id
}

function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new SessionActivityError('invalid-body', '请求体必须是对象')
  }
  if (body.action === 'read') {
    if (!Array.isArray(body.ids)) {
      throw new SessionActivityError('invalid-id', 'ids 必须是数组')
    }
    if (body.ids.length > SESSION_ACTIVITY_READ_LIMIT) {
      throw new SessionActivityError(
        'too-many',
        `一次最多读取 ${SESSION_ACTIVITY_READ_LIMIT} 个会话`,
      )
    }
    const ids = []
    const seen = new Set()
    for (const value of body.ids) {
      const id = validateId(value)
      if (seen.has(id)) continue
      seen.add(id)
      ids.push(id)
    }
    return { action: 'read', ids }
  }
  if (body.action === 'visit') {
    return { action: 'visit', id: validateId(body.id) }
  }
  throw new SessionActivityError('unknown-action', '未知操作')
}

class SessionActivity {
  constructor(ctx) {
    this.ctx = ctx
    this.phase = 'idle'
    this.lastError = undefined
    this.lastWriteError = undefined
    this.domain = undefined
    this.table = undefined

    /** Authoritative headers from the latest session-query listing. */
    this.headers = new Map()
    /** Intended (possibly not yet durable) records, one per root session. */
    this.latest = new Map()
    /** Roots whose intended record differs from the last successful write. */
    this.dirty = new Set()
    /** Per-root visit promises waiting for the durable write. */
    this.waiters = new Map()
    /** Per-root in-flight write chain (coalescing, never a growing queue). */
    this.flushing = new Map()

    this.lifecycle = Promise.resolve()
    this.mountToken = 0
    this.disposed = false
    this.disposePromise = undefined
    this.refreshPromise = undefined
    this.listenerOff = undefined

    this.installListener()
  }

  // ── Optional service access ─────────────────────────────────────────────
  service(name) {
    try {
      if (typeof this.ctx.get === 'function') return this.ctx.get(name)
    } catch {
      /* an optional service lookup must never break the plugin */
    }
    try {
      return this.ctx[name]
    } catch {
      return undefined
    }
  }

  warn(message, error) {
    const line = `dsh-file-finder session activity: ${message}`
    try {
      if (this.ctx.logger && typeof this.ctx.logger.warn === 'function') {
        this.ctx.logger.warn(line, error)
        return
      }
    } catch {
      /* logging is best effort */
    }
    try {
      console.warn(line, error)
    } catch {
      /* nothing left to do */
    }
  }

  hostNow() {
    // The host clock is the ordering authority. No request field can supply a
    // timestamp: `validateRequest` never reads one.
    const number = Number(Date.now())
    if (!Number.isFinite(number) || number < 0) return 0
    return Math.trunc(number)
  }

  // ── Session event tracking ──────────────────────────────────────────────
  installListener() {
    if (typeof this.ctx.on !== 'function') return
    try {
      const off = this.ctx.on('session/event', (session, event) => {
        this.recordEvent(session, event)
      })
      if (typeof off === 'function') this.listenerOff = off
    } catch (error) {
      this.warn('could not observe session events', error)
    }
  }

  recordEvent(session, event) {
    try {
      if (this.disposed || this.phase === 'closed') return
      if (!event || typeof event.type !== 'string') return
      if (!SESSION_ACTIVITY_EVENT_TYPES.has(event.type)) return
      const id = sessionIdOf(session)
      if (!id) return
      const root = this.resolveRoot(id, headerOfSession(session))
      if (!root) return
      // `event.time` is deliberately not used: the host clock at receipt is
      // the ordering authority, and a queued event can carry an older stamp.
      const now = this.hostNow()
      void this.merge(root, (record) => {
        record.activityAt = Math.max(record.activityAt, now)
      })
    } catch (error) {
      // A session-event listener runs inside the session append path; it must
      // never turn into a host-wide failure.
      this.warn('event handling failed', error)
    }
  }

  // ── Root resolution ─────────────────────────────────────────────────────
  liveHeader(id) {
    const sessions = this.service('sessions')
    if (sessions && typeof sessions.get === 'function') {
      try {
        const session = sessions.get(id)
        if (session && session.header && typeof session.header === 'object') return session.header
      } catch {
        /* optional live lookup */
      }
    }
    const agents = this.service('agents')
    if (agents && typeof agents.get === 'function') {
      try {
        const agent = agents.get(id)
        const header = agent && agent.session && agent.session.header
        if (header && typeof header === 'object') return header
      } catch {
        /* optional agent lookup */
      }
    }
    return undefined
  }

  headerOf(id) {
    const live = this.liveHeader(id)
    if (live) return live
    const cached = this.headers.get(id)
    return cached && typeof cached === 'object' ? cached : undefined
  }

  /**
   * Walk `header.parentSession` to the root. The walk stops at the highest
   * known ancestor (a missing parent is data, not an error), breaks arbitrary
   * cycles, and returns one canonical member for every node of a cycle so a
   * read from either side lands on the same record.
   */
  resolveRoot(id, header) {
    const path = []
    const seen = new Set()
    let current = id
    let currentHeader = header && typeof header === 'object' ? header : this.headerOf(id)
    for (let depth = 0; depth < MAX_PARENT_DEPTH; depth += 1) {
      if (seen.has(current)) {
        const at = path.indexOf(current)
        const cycle = at >= 0 ? path.slice(at) : [current]
        return cycle.reduce((min, value) => (value < min ? value : min), cycle[0])
      }
      seen.add(current)
      path.push(current)
      const parent = parentIdOf(currentHeader)
      if (!parent || parent === current) break
      const parentHeader = this.headerOf(parent)
      if (!parentHeader) break
      current = parent
      currentHeader = parentHeader
    }
    return current
  }

  // ── Record merge and coalesced durable writes ───────────────────────────
  readTable(root) {
    if (!this.table) return undefined
    let record
    try {
      record = this.table.get(root)
    } catch (error) {
      throw storageFailure('读取活动记录失败', error)
    }
    if (!record || typeof record !== 'object') return undefined
    const activityAt = normalizeStamp(record.activityAt)
    const visitedAt = normalizeStamp(record.visitedAt)
    if (activityAt === undefined || visitedAt === undefined) return undefined
    return { activityAt, visitedAt }
  }

  merge(root, mutate, waitForDurability = false) {
    if (this.disposed) {
      if (waitForDurability) throw unavailable('活动记录服务已关闭')
      return Promise.resolve(undefined)
    }

    let base
    try {
      base = this.latest.get(root) || this.readTable(root) || { activityAt: 0, visitedAt: 0 }
    } catch (error) {
      if (waitForDurability) throw error
      this.warn(`could not read the existing record for "${root}"`, error)
      return Promise.resolve(undefined)
    }

    if (!this.latest.has(root) && this.latest.size >= MAX_BUFFERED_SESSIONS) {
      this.warn(`activity buffer is full (${MAX_BUFFERED_SESSIONS} sessions); dropping "${root}"`)
      if (waitForDurability) throw unavailable()
      return Promise.resolve(undefined)
    }

    const next = { activityAt: base.activityAt, visitedAt: base.visitedAt }
    mutate(next)
    next.activityAt = normalizeStamp(next.activityAt) ?? base.activityAt
    next.visitedAt = normalizeStamp(next.visitedAt) ?? base.visitedAt

    this.latest.set(root, next)
    this.dirty.add(root)

    if (this.phase !== 'ready' || !this.table) {
      if (waitForDurability) throw unavailable()
      return Promise.resolve(next)
    }

    let promise = Promise.resolve(next)
    if (waitForDurability) {
      promise = new Promise((resolve, reject) => {
        const list = this.waiters.get(root) || []
        list.push({ resolve, reject })
        this.waiters.set(root, list)
      })
    }
    void this.flush(root)
    return promise
  }

  flush(root) {
    const existing = this.flushing.get(root)
    if (existing) return existing

    const task = (async () => {
      let failed = false
      while (this.dirty.has(root)) {
        this.dirty.delete(root)
        const record = this.latest.get(root)
        if (!record || !this.table) break
        const batch = (this.waiters.get(root) || []).splice(0)
        try {
          await this.table.put(root, {
            activityAt: record.activityAt,
            visitedAt: record.visitedAt,
          })
          this.lastWriteError = undefined
          for (const waiter of batch) waiter.resolve({ ...record })
        } catch (error) {
          failed = true
          this.lastWriteError = error
          this.warn(`write for "${root}" failed`, error)
          const failure = storageFailure('活动记录未能写入存储', error)
          for (const waiter of batch) waiter.reject(failure)
          // A merge that landed during the failed write has its own waiter;
          // reject it too instead of leaving it pending forever.
          const pending = this.waiters.get(root) || []
          for (const waiter of pending.splice(0)) waiter.reject(failure)
          this.dirty.delete(root)
          break
        }
      }
      this.waiters.delete(root)
      if (!failed && !this.dirty.has(root)) this.latest.delete(root)
    })()

    this.flushing.set(root, task)
    task.then(
      () => {
        if (this.flushing.get(root) === task) this.flushing.delete(root)
      },
      () => {
        if (this.flushing.get(root) === task) this.flushing.delete(root)
      },
    )
    return task
  }

  async settle() {
    if (!this.table) return
    for (let round = 0; round < MAX_SETTLE_ROUNDS; round += 1) {
      for (const root of [...this.dirty]) void this.flush(root)
      const tasks = [...this.flushing.values()]
      if (tasks.length) {
        await Promise.allSettled(tasks)
        continue
      }
      if (!this.dirty.size) return
    }
  }

  // ── Authorization over the authoritative live + cold corpus ─────────────
  async authorize(ids, signal) {
    const query = this.service('sessionQuery')
    if (!query || typeof query.listSessions !== 'function') {
      throw new SessionActivityError(
        'auth-unavailable',
        '宿主会话查询不可用，无法校验会话是否真实存在',
      )
    }
    let listing
    try {
      listing = await query.listSessions(signal)
    } catch (error) {
      if (signal && signal.aborted) {
        throw new SessionActivityError('aborted', '请求已取消')
      }
      throw new SessionActivityError('auth-failed', '无法读取宿主会话列表', { cause: error })
    }
    const headers = new Map()
    if (Array.isArray(listing)) {
      for (const entry of listing) {
        const header = entry && entry.header ? entry.header : entry
        if (!header || typeof header !== 'object') continue
        if (typeof header.id !== 'string' || !header.id) continue
        headers.set(header.id, header)
      }
    }
    this.headers = headers
    return headers
  }

  // ── Public operations ───────────────────────────────────────────────────
  async whenReady() {
    try {
      await this.lifecycle
    } catch {
      /* the rejection is already logged by mount/unmount */
    }
    if (this.disposed || this.phase === 'closed') throw unavailable('活动记录服务已关闭')
    if (this.phase !== 'ready' || !this.table) throw unavailable()
  }

  async read(ids, headers, signal) {
    await this.whenReady()
    await this.settle()
    if (signal && signal.aborted) throw new SessionActivityError('aborted', '请求已取消')

    // Null prototype so a session id like "__proto__" cannot rewrite the
    // response object's prototype (session ids normally cannot be that, but the
    // route must not depend on it).
    const records = Object.create(null)
    for (const id of ids) {
      if (signal && signal.aborted) throw new SessionActivityError('aborted', '请求已取消')
      const header = headers.get(id)
      if (!header) continue
      const root = this.resolveRoot(id, header)
      let record
      try {
        record = this.table.get(root)
        if (record === undefined && root !== id) record = this.table.get(id)
      } catch (error) {
        throw storageFailure('读取活动记录失败', error)
      }
      if (!record || typeof record !== 'object') continue
      const activityAt = normalizeStamp(record.activityAt)
      const visitedAt = normalizeStamp(record.visitedAt)
      if (activityAt === undefined || visitedAt === undefined) {
        this.warn(`stored record for "${root}" is not readable activity data`)
        continue
      }
      records[id] = { activityAt, visitedAt }
    }
    return records
  }

  async visit(id, header) {
    await this.whenReady()
    const root = this.resolveRoot(id, header)
    const now = this.hostNow()
    const record = await this.merge(root, (next) => {
      next.visitedAt = Math.max(next.visitedAt, now)
    }, true)
    if (!record) throw unavailable()
    return { visitedAt: record.visitedAt }
  }

  async handle(body, signal) {
    let request
    try {
      request = validateRequest(body)
    } catch (error) {
      return this.failure(error)
    }
    try {
      await this.whenReady()
      const ids = request.action === 'read' ? request.ids : [request.id]
      const headers = await this.authorize(ids, signal)
      if (request.action === 'read') {
        const records = await this.read(request.ids, headers, signal)
        return { ok: true, records }
      }
      if (!headers.has(request.id)) {
        return { ok: false, error: '会话不存在或无权访问', code: 'not-found' }
      }
      if (signal && signal.aborted) throw new SessionActivityError('aborted', '请求已取消')
      const result = await this.visit(request.id, headers.get(request.id))
      return { ok: true, visitedAt: result.visitedAt }
    } catch (error) {
      return this.failure(error)
    }
  }

  failure(error) {
    if (error instanceof SessionActivityError) {
      return { ok: false, error: error.message, code: error.code }
    }
    this.warn('request failed', error)
    return { ok: false, error: '活动记录失败', code: 'internal' }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────
  drain() {
    for (const root of [...this.dirty]) void this.flush(root)
  }

  async refreshHeaders() {
    const query = this.service('sessionQuery')
    if (!query || typeof query.listSessions !== 'function') return
    let listing
    try {
      listing = await query.listSessions()
    } catch (error) {
      this.warn('could not cache session headers', error)
      return
    }
    if (!Array.isArray(listing)) return
    const headers = new Map()
    for (const entry of listing) {
      const header = entry && entry.header ? entry.header : entry
      if (!header || typeof header !== 'object') continue
      if (typeof header.id !== 'string' || !header.id) continue
      headers.set(header.id, header)
    }
    this.headers = headers
  }

  mount(scoped) {
    if (this.disposed) return Promise.resolve()
    if (this.phase === 'ready' || this.phase === 'opening') return this.lifecycle
    const token = ++this.mountToken
    const task = this.lifecycle.then(() => this.openDomain(scoped, token))
    this.lifecycle = task.catch((error) => {
      this.lastError = error
      this.phase = 'unavailable'
      this.warn('storage mount failed', error)
    })
    return this.lifecycle
  }

  async openDomain(scoped, token) {
    if (this.disposed || token !== this.mountToken) return
    let service
    try {
      service = (scoped && scoped.storageDomain)
        || (scoped && typeof scoped.get === 'function' ? scoped.get('storageDomain') : undefined)
        || this.service('storageDomain')
    } catch {
      service = undefined
    }
    if (!service || typeof service.open !== 'function') {
      this.phase = 'idle'
      return
    }

    this.phase = 'opening'
    let domain
    try {
      domain = await service.open(SESSION_ACTIVITY_DOMAIN)
    } catch (error) {
      this.lastError = error
      this.phase = 'unavailable'
      this.warn('could not open the activity domain', error)
      return
    }

    if (this.disposed || token !== this.mountToken) {
      try {
        await domain.close()
      } catch (error) {
        this.warn('could not close an abandoned activity domain', error)
      }
      return
    }

    try {
      const table = domain.table(SESSION_ACTIVITY_TABLE)
      if (!table || typeof table.put !== 'function' || typeof table.get !== 'function') {
        throw new Error('the activity domain returned no usable table')
      }
      this.table = table
      this.domain = domain
      this.phase = 'ready'
      this.lastError = undefined
      this.drain()
      if (!this.refreshPromise) {
        this.refreshPromise = this.refreshHeaders().finally(() => {
          this.refreshPromise = undefined
        })
      }
    } catch (error) {
      this.lastError = error
      this.phase = 'unavailable'
      this.table = undefined
      this.domain = undefined
      this.warn('could not bind the activity table', error)
      try {
        await domain.close()
      } catch (closeError) {
        this.warn('could not close the activity domain after a table failure', closeError)
      }
    }
  }

  unmount() {
    if (this.phase === 'idle' || this.phase === 'closed') return this.lifecycle
    ++this.mountToken
    const task = this.lifecycle.then(async () => {
      if (this.phase === 'ready' || this.phase === 'opening' || this.phase === 'unavailable') {
        this.phase = 'closing'
        try {
          await this.settle()
        } catch (error) {
          this.warn('flush on unmount failed', error)
        }
        const domain = this.domain
        this.domain = undefined
        this.table = undefined
        if (domain) {
          try {
            await domain.close()
          } catch (error) {
            this.warn('could not close the activity domain', error)
          }
        }
      }
      this.phase = this.disposed ? 'closed' : 'idle'
    })
    this.lifecycle = task.catch((error) => {
      this.lastError = error
      this.phase = this.disposed ? 'closed' : 'idle'
      this.warn('activity unmount failed', error)
    })
    return this.lifecycle
  }

  dispose() {
    if (this.disposePromise) return this.disposePromise
    this.disposed = true
    ++this.mountToken
    const task = this.lifecycle.then(async () => {
      try {
        if (this.table) {
          await this.settle()
          const domain = this.domain
          this.domain = undefined
          this.table = undefined
          if (domain) {
            try {
              await domain.close()
            } catch (error) {
              this.warn('could not close the activity domain on shutdown', error)
            }
          }
        }
      } catch (error) {
        this.warn('flush on shutdown failed', error)
      } finally {
        const failure = unavailable('活动记录服务已关闭')
        for (const list of this.waiters.values()) {
          for (const waiter of list.splice(0)) waiter.reject(failure)
        }
        this.waiters.clear()
        this.latest.clear()
        this.dirty.clear()
        this.phase = 'closed'
        if (this.listenerOff) {
          try {
            this.listenerOff()
          } catch {
            /* already removed */
          }
          this.listenerOff = undefined
        }
      }
    })
    this.disposePromise = task.catch((error) => {
      this.lastError = error
      this.phase = 'closed'
      this.warn('activity dispose failed', error)
    })
    return this.disposePromise
  }
}

export function createSessionActivity(ctx) {
  return new SessionActivity(ctx)
}
