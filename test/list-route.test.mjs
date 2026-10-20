// Exercises the directory listing the panel's browse mode uses, with a fake
// filesystem so ignore rules, containment and the entry cap stay verifiable.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { listDirectory } from '../index.js'

const ROOT = '/workspace'

function node(name, type) {
  return { name, type }
}

const TREE = new Map([
  [ROOT, [
    node('src', 'directory'),
    node('empty', 'directory'),
    node('node_modules', 'directory'),
    node('.git', 'directory'),
    node('README.md', 'file'),
    node('.DS_Store', 'file'),
    node('index.js', 'file'),
  ]],
  [`${ROOT}/src`, [
    node('api', 'directory'),
    node('main.ts', 'file'),
    node('app.vue', 'file'),
  ]],
  [`${ROOT}/src/api`, [node('survey.ts', 'file')]],
  [`${ROOT}/empty`, []],
])

function targetOf(value) {
  const normalized = path.posix.normalize(String(value))
  return { targetKey: normalized, displayPath: normalized }
}

function fakeContext(tree = TREE) {
  return {
    fs: {
      async resolve(value) { return targetOf(value) },
      contains(parent, child) {
        return child.targetKey === parent.targetKey || child.targetKey.startsWith(`${parent.targetKey}/`)
      },
      async stat(target) {
        if (!tree.has(target.targetKey)) return undefined
        return { type: 'directory' }
      },
      async listDir(target) {
        const entries = tree.get(target.targetKey) || []
        return entries.map((entry) => ({ ...entry, target: targetOf(`${target.targetKey}/${entry.name}`) }))
      },
      processPath(target) { return target.displayPath },
    },
  }
}

test('the listing puts folders first and applies the search ignore rules', async () => {
  const data = await listDirectory(fakeContext(), ROOT, ROOT)
  assert.equal(data.ok, true)
  assert.equal(data.path, ROOT)
  assert.equal(data.parent, null)
  assert.deepEqual(data.entries.map((entry) => entry.name), ['empty', 'src', 'index.js', 'README.md'])
  assert.deepEqual(data.entries.map((entry) => entry.type), ['dir', 'dir', 'file', 'file'])
  assert.equal(data.total, 4)
  assert.equal(data.truncated, false)
})

test('a nested directory reports its parent and its own entries', async () => {
  const data = await listDirectory(fakeContext(), ROOT, `${ROOT}/src`)
  assert.equal(data.path, `${ROOT}/src`)
  assert.equal(data.parent, ROOT)
  assert.deepEqual(data.entries.map((entry) => entry.name), ['api', 'app.vue', 'main.ts'])
})

test('an empty directory lists nothing without failing', async () => {
  const data = await listDirectory(fakeContext(), ROOT, `${ROOT}/empty`)
  assert.equal(data.ok, true)
  assert.deepEqual(data.entries, [])
  assert.equal(data.total, 0)
})

test('a file path is not a directory', async () => {
  await assert.rejects(
    () => listDirectory(fakeContext(), ROOT, `${ROOT}/README.md`),
    /不是目录/,
  )
})

test('a path outside the workspace is rejected', async () => {
  const ctx = fakeContext()
  ctx.fs.contains = () => false
  await assert.rejects(() => listDirectory(ctx, ROOT, '/etc'), /超出当前工作区/)
})

test('extra ignored directory names from the settings hide folders', async () => {
  const data = await listDirectory(fakeContext(), ROOT, ROOT, undefined, { extraIgnore: 'src' })
  assert.deepEqual(data.entries.map((entry) => entry.name), ['empty', 'index.js', 'README.md'])
})

test('a huge directory is capped and reported as truncated', async () => {
  const big = new Map([[
    ROOT,
    Array.from({ length: 1205 }, (_, index) => node(`file-${String(index).padStart(4, '0')}.txt`, 'file')),
  ]])
  const data = await listDirectory(fakeContext(big), ROOT, ROOT)
  assert.equal(data.total, 1205)
  assert.equal(data.truncated, true)
  assert.equal(data.entries.length, 1000)
})
