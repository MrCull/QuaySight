// Numbered regions, the "where is it?" step (spec #75, ticket #84). Pure.
//
// Each photo gets one extra request showing a copy of the photo with numbered, overlapping regions: a 4x4
// grid (marks 1 to 16, one per cell, row by row from the top left) and nine regions straddling the grid
// lines (marks 17 to 25, each a cell-sized area centred where four cells meet). The model names the mark,
// or two adjacent marks, that hold the container ID, the seal, the weights panel, the ISO code and each
// hazard sticker, or "none". No coordinates are ever asked for: a named mark is an area of the upright
// photo, which is cropped from the full-resolution photo and read again (idCropRead.ts, sealZoom.ts).
// One route for every model: it replaces Jev's own location boxes on the reading path.
import { questionSet } from './questionSet'
import type { ChoiceQuestion, SharedAnswer, SharedQuestion, SharedQuestionSet } from './questionSet'

/** An area of a photo as fractions (0..1): top < bottom and left < right. */
export interface RegionBox {
  top: number
  bottom: number
  left: number
  right: number
}

export const GRID = 4
export const CELL_MARKS = GRID * GRID
const CROSSINGS = (GRID - 1) * (GRID - 1)
export const MARK_COUNT = CELL_MARKS + CROSSINGS

/** The area a mark covers. Cells 1 to 16 are the grid; 17 to 25 are cell-sized and centred on a crossing. Null for a mark that is not drawn. */
export function markBox(mark: number): RegionBox | null {
  if (!Number.isInteger(mark) || mark < 1 || mark > MARK_COUNT) return null
  if (mark <= CELL_MARKS) {
    const row = Math.floor((mark - 1) / GRID)
    const col = (mark - 1) % GRID
    return {
      top: row / GRID,
      bottom: (row + 1) / GRID,
      left: col / GRID,
      right: (col + 1) / GRID,
    }
  }
  const k = mark - CELL_MARKS - 1
  const row = Math.floor(k / (GRID - 1)) + 1
  const col = (k % (GRID - 1)) + 1
  const half = 1 / (2 * GRID)
  return {
    top: row / GRID - half,
    bottom: row / GRID + half,
    left: col / GRID - half,
    right: col / GRID + half,
  }
}

/** Where each mark is drawn: its number at the centre of its area. */
export function markCentre(mark: number): { x: number; y: number } | null {
  const box = markBox(mark)
  return box ? { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 } : null
}

const EPSILON = 1e-9

/** Whether two marks' areas overlap or touch (a shared edge or corner counts). */
export function adjacent(a: number, b: number): boolean {
  const x = markBox(a)
  const y = markBox(b)
  if (!x || !y) return false
  return (
    x.left <= y.right + EPSILON &&
    y.left <= x.right + EPSILON &&
    x.top <= y.bottom + EPSILON &&
    y.top <= x.bottom + EPSILON
  )
}

/** The area one or two named marks hold, as one box; null when there is no usable mark. A second mark that is not adjacent to the first is ignored. */
export function areaOfMarks(marks: readonly number[]): { marks: number[]; box: RegionBox } | null {
  const first = marks[0]
  const one = first === undefined ? null : markBox(first)
  if (first === undefined || !one) return null
  const second = marks[1]
  const other = second !== undefined && second !== first && adjacent(first, second) ? markBox(second) : null
  if (second === undefined || !other) return { marks: [first], box: one }
  return {
    marks: [first, second],
    box: {
      top: Math.min(one.top, other.top),
      bottom: Math.max(one.bottom, other.bottom),
      left: Math.min(one.left, other.left),
      right: Math.max(one.right, other.right),
    },
  }
}

/** Lines of the grid, as fractions: the three interior lines each way. */
export function gridLines(): { x1: number; y1: number; x2: number; y2: number }[] {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (let i = 1; i < GRID; i++) {
    lines.push({ x1: i / GRID, y1: 0, x2: i / GRID, y2: 1 })
    lines.push({ x1: 0, y1: i / GRID, x2: 1, y2: i / GRID })
  }
  return lines
}

/** A number to draw on the photo. `crossing`: marks 17 to 25, drawn in a second colour so they are not read as cells. */
export interface MarkLabel {
  text: string
  /** Centre, as a fraction of the photo. */
  x: number
  y: number
  crossing: boolean
}

export function markLabels(): MarkLabel[] {
  return Array.from({ length: MARK_COUNT }, (_, i) => {
    const mark = i + 1
    return { text: String(mark), ...markCentre(mark)!, crossing: mark > CELL_MARKS }
  })
}

// ---------------------------------------------------------------------------------------------------
// The questions

/** What is located, in order. Hazard stickers are asked up to this many times. */
export const HAZARD_SLOTS = 3

type Item = 'id' | 'seal' | 'weights' | 'iso' | `hazard_${number}`

