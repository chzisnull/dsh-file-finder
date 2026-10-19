import assert from 'node:assert/strict'
import test from 'node:test'
import { contentHits, fileKindOf, rankName } from '../index.js'

test('rankName prefers an exact filename over a prefix or a path fragment', () => {
  assert.equal(rankName('App.ts', 'src/App.ts').score, 0)
  assert.equal(rankName('App', 'src/App.ts').score, 0)
  assert.equal(rankName('app', 'src/apple.ts').score, 1)
  assert.equal(rankName('ple', 'src/apple.ts').score, 2)
  assert.equal(rankName('src/app', 'src/app/main.ts').score, 3)
  assert.equal(rankName('zzz', 'src/App.ts'), null)
  assert.equal(rankName('   ', 'src/App.ts'), null)
})

test('contentHits is case-insensitive and 1-based', () => {
  const hits = contentHits('a\nhello world\nHello there', 'hello', 5)
  assert.deepEqual(hits.map((hit) => hit.line), [2, 3])
  assert.equal(contentHits('nothing', 'hello', 5).length, 0)
  assert.equal(contentHits('hello\nhello', 'hello', 1).length, 1)
})

test('fileKindOf routes each preview kind and treats everything else as text', () => {
  assert.equal(fileKindOf('assets/logo.png'), 'image')
  assert.equal(fileKindOf('clip.MP4'), 'video')
  assert.equal(fileKindOf('voice.m4a'), 'audio')
  assert.equal(fileKindOf('manual.pdf'), 'pdf')
  assert.equal(fileKindOf('README.md'), 'markdown')
  assert.equal(fileKindOf('page.html'), 'html')
  assert.equal(fileKindOf('src/app.ts'), 'text')
  assert.equal(fileKindOf('Makefile'), 'text')
})
