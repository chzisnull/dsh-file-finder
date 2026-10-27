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