const ITEM_TEXT: Record<'id' | 'seal' | 'weights' | 'iso' | 'hazard', string> = {
  id: 'the container identification: the four-letter owner code, the six-digit number and the single digit in a drawn box',
  seal: 'the seal: the small tamper-evident device fitted to a door locking bar or handle, with its own number (this is not the container identification)',
  weights:
    'the weights panel: the printed maximum gross, tare, payload and net weights in kilograms and pounds',
  iso: 'the ISO size-and-type code, a four-character code such as 22G1 or 45G1, usually printed under the container number or beside the weights',
  hazard:
    'a hazard sticker: a diamond-shaped dangerous-goods placard or label',
}

export const REGIONS_INSTRUCTIONS =
  'This photo of a freight container has numbered marks drawn on it. White numbers on black, 1 to 16, label the cells of a 4 by 4 grid, counted row by row from the top left. Yellow numbers, 17 to 25, sit where the grid lines cross: each covers a cell-sized area centred on its number, so it overlaps the cells around it. For each item, answer with the mark whose area holds it. If the item runs across two marks, answer with the main mark first and the neighbouring mark in the second question for that item; otherwise answer none. If the item is not visible, answer none.'

const markName = (item: Item, second: boolean) => `${item}_mark${second ? '_2' : ''}`

function markQuestion(item: Item, second: boolean): ChoiceQuestion {
  const subject = ITEM_TEXT[item.startsWith('hazard_') ? 'hazard' : (item as 'id')]
  const which = item.startsWith('hazard_') ? `hazard sticker number ${item.slice(7)}, counting from the top left` : ''
  return {
    type: 'choice',
    name: markName(item, second),
    instructions: second
      ? `Which second, neighbouring mark also holds ${which ? which + ': ' : ''}${subject}? Answer none if it sits in the first mark alone or is not visible.`
      : `Which numbered mark holds ${which ? which + ': ' : ''}${subject}? Answer none if it is not visible.`,
    choices: [
      ...Array.from({ length: MARK_COUNT }, (_, i) => ({
        value: String(i + 1),
        description: `Mark ${i + 1}`,
      })),
      { value: 'none', description: 'No mark: it is not visible' },
    ],
  }
}

const ITEMS: Item[] = [
  'id',
  'seal',
  'weights',
  'iso',
  ...Array.from({ length: HAZARD_SLOTS }, (_, i): Item => `hazard_${i + 1}`),
]

export function regionsQuestions(): SharedQuestion[] {
  return ITEMS.flatMap((item) => [markQuestion(item, false), markQuestion(item, true)])
}

export function regionsQuestionSet(): SharedQuestionSet {
  return questionSet(REGIONS_INSTRUCTIONS, regionsQuestions())
}

// ---------------------------------------------------------------------------------------------------
// The answers

/** The mark the model chose must have at least this probability to count. A large item (a seal close-up) spreads the probability over neighbouring marks, so the bar is low; "none" wins clearly when nothing is there. */
export const MARK_MIN_PROBABILITY = 0.15

/** One located item: the marks named and the area they hold. */
export interface RegionArea {
  marks: number[]
  box: RegionBox
}

export interface RegionsReading {
  id: RegionArea | null
  seal: RegionArea | null
  weights: RegionArea | null
  iso: RegionArea | null
  /** Each hazard sticker located, in the order asked. */
  hazards: RegionArea[]
}

function markOf(answer: SharedAnswer | undefined): number | null {
  if (answer?.type !== 'choice' || answer.value === 'none') return null
  const probability = answer.probabilities[answer.value]
  if (probability !== undefined && probability < MARK_MIN_PROBABILITY) return null
  const mark = Number(answer.value)
  return Number.isInteger(mark) && markBox(mark) ? mark : null
}

function areaOf(answers: Record<string, SharedAnswer>, item: Item): RegionArea | null {
  const first = markOf(answers[markName(item, false)])
  if (first === null) return null
  const second = markOf(answers[markName(item, true)])
  return areaOfMarks(second === null ? [first] : [first, second])
}

/** The regions answers, by meaning. An item with no usable mark is null: nothing is cropped for it. */
export function readRegions(answers: Record<string, SharedAnswer>): RegionsReading {
  return {
    id: areaOf(answers, 'id'),
    seal: areaOf(answers, 'seal'),
    weights: areaOf(answers, 'weights'),
    iso: areaOf(answers, 'iso'),
    hazards: Array.from({ length: HAZARD_SLOTS }, (_, i) =>
      areaOf(answers, `hazard_${i + 1}` as Item),
    ).filter((a): a is RegionArea => a !== null),
  }
}

/** What the numbered-region request found, as the record keeps it (for the export; the UI shows only the close-ups). */
export interface RegionsRecord {
  outcome: 'located' | 'failed' | 'cancelled' | 'skipped-cap'
  found: RegionsReading | null
  resolvedVersion: string | null
}

declare module './inspection' {
  interface InspectionRecord {
    /** Where the numbered-region step found the ID, seal, weights, ISO code and hazard stickers (ticket #84). Absent on other runs. */
    regions?: RegionsRecord
  }
}
