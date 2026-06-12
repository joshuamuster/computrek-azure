import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = path.join(root, 'version.json')

const v = JSON.parse(readFileSync(file, 'utf8'))

// Compare against last committed version to detect a manual major/minor bump
let committed = null
try {
  const raw = execSync('git show HEAD:version.json', { cwd: root }).toString()
  committed = JSON.parse(raw)
} catch { /* first commit — no HEAD yet */ }

if (committed && (v.major !== committed.major || v.minor !== committed.minor)) {
  v.patch = 0
} else {
  v.patch += 1
}

writeFileSync(file, JSON.stringify(v) + '\n')
console.log(`Version bumped → ${v.major}.${v.minor}.${v.patch}`)
