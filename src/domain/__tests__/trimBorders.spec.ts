import { describe, expect, it } from 'vitest'
import { trimBorders } from '../trimBorders'

/** A width x height photo: black, with a grey-and-white checked block from (x0, y0) to (x1, y1). */
function photo(width: number, height: number, [x0, y0, x1, y1]: number[]) {
  const px = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x >= x0! && x < x1! && y >= y0! && y < y1!
      const v = inside ? ((x + y) % 2 ? 240 : 120) : 0
      px.set([v, v, v, 255], (y * width + x) * 4)
    }
  }
  return px
}

describe('plain borders round a photo', () => {
  it('trims black bars above and below a phone screenshot', () => {
    expect(trimBorders(photo(20, 40, [0, 6, 20, 34]), 20, 40)).toEqual({
      top: 6 / 40,
      bottom: 34 / 40,
      left: 0,
      right: 1,
    })
  })

  it('trims a plain border on every side', () => {
    expect(trimBorders(photo(20, 20, [3, 4, 17, 15]), 20, 20)).toEqual({
      top: 4 / 20,
      bottom: 15 / 20,
      left: 3 / 20,
      right: 17 / 20,
    })
  })

  it('leaves a photo with no plain border, or a plain photo, whole', () => {
    expect(trimBorders(photo(20, 20, [0, 0, 20, 20]), 20, 20)).toBeNull()
    expect(trimBorders(photo(20, 20, [0, 0, 0, 0]), 20, 20)).toBeNull()
  })
})
