// Runs only the screenshot harness (see the header of capture.spec.ts).
// Builds the app, then runs Playwright with CI=1 so it starts its own preview server on port 4173
// (never a foreign dev server on 5173), and QS_SCREENSHOTS=1 so the harness is not skipped.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { countScreenshots, resolveChromiumPath } from '../../scripts/screenshot-runner.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const env = { ...process.env, CI: '1', QS_SCREENSHOTS: '1' }
// Use the container's Chromium (PW_CHROMIUM_PATH, else /opt/pw-browsers/chromium) rather than the bundled build.
const chromiumPath = resolveChromiumPath(process.env)
if (chromiumPath) {
  if (!fs.existsSync(chromiumPath)) {
    console.error(
      `Screenshots failed: browser problem, no Chromium at ${chromiumPath}. Set PW_CHROMIUM_PATH to a working Chromium.`,
    )
    process.exit(1)
  }
  env.PW_CHROMIUM_PATH = chromiumPath
}
const startedAt = Date.now()

const build = spawnSync('npm', ['run', 'build-only'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env,
})
if (build.status !== 0) process.exit(build.status ?? 1)

const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js')
const run = spawnSync(
  process.execPath,
  [cli, 'test', 'e2e/screens/capture.spec.ts', '--project=chromium', ...process.argv.slice(2)],
  { cwd: root, stdio: 'inherit', env },
)
if (run.status === 0 && countScreenshots(path.join(root, 'screenshots'), startedAt) === 0) {
  console.error(
    `Screenshots failed: no screenshot was written. Browser problem? Chromium used: ${chromiumPath ?? 'Playwright bundled build'}. Set PW_CHROMIUM_PATH to a working Chromium.`,
  )
  process.exit(1)
}
if (run.status !== 0 && !fs.existsSync(path.join(root, 'screenshots'))) {
  console.error(
    `Screenshots failed before capturing. Browser problem? Chromium used: ${chromiumPath ?? 'Playwright bundled build'}.`,
  )
}
process.exit(run.status ?? 1)
