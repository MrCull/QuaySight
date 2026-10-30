import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { doorReply, openAiShape } from '../src/__tests__/planReplies'

/**
 * Several photos of one container (ticket #70): the intake takes more than one photo, each photo shows the
 * face the survey named as a chip, and two photos of different containers raise a warning. OpenAI's Decisions
 * endpoint is answered here; nothing leaves the app origin and the key is a placeholder.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const photos = [
  path.join(ROOT, 'samples', 'rear-door-coyu-22g1.jpg'),
  path.join(ROOT, 'samples', 'side-dented-grey.jpg'),
]
const PLACEHOLDER_KEY = 'playwright-placeholder-not-a-key'
const SHOTS = process.env.QS_SHOT_DIR

/** An OpenAI Decisions reply that reads one ID and says which face the photo shows. */
function surveyReply(id: string, face: string) {
  const choice = (name: string, value: string, probability: number) => ({
    type: 'choice',
    name,
    choice: value,
    probabilities: [{ value, probability }],
  })
  const answers = id
    .split('')
    .map((ch, i) => choice(`id_char_${String(i + 1).padStart(2, '0')}`, ch, 0.98))
  answers.push(choice('photo_face', face, 0.96))
  return { model: 'gpt-6-luna', answers, usage: { input_tokens: 6000, output_tokens: 0 } }
}

async function answerWith(page: Page, ids: string[]) {
  let surveys = 0
  await page.route(/api\.openai\.com\/v1\/decisions/, async (route) => {
    const body = route.request().postData() ?? ''
    const damage = body.includes('Z1T_DT') || body.includes('D1T_DT')
    const reply = damage
      ? { model: 'gpt-6-luna', answers: [], usage: { input_tokens: 9000, output_tokens: 0 } }
      : surveyReply(ids[surveys % ids.length]!, surveys++ === 0 ? 'rear_doors' : 'long_side')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(reply),
    })
  })
}

async function openWithTwoPhotos(page: Page, files: string[] = photos) {
  await page.goto('/')
  await page.locator('#provider-button').click()
  await page.getByTestId('provider-option-luna').click()
  const key = page.getByLabel('OpenAI API key', { exact: true })
  await key.fill(PLACEHOLDER_KEY)
  await key.press('Enter')
  await page.locator('input[type="file"]').setInputFiles(files)
}

test.describe('Several photos of one container', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('opens each damage observation on its own source photo and returns focus', async ({
    page,
  }) => {
    await page.route(/api\.openai\.com\/v1\/decisions/, async (route) => {
      const body = route.request().postData() ?? ''
      const reply = body.includes('D1T_DT')
        ? openAiShape(doorReply())
        : surveyReply('COYU2668130', 'rear_doors')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(reply),
      })
    })
    await openWithTwoPhotos(page)
    const sources = page.getByRole('button', { name: /^View photo [12]:/ })
    await expect(sources).toHaveCount(2)
    for (const index of [1, 0]) {
      const source = sources.nth(index)
      await source.click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.locator('img')).toHaveAttribute(
        'alt',
        `Container photo ${index + 1}: ${path.basename(photos[index]!)}`,
      )
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(source).toBeFocused()
    }
  })

  test('takes several photos at once and refuses more than five', async ({ page }) => {
    await answerWith(page, ['COYU2668130'])
    await openWithTwoPhotos(page)
    await expect(page.locator('.rs-photos__item')).toHaveCount(2)
    await expect(page.getByText('Photo 2')).toBeVisible()
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'intake.png') })
    // A run is in flight, so a further choice is ignored; the refusal shows once the run has finished.
    await page.locator('#stage.qs-arrived').waitFor()
    await page.locator('input[type="file"]').setInputFiles([...photos, ...photos, ...photos])
    await expect(page.getByRole('alert')).toHaveText('Choose up to 5 photos of one container.')
    await expect(page.locator('.rs-photos__item')).toHaveCount(2)
  })

  test('inspects five photos together as one container', async ({ page }) => {
    await answerWith(page, ['COYU2668130'])
    await openWithTwoPhotos(page, [...photos, ...photos, photos[0]!])
    await expect(page.locator('.rs-photos__item')).toHaveCount(5)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('fits five photos in one centred row at 1920px', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await answerWith(page, ['COYU2668130'])
    await openWithTwoPhotos(page, [...photos, ...photos, photos[0]!])
    await expect(page.locator('.rs-photos__item')).toHaveCount(5)
    const boxes = await page.locator('.rs-photos__frame').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, right: r.right, height: r.height }
      }),
    )
    expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(1)
    expect(boxes[0]!.x).toBeGreaterThanOrEqual(0)
    expect(boxes[4]!.right).toBeLessThanOrEqual(1920)
    expect(boxes.every((b) => b.height > 150)).toBe(true)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('shows each photo’s face as a chip under it, never over it', async ({ page }) => {
    await answerWith(page, ['COYU2668130'])
    await openWithTwoPhotos(page)
    await page.locator('#stage.qs-arrived').waitFor()

    const chips = page.locator('[data-face-chip]')
    await expect(chips).toHaveText(['Doors', /^(Long side|Left side|Right side)$/])
    const frame = await page.locator('.rs-photos__frame').first().boundingBox()
    const chip = await chips.first().boundingBox()
    expect(chip!.y).toBeGreaterThanOrEqual(frame!.y + frame!.height)
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'chips.png') })
  })

  test('warns when two photos read different containers, and combines nothing', async ({
    page,
  }) => {
    await answerWith(page, ['COYU2668130', 'APHU6586847'])
    await openWithTwoPhotos(page)
    await page.locator('#stage.qs-arrived').waitFor()

    await expect(page.getByText('These photos may be of different containers')).toBeVisible()
    await expect(page.locator('.qs-id')).toHaveCount(0)
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'different.png') })
  })
})
