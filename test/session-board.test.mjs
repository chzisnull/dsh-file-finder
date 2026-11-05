// Fast unit tests for the session board's derivations. The same functions run
// inside the client bundle; here they are fed plain session snapshots, so a
// rename or a counting mistake fails in milliseconds instead of a browser run.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

function fakeReact() {
  return {
    createElement: (...args) => ({ args }),
    useEffect: () => {},
    useLayoutEffect: () => {},
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value }),
    useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
    useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
  }
}

/** Evaluate client.js the way the Web shell does and return its plugin object. */
function loadPlugin() {
  let definition
  globalThis.window = {
    __ModuleLoader__: { load: (loaded) => { definition = loaded } },
    addEventListener() {},
    removeEventListener() {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  }
  globalThis.document = { addEventListener() {}, removeEventListener() {} }
  globalThis.localStorage = globalThis.window.localStorage

  new Function('window', source)(globalThis.window)
  assert.equal(definition?.id, 'dsh-file-finder')
  const plugin = definition.factory((name) => {
    if (name === 'react') return fakeReact()
    throw new Error(`unexpected require: ${name}`)
  })
  assert.ok(plugin.__test, 'the plugin must expose its board derivations for tests')
  return plugin.__test
}

const board = loadPlugin()

const MINUTE = 60_000
const now = Date.now()

function summary(id, extra = {}) {
  return {
    id,
    displayTitle: id,
    cwd: '/w/project',
    updatedAt: now - MINUTE,
    blank: false,
    running: false,
    ...extra,
  }
}

function listOf(rows) {
  return { ids: rows.map((row) => row.id), byId: Object.fromEntries(rows.map((row) => [row.id, row])) }
}

function statusOf(extra = {}) {
  return { running: false, pendingInteraction: undefined, completionUnread: false, ...extra }
}

function statusMap(entries) {
  return new Map(Object.entries(entries))
}

test('one state per session, in DSH precedence: awaiting, running, finished, idle', () => {
  const list = listOf([
    summary('pending', { updatedAt: now - 5 * MINUTE }),
    summary('running'),
    summary('finished'),
    summary('idle'),
  ])
  const statuses = statusMap({
    pending: statusOf({ pendingInteraction: { kind: 'approval' } }),
    running: statusOf({ running: true }),
    finished: statusOf({ completionUnread: true }),
    idle: statusOf(),
  })
  const rows = board.sessionRowsOf(list, statuses, [], new Map(), new Map())
  assert.deepEqual(rows.map((row) => [row.id, row.state]), [
    ['pending', 'pending'],
    ['running', 'running'],
    ['finished', 'finished'],
    ['idle', 'idle'],
  ])
  assert.deepEqual(board.sessionCountsOf(rows), { pending: 1, running: 1, finished: 1, idle: 1 })
  assert.equal(rows[0].pending, 'approval', 'the reason travels with the row')
})

test('sessions the user cannot act on never become rows', () => {
  const list = listOf([
    summary('keep'),
    summary('empty', { blank: true }),
    summary('child', { origin: 'subagent', parentId: 'keep' }),
    summary('gone'),
  ])
  const statuses = statusMap({ keep: statusOf(), gone: statusOf({ completionUnread: true }) })
  const rows = board.sessionRowsOf(list, statuses, ['gone'], new Map(), new Map())
  assert.deepEqual(rows.map((row) => row.id), ['keep'])
})

test('a running subagent keeps its idle parent running, and the parent counts once', () => {
  const list = listOf([
    summary('parent'),
    summary('sa1', { origin: 'subagent', parentId: 'parent' }),
    summary('sa2', { origin: 'subagent', parentId: 'parent' }),
  ])
  const statuses = statusMap({
    parent: statusOf(),
    sa1: statusOf({ running: true }),
    sa2: statusOf({ running: true }),
  })
  const rollup = board.indexSubagentRollup(list, statuses)
  assert.deepEqual(rollup.get('parent'), { count: 2, running: 2, pending: 0 })
  const rows = board.sessionRowsOf(list, statuses, [], new Map(), rollup)
  assert.equal(rows.length, 1, 'subagents never own a row')
  assert.equal(rows[0].state, 'running')
  assert.equal(rows[0].subagents, 2)
})

test('a waiting subagent makes its parent awaiting with the subagent reason', () => {
  const list = listOf([
    summary('parent'),
    summary('child', { origin: 'subagent', parentId: 'parent' }),
  ])
  const statuses = statusMap({
    parent: statusOf(),
    child: statusOf({ pendingInteraction: { kind: 'approval' } }),
  })
  const rows = board.sessionRowsOf(list, statuses, [], new Map(), board.indexSubagentRollup(list, statuses))
  assert.equal(rows[0].state, 'pending')
  assert.equal(rows[0].pending, 'subagent')
  assert.equal(board.pendingKeyOf(rows[0].pending), 'pendingSubagent')
})

test('the main Agent finishing first does not mark a busy tree finished', () => {
  const list = listOf([
    summary('parent'),
    summary('child', { origin: 'subagent', parentId: 'parent' }),
  ])
  const statuses = statusMap({
    // The parent's own turn ended, so DSH flags the completion…
    parent: statusOf({ completionUnread: true }),
    child: statusOf({ running: true }),
  })
  const rows = board.sessionRowsOf(list, statuses, [], new Map(), board.indexSubagentRollup(list, statuses))
  assert.equal(rows[0].state, 'running', '…but the tree is still working')

  // Once the child stops, the unread completion surfaces.
  statuses.set('child', statusOf())
  const settled = board.sessionRowsOf(list, statuses, [], new Map(), board.indexSubagentRollup(list, statuses))
  assert.equal(settled[0].state, 'finished')
})

test('nested subagents roll up to the topmost session, never to a subagent row', () => {
  const list = listOf([
    summary('parent'),
    summary('child', { origin: 'subagent', parentId: 'parent' }),
    summary('grandchild', { origin: 'subagent', parentId: 'child' }),
    summary('orphan', { origin: 'subagent' }),
  ])
  const statuses = statusMap({
    parent: statusOf(),
    child: statusOf({ running: true }),
    grandchild: statusOf({ running: true }),
    orphan: statusOf({ running: true }),
  })
  const rollup = board.indexSubagentRollup(list, statuses)
  assert.deepEqual(rollup.get('parent'), { count: 2, running: 2, pending: 0 })
  assert.deepEqual(rollup.get('child'), { count: 1, running: 1, pending: 0 })
  assert.equal(rollup.has('orphan'), false, 'an orphan has no parent to roll into')
  const rows = board.sessionRowsOf(list, statuses, [], new Map(), rollup)
  assert.deepEqual(rows.map((row) => row.id), ['parent'])
})

test('the workspace title wins over the folder name and feeds the search', () => {
  const list = listOf([summary('s1', { cwd: '/w/renamed-dir' })])
  const statuses = statusMap({ s1: statusOf({ running: true }) })
  const titles = new Map([['s1', 'Renamed workspace']])
  const rows = board.sessionRowsOf(list, statuses, [], titles, new Map())
  assert.equal(rows[0].workspace, 'Renamed workspace')
  const hit = board.boardColumnsOf(rows, 'renamed work')
  assert.equal(hit.find((column) => column.state === 'running').total, 1)
})

test('columns order by longest wait first, then by latest activity', () => {
  const list = listOf([
    summary('pending-old', { updatedAt: now - 30 * MINUTE }),
    summary('pending-new', { updatedAt: now - MINUTE }),
    summary('running-old', { updatedAt: now - 20 * MINUTE }),
    summary('running-new', { updatedAt: now - 2 * MINUTE }),
    summary('finished-old', { updatedAt: now - 40 * MINUTE }),
    summary('finished-new', { updatedAt: now - 3 * MINUTE }),
  ])
  const statuses = statusMap({
    'pending-old': statusOf({ pendingInteraction: { kind: 'question' } }),
    'pending-new': statusOf({ pendingInteraction: { kind: 'question' } }),
    'running-old': statusOf({ running: true }),
    'running-new': statusOf({ running: true }),
    'finished-old': statusOf({ completionUnread: true }),
    'finished-new': statusOf({ completionUnread: true }),
  })
  const rows = board.sessionRowsOf(list, statuses, [], new Map(), new Map())
  const columns = board.boardColumnsOf(rows, '')
  const order = Object.fromEntries(columns.map((column) => [column.state, column.rows.map((row) => row.id)]))
  assert.deepEqual(order.pending, ['pending-old', 'pending-new'])
  assert.deepEqual(order.running, ['running-new', 'running-old'])
  assert.deepEqual(order.finished, ['finished-new', 'finished-old'])
})

test('the finished column is a recent window over every ended session', () => {
  const list = listOf([
    summary('unread-old', { updatedAt: now - 60 * MINUTE }),
    summary('idle-new', { updatedAt: now - 5 * MINUTE }),
    summary('idle-2', { updatedAt: now - 6 * MINUTE }),
    summary('idle-3', { updatedAt: now - 7 * MINUTE }),
    summary('idle-4', { updatedAt: now - 8 * MINUTE }),
    summary('idle-5', { updatedAt: now - 9 * MINUTE }),
    summary('running', { updatedAt: now - MINUTE }),
    summary('pending', { updatedAt: now - MINUTE }),
  ])
  const statuses = statusMap({
    'unread-old': statusOf({ completionUnread: true }),
    running: statusOf({ running: true }),
    pending: statusOf({ pendingInteraction: { kind: 'approval' } }),
  })
  const rows = board.sessionRowsOf(list, statuses, [], new Map(), new Map())
  // DSH's prompt time says the unread session is old, but the host saw its Agent
  // finish two minutes ago: the column ranks by the newest fact it has, so the
  // just-finished work is not buried under a fresher prompt.
  const records = { 'unread-old': { activityAt: now - 2 * MINUTE, visitedAt: 0 } }
  const column = board.boardColumnsOf(rows, '', records).find((item) => item.state === 'finished')
  assert.deepEqual(column.rows.map((row) => row.id), [
    'unread-old', 'idle-new', 'idle-2', 'idle-3', 'idle-4',
  ], 'five newest ended sessions, unread and read alike')
  assert.deepEqual(column.rows.map((row) => row.state), [
    'finished', 'idle', 'idle', 'idle', 'idle',
  ], 'a read idle session keeps its own state inside the recent window')
  assert.equal(column.rows[0].recentSource, 'activity')
  assert.equal(column.total, 5, 'the column reports the cards it lists, not every ended session')
  assert.equal(column.rows.some((row) => row.id === 'idle-5'), false, 'the sixth ended session is cut')
  assert.equal(column.rows.some((row) => row.id === 'running' || row.id === 'pending'), false)

  // Without host records the window still works on the summary time.
  const fallback = board.boardColumnsOf(rows, '', {}).find((item) => item.state === 'finished')
  assert.equal(fallback.rows.length, 5)
  assert.equal(fallback.rows[0].id, 'idle-new', 'summary time is the fallback order')
  assert.equal(fallback.rows[0].approximate, true)

  // The search narrows the window too.
  const searched = board.boardColumnsOf(rows, 'idle-5', records).find((item) => item.state === 'finished')
  assert.deepEqual(searched.rows.map((row) => row.id), ['idle-5'])

  // Exactly five ended sessions is not a cut, so nothing claims "in total".
  const fiveRows = rows.filter((row) => row.id !== 'idle-5')
  const five = board.boardColumnsOf(fiveRows, '', records).find((item) => item.state === 'finished')
  assert.equal(five.rows.length, 5)
  assert.equal(five.total, 5)

  // A single ended session fills the window alone, and an empty window is empty.
  const single = board.boardColumnsOf(rows.filter((row) => row.id === 'idle-2'), '', records)
    .find((item) => item.state === 'finished')
  assert.deepEqual(single.rows.map((row) => row.id), ['idle-2'])
  assert.equal(single.total, 1)
  const activeOnly = board.boardColumnsOf(rows.filter((row) => row.id === 'running' || row.id === 'pending'), '', records)
    .find((item) => item.state === 'finished')
  assert.deepEqual(activeOnly.rows, [])
  assert.equal(activeOnly.total, 0)

  // A visit the host has not confirmed ranks the window but stays approximate.
  const unconfirmed = board.boardColumnsOf(
    rows,
    '',
    { 'idle-2': { activityAt: 0, visitedAt: now - MINUTE } },
    { 'idle-2': true },
  ).find((item) => item.state === 'finished')
  assert.equal(unconfirmed.rows[0].id, 'idle-2')
  assert.equal(unconfirmed.rows[0].recentSource, 'visit')
  assert.equal(unconfirmed.rows[0].approximate, true)
})

test('a column caps its rows and reports the real total', () => {
  const rows = []
  for (let index = 0; index < 60; index += 1) {
    rows.push({ id: `s${index}`, title: `s${index}`, workspace: 'w', updatedAt: now - index, state: 'running', pending: '', subagents: 0 })
  }
  const columns = board.boardColumnsOf(rows, '')
  const running = columns.find((column) => column.state === 'running')
  assert.equal(running.total, 60)
  assert.equal(running.rows.length, 50)
})

test('the pending reason keys cover every interaction DSH can raise', () => {
  assert.equal(board.pendingKeyOf('approval'), 'pendingApproval')
  assert.equal(board.pendingKeyOf('question'), 'pendingQuestion')
  assert.equal(board.pendingKeyOf('plan-review'), 'pendingPlan')
  assert.equal(board.pendingKeyOf('subagent'), 'pendingSubagent')
  assert.equal(board.pendingKeyOf('nonsense'), 'pendingOther')
})

test('relative ages step through now, minutes, hours and days', () => {
  assert.equal(board.ageText(now, (key) => key), 'ageNow')
  assert.equal(board.ageText(now - 5 * MINUTE, (key) => key), 'ageMinute')
  assert.equal(board.ageText(now - 3 * 60 * MINUTE, (key) => key), 'ageHour')
  assert.equal(board.ageText(now - 50 * 60 * MINUTE, (key) => key), 'ageDay')
  assert.equal(board.ageText(0, (key) => key), '')
})

test('recent rows include idle sessions and sort by the strongest activity fact', () => {
  const list = listOf([
    summary('activity', { updatedAt: now - 90 * MINUTE }),
    summary('summary', { updatedAt: now - 5 * MINUTE }),
    summary('visit', { updatedAt: now - 80 * MINUTE }),
    summary('older', { updatedAt: now - 50 * MINUTE }),
    summary('blank', { blank: true, updatedAt: now - MINUTE }),
    summary('child', { origin: 'subagent', parentId: 'activity', updatedAt: now - MINUTE }),
    summary('archived', { updatedAt: now - MINUTE }),
  ])
  const statuses = statusMap({
    activity: statusOf(),
    summary: statusOf(),
    visit: statusOf(),
    older: statusOf(),
  })
  const rows = board.sessionRowsOf(list, statuses, ['archived'], new Map(), new Map())
  const records = {
    activity: { activityAt: now - 2 * MINUTE, visitedAt: 0 },
    visit: { activityAt: 0, visitedAt: now - 3 * MINUTE },
  }
  const recent = board.recentRowsOf(rows, records, '')
  assert.deepEqual(recent.rows.map((row) => row.id), ['activity', 'visit', 'summary', 'older'])
  assert.deepEqual(recent.rows.map((row) => row.state), ['idle', 'idle', 'idle', 'idle'])
  assert.deepEqual(recent.rows.map((row) => row.recentSource), ['activity', 'visit', 'summary', 'summary'])
  assert.deepEqual(recent.rows.map((row) => row.approximate), [false, false, true, true])
  assert.equal(recent.rows[0].recentAt, now - 2 * MINUTE)
  assert.equal(recent.total, 4)
  assert.equal(recent.hasMore, false)
})

test('recent ties keep their incoming order, and the newest fact always wins', () => {
  const tie = [
    { id: 'first', title: 'first', workspace: 'w', updatedAt: 100 },
    { id: 'second', title: 'second', workspace: 'w', updatedAt: 100 },
  ]
  assert.deepEqual(board.recentRowsOf(tie, {}, '').rows.map((row) => row.id), ['first', 'second'])
  const row = { id: 'x', title: 'x', workspace: 'w', updatedAt: 100 }
  assert.equal(board.recentTimeOf(row, { x: { activityAt: 100, visitedAt: 100 } }).source, 'activity')
  assert.equal(board.recentTimeOf(row, { x: { activityAt: 90, visitedAt: 100 } }).source, 'visit')
  const summaryOnly = board.recentTimeOf(row, { x: { activityAt: 0, visitedAt: 0 } })
  assert.deepEqual(summaryOnly, { at: 100, source: 'summary', approximate: true })
  assert.deepEqual(board.recentTimeOf({ ...row, updatedAt: 0 }, {}), { at: 0, source: '', approximate: false })
})

test('recent search covers every eligible session before the page is cut', () => {
  const rows = []
  for (let index = 0; index < 60; index += 1) {
    rows.push(summary(`s${index}`, {
      displayTitle: `Session ${index}`,
      updatedAt: now - index,
    }))
  }
  const list = listOf(rows)
  const statuses = statusMap(Object.fromEntries(rows.map((row) => [row.id, statusOf()])))
  const eligible = board.sessionRowsOf(list, statuses, [], new Map(), new Map())
  const all = board.recentRowsOf(eligible, {}, '')
  assert.equal(all.total, 60)
  assert.equal(all.rows.length, 50, 'the first page defaults to 50')
  assert.equal(all.hasMore, true)

  const deeper = board.recentRowsOf(eligible, {}, 'session 59', 50)
  assert.deepEqual(deeper.rows.map((row) => row.id), ['s59'], 'the 60th row is searchable, not truncated away')
  assert.equal(deeper.total, 1)

  const workspace = board.recentRowsOf(eligible, {}, 'project', 50)
  assert.equal(workspace.total, 60, 'the workspace name is part of the search')

  const page = board.recentRowsOf(eligible, {}, '', 100)
  assert.equal(page.rows.length, 60)
  assert.equal(page.hasMore, false)
})

test('the activity adapter uses one route and reports read or visit failures', async () => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url, body })
    const payload = body.action === 'read'
      ? { ok: true, records: { a: { activityAt: 123, visitedAt: 0 }, bad: { activityAt: 'nope' } } }
      : { ok: true, visitedAt: 456 }
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try {
    const activity = board.sessionActivity
    await activity.read(['a', 'b'])
    assert.deepEqual(calls[0], { url: '/dsh-file-finder/session-activity', body: { action: 'read', ids: ['a', 'b'] } })
    assert.equal(activity.snapshot().readError, false)
    assert.equal(activity.snapshot().records.a.activityAt, 123)
    assert.equal(activity.snapshot().records.bad.activityAt, 0, 'a malformed record never becomes a fake timestamp')

    await activity.visit('a')
    assert.deepEqual(calls[1], { url: '/dsh-file-finder/session-activity', body: { action: 'visit', id: 'a' } })
    assert.equal(activity.snapshot().records.a.visitedAt, 456)
    assert.equal(activity.snapshot().visitError, false)

    globalThis.fetch = async () => { throw new Error('offline') }
    await activity.read(['a'])
    assert.equal(activity.snapshot().readError, true, 'a missing host route is a visible read degradation')
    assert.deepEqual(activity.snapshot().records, {}, 'an unconfirmed cache is dropped, not ranked as fact')
    await activity.visit('a')
    assert.equal(activity.snapshot().visitError, true, 'a rejected visit is never reported as persisted')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('a visit the host has not confirmed is approximate, and a failure withdraws it', async () => {
  const originalFetch = globalThis.fetch
  const activity = board.sessionActivity
  const row = { id: 'v1', title: 'Visit', workspace: 'w', updatedAt: 0, state: 'idle' }
  let release
  globalThis.fetch = () => new Promise((resolve) => {
    release = () => resolve(new Response(
      JSON.stringify({ ok: true, visitedAt: 999 }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
  })
  try {
    const pending = activity.visit('v1')
    const snapshot = activity.snapshot()
    assert.equal(snapshot.pendingVisits.v1, true, 'the guess is marked until the host answers')
    const inFlight = board.recentTimeOf(row, snapshot.records, snapshot.pendingVisits)
    assert.equal(inFlight.source, 'visit')
    assert.equal(inFlight.approximate, true, 'a local clock is never presented as a persisted time')

    release()
    await pending
    const settled = activity.snapshot()
    assert.equal(settled.pendingVisits.v1, undefined)
    assert.equal(board.recentTimeOf(row, settled.records, settled.pendingVisits).approximate, false)

    globalThis.fetch = async () => { throw new Error('offline') }
    const previous = activity.snapshot().records.v1.visitedAt
    await activity.visit('v1')
    assert.equal(activity.snapshot().records.v1.visitedAt, previous, 'a failed visit is withdrawn, not kept')
    assert.equal(activity.snapshot().visitError, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('the activity read batches past the host limit and merges every page', async () => {
  const batches = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    batches.push(body.ids)
    const records = Object.fromEntries(body.ids.map((id) => [id, { activityAt: 100, visitedAt: 0 }]))
    return new Response(JSON.stringify({ ok: true, records }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try {
    const ids = Array.from({ length: 450 }, (_, index) => `s${index}`)
    await board.sessionActivity.read(ids)
    assert.deepEqual(batches.map((batch) => batch.length), [200, 200, 50], 'one request per 200 ids')
    assert.equal(board.sessionActivity.snapshot().readError, false)
    assert.equal(Object.keys(board.sessionActivity.snapshot().records).length, 450, 'every batch lands')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('main-view switches record visits, but the first restored view is the baseline', () => {
  const visits = []
  const tracker = board.createVisitTracker((id) => visits.push(id))
  const main = (id, generation = 1) => summary(id, { retainedBy: { mainView: generation } })

  tracker.update(listOf([]))
  tracker.update(listOf([main('a')]))
  assert.deepEqual(visits, [], 'startup restore is not a visit')

  tracker.update(listOf([main('a'), main('b')]))
  assert.deepEqual(visits, [], 'two mainView rows pick the first in ids order')
  tracker.update(listOf([main('a', 0), main('b')]))
  assert.deepEqual(visits, ['b'])

  tracker.update(listOf([]))
  tracker.update(listOf([main('b', 0), main('c')]))
  tracker.update(listOf([main('a'), main('b', 0), main('c')]))
  assert.deepEqual(visits, ['b', 'c', 'a'], 'rapid switches each record; an empty snapshot settles nothing')

  assert.equal(board.mainViewIdOf({ byId: { a: main('a') } }), 'a', 'rows missing from ids still resolve')
  assert.equal(board.mainViewIdOf({ ids: ['b', 'a'], byId: { a: main('a'), b: main('b') } }), 'b')
})

test('one dialog carries the two peer tabs with stable selectors and honest copy', () => {
  assert.match(source, /state: \{ open: false, tab: 'status' \}/)
  assert.match(source, /'data-dff-board-tab': value/)
  assert.match(source, /tabButton\('status', 'boardTabStatus'\)/)
  assert.match(source, /tabButton\('recent', 'boardTabRecent'\)/)
  assert.match(source, /'data-dff-recent-entry'/)
  assert.match(source, /'data-dff-recent-more'/)
  assert.match(source, /'data-dff-region-recent'/)
  assert.match(source, /role: 'tablist'/)
  assert.match(source, /role: 'tab'/)
  assert.match(source, /role: 'tabpanel'/)
  assert.match(source, /aria-selected/)
  assert.match(source, /boardFinished: '已结束·未读'/)
  assert.match(source, /boardFinishedColumn: '已结束'/)
  assert.match(source, /regionFinished: '已结束·未读'/)
  assert.match(source, /boardTabStatus:/)
  assert.match(source, /boardTabRecent:/)
  assert.match(source, /boardRecentSourceSummary:/)
})
