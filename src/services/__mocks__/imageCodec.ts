import type { DecodedPhoto } from '../imageCodec'

/**
 * Stand-in for the browser's image decoder and canvas, which jsdom lacks. Opt in with
 * `vi.mock('…/services/imageCodec')`. A fake photo is a blob whose text is its upright size, e.g.
 * "4032x3024"; any other blob decodes as 1200 × 900. The fake JPEG's text is its size, e.g. "jpeg 2048x1536".
 */
export async function decodePhoto(blob: Blob): Promise<DecodedPhoto> {
  const size = /^(\d+)x(\d+)$/.exec(await blob.text())
  const width = size ? Number(size[1]) : 1200
  const height = size ? Number(size[2]) : 900
  return {
    width,
    height,
    toJpeg: async (w, h) => new Blob([`jpeg ${w}x${h}`], { type: 'image/jpeg' }),
    close: () => {},
  }
}
