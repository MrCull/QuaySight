#!/usr/bin/env node
// Secret scan. Usage:
//   node scripts/check-secrets.mjs            scan every tracked file (git ls-files)
//   node scripts/check-secrets.mjs --staged   scan added lines of the staged diff
// Exits 1 when a key-shaped string is found. Reports file and line, never the value.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

export const PATTERNS = [
  { name: 'sk-proj- prefix', re: /sk-proj-/ },
  { name: 'sk-or-v1- prefix', re: /sk-or-v1-/ },
  { name: 'sk- key (20+ chars)', re: /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/ },
]

// This scanner and its test name the prefixes in source, so they are not scanned.
const SELF_FILES = new Set(['scripts/check-secrets.mjs', 'scripts/check-secrets.test.mjs'])

// One hit per line: the first pattern that matches.
function matchLine(line) {
  const found = PATTERNS.find((p) => p.re.test(line))
  return found ? [found.name] : []
}

export function findSecretsInText(text, file) {
  const hits = []
  text.split(/\r?\n/).forEach((line, i) => {
    for (const name of matchLine(line)) hits.push({ file, line: i + 1, pattern: name })
  })
  return hits
}

// Scans added lines only. Line numbers follow the new-file side of each hunk.
export function findSecretsInDiff(diff) {
  const hits = []
  let file = null
  let newLine = 0
  for (const raw of diff.split(/\r?\n/)) {
    if (raw.startsWith('+++ ')) {
      file = raw.slice(4).replace(/^b\//, '')
      continue
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw)
    if (hunk) {
      newLine = Number(hunk[1])
      continue
    }
    if (raw.startsWith('+') && file) {
      for (const name of matchLine(raw.slice(1))) hits.push({ file, line: newLine, pattern: name })
      newLine++
    } else if (raw.startsWith(' ')) {
      newLine++
    }
  }
  return hits
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
}

function scanTracked() {
  const files = git(['ls-files', '-z']).split('\0').filter(Boolean)
  const hits = []
  for (const file of files) {
    if (SELF_FILES.has(file)) continue
    const buffer = readFileSync(join(ROOT, file))
    if (buffer.includes(0)) continue // binary
    hits.push(...findSecretsInText(buffer.toString('utf8'), file))
  }
  return hits
}

function main() {
  const staged = process.argv.includes('--staged')
  let hits
  try {
    const found = staged ? findSecretsInDiff(git(['diff', '--cached', '--no-color', '-U0'])) : scanTracked()
    hits = found.filter((hit) => !SELF_FILES.has(hit.file))
  } catch (error) {
    console.error(`check-secrets: could not run: ${error.message}`)
    return 2
  }
  if (hits.length === 0) {
    console.log(`check-secrets: clean (${staged ? 'staged diff' : 'tracked tree'})`)
    return 0
  }
  for (const hit of hits) console.error(`${hit.file}:${hit.line}: ${hit.pattern}`)
  console.error(`check-secrets: ${hits.length} key-shaped string(s) found. Remove them before committing.`)
  return 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main()
}
