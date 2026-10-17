// Helpers for e2e/screens/run-screenshots.mjs.
import fs from 'node:fs'

export const CONTAINER_CHROMIUM = '/opt/pw-browsers/chromium'

/** PW_CHROMIUM_PATH when set, else the container's Chromium when it exists, else undefined (bundled build). */
export function resolveChromiumPath(env, exists = fs.existsSync) {
  if (env.PW_CHROMIUM_PATH) return env.PW_CHROMIUM_PATH
  return exists(CONTAINER_CHROMIUM) ? CONTAINER_CHROMIUM : undefined
}

/** Number of .png files in dir modified at or after sinceMs. */
export function countScreenshots(dir, sinceMs) {
  let names
  try {
    names = fs.readdirSync(dir)
  } catch {
    return 0
  }
  return names.filter((n) => {
    if (!n.endsWith('.png')) return false
    try {
      return fs.statSync(`${dir}/${n}`).mtimeMs >= sinceMs
    } catch {
      return false
    }
  }).length
}
