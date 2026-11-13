import { describe, expect, it } from 'vitest'
import type { InspectionRecord } from '../../../domain/inspection'
import type { SealReading } from '../../../domain/sealFamily'
import type { PlanRequest, PlanView } from '../../requestPlan'
import { regions } from '../regions'
import { sealZoom } from '../sealZoom'
import { survey } from '../survey'
import { tileSearchRequests } from '../tileSearch'

const byId = (id: string) => tileSearchRequests.find((r) => r.id === id)!
const seal = (value: string): SealReading => ({
  visible: true,
  characters: [...value].map((v) => ({ value: v === '?' ? null : v, certainty: 'Confident' })),
  value,
  certainty: 'Confident',
})

/** A plan view with the survey's answer and the given parts' answers. */
function planOf(
  findings: object,
  parts: Record<string, unknown>,
  extra: [PlanRequest, unknown][] = [],
) {
  const answers = new Map<PlanRequest, unknown>([[survey, { findings }], ...extra])
  for (const [id, a] of Object.entries(parts)) answers.set(byId(id), a)
  return { route: {} as never, answer: (r: PlanRequest) => answers.get(r) } as PlanView
}

const record = {} as InspectionRecord
const settle = (id: string, plan: PlanView) =>
  byId(id).apply(record, { status: 'answered', answer: null, resolvedModel: 'm' }, plan)
const sides = (b: { left: number; top: number; right: number; bottom: number }) =>
  [b.left, b.top, b.right, b.bottom].map((n) => +n.toFixed(4))

describe('finding the seal number by reading parts of a seal close-up', () => {
  const findings = { face: { face: 'close-up', closeUpSubject: 'seal' }, seal: seal('0154620') }

  it('reads three bands, then cuts back the first band that gave the whole number', () => {
    const start = planOf(findings, {})
    expect(byId('seal-part-0-1').needed!(start)).toBe(true)
    expect(byId('seal-part-1-1').needed!(start)).toBe(false)

    // The top band gives the number with one character slipped, as Jev does; the middle one does not.
    const banded = planOf(findings, {
      'seal-part-0-1': seal('01546220'),
      'seal-part-0-2': seal('015462?'),
      'seal-part-0-3': seal('0154620'),
    })
    expect(byId('seal-part-1-1').needed!(banded)).toBe(true)
    expect(sides(settle('seal-part-0-3', banded).tileSearch!.seal!)).toEqual([0, 0, 1, 0.4])

    // Round 1 on the top band: the left and bottom cuts still hold the number; the right and top do not.
    const round1 = planOf(findings, {
      'seal-part-0-1': seal('0154620'),
      'seal-part-1-1': seal('0154620'),
      'seal-part-1-2': seal('015462?'),
      'seal-part-1-3': seal('546620'),
      'seal-part-1-4': seal('0154620'),
    })
    expect(sides(settle('seal-part-1-4', round1).tileSearch!.seal!)).toEqual([0.25, 0, 1, 0.3])
  })

  it('does nothing on a photo that is not a seal close-up, or when the number is not whole', () => {
    const doors = planOf({ ...findings, face: { face: 'rear-doors' } }, {})
    expect(byId('seal-part-0-1').needed!(doors)).toBe(false)
    const unread = planOf({ ...findings, seal: seal('01546?0') }, {}, [[sealZoom, { seal: null }]])
    expect(byId('seal-part-0-1').needed!(unread)).toBe(false)
  })
})

describe('finding the ISO code by reading parts round the ID', () => {
  const code = { state: 'read', code: '25G1', certainty: 'Confident' }
  const findings = { face: { face: 'rear-doors' }, details: { sizeCode: code } }
  const idArea: [PlanRequest, unknown] = [
    regions,
    { id: { box: { top: 0.125, bottom: 0.375, left: 0.625, right: 0.875 } } },
  ]

  it('starts from the ID area with a margin and keeps each cut that still reads the code', () => {
    expect(byId('iso-part-1-1').needed!(planOf(findings, {}, [idArea]))).toBe(true)
    const all = Object.fromEntries([1, 2, 3, 4].map((i) => [`iso-part-1-${i}`, code]))
    // The grown area runs 0.5625..0.9375 by 0.0625..0.4375; each side is cut back by a quarter.
    expect(sides(settle('iso-part-1-4', planOf(findings, all, [idArea])).tileSearch!.iso!)).toEqual(
      [0.6563, 0.1563, 0.8438, 0.3438],
    )
  })

  it('does nothing without the ID area or off the door end', () => {
    expect(byId('iso-part-1-1').needed!(planOf(findings, {}))).toBe(false)
    const side = planOf({ ...findings, face: { face: 'long-side' } }, {}, [idArea])
    expect(byId('iso-part-1-1').needed!(side)).toBe(false)
  })
})
