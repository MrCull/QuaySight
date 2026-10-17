import type { DecodedPhoto } from '../imageCodec'

/**
 * Stand-in for the browser's image decoder and canvas, which jsdom lacks. Opt in with
 * `vi.mock('…/services/imageCodec')`. A fake photo is a blob whose text is its upright size, e.g.
 * "4032x3024"; any other blob decodes as 1200 × 900. The fake JPEG's text is its size, e.g. "jpeg 2048x1536",
 * and decodes again at that size. A fake crop's text names the size it was drawn at and the region, e.g.
 * "jpeg 1568x852 from 331x180 at 590,40".
 */
export async function decodePhoto(blob: Blob): Promise<DecodedPhoto> {
  const size = /^(?:jpeg )?(\d+)x(\d+)$/.exec(await blob.text())
  const width = size ? Number(size[1]) : 1200
  const height = size ? Number(size[2]) : 900
  return {
    width,
    height,
    toJpeg: async (w, h) => new Blob([`jpeg ${w}x${h}`], { type: 'image/jpeg' }),
    toJpegRegion: async (r, w, h) =>
      new Blob([`jpeg ${w}x${h} from ${r.width}x${r.height} at ${r.x},${r.y}`], {
        type: 'image/jpeg',
      }),
    toJpegMarked: async (w, h, o) =>
      new Blob([`jpeg ${w}x${h} marked ${o.labels.length}`], { type: 'image/jpeg' }),
    close: () => {},
  }
}
