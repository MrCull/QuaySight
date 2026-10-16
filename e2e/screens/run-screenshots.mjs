// Runs only the screenshot harness (see the header of capture.spec.ts).
// Builds the app, then runs Playwright with CI=1 so it starts its own preview server on port 4173
// (never a foreign dev server on 5173), and QS_SCREENSHOTS=1 so the harness is not skipped.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const env = { ...process.env, CI: '1', QS_SCREENSHOTS: '1' }

const build = spawnSync('npm', ['run', 'build-only'], { cwd: root, stdio: 'inherit', shell: true, env })
if (build.status !== 0) process.exit(build.status ?? 1)

const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js')
const run = spawnSync(
  process.execPath,
  [cli, 'test', 'e2e/screens/capture.spec.ts', '--project=chromium', ...process.argv.slice(2)],
  { cwd: root, stdio: 'inherit', env },
)
process.exit(run.status ?? 1)
