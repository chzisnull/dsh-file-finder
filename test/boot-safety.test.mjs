// Guards the regression that took the whole Web UI down: DSH's shortcut
// registry throws when a command's default binding overlaps any other command's
// default, and it throws from inside the *other* plugin's apply(). A default of
// Cmd+Shift+F here therefore broke @deepseek-ai/dsh-client-ui-workspace, whose
// apply() registers `session.fork` on the same keys:
//
//   Error: Conflicting shortcut defaults: session.fork and files.searchContent
//   at ShortcutRegistry.register
//   at installWorkspaceShortcuts (dsh-client-ui-workspace)
//   → ui-workspace: failed → 19 entries did not activate → boot aborts
//
// So every command this plugin registers must declare NO default binding; the
// VS Code keys are served by the plugin's own keydown handler instead.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

function fakeReact() {
  return {
    createElement: (...args) => ({ args }),
    useEffect: () => {},
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value }),
    useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
    useSyncExternalStore: () => undefined,
  }
}

/** Evaluate client.js the way the Web shell does and return its plugin object. */
function loadPlugin() {
  let definition
  globalThis.window = {
    __ModuleLoader__: { load: (loaded) => { definition = loaded } },
    addEventListener() {},
    removeEventListener() {},
  }
  globalThis.document = { addEventListener() {}, removeEventListener() {} }
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }

  new Function('window', source)(globalThis.window)
  assert.equal(definition?.id, 'dsh-file-finder')
  return definition.factory((name) => {
    if (name === 'react') return fakeReact()
    throw new Error(`unexpected require: ${name}`)
  })
}

/** Minimal context: enough for apply() to reach its shortcut registrations. */
function fakeContext(registered) {
  const effect = (callback) => {
    const dispose = callback()
    return typeof dispose === 'function' ? dispose : () => {}
  }
  const ctx = {
    effect,
    on() {},
    get() { return undefined },
    logger: { info() {}, error() {} },
    locale: { register() {}, bind: () => (key) => key },
    inject(dependencies, callback) {
      if (Array.isArray(dependencies) && dependencies.includes('shortcuts')) {
        const scoped = {
          effect,
          shortcuts: {
            register(command) {
              registered.push(command)
              return () => {}
            },
          },
        }
        callback(scoped)
      }
    },
    slots: {
      inject(_slot, callback) {
        try {
          callback()
        } catch {
          /* slot declarations are irrelevant to this test */
        }
      },
      register() {
        return () => {}
      },
    },
  }
  return ctx
}

test('every registered shortcut leaves its default binding empty', () => {
  const plugin = loadPlugin()
  assert.ok(Array.isArray(plugin.inject) && plugin.inject.includes('slots'))

  const registered = []
  plugin.apply(fakeContext(registered))

  assert.equal(registered.length, 4, 'both search commands, the browser command and the board command must be registered')
  assert.deepEqual(
    registered.map((command) => command.id).sort(),
    ['files.browse', 'files.searchContent', 'files.searchName', 'sessions.board'],
  )
  for (const command of registered) {
    assert.deepEqual(
      command.defaults,
      {},
      `${command.id} must not claim a default binding: a collision breaks another plugin's apply()`,
    )
    assert.equal(typeof command.resolve, 'function', `${command.id} must stay invokable when a user binds it`)
  }
})

test('the plugin never declares per-platform default bindings', () => {
  assert.equal(source.includes("'desktop:macos':"), false)
  assert.equal(source.includes('"desktop:macos":'), false)
})
