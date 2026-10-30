// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { findLargeImages, MAX_INLINE_IMAGE_CHARS } from './check-doc-images.mjs'

describe('Markdown image guard', () => {
  it('reports the location of oversized Markdown and HTML image payloads without echoing them', () => {
    const payload = 'A'.repeat(MAX_INLINE_IMAGE_CHARS + 1)
    const url = ['data:image/png;base64,', payload].join('')
    const hits = findLargeImages(`intro\n![preview](${url})\n<img src="${url}">`, 'README.md')
    expect(hits.map(({ line }) => line)).toEqual([2, 3])
    expect(JSON.stringify(hits)).not.toContain(payload)
  })

  it('accepts linked assets and tiny inline icons', () => {
    expect(findLargeImages('![preview](assets/preview.jpg)\n<img src="data:image/png;base64,AAAA">', 'x.md')).toEqual([])
  })

  it('counts wrapped base64 as one payload', () => {
    const url = 'data:image/jpeg;base64,' + ('A'.repeat(600) + '\n').repeat(2)
    expect(findLargeImages(url, 'x.md')).toHaveLength(1)
  })
})
