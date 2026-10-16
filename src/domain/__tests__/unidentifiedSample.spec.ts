import { describe, it, expect } from 'vitest'
import { recordedInspection } from '../../__tests__/recordedInspection'

describe('recorded sample with the container ID not identified', () => {
  it('returns no container ID for the unidentified scenario', async () => {
    const record = await recordedInspection('luna', {
      delayMs: 0,
      scenario: 'unidentified',
    })
    expect(record.containerId).toBeNull()
    expect(record.source).toBe('recorded')
    expect(record.status).toBe('complete')
  })

  it('keeps the identified sample unchanged by default', async () => {
    const record = await recordedInspection('luna', { delayMs: 0 })
    expect(record.containerId?.value).toBe('APHU6586847')
  })
})
