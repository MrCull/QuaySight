#!/usr/bin/env node
// Keep Markdown readable by tools: large image payloads belong in linked asset files.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const MAX_INLINE_IMAGE_CHARS = 1024

export function findLargeImages(text, file) {
  const hits = []
  const images = /data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\r\n]+/gi
  for (const match of text.matchAll(images)) {
    if (match[0].length > MAX_INLINE_IMAGE_CHARS) {
      hits.push({ file, line: text.slice(0, match.index).split('\n').length, size: match[0].length })
    }
  }
  return hits
}

export function main() {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).split('\0').filter((file) => /\.md$/i.test(file))
  let failures = 0
  for (const file of new Set(files)) {
    for (const hit of findLargeImages(readFileSync(resolve(ROOT, file), 'utf8'), file)) {
      console.error(`${hit.file}:${hit.line}: embedded image is ${hit.size} characters; use a linked asset`)
      failures++
    }
  }
  if (!failures) console.log('check-doc-images: clean')
  return failures ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main()
}
