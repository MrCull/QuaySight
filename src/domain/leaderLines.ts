// The landing's leader lines: each joins a reading on a card to the area it was read from on the sample photo.
// Pure geometry on measured coordinates (CSS pixels in the landing); the component measures and draws.

/** A leader line's ends: from a reading's card edge (x0, y0) to the left edge of its outline (x1, y1). */
export interface LineEnds {
  key: string
  x0: number
  y0: number
  x1: number
  y1: number
}

/** A routed line: where it turns, and its SVG path (across, up or down, then across). */
export type LeaderLine<T extends LineEnds = LineEnds> = T & { bend: number; d: string }

/** How far beyond its card the innermost line turns, in CSS pixels. */
export const FIRST_TURN = 14
/** How much further out each next line in a group turns, so the vertical runs never overlap. */
export const TURN_SPACING = 8

/**
 * Where each elbow line turns, so that no line crosses another. Lines that climb to their outline turn further out
 * the lower they start; lines that drop turn further out the higher they start. The two groups never share a height
 * range when the climbers start above the droppers, as the cards and outlines do.
 */
export function routeLeaderLines<T extends LineEnds>(lines: T[]): LeaderLine<T>[] {
  const up = lines.filter((l) => l.y1 < l.y0).sort((a, b) => a.y0 - b.y0)
  const down = lines.filter((l) => l.y1 >= l.y0).sort((a, b) => b.y0 - a.y0)
  const rank = new Map<T, number>()
  up.forEach((l, i) => rank.set(l, i))
  down.forEach((l, i) => rank.set(l, i))
  return lines.map((l) => {
    const bend = l.x0 + FIRST_TURN + (rank.get(l) ?? 0) * TURN_SPACING
    return { ...l, bend, d: `M${l.x0} ${l.y0}H${bend}V${l.y1}H${l.x1}` }
  })
}
