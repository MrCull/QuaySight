import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { HOLD, kindOfRequest, rearDoorsScript } from './screens/mockRuns'

/** Demo mode, no key and no network call: the rear-doors sample, ready to start. */
async function prepareRecordedRun(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter as demo user' }).click()
  await page.getByRole('button', { name: /Rear doors with markings/ }).click()
}

async function runSample(page: Page) {
  await prepareRecordedRun(page)
  await expect(page.getByText('Recorded demonstration: GPT-6 Luna / gpt-6-luna')).toBeVisible()
}

test.describe('phone width (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('has no horizontal page scroll while analysing and after the result lands', async ({
    page,
  }) => {
    await prepareRecordedRun(page)
    const width = () =>
      page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))
    const analysing = await width()
    expect(analysing.scroll).toBeLessThanOrEqual(analysing.client)
    // The Reading… tiles sit under the photo, not over it, and the photo stays on screen.
    const photo = (await page.locator('.rs-photos__frame').first().boundingBox())!
    const tiles = (await page.locator('.qs-keyfacts').boundingBox())!
    expect(tiles.y).toBeGreaterThanOrEqual(photo.y + photo.height)
    expect(photo.y + photo.height).toBeLessThanOrEqual(844)
    expect(await page.locator('.rs-photos__frame .qs-keyfacts').count()).toBe(0)
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
    const photo = page.locator('.rs-photos__frame').first()
    await startsInViewport(photo)
    const photoBox = await photo.boundingBox()
    expect(photoBox!.y + photoBox!.height).toBeLessThanOrEqual(900)
  })
})

test.describe('desktop width (1920x1080)', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })

  test('shows the photo strip and the top of the readings without scrolling', async ({ page }) => {
    await runSample(page)
    await expect(page.locator('.qs-ledger')).toBeVisible()
    const strip = (await page.locator('.rs-photos__frame').first().boundingBox())!
    expect(strip.y + strip.height).toBeLessThanOrEqual(1080)
    // About 260px tall, centred, and not stretched to the full width.
    expect(strip.height).toBeGreaterThan(200)
    expect(strip.height).toBeLessThan(300)
    expect(strip.width).toBeLessThan(1920 * 0.5)
    const readings = (await page.locator('.qs-ledger').boundingBox())!
    expect(readings.y).toBeLessThan(1080 - 100)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0)
  })

  test('puts the damage under the readings, across the full width', async ({ page }) => {
    await runSample(page)
    await expect(page.locator('.rs-damage')).toBeVisible()
    const damage = (await page.locator('.rs-damage').boundingBox())!
    const readings = (await page.locator('.qs-ledger').boundingBox())!
    expect(damage.y).toBeGreaterThanOrEqual(readings.y + readings.height)
    expect(damage.width).toBeGreaterThanOrEqual(readings.width - 1)
  })
})

test.describe('tablet width (1000x800)', () => {
  test.use({ viewport: { width: 1000, height: 800 } })

  test('stacks the damage under the readings', async ({ page }) => {
    await runSample(page)
    await expect(page.locator('.rs-damage')).toBeVisible()
    const damage = (await page.locator('.rs-damage').boundingBox())!
    const readings = (await page.locator('.qs-ledger').boundingBox())!
    expect(damage.y).toBeGreaterThanOrEqual(readings.y + readings.height)
  })
})

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })

  test('the analysing sweep is removed; the Reading… tiles are still shown', async ({ page }) => {
    await prepareRecordedRun(page)
    const sweep = page.locator('.rs-sweep')
    await expect(sweep).toBeHidden()
    await expect(page.locator('[data-tile="id"]')).toContainText('Reading…')
  })
})

// A live run's top bar carries long cost words ("estimate", "Cost unavailable Partial estimate"); at no width may
// they push the page sideways, and on a laptop the settings chip keeps naming the model.
const coyuPhoto = path.resolve('samples/rear-door-coyu-22g1.jpg')

async function liveRun(page: Page, hold: Array<'side' | 'door'>, cancel: boolean) {
  const script = rearDoorsScript({}, Object.fromEntries(hold.map((kind) => [kind, HOLD])))
  await page.route(/api\.openai\.com\/v1\/decisions/, (route) => {
    const reply = script(kindOfRequest(route.request().postData() ?? ''), 1)
    if (reply === HOLD) return
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(reply),
    })
  })
  await page.goto('/')
  await page.locator('#provider-button').click()
  await page.getByTestId('provider-option-luna').click()
  const key = page.getByLabel('OpenAI API key', { exact: true })
  await key.fill('playwright-placeholder-not-a-key')
  await key.press('Enter')
  await page.locator('input[type="file"]').setInputFiles(coyuPhoto)
  if (cancel) {
    await expect(page.locator('[data-tile="id"]')).toHaveAttribute('data-state', 'arrived')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByText('Drop a container photo here').waitFor()
  } else {
    await page.locator('#stage.qs-arrived').waitFor()
  }
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
]) {
  test.describe(`live result at ${viewport.width}px`, () => {
    test.use({ viewport })

    test('a landed result and a cancelled run (back at the empty picker) have no horizontal page scroll', async ({
      page,
    }) => {
      await liveRun(page, [], false)
      expect(await overflow(page)).toBeLessThanOrEqual(0)
      await page.getByRole('button', { name: 'New inspection' }).click()
      await liveRun(page, ['side', 'door'], true)
      expect(await overflow(page)).toBeLessThanOrEqual(0)
    })
  })
}

test.describe('settings chip on a laptop', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  test('names the model in full while the cost reads Cost unavailable after a cancel', async ({
    page,
  }) => {
    await liveRun(page, ['side', 'door'], true)
    const text = page.locator('.rs-top .qs-settingschip__text')
    const fits = await text.evaluate((el) => el.scrollWidth <= el.clientWidth)
    expect(fits).toBe(true)
  })
})
