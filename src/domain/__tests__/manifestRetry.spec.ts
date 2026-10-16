import { describe, it, expect } from 'vitest'
import { runRecordedManifestRetry, ManifestRetryError } from '../manifest'

describe('runRecordedManifestRetry', () => {
  it('reads the recorded reading from the image when no entry matches', async () => {
    const reading = await runRecordedManifestRetry('luna', ['MSCU4417305'], { delayMs: 0 })
    expect(reading.value).toBe('APHU6586847')
    expect(reading.provenance).toBe('printed')
    expect(reading.manifestChecked).toBe(true)
    expect(reading.checkDigitValid).toBe(true)
    expect(reading.certainty).toBe('Confident')
  })

  it('marks the reading as matched against the manifest when an entry matches, ignoring case', async () => {
    const reading = await runRecordedManifestRetry('luna', ['mscu4417305', 'aphu6586847'], {
      delayMs: 0,
    })
    expect(reading.provenance).toBe('manifest')
    expect(reading.value).toBe('APHU6586847')
  })

  it('rejects with the provider message when the check fails, and never returns a reading', async () => {
    const error = await runRecordedManifestRetry('luna', ['APHU6586847'], {
      delayMs: 0,
      fail: true,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ManifestRetryError)
    expect((error as ManifestRetryError).message).toContain('Rate limit reached')
  })

  it('uses the Jev recorded fixture for Jev', async () => {
    const reading = await runRecordedManifestRetry('openrouter', [], { delayMs: 0 })
    expect(reading.certainty).toBe('Likely')
  })
})
