import { describe, expect, it } from 'vitest'
import { routeLeaderLines, type LineEnds, type LeaderLine } from '../leaderLines'

/** Does a horizontal run of one line cross the vertical run of another? */
function crosses(a: LeaderLine, b: LeaderLine): boolean {
  const runs = [
    { y: a.y0, from: Math.min(a.x0, a.bend), to: Math.max(a.x0, a.bend) },
    { y: a.y1, from: Math.min(a.bend, a.x1), to: Math.max(a.bend, a.x1) },
  ]
  const top = Math.min(b.y0, b.y1)
  const bottom = Math.max(b.y0, b.y1)
  return runs.some((r) => r.from < b.bend && b.bend < r.to && top < r.y && r.y < bottom)
}

describe('routeLeaderLines', () => {
  it('turns a lone line a little beyond its card and draws across, up or down, then across', () => {
    const [line] = routeLeaderLines([{ key: 'id', x0: 100, y0: 50, x1: 300, y1: 20 }])
    expect(line).toMatchObject({ key: 'id', bend: 114, d: 'M100 50H114V20H300' })
  })

  it('turns climbing lines further out the lower they start, and dropping lines the higher they start', () => {
    const lines: LineEnds[] = [
      { key: 'id', x0: 100, y0: 10, x1: 300, y1: 0 },
      { key: 'type', x0: 100, y0: 30, x1: 300, y1: 5 },
      { key: 'gross', x0: 100, y0: 60, x1: 300, y1: 200 },
      { key: 'tare', x0: 100, y0: 80, x1: 300, y1: 220 },
    ]
    expect(routeLeaderLines(lines).map((l) => [l.key, l.bend])).toEqual([
      ['id', 114],
      ['type', 122],
      ['gross', 122],
      ['tare', 114],
    ])
  })

  it('never lets one line cross another, as the landing cards and outlines are laid out', () => {
    // Seven readings down a card column at x 400, their outlines on the photo to the right: the ID and type
    // climb a little, the weights and the marking drop.
    const lines: LineEnds[] = [
      { key: 'id', x0: 400, y0: 260, x1: 640, y1: 230 },
      { key: 'type', x0: 400, y0: 360, x1: 760, y1: 270 },
      { key: 'gross', x0: 400, y0: 450, x1: 610, y1: 540 },
      { key: 'tare', x0: 400, y0: 480, x1: 615, y1: 580 },
      { key: 'payload', x0: 400, y0: 510, x1: 612, y1: 630 },
      { key: 'cube', x0: 400, y0: 540, x1: 620, y1: 680 },
      { key: 'marking', x0: 400, y0: 620, x1: 800, y1: 830 },
    ]
    const routed = routeLeaderLines(lines)
    expect(routed.filter((l) => l.bend <= l.x0)).toEqual([])
    const crossings = routed.flatMap((a) =>
      routed.filter((b) => b !== a && crosses(a, b)).map((b) => `${a.key} × ${b.key}`),
    )
    expect(crossings).toEqual([])
  })
})
