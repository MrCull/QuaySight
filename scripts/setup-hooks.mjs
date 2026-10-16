// Points git at the repo's .githooks directory. Runs from the `prepare` script.
// Skipped quietly when the package is installed outside a git work tree.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: ROOT, stdio: 'ignore' })
} catch {
  console.log('setup-hooks: not inside a git work tree; core.hooksPath not set.')
  process.exit(0)
}

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: ROOT, stdio: 'ignore' })
