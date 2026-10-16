import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const samplePhoto = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../samples/rear-door-aphu-45g1.jpg',
)

/** The key gate applies to recorded runs too: enter a placeholder key and choose replay (no network call). */
async function prepareRecordedRun(page: Page) {
  await page.goto('/')
  // OpenRouter is pre-selected; these runs use OpenAI's recorded Luna responses.
  await page.locator('#provider-button').click()
  await page.getByRole('option', { name: /GPT-6 Luna OpenAI/ }).click()
  await page.getByLabel('OpenAI API key', { exact: true }).fill('playwright-placeholder-not-a-key')
  await page.getByRole('checkbox', { name: /Replay the recorded sample/ }).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.locator('input[type="file"]').setInputFiles(samplePhoto)
}

async function runSample(page: Page) {
  await prepareRecordedRun(page)
  await page.getByRole('button', { name: 'Start inspection' }).click()
  await expect(page.getByText('Recorded demonstration: GPT-6 Luna / gpt-6-luna')).toBeVisible()
}

test.describe('phone width (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('has no horizontal page scroll while analysing and after the result lands', async ({
    page,
  }) => {
    await prepareRecordedRun(page)
    await page.getByRole('button', { name: 'Start inspection' }).click()
    const width = () =>
      page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))
    const analysing = await width()
    expect(analysing.scroll).toBeLessThanOrEqual(analysing.client)
    await expect(page.getByText('Recorded demonstration: GPT-6 Luna / gpt-6-luna')).toBeVisible()
    const landed = await width()
    expect(landed.scroll).toBeLessThanOrEqual(landed.client)
  })
})

test.describe('laptop width (1440x900)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('keeps the photo fully in the 1440x900 viewport', async ({ page }) => {
    await runSample(page)
    // Each key element must start inside the 900px viewport; the photo must also end inside it.
    const startsInViewport = async (locator: ReturnType<Page['locator']>) => {
      const box = await locator.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y).toBeLessThan(900)
    }
    const photo = page.locator('.rs-photo')
    await startsInViewport(photo)
    const photoBox = await photo.boundingBox()
    expect(photoBox!.y + photoBox!.height).toBeLessThanOrEqual(900)
  })
})

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })

  test('the analysing sweep is removed; the stage card is still shown', async ({ page }) => {
    await prepareRecordedRun(page)
    await page.getByRole('button', { name: 'Start inspection' }).click()
    const sweep = page.locator('.rs-sweep')
    await expect(sweep).toBeHidden()
    await expect(page.locator('.rs-stagecard .qs-stage__title').first()).toHaveText(
      'Reading markings',
    )
  })
})
