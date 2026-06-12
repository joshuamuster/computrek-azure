/**
 * update-changelog.mjs
 *
 * Runs as part of `npm run deploy` (after bump-version.mjs, before vite build).
 * Collects all git commits since the last production deploy and prepends a new
 * entry to src/assets/data/changelog.json so the live site always reflects
 * the current deployment.
 *
 * How it finds "new" commits:
 *   bump-version.mjs edits version.json on disk but does NOT commit it.
 *   So `git log -- version.json` at deploy time returns commits from the
 *   PREVIOUS deploy — the exact anchor we need.
 */

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ── Read the new version (already bumped by bump-version.mjs) ────────────────
const version = JSON.parse(readFileSync(path.join(root, 'version.json'), 'utf8'))
const versionStr = `${version.major}.${version.minor}.${version.patch}`

// ── Find the last committed version.json → that was the previous deploy ───────
let sinceRef = null
try {
  const log = execSync('git log --format="%H" -- version.json', { cwd: root })
    .toString().trim().split('\n').filter(Boolean)
  if (log.length > 0) sinceRef = log[0]
} catch { /* first ever deploy */ }

// ── Collect commit subjects since the previous deploy ─────────────────────────
let changes = []
try {
  const range = sinceRef ? `${sinceRef}..HEAD` : 'HEAD'
  const raw = execSync(`git log ${range} --format="%s" --no-merges`, { cwd: root })
    .toString().trim()
  if (raw) {
    changes = raw.split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      // skip pure version-bump lines like "v0.8.47" or "Bump version"
      .filter(s => !/^v?\d+\.\d+\.\d+/.test(s))
      .filter(s => !/^bump version/i.test(s))
  }
} catch { /* noop */ }

if (changes.length === 0) {
  console.log('Changelog: no new commits since last deploy — skipping update.')
  process.exit(0)
}

// ── Derive a human-readable title from the most recent commit ─────────────────
// Strip conventional-commit prefixes (Fix:, feat:, chore:, etc.) if present
const rawTitle = changes[0]
const strippedTitle = rawTitle
  .replace(/^(fix|feat|chore|refactor|docs|style|test|perf|build|ci)(\([^)]+\))?:\s*/i, '')
  .trim()
const title = strippedTitle.charAt(0).toUpperCase() + strippedTitle.slice(1)

// ── Build new entry ───────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10)
const newEntry = {
  version: versionStr,
  date: today,
  title,
  changes,
}

// ── Prepend to existing changelog ─────────────────────────────────────────────
const changelogPath = path.join(root, 'src/assets/data/changelog.json')
const existing = JSON.parse(readFileSync(changelogPath, 'utf8'))
writeFileSync(changelogPath, JSON.stringify([newEntry, ...existing], null, 2) + '\n')

const n = changes.length
console.log(`Changelog updated → v${versionStr} (${n} change${n === 1 ? '' : 's'})`)
changes.forEach(c => console.log(`  • ${c}`))
