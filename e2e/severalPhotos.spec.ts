import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

async function openWithTwoPhotos(page: Page) {
  await page.goto('/')
  await page.locator('#provider-button').click()
  await page.getByTestId('provider-option-luna').click()
  const key = page.getByLabel('OpenAI API key', { exact: true })
  await key.fill(PLACEHOLDER_KEY)
  await key.press('Enter')
  await page.locator('input[type="file"]').setInputFiles(photos)
}

test.describe('Several photos of one container', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('takes several photos at once and refuses more than five', async ({ page }) => {
    await openWithTwoPhotos(page)
    await expect(page.locator('.rs-photos__item')).toHaveCount(2)
    await expect(page.getByText('Photo 2')).toBeVisible()
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'intake.png') })

    await page.locator('input[type="file"]').setInputFiles([...photos, ...photos, ...photos, photos[0]!])
    await expect(page.getByRole('alert')).toHaveText('Choose up to 5 photos of one container.')
    await expect(page.locator('.rs-photos__item')).toHaveCount(2)
  })

  test('inspects five photos together as one container', async ({ page }) => {
    await answerWith(page, ['COYU2668130'])
    await openWithTwoPhotos(page)
    await page.locator('input[type="file"]').setInputFiles([...photos, ...photos, photos[0]!])
    await expect(page.locator('.rs-photos__item')).toHaveCount(5)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('shows each photo’s face as a chip under it, never over it', async ({ page }) => {
    await answerWith(page, ['COYU2668130'])
    await openWithTwoPhotos(page)
    await page.getByRole('button', { name: 'Run live inspection' }).click()
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
    await page.getByRole('button', { name: 'Run live inspection' }).click()
    await page.locator('#stage.qs-arrived').waitFor()

    await expect(page.getByText('These photos may be of different containers')).toBeVisible()
    await expect(page.locator('.qs-id')).toHaveCount(0)
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'different.png') })
  })
})
