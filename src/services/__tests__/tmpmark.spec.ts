import { it, vi } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'

vi.mock('../imageCodec', () => import('./browserCodec'))

import { closeBrowserCodec } from './browserCodec'
import { markPhoto } from '../scalePhoto'

it('marks', { timeout: 60000 }, async () => {
  const out = '/tmp/claude-0/-home-user-QuaySight/287efa62-d4b1-5b47-9ccf-858b00c52ffe/scratchpad'
  for (const name of ['rear-door-coyu-22g1', 'jdlu-200690-4-long-side']) {
    const blob = new Blob([await readFile(`samples/${name}.jpg`)], { type: 'image/jpeg' })
    const marked = await markPhoto(blob)
    await writeFile(`${out}/marked-${name}.jpg`, Buffer.from(await marked.arrayBuffer()))
  }
  await closeBrowserCodec()
})
