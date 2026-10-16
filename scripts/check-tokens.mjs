#!/usr/bin/env node
// Design-token ratchet (AGENTS.md: tokens only, no hard-coded colours, font sizes or spacing).
// Scans src/**/*.{vue,ts,css} and compares per-file violation counts with scripts/token-baseline.json.
// A file fails when its count rises above its baseline, or when a file with no baseline has violations.
// Usage:
//   node scripts/check-tokens.mjs                    check against the baseline
//   node scripts/check-tokens.mjs --write-baseline   record current counts as the baseline
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, extname, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const BASELINE_PATH = join(ROOT, 'scripts', 'token-baseline.json')
const SCAN_DIR = join(ROOT, 'src')
const EXTENSIONS = new Set(['.vue', '.ts', '.css'])

const PX = String.raw`\d*\.?\d+px`

export const RULES = [
  { kind: 'hex-colour', pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { kind: 'rgb-hsl', pattern: /\b(?:rgba?|hsla?)\(/i },
  { kind: 'font-size-px', pattern: new RegExp(`(?<![\\w-])font-size\\s*:[^;}\\n]*?${PX}`) },
  { kind: 'font-px', pattern: new RegExp(`(?<![\\w-])font\\s*:[^;}\\n]*?${PX}`) },
  {
    kind: 'spacing-px',
    pattern: new RegExp(
      `(?<![\\w-])(?:padding|margin|gap|row-gap|column-gap)(?:-[a-z]+)*\\s*:[^;}\\n]*?${PX}`,
    ),
  },
]

export function scanText(text, file) {
  const violations = []
  text.split(/\r?\n/).forEach((line, index) => {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        violations.push({ file, line: index + 1, kind: rule.kind, text: line.trim() })
      }
    }
  })
  return violations
}

export function countByFile(violations) {
  const counts = {}
  for (const v of violations) counts[v.file] = (counts[v.file] ?? 0) + 1
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
}

export function compareToBaseline(counts, baseline) {
  const problems = []
  for (const [file, count] of Object.entries(counts)) {
    const allowed = baseline[file]
    if (allowed === undefined) {
      problems.push(`${file}: ${count} violation(s) in a file with no baseline entry`)
    } else if (count > allowed) {
      problems.push(`${file}: ${count} violation(s), baseline allows ${allowed}`)
    }
  }
  return problems
}

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else if (EXTENSIONS.has(extname(entry.name))) files.push(full)
  }
  return files
}

export function scanSourceTree() {
  const violations = []
  for (const full of walk(SCAN_DIR)) {
    const file = relative(ROOT, full).split(sep).join('/')
    violations.push(...scanText(readFileSync(full, 'utf8'), file))
  }
  return violations
}

function main() {
  const counts = countByFile(scanSourceTree())

  if (process.argv.includes('--write-baseline')) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(counts, null, 2)}\n`)
    console.log(`check-tokens: baseline written to scripts/token-baseline.json (${Object.values(counts).reduce((a, b) => a + b, 0)} violations in ${Object.keys(counts).length} files)`)
    return 0
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const problems = compareToBaseline(counts, baseline)
  if (problems.length > 0) {
    console.error('check-tokens: hard-coded colour, font-size or spacing values rose above the baseline:')
    for (const problem of problems) console.error(`  ${problem}`)
    console.error('Use design-system tokens (var(--...)). Details per line: node scripts/check-tokens.mjs --list')
    return 1
  }
  const lower = Object.entries(baseline).filter(([file, n]) => (counts[file] ?? 0) < n)
  console.log(`check-tokens: ok (${Object.values(counts).reduce((a, b) => a + b, 0)} known violations)`)
  if (lower.length > 0) {
    console.log(`check-tokens: ${lower.length} file(s) are below baseline; lower scripts/token-baseline.json to ratchet`)
  }
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--list')) {
    for (const v of scanSourceTree()) console.log(`${v.file}:${v.line}: ${v.kind}: ${v.text}`)
    process.exitCode = 0
  } else {
    process.exitCode = main()
  }
}
