#!/usr/bin/env node
/**
 * One release, one command.
 *
 *   node scripts/release.mjs                 # patch bump, gate, publish, verify
 *   node scripts/release.mjs --version 0.14.0
 *   node scripts/release.mjs --stage         # bump + gate only, no publish
 *   node scripts/release.mjs --full          # gate includes every browser check
 *   node scripts/release.mjs --dry-run       # publish --dry-run
 *   node scripts/release.mjs --commit        # also commit the version files
 *
 * The npm token comes from $DSH_SECRET_NPM_TOKEN_BYPASS through a temporary
 * user config that is deleted in a finally block. The value is never printed and
 * never written to the repository.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY = 'https://registry.npmjs.org'
const PACKAGE = 'dsh-file-finder'
const BADGE = join(ROOT, 'preview/index.html')

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const value = (name) => {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : undefined
}

function step(message) { console.log(`\n[release] ${message}`) }
function fail(message) { console.error(`[release] ✗ ${message}`); process.exit(1) }

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')) }

function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: ROOT, stdio: 'inherit', ...options })
}

function capture(command, args) {
  return execFileSync(command, args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function compare(left, right) {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

function nextVersion(current, requested) {
  if (requested) {
    if (!/^\d+\.\d+\.\d+$/.test(requested)) fail(`--version must be x.y.z, got "${requested}"`)
    if (compare(requested, current) <= 0) fail(`--version ${requested} must be greater than ${current}`)
    return requested
  }
  const [major, minor, patch] = current.split('.').map(Number)
  return `${major}.${minor}.${patch + 1}`
}

function writeVersion(version) {
  const pkgPath = join(ROOT, 'package.json')
  const pkg = readJson(pkgPath)
  pkg.version = version
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  const badge = readFileSync(BADGE, 'utf8')
  const updated = badge.replace(/<span class="app-badge">v[^<]+<\/span>/, `<span class="app-badge">v${version}</span>`)
  if (updated === badge) fail('preview/index.html has no version badge to update')
  writeFileSync(BADGE, updated)
}

function gate(full) {
  step('running the gate (unit tests)')
  run('npm', ['test'])
  if (!full) {
    console.log('[release] browser checks skipped; pass --full to run them all')
    return
  }
  step('running every browser check and the screenshots')
  for (const script of ['check:browse', 'check:tokens', 'check:intel', 'check:find', 'check:viewer', 'check:board', 'check:bot']) {
    run('npm', ['run', script])
  }
  run('npm', ['run', 'preview'])
}

function publish(version, dryRun) {
  const token = process.env.DSH_SECRET_NPM_TOKEN_BYPASS
  if (!token) fail('DSH_SECRET_NPM_TOKEN_BYPASS is not set; refusing to publish without it')
  const rcDir = mkdtempSync(join(tmpdir(), 'dff-npm-'))
  const rc = join(rcDir, '.npmrc')
  writeFileSync(rc, `//registry.npmjs.org/:_authToken=${token}\n`, { mode: 0o600 })
  try {
    step(`publishing ${PACKAGE}@${version}${dryRun ? ' (dry run)' : ''}`)
    const args = ['publish', `--registry=${REGISTRY}`, `--userconfig=${rc}`]
    if (dryRun) args.push('--dry-run')
    run('npm', args)
  } finally {
    rmSync(rcDir, { recursive: true, force: true })
  }
}

async function waitForLatest(version, timeoutMs) {
  const started = Date.now()
  step(`waiting for the latest tag to reach ${version}`)
  for (;;) {
    const latest = capture('npm', ['view', PACKAGE, 'version', '--registry', REGISTRY])
    console.log(`[release] latest=${latest} (${Math.round((Date.now() - started) / 1000)}s)`)
    if (latest === version) return
    if (Date.now() - started > timeoutMs) fail(`latest never became ${version}; it is ${latest}`)
    await new Promise((done) => setTimeout(done, 30_000))
  }
}

function verifyInstall(version) {
  step('installing the published version into a scratch directory')
  const dir = mkdtempSync(join(tmpdir(), 'dff-verify-'))
  try {
    run('npm', ['init', '-y'], { cwd: dir, stdio: 'ignore' })
    run('npm', ['install', `${PACKAGE}@${version}`, '--registry', REGISTRY, '--no-audit', '--no-fund'], { cwd: dir, stdio: 'ignore' })
    const installed = readJson(join(dir, 'node_modules', PACKAGE, 'package.json'))
    if (installed.version !== version) fail(`installed ${installed.version}, expected ${version}`)
    const client = readFileSync(join(dir, 'node_modules', PACKAGE, 'client.js'), 'utf8')
    const host = readFileSync(join(dir, 'node_modules', PACKAGE, 'index.js'), 'utf8')
    if (!client.includes('__ModuleLoader__')) fail('the installed client.js does not look like the plugin bundle')
    if (!host.includes('export function apply')) fail('the installed index.js does not export apply()')
    console.log(`[release] ✓ ${PACKAGE}@${version} installs and contains both halves`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function main() {
  const pkg = readJson(join(ROOT, 'package.json'))
  const version = nextVersion(pkg.version, value('--version'))
  const dryRun = flag('--dry-run')
  const stage = flag('--stage')
  step(`${PACKAGE}: ${pkg.version} → ${version}${stage ? ' (stage only)' : ''}`)

  gate(flag('--full'))
  const originals = {
    pkg: readFileSync(join(ROOT, 'package.json')),
    badge: readFileSync(BADGE),
  }
  writeVersion(version)
  step('version files updated (package.json, preview/index.html badge)')

  if (flag('--commit')) {
    run('git', ['add', 'package.json', 'preview/index.html'])
    run('git', ['commit', '-m', `Release ${version}`])
    step(`committed Release ${version}; push it with git push origin main`)
  }

  if (stage) {
    step('stage only: nothing published. Commit, then re-run without --stage.')
    return
  }

  if (dryRun) {
    try {
      publish(version, true)
    } finally {
      // A dry run must leave the tree exactly as it found it.
      writeFileSync(join(ROOT, 'package.json'), originals.pkg)
      writeFileSync(BADGE, originals.badge)
    }
    step('dry run: nothing published, version files restored')
    return
  }
  publish(version, false)
  await waitForLatest(version, 10 * 60_000)
  verifyInstall(version)
  if (!flag('--commit')) {
    console.log('[release] version files are still uncommitted:')
    console.log('          git add package.json preview/index.html')
    console.log(`          git commit -m "Release ${version}" && git push origin main`)
  }
  step(`done: ${PACKAGE}@${version} is live. Refresh DSH to pick up a client-only change.`)
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
