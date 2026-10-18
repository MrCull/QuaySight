import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Photo preparation in a real browser (spec #16): the photo a live call sends is upright from its EXIF
 * orientation, fitted to the model's limits and a JPEG, while the photo on screen stays the one chosen.
 * The unit specs fake the decoder; this one runs the browser's own.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lunaSmoke = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src', 'fixtures', 'live', 'luna-smoke.json'), 'utf8'),
).response as unknown

// A placeholder typed through the real field. It is not a credential and no provider receives it.
const PLACEHOLDER_KEY = 'playwright-placeholder-not-a-key'

/** A JPEG drawn in the page: the left half red, the right half blue. */
async function twoToneJpeg(page: Page, width: number, height: number): Promise<Buffer> {
  const base64 = await page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const context = canvas.getContext('2d')!
      context.fillStyle = 'red'
      context.fillRect(0, 0, w / 2, h)
      context.fillStyle = 'blue'
      context.fillRect(w / 2, 0, w / 2, h)
      return canvas.toDataURL('image/jpeg', 0.95).split(',')[1]!
    },
    [width, height] as const,
  )
  return Buffer.from(base64, 'base64')
}

/** The JPEG with an EXIF segment saying "rotate 90° clockwise to show" (orientation 6), as phones write it. */
function withExifOrientation6(jpeg: Buffer): Buffer {
  const exif = Buffer.from([
    0xff, 0xe1, 0x00, 0x22, // APP1, 34 bytes
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF header, IFD0 at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, // Orientation = 6
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ])
  return Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)])
}

/**
 * The pixel size a JPEG stores, read from its start-of-frame marker. Unlike a decoded size, no EXIF
 * orientation is applied, so it tells a photo stored upright from one that only displays upright.
 */
function storedSize(dataUrl: string): { width: number; height: number } {
  const jpeg = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
  let at = 2
  while (at + 9 < jpeg.length) {
    const marker = jpeg[at + 1]!
    const length = jpeg.readUInt16BE(at + 2)
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: jpeg.readUInt16BE(at + 5), width: jpeg.readUInt16BE(at + 7) }
    }
    at += 2 + length
  }
  throw new Error('No JPEG frame found')
}

/** What the browser sees in a JPEG data URL: its size and the colour at the top and bottom centre. */
async function inspectSentPhoto(page: Page, dataUrl: string) {
  return page.evaluate(async (url) => {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const context = canvas.getContext('2d')!
    context.drawImage(img, 0, 0)
    const tone = (x: number, y: number) => {
      const [r = 0, , b = 0] = context.getImageData(x, y, 1, 1).data
      return r > b ? 'red' : 'blue'
    }
    const x = Math.floor(img.naturalWidth / 2)
    return {
      type: url.slice(5, url.indexOf(';')),
      width: img.naturalWidth,
      height: img.naturalHeight,
      top: tone(x, Math.floor(img.naturalHeight / 4)),
      bottom: tone(x, Math.floor((img.naturalHeight * 3) / 4)),
    }
  }, dataUrl)
}

/** Runs one live Luna inspection on the photo and returns the image data URL of the first request sent. */
async function runLuna(page: Page, photo: Buffer): Promise<string> {
  const sent: string[] = []
  await page.route(/api\.openai\.com\/v1\/decisions/, (route) => {
    const body = route.request().postDataJSON() as {
      input: Array<{ content: Array<{ type: string; image_url?: string }> }>
    }
    const image = body.input[0]?.content.find((part) => part.type === 'input_image')?.image_url
    if (image) sent.push(image)
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lunaSmoke) })
  })
  // The setup card first: the placeholder key, then Enter continues to the inspection screen.
  // OpenRouter is pre-selected; these runs use OpenAI's recorded Luna responses.
  await page.locator('#provider-button').click()
  await page.getByTestId('provider-option-luna').click()
  const key = page.getByLabel('OpenAI API key', { exact: true })
  await key.fill(PLACEHOLDER_KEY)
  await key.press('Enter')
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'phone.jpg', mimeType: 'image/jpeg', buffer: photo })
  await page.locator('#stage.qs-arrived').waitFor()
  expect(sent.length).toBeGreaterThan(0)
  return sent[0]!
}

test.describe('Photo preparation', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('sends a sideways phone photo upright, and shows the photo as chosen', async ({ page }) => {
    await page.goto('/')
    // Stored 400 × 300 with red on the left; shown upright it is 300 × 400 with red on top.
    const photo = withExifOrientation6(await twoToneJpeg(page, 400, 300))

    const sent = await runLuna(page, photo)

    // Stored upright, so a provider that ignores EXIF (as Jev does) still sees it the right way up.
    expect(storedSize(sent)).toEqual({ width: 300, height: 400 })
    expect(await inspectSentPhoto(page, sent)).toEqual({
      type: 'image/jpeg',
      width: 300,
      height: 400,
      top: 'red',
      bottom: 'blue',
    })
    await expect(page.locator('.rs-photo__img')).toHaveAttribute('src', /^blob:/)
  })

  test('sends a large photo shrunk to the model limit, keeping its shape', async ({ page }) => {
    await page.goto('/')
    const photo = await twoToneJpeg(page, 3000, 1200)

    const sent = await runLuna(page, photo)

    expect(await inspectSentPhoto(page, sent)).toMatchObject({
      type: 'image/jpeg',
      width: 2048,
      height: 819,
    })
  })
})
