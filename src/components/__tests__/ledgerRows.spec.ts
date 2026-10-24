import { describe, it, expect } from 'vitest'
import { recordedInspection } from '../../__tests__/recordedInspection'
import { LEDGER_DETAIL_LABELS, ledgerModel, placeRows } from '../ledgerRows'

describe('the readings ledger rows', () => {
  it('puts the ID, size-type code, weights and seal on the right, in door order', async () => {
    const record = await recordedInspection('luna', { delayMs: 0 })
    const { rows } = ledgerModel(record)
    expect(rows.filter((r) => r.side === 'right').map((r) => r.key)).toEqual([
      'id',
      'type',
      'gross',
      'tare',
      'payload',
    ])
    const id = rows.find((r) => r.key === 'id')!
    expect(
      id
        .groups!.flat()
        .map((c) => c.ch)
        .join(''),
    ).toBe('APHU6586847')
    expect(id.groups![id.groups!.length - 1]![0]!.check).toBe(true)
    expect(id.tags.map((t) => t.text)).toContain('Check digit valid')
  })

  it('paints only what was printed: a calculated payload has a row but no place on the door', async () => {
    const record = await recordedInspection('luna', { delayMs: 0 })
    const { rows, door } = ledgerModel(record)
    expect(door.id).toEqual({ text: 'APHU 658684', check: '7', state: undefined })
    expect(door.gross?.text).toBe('32,500 kg')
    expect(door.net).toBeUndefined()
    const payload = rows.find((r) => r.key === 'payload')!
    expect(payload.slot).toBeNull()
    expect(payload.tags.map((t) => t.text)).toEqual(['Calculated'])
  })

  it('splits the unit from the number and follows the units setting', async () => {
    const record = await recordedInspection('luna', { delayMs: 0 })
    const gross = ledgerModel(record, 'imperial').rows.find((r) => r.key === 'gross')!
    expect(gross.unit).toBe('lb')
    expect(
      gross
        .groups!.flat()
        .map((c) => c.ch)
        .join(''),
    ).toMatch(/^[\d,]+$/)
  })

  it('shows "ID not readable in this photo" and paints no ID when too little was read', async () => {
    const base = await recordedInspection('luna', { delayMs: 0 })
    const { rows, door } = ledgerModel({
      ...base,
      containerId: { ...base.containerId!, value: '???U??0000?', certainty: "Can't tell" },
    })
    const id = rows.find((r) => r.key === 'id')!
    expect(id.words).toBe('ID not readable in this photo')
    expect(id.groups).toBeNull()
    expect(door.id).toBeUndefined()
  })

  it('leaves out what has not landed: details wait for their stage', async () => {
    const record = await recordedInspection('luna', { delayMs: 0 })
    const { rows, door } = ledgerModel(record, 'metric', { id: true, details: false })
    expect(rows.map((r) => r.key)).toEqual(['id'])
    expect(door.gross).toBeUndefined()
  })

  it('names the Container details rows it shows instead', () => {
    expect(LEDGER_DETAIL_LABELS).toContain('MAX GROSS')
    expect(LEDGER_DETAIL_LABELS).not.toContain('LENGTH')
  })
})

describe('placing the rows beside the door', () => {
  it('keeps each row level with its slot when there is room', () => {
    expect(
      placeRows(
        [
          { ideal: 40, height: 32 },
          { ideal: 150, height: 32 },
        ],
        8,
      ),
    ).toEqual([40, 150])
  })

  it('pushes a row down below the one above rather than overlapping it', () => {
    expect(
      placeRows(
        [
          { ideal: 40, height: 52 },
          { ideal: 60, height: 32 },
          { ideal: null, height: 32 },
        ],
        8,
      ),
    ).toEqual([40, 100, 140])
  })
})
