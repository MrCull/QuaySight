// The landing's decoration: what was read from the bundled JDLU rear-doors sample, hand-written, and where on
// that photo each reading is painted. Static values for a picture; the landing never runs an inspection.
import type { CertaintyLabel } from '../domain/inspection'

/** Left, top, width, height as fractions of samples/jdlu-200690-1-rear-doors.jpg (1080 by 1440). */
export type Box = [number, number, number, number]

/** One outlined area on the photo. Only the ID areas carry a caption. */
export interface Outline {
  box: Box
  caption?: string
}

/** The weight lines painted on the doors, each with its own outline. */
export type WeightKey = 'gross' | 'tare' | 'payload' | 'cube'
/** Every reading with an outline on the photo: matches a card's or a weight row's data-row. */
export type ReadingKey = 'id' | 'type' | WeightKey | 'marking'

/** A reading joined to the photo: a leader line runs from it to the left edge of its first outline. */
export interface Pointer {
  key: ReadingKey
  outlines: Outline[]
}

export interface WeightRow {
  key: WeightKey
  label: string
  value: string
}

/** A card with one value and an optional gloss after it. */
export interface ValueCard {
  label: string
  value: string
  gloss?: string
  certainty: CertaintyLabel
}

const PHOTO_WIDTH = 1080
const PHOTO_HEIGHT = 1440

/** Pixels on the sample, x0, y0, x1, y1, as fractions of the photo. */
const px = (x0: number, y0: number, x1: number, y1: number): Box => [
  x0 / PHOTO_WIDTH,
  y0 / PHOTO_HEIGHT,
  (x1 - x0) / PHOTO_WIDTH,
  (y1 - y0) / PHOTO_HEIGHT,
]

/** In card order. Seal is not in this photo, so it has no outline and no leader line. */
export const POINTERS: Pointer[] = [
  {
    key: 'id',
    outlines: [
      { box: px(640, 368, 724, 419), caption: 'Owner' },
      { box: px(764, 387, 870, 443), caption: 'Serial' },
      { box: px(875, 408, 903, 448), caption: 'Check' },
    ],
  },
  { key: 'type', outlines: [{ box: px(756, 441, 829, 485) }] },
  // Max gross and Tare stop short of the small "LB" lines painted under each of them.
  { key: 'gross', outlines: [{ box: px(612, 520, 840, 556) }] },
  { key: 'tare', outlines: [{ box: px(616, 569, 848, 604) }] },
  { key: 'payload', outlines: [{ box: px(614, 624, 844, 664) }] },
  { key: 'cube', outlines: [{ box: px(620, 674, 870, 714) }] },
  { key: 'marking', outlines: [{ box: px(803, 797, 889, 891) }] },
]

/** Card 01: the ID in its three groups and the check digit. */
export const CONTAINER_ID = { owner: 'JDLU', serial: ['200', '690'], check: '2' } as const

/** The ID as a screen reader says it, group by group: "J D L U, 2 0 0, 6 9 0, check digit 2". */
export function idSpoken(id: { owner: string; serial: readonly string[]; check: string }): string {
  const spell = (group: string) => group.split('').join(' ')
  return [id.owner, ...id.serial].map(spell).join(', ') + `, check digit ${id.check}`
}

/** The five cards, in order. Weights carries one certainty for the whole card. */
export const CARDS = {
  id: {
    label: 'Container ID',
    id: CONTAINER_ID,
    tag: 'Check digit valid',
    certainty: 'Confident',
  },
  type: {
    label: 'Size and type',
    value: '22G1',
    gloss: '20 ft general purpose',
    certainty: 'Confident',
  },
  weights: {
    label: 'Weights',
    certainty: 'Likely',
    rows: [
      { key: 'gross', label: 'Max gross', value: '32,500 kg' },
      { key: 'tare', label: 'Tare', value: '2,180 kg' },
      { key: 'payload', label: 'Payload', value: '30,320 kg' },
      { key: 'cube', label: 'Cubic capacity', value: '33.2 m³' },
    ],
  },
  marking: {
    label: 'Marking',
    value: 'Super heavy',
    gloss: 'No DG placard visible',
    certainty: 'Confident',
  },
  seal: { label: 'Seal', value: 'Not in this photo', certainty: 'Not seen' },
} satisfies {
  id: { label: string; id: typeof CONTAINER_ID; tag: string; certainty: CertaintyLabel }
  type: ValueCard
  weights: { label: string; certainty: CertaintyLabel; rows: WeightRow[] }
  marking: ValueCard
  seal: ValueCard
}

const pct = (n: number) => `${(n * 100).toFixed(3)}%`

/** Places an outline inside the photo figure, which keeps the photo's 3:4 aspect. */
export const boxStyle = ([left, top, width, height]: Box) =>
  `left: ${pct(left)}; top: ${pct(top)}; width: ${pct(width)}; height: ${pct(height)}`
