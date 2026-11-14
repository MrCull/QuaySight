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

/** A reading joined to the photo: a leader line runs from it to the left edge of its first outline. */
export interface Pointer {
  key: string
  outlines: Outline[]
}

export interface WeightRow {
  key: string
  label: string
  value: string
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
  { key: 'gross', outlines: [{ box: px(612, 520, 840, 561) }] },
  { key: 'tare', outlines: [{ box: px(616, 566, 848, 610) }] },
  { key: 'payload', outlines: [{ box: px(614, 624, 844, 664) }] },
  { key: 'cube', outlines: [{ box: px(620, 674, 870, 714) }] },
  { key: 'marking', outlines: [{ box: px(803, 797, 889, 891) }] },
]

/** Card 01: the ID in its three groups and the check digit. */
export const CONTAINER_ID = { owner: 'JDLU', serial: ['200', '690'], check: '2' } as const

export const TYPE_READING = { code: '22G1', meaning: '20 ft general purpose' } as const

/** Card 03: one certainty for the whole card. */
export const WEIGHTS_CERTAINTY: CertaintyLabel = 'Likely'
export const WEIGHT_ROWS: WeightRow[] = [
  { key: 'gross', label: 'Max gross', value: '32,500 kg' },
  { key: 'tare', label: 'Tare', value: '2,180 kg' },
  { key: 'payload', label: 'Payload', value: '30,320 kg' },
  { key: 'cube', label: 'Cubic capacity', value: '33.2 m³' },
]

const pct = (n: number) => `${(n * 100).toFixed(3)}%`

/** Places an outline inside the photo figure, which keeps the photo's 3:4 aspect. */
export const boxStyle = ([left, top, width, height]: Box) =>
  `left: ${pct(left)}; top: ${pct(top)}; width: ${pct(width)}; height: ${pct(height)}`
