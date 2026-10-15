import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadText } from '../download'

describe('downloadText', () => {
  let createdUrls: Blob[]
  let revoked: string[]
  let clicked: { href: string; download: string }[]

  beforeEach(() => {
    vi.useFakeTimers()
    createdUrls = []
    revoked = []
    clicked = []
    URL.createObjectURL = vi.fn<(blob: Blob) => string>((blob: Blob) => {
      createdUrls.push(blob)
      return 'blob:quay-sight-test'
    })
    URL.revokeObjectURL = vi.fn<(url: string) => void>((url: string) => {
      revoked.push(url)
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function (this: HTMLAnchorElement) {
        clicked.push({ href: this.href, download: this.download })
      },
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('wraps the text in a Blob, downloads it under the given name and revokes the object URL', async () => {
    downloadText('quay-sight-run-1-summary.txt', 'Quay Sight - POC, non-certified\n', 'text/plain')

    expect(createdUrls).toHaveLength(1)
    const blob = createdUrls[0]!
    expect(blob.type).toBe('text/plain')
    expect(await blob.text()).toBe('Quay Sight - POC, non-certified\n')

    expect(clicked).toEqual([
      { href: 'blob:quay-sight-test', download: 'quay-sight-run-1-summary.txt' },
    ])
    expect(revoked).toEqual([])

    vi.runAllTimers()
    expect(revoked).toEqual(['blob:quay-sight-test'])
  })

  it('does not touch the network', () => {
    const fetchSpy = vi.fn<() => void>()
    vi.stubGlobal('fetch', fetchSpy)
    downloadText('a.json', '{}', 'application/json')
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
