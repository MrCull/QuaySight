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
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lunaSmoke) }),
  )
}

const choosePhoto = (page: Page) => page.locator('input[type="file"]').setInputFiles(samplePhoto)
const costLine = (page: Page) => page.locator('.rs-top .qs-cost__toggle')
const newInspection = (page: Page) => page.getByRole('button', { name: 'New inspection' })

async function liveRun(page: Page) {
  await mockDecisions(page)
  await page.goto('/')
  await choosePhoto(page)
  const key = page.getByLabel('OpenAI API key', { exact: true }).first()
  await key.fill(PLACEHOLDER_KEY)
  await key.press('Enter')
  await page.getByRole('button', { name: 'Run live inspection' }).click()
  await page.locator('#stage.qs-arrived').waitFor()
}

test.describe('New inspection', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('is in the header, reachable by keyboard with a visible focus ring', async ({ page }) => {
    await page.goto('/')
    const button = page.locator('.rs-top').getByRole('button', { name: 'New inspection' })
    await expect(button).toBeVisible()

    // Tab order in the top bar: the cost indicator, then New inspection.
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(button).toBeFocused()
    const outline = await button.evaluate((el) => {
      const style = getComputedStyle(el)
      return { style: style.outlineStyle, width: style.outlineWidth }
    })
    expect(outline).toEqual({ style: 'solid', width: '2px' })
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
    await expect(page.getByRole('button', { name: 'Run live inspection' })).toBeEnabled()
  })

  test('clears the manifest retry panel', async ({ page }) => {
    await page.goto('/')
    await choosePhoto(page)
    await page.getByLabel('OpenAI API key', { exact: true }).first().fill(PLACEHOLDER_KEY)
    await page.getByRole('checkbox', { name: /Replay the recorded sample/ }).check()
    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('button', { name: 'Start inspection' }).click()
    await page.locator('#stage.qs-arrived').waitFor()
    await page.getByRole('checkbox', { name: 'Container ID not visible in this sample' }).check()
    await page.getByRole('button', { name: 'Start inspection' }).click()
    const offer = page.getByRole('heading', { name: 'Container ID not identified' })
    await expect(offer).toBeVisible()

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
    await page.goto('/')
    await choosePhoto(page)
    const key = page.getByLabel('OpenAI API key', { exact: true }).first()
    await key.fill(PLACEHOLDER_KEY)
    await key.press('Enter')
    await page.getByRole('button', { name: 'Run live inspection' }).click()
    const release = await held
    await expect(page.locator('#stage.qs-arriving')).toBeVisible()

    await newInspection(page).click()
    await release()

    await expect(page.getByText('Drop a container photo here')).toBeVisible()
    // The cancelled call settles (it was sent, so its charge reaches the session total) and its result does not land.
    await expect(costLine(page)).not.toContainText('Session None yet')
    await expect(page.locator('#stage')).not.toHaveClass(/qs-arrived|qs-arriving/)
    await expect(page.locator('.rs-photo__img')).toHaveCount(0)
  })
})
