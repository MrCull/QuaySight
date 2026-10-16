import { test, expect, type Page } from '@playwright/test'

/** Demo mode, no key and no network call: the rear-doors sample, ready to start. */
async function prepareRecordedRun(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter as demo user' }).click()
  await page.getByRole('button', { name: /Rear doors with markings/ }).click()
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
