// A real image decoder and canvas for the opt-in live smoke tests, which run in Node: Playwright's Chromium
// decodes, enlarges and crops the photo the way the app's own codec does in the browser (imageCodec.ts),
// so a live run through the store sends the bytes a presenter's browser would. Not used by the default run.
// Set PW_CHROMIUM_PATH to use a pre-installed Chromium.
import { chromium, type Browser, type Page } from '@playwright/test'
import { drawOverlay, type PhotoOverlay } from '../drawOverlay'
import type { DecodedPhoto, PhotoRegion } from '../imageCodec'

const JPEG_QUALITY = 0.9

let browser: Browser | null = null
let page: Page | null = null

async function canvasPage(): Promise<Page> {
  if (page) return page
  browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined })
  page = await browser.newPage()
  // The app's own overlay drawing, so the page draws the numbered regions exactly as the app does.
  await page.addScriptTag({ content: `window.drawOverlay = ${drawOverlay.toString()}` })
  return page
}

/** Closes the browser. Call once the live tests are done. */
export async function closeBrowserCodec(): Promise<void> {
  await browser?.close()
  browser = null
  page = null
}

interface PhotoWindow {
  photos?: HTMLImageElement[]
}

export async function decodePhoto(blob: Blob): Promise<DecodedPhoto> {
  const p = await canvasPage()
  const source = {
    base64: Buffer.from(await blob.arrayBuffer()).toString('base64'),
    type: blob.type || 'image/jpeg',
  }
  const decoded = await p.evaluate(async ({ base64, type }) => {
    const img = new Image()
    img.src = `data:${type};base64,${base64}`
    await img.decode()
    const w = window as unknown as PhotoWindow
    w.photos ??= []
    w.photos.push(img)
    return { index: w.photos.length - 1, width: img.naturalWidth, height: img.naturalHeight }
  }, source)

  const draw = async (
    region: PhotoRegion | null,
    width: number,
    height: number,
    overlay: PhotoOverlay | null = null,
  ) => {
    const base64 = await p.evaluate(
      ({ index, region, width, height, quality, overlay }) => {
        const img = (window as unknown as PhotoWindow).photos![index]!
        const r = region ?? { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')!
        context.fillStyle = 'white'
        context.fillRect(0, 0, width, height)
        context.imageSmoothingQuality = 'high'
        context.drawImage(img, r.x, r.y, r.width, r.height, 0, 0, width, height)
        if (overlay) {
          // The app's own overlay drawing, installed in the page below.
          const w = window as unknown as { drawOverlay: (...args: unknown[]) => void }
          w.drawOverlay(context, width, height, overlay)
        }
        return canvas.toDataURL('image/jpeg', quality).split(',')[1]!
      },
      { index: decoded.index, region, width, height, quality: JPEG_QUALITY, overlay },
    )
    return new Blob([Buffer.from(base64, 'base64')], { type: 'image/jpeg' })
  }

  return {
    width: decoded.width,
    height: decoded.height,
    toJpeg: (width, height) => draw(null, width, height),
    toJpegRegion: (region, width, height) => draw(region, width, height),
    toJpegMarked: (width, height, overlay) => draw(null, width, height, overlay),
    close: () => {},
  }
}
