import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const samplePhoto = path.join(ROOT, 'samples', 'rear-door-aphu-45g1.jpg')
const lunaSmoke = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src', 'fixtures', 'live', 'luna-smoke.json'), 'utf8'),
).response as { answers: Array<Record<string, unknown>> }

/**
 * The smoke response with position 4 read as U, so every position is read and a run is one call:
 * its ledger line and its result would land together.
 */
function everyPositionRead() {
  const body = structuredClone(lunaSmoke)
  const fourth = body.answers.find((answer) => answer.name === 'id_char_04')!
  fourth.choice = 'U'
  fourth.probabilities = [
    { value: 'U', probability: 0.97 },
    { value: 'J', probability: 0.02 },
  ]
  return body
}

// A placeholder typed through the real field. It is not a credential and no provider receives it.
const PLACEHOLDER_KEY = 'playwright-placeholder-not-a-key'

/** The Decisions endpoint answers from the recorded smoke response; nothing else leaves the app origin. */
async function mockDecisions(page: Page) {
  await page.route(/api\.openai\.com\/v1\/decisions/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(lunaSmoke),
    }),
  )
}

const choosePhoto = (page: Page) => page.locator('input[type="file"]').setInputFiles(samplePhoto)
const costLine = (page: Page) => page.locator('.rs-top .qs-cost__toggle')
const newInspection = (page: Page) =>
  page.getByRole('button', { name: /^(New inspection|Cancel)$/ })

/** Types the placeholder on the setup card and continues to the inspection screen. */
async function continueWithKey(page: Page) {
  await page.goto('/')
  // OpenRouter is pre-selected; these runs use OpenAI's recorded Luna responses.
  await page.locator('#provider-button').click()
  await page.getByTestId('provider-option-luna').click()
  const key = page.getByLabel('OpenAI API key', { exact: true })
  await key.fill(PLACEHOLDER_KEY)
  await key.press('Enter')
}

async function liveRun(page: Page) {
  await mockDecisions(page)
  await continueWithKey(page)
  await choosePhoto(page)
  await page.locator('#stage.qs-arrived').waitFor()
}

test.describe('New inspection', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('is in the header, reachable by keyboard with a visible focus ring', async ({ page }) => {
    await continueWithKey(page)
    const button = page.locator('.rs-top').getByRole('button', { name: 'New inspection' })
    await expect(button).toBeVisible()

    // Tab order in the top bar: New inspection comes first, then the settings chip.
    await button.focus()
    await page.keyboard.press('Tab')
    await expect(page.locator('.rs-top').getByRole('button', { name: /^Settings:/ })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(button).toBeFocused()
    const outline = await button.evaluate((el) => {
      const style = getComputedStyle(el)
      return { style: style.outlineStyle, width: style.outlineWidth }
    })
    expect(outline).toEqual({ style: 'solid', width: '2px' })
  })

  test('header reads brand, then New inspection centred, then model label and costs', async ({
    page,
  }) => {
    await continueWithKey(page)
    const box = async (loc: ReturnType<Page['locator']>) => (await loc.boundingBox())!
    const brand = await box(page.locator('.rs-top .qs-brand'))
    const action = await box(page.locator('.rs-top').getByRole('button', { name: 'New inspection' }))
    const chipBox = await box(page.locator('.rs-top .qs-settingschip'))
    const cost = await box(page.locator('.rs-top .qs-cost'))
    expect(brand.x + brand.width).toBeLessThan(action.x)
    expect(action.x + action.width).toBeLessThan(chipBox.x)
    expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(cost.x + 1)
    // Centred on the 1440 px page, give or take the bar's padding.
    expect(Math.abs(action.x + action.width / 2 - 720)).toBeLessThan(8)
    await expect(page.locator('.rs-top .qs-settingschip')).not.toContainText('key set')
  })

  test('after a live run, leaves a blank screen and keeps the key and the session total', async ({
    page,
  }) => {
    await liveRun(page)
    await expect(page.locator('.rs-photo__img')).toBeVisible()
    await expect(costLine(page)).not.toContainText('Session None yet')
    const session = await costLine(page).locator('b').nth(1).textContent()

    await newInspection(page).focus()
    await page.keyboard.press('Enter')

    await expect(page.locator('.rs-photo__img')).toHaveCount(0)
    await expect(page.getByText('Drop a container photo here')).toBeVisible()
    await expect(page.locator('#stage')).not.toHaveClass(/qs-arrived|qs-arriving/)
    await expect(page.getByRole('region', { name: 'Damage view' })).toHaveCount(0)
    await expect(page.locator('.qs-marker, .is-selected')).toHaveCount(0)
    await expect(costLine(page)).toContainText('This container None yet')
    await expect(costLine(page).locator('b').nth(1)).toHaveText(session ?? '')

    // The key survived: a new photo can run live straight away.
    await choosePhoto(page)
    await expect(page.locator('.rs-photo__img')).toBeVisible()
  })

  test('clears the manifest retry panel', async ({ page }) => {
    // Demo mode: the rear doors' recorded ID has an unread position, so the manifest offer opens.
    await page.goto('/')
    await page.getByRole('button', { name: 'Enter as demo user' }).click()
    await page.getByRole('button', { name: /Rear doors with markings/ }).click()
    await page.locator('#stage.qs-arrived').waitFor()
    const offer = page.getByRole('heading', { name: 'Container ID not identified' })
    await expect(offer).toBeVisible()
    await page.getByLabel('Container numbers from the manifest').fill('APHU 658684 7')

    await newInspection(page).click()

    await expect(offer).toHaveCount(0)
    await expect(page.getByLabel('Container numbers from the manifest')).toHaveCount(0)
  })

  test('during a running inspection, cancels it so no result appears', async ({ page }) => {
    // The first Decisions call is held until New inspection is pressed; any later call answers at once.
    const reply = {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(everyPositionRead()),
    }
    let answer: (() => Promise<void>) | null = null
    const held = new Promise<() => Promise<void>>((hold) => {
      void page.route(/api\.openai\.com\/v1\/decisions/, (route) => {
        if (answer) return route.fulfill(reply)
        answer = () => route.fulfill(reply)
        hold(answer)
      })
    })
    await continueWithKey(page)
    await choosePhoto(page)
    const release = await held
    await expect(page.locator('#stage.qs-arriving')).toBeVisible()

    await newInspection(page).click()
    await release()

    await expect(page.getByText('Drop a container photo here')).toBeVisible()
    // The call is aborted: it was sent, so the session counts it as cancelled with unknown cost, and its result never lands.
    await expect(costLine(page)).not.toContainText('Session None yet')
    await expect(page.locator('#stage')).not.toHaveClass(/qs-arrived|qs-arriving/)
    await expect(page.locator('.rs-photo__img')).toHaveCount(0)
  })
})

test.describe('header at phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('has no horizontal scroll and keeps New inspection visible and focusable', async ({
    page,
  }) => {
    await continueWithKey(page)
    const button = page.locator('.rs-top').getByRole('button', { name: 'New inspection' })
    await expect(button).toBeInViewport()
    await button.focus()
    await expect(button).toBeFocused()
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(over).toBeLessThanOrEqual(0)
  })
})
