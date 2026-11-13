// Finding a reading's place by reading parts of the photo (the seal number, the ISO code). Pure.
//
// The model reads well but places things badly: its boxes and the numbered regions miss the seal number
// and the ISO code (docs/research/jev-seal-location-2026-11-13.md). So the photo is cut into parts and
// each part is read again. A part that still gives the whole reading holds it. Each round reads four
// parts of the current area, each with one side cut back by a quarter; every cut whose part still gives
// the whole reading is kept, so the area shrinks round by round towards the reading itself.
//
// A seal often carries its number twice (two tags), so it starts from three overlapping bands across the
// photo and keeps the first that gives the whole number: within one band there is one copy.
import type { IdBox } from './cropRead'
import type { CertaintyLabel } from './inspection'
import type { SealReading } from './sealFamily'
import type { SizeCodeReading } from './containerDetailTypes'

/** The four sides a round cuts back, in the order its parts are read. */
export const SIDES = ['left', 'right', 'top', 'bottom'] as const
export type Side = (typeof SIDES)[number]

/** How much of the current area a cut takes off one side. */
export const CUT = 0.25
/** Bands across the photo for the seal: their tops, and their height, as fractions of the area. */
const BAND_TOPS = [0, 0.3, 0.6]
const BAND_HEIGHT = 0.4
/** The rounds of cuts after the starting area. */
export const ROUNDS = 2

const width = (b: IdBox) => b.right - b.left
const height = (b: IdBox) => b.bottom - b.top

/** Three overlapping bands across an area, top to bottom. */
export function bands(area: IdBox): IdBox[] {
  return BAND_TOPS.map((t) => ({
    ...area,
    top: area.top + t * height(area),
    bottom: area.top + (t + BAND_HEIGHT) * height(area),
  }))
}

/** The part of an area with one side cut back by CUT. */
export function cut(area: IdBox, side: Side): IdBox {
  const dx = CUT * width(area)
  const dy = CUT * height(area)
  switch (side) {
    case 'left':
      return { ...area, left: area.left + dx }
    case 'right':
      return { ...area, right: area.right - dx }
    case 'top':
      return { ...area, top: area.top + dy }
    case 'bottom':
      return { ...area, bottom: area.bottom - dy }
  }
}

/** The area after a round: every side whose cut part still gave the whole reading is cut back. */
export function narrowed(area: IdBox, kept: Partial<Record<Side, boolean>>): IdBox {
  return SIDES.reduce((b, side) => (kept[side] ? { ...b, [side]: cut(area, side)[side] } : b), area)
}

/** An area grown by `margin` of its long side on every side, kept inside the photo. */
export function grown(area: IdBox, margin: number): IdBox {
  const pad = margin * Math.max(width(area), height(area))
  return {
    left: Math.max(0, area.left - pad),
    right: Math.min(1, area.right + pad),
    top: Math.max(0, area.top - pad),
    bottom: Math.min(1, area.bottom + pad),
    confidence: area.confidence,
  }
}

/** How many single-character edits turn one string into the other. */
export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j]! + 1,
        row[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = row
  }
  return prev[b.length]!
}

const SURE: readonly CertaintyLabel[] = ['Confident', 'Likely']

/**
 * Whether a part's seal reading is the whole number: every character read, and within one character
 * of the number the photo gave (a part read alone slips a character as often as the whole photo does).
 */
export function sealFits(reading: SealReading | null | undefined, number: string): boolean {
  if (!reading?.visible || !number || reading.value.includes('?')) return false
  if (!SURE.includes(reading.certainty)) return false
  return editDistance(reading.value, number) <= 1
}

/** Whether a part's size-code reading is the code the photo gave, read with some certainty. */
export function isoFits(reading: SizeCodeReading | null | undefined, code: string): boolean {
  return reading?.state === 'read' && reading.code === code && SURE.includes(reading.certainty)
}

declare module './inspection' {
  interface InspectionRecord {
    /** Where reading parts of the photo placed the seal number and the ISO code (fractions). Absent on other runs. */
    tileSearch?: { seal?: IdBox; iso?: IdBox }
  }
}
