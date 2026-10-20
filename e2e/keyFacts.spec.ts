import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The key-facts tiles (ticket #102): Reading… placeholders as soon as a run starts, filled in as each part
 * arrives, a Placards tile only for a placard, and a click that brings the detail section into view.
 * Demo mode is recorded (no network); the live run answers OpenAI's Decisions endpoint from here, with a
 * placeholder key.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const coyuPhoto = path.join(ROOT, 'samples', 'rear-door-coyu-22g1.jpg')

const tile = (page: Page, id: 'id' | 'seal' | 'damage' | 'placards') =>
  page.locator(`[data-tile="${id}"]`)

async function startDemo(page: Page, sample = 'Rear doors with markings') {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter as demo user' }).click()
  await page.getByRole('button', { name: new RegExp(sample) }).click()
}

test.describe('key-facts tiles in demo mode', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('show Reading… as soon as the sample starts, then the values with their certainty words', async ({
    page,
  }) => {
    await startDemo(page)
    await expect(page.locator('#stage.qs-arriving')).toBeVisible()
    for (const id of ['id', 'seal', 'damage'] as const) {
      await expect(tile(page, id)).toContainText('Reading…')
    }
    await expect(page.getByRole('progressbar', { name: 'Inspection progress' })).toBeVisible()

    await page.locator('#stage.qs-arrived').waitFor()
    await expect(page.getByRole('progressbar')).toHaveCount(0)
    for (const id of ['id', 'seal', 'damage'] as const) {
      await expect(tile(page, id)).not.toContainText('Reading…')
      await expect(tile(page, id)).toHaveAttribute('data-state', 'arrived')
    }
    await expect(tile(page, 'id').locator('.qs-id')).toBeVisible()
    await expect(tile(page, 'id')).toContainText(/Confident|Likely|Uncertain|Can't tell/)
    // This recording shows a placard; the What we found summary is gone.
    await expect(tile(page, 'placards')).toContainText(/Class \d|Placard seen|placards/)
    await expect(page.getByText('What we found')).toHaveCount(0)
  })

  test('has no Placards tile for a sample with no placard', async ({ page }) => {
    await startDemo(page, 'Clean grey rear doors')
    await page.locator('#stage.qs-arrived').waitFor()
    await expect(tile(page, 'id')).toHaveAttribute('data-state', 'arrived')
    await expect(tile(page, 'placards')).toHaveCount(0)
  })

  test('a click brings the matching detail section into view, focused and highlighted', async ({
    page,
  }) => {
    await startDemo(page)
    await page.locator('#stage.qs-arrived').waitFor()

    // The tile's close-up is its own control: click the tile away from it.
    await tile(page, 'id').click({ position: { x: 8, y: 8 } })
    await expect(page.locator('#detail-id')).toBeFocused()
    await expect(page.locator('#detail-id')).toBeInViewport()
    await expect(page.locator('#detail-id')).toHaveClass(/qs-flash/)

    await tile(page, 'damage').click()
    await expect(page.locator('#detail-damage')).toBeFocused()
    await expect(page.locator('#detail-damage')).toBeInViewport()
  })

  test('has no horizontal page scroll at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await startDemo(page)
    await page.locator('#stage.qs-arrived').waitFor()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test.describe('key-facts tiles at 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })

  test('the photo strip, the tiles and the top of the readings are visible without scrolling', async ({
    page,
  }) => {
    await startDemo(page)
    await page.locator('#stage.qs-arrived').waitFor()
    await expect(page.locator('.rs-photos').first()).toBeInViewport()
    await expect(page.locator('.qs-keytiles')).toBeInViewport({ ratio: 1 })
    const readings = (await page.locator('.qs-ledger').boundingBox())!
    expect(readings.y).toBeLessThan(1080)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })
})

test.describe('key-facts tiles with reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })

  test('fill in without animation', async ({ page }) => {
    await startDemo(page)
    await page.locator('#stage.qs-arrived').waitFor()
    const duration = await tile(page, 'id').evaluate((el) => getComputedStyle(el).animationDuration)
    expect(duration).toBe('0s')
    await expect(tile(page, 'id')).toHaveCSS('opacity', '1')
  })
})

test.describe('the Placards tile on a live run', () => {
  test.use({ viewport: { width: 1440, height: 1100 } })

  const choice = (name: string, value: string, probability = 0.98) => ({
    type: 'choice',
    name,
    choice: value,
    probabilities: [{ value, probability }],
  })
  const two = (n: number) => String(n).padStart(2, '0')

  test('appears with its class and certainty word when a placard is seen', async ({ page }) => {
    const answers: unknown[] = 'COYU2668130'
      .split('')
      .map((ch, i) => choice(`id_char_${two(i + 1)}`, ch))
    answers.push(choice('photo_face', 'rear_doors', 0.96))
    answers.push({ type: 'predicate', name: 'placards_present', probability: 0.95 })
    answers.push({ type: 'predicate', name: 'placard_1_present', probability: 0.95 })
    answers.push(choice('placard_1_class', 'class_3', 0.93))
    for (const [i, d] of [...'1203'].entries())
      answers.push(choice(`placard_1_un_${i + 1}`, d, 0.93))
    await page.route(/api\.openai\.com\/v1\/decisions/, (route) => {
      const damage = (route.request().postData() ?? '').match(/Z1T_DT|D1T_DT/)
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          model: 'gpt-6-luna',
          answers: damage ? [] : answers,
          usage: { input_tokens: 6000, output_tokens: 0 },
        }),
      })
    })
    await page.goto('/')
    await page.locator('#provider-button').click()
    await page.getByTestId('provider-option-luna').click()
    const key = page.getByLabel('OpenAI API key', { exact: true })
    await key.fill('playwright-placeholder-not-a-key')
    await key.press('Enter')
    await page.locator('input[type="file"]').setInputFiles(coyuPhoto)
    await page.locator('#stage.qs-arrived').waitFor()

    await expect(tile(page, 'placards')).toContainText('Class 3, flammable liquids')
    await expect(tile(page, 'placards')).toContainText(/Confident|Likely|Uncertain/)
    await tile(page, 'placards').click()
    await expect(page.locator('#detail-markings')).toBeFocused()
  })
})
