// Pure helpers for the screenshot harness. No browser, no file system.

/** The five fixed certainty words, most confident first (AGENTS.md). Nothing else may be indexed. */
export const FIXED_CERTAINTY_LABELS = [
  'Confident',
  'Likely',
  'Uncertain',
  "Can't tell",
  'Not seen',
] as const

export type FixedCertaintyLabel = (typeof FIXED_CERTAINTY_LABELS)[number]

/**
 * Returns the fixed certainty words that appear, exactly, among the given visible texts
 * (the textContent of each .qs-cert chip). Unique, in canonical order.
 */
export function certaintyLabelsIn(texts: readonly string[]): FixedCertaintyLabel[] {
  const seen = new Set<string>(texts.map((text) => text.trim().replace(/’/g, "'")))
  return FIXED_CERTAINTY_LABELS.filter((label) => seen.has(label))
}

export interface ShotViewport {
  width: number
  height: number
}

/** One PNG per state and viewport: `<state>-<width>x<height>.png`. */
export function shotFileName(state: string, viewport: ShotViewport): string {
  return `${state}-${viewport.width}x${viewport.height}.png`
}

export interface ShotInput {
  screen: string
  state: string
  viewport: ShotViewport
  /** Steps taken to reach the state, in order. */
  steps: string[]
  /** Fixed certainty words visible on the page at capture time. */
  certaintyLabels: readonly FixedCertaintyLabel[]
  /** 'frozen' when motion was disabled for the capture, 'animated' for a mid-animation frame. */
  motion: 'frozen' | 'animated'
}

export interface ShotEntry extends ShotInput {
  file: string
}

export interface ShotIndex {
  count: number
  shots: ShotEntry[]
}

/** Builds index.json content. The file name is derived here, so the index cannot disagree with the PNG names. */
export function buildIndex(inputs: readonly ShotInput[]): ShotIndex {
  const shots = inputs
    .map((input) => ({ ...input, file: shotFileName(input.state, input.viewport) }))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
  return { count: shots.length, shots }
}
