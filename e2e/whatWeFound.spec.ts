import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COYU_WEIGHTS, weightChoices } from '../src/__tests__/weightReplies'
import { openAiSurveyReply } from '../src/__tests__/surveyReplies'

/**
 * "What we found" (spec 8.1, spec #27 ticket #36): the summary at the top of every result, live and
 * recorded, with the caveats first. The live run is answered from the recorded smoke response; nothing
 * leaves the app origin and the key is a placeholder.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const samplePhoto = path.join(ROOT, 'samples', 'rear-door-aphu-45g1.jpg')
const lunaSmoke = fs.readFileSync(path.join(ROOT, 'src', 'fixtures', 'live', 'luna-smoke.json'), 'utf8')
const reply = JSON.stringify((JSON.parse(lunaSmoke) as { response: unknown }).response)
const PLACEHOLDER_KEY = 'playwright-placeholder-not-a-key'
const BANNED = /\b(verified|supported|safe|passed|candidates?|retry|retries|undamaged|non-hazardous)\b/i

const found = (page: Page) => page.locator('.qs-found')

async function runLive(page: Page) {
  await page.route(/api\.openai\.com\/v1\/decisions/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: reply }),
  )
  await page.goto('/')
  await page.locator('#provider-button').click()
  await page.getByTestId('provider-option-luna').click()
  const key = page.getByLabel('OpenAI API key', { exact: true })
  await key.fill(PLACEHOLDER_KEY)
  await key.press('Enter')
  await page.locator('input[type="file"]').setInputFiles(samplePhoto)
  await page.locator('#stage.qs-arrived').waitFor()
}

async function runDemo(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter as demo user' }).click()
  await page.getByRole('button', { name: /Rear doors with markings/ }).click()
  await page.locator('#stage.qs-arrived').waitFor()
}

test.describe('What we found', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a live result opens with the summary: caveats first, then what was found', async ({
    page,
  }) => {
    await runLive(page)

    const card = found(page)
    await expect(card).toBeVisible()
    await expect(card.getByRole('heading', { name: 'What we found' })).toBeVisible()
    // The first card of the readings, above the container ID.
    const cards = page.locator('.rs-right > .qs-found, .rs-right > .rs-card')
    await expect(cards.first()).toHaveClass(/qs-found/)

    // The smoke response leaves a position of the ID unread: that is the first thing said.
    await expect(card.locator('.qs-found__headline')).toHaveText('Some of what we found is uncertain')
    await expect(card.locator('.qs-found__block .qs-found__label').first()).toHaveText(
      'What remains uncertain',
    )
    const order = await card.evaluate((el) => {
      const kids = [...el.children].map((c) => c.className)
      return {
        caveats: kids.findIndex((k) => k.includes('qs-found__block')),
        facts: kids.findIndex((k) => k.includes('qs-found__facts')),
      }
    })
    expect(order.caveats).toBeGreaterThan(-1)
    expect(order.caveats).toBeLessThan(order.facts)
    await expect(card).toContainText('The container ID is')
    expect((await card.innerText()).match(BANNED)).toBeNull()
  })

  test('a recorded result opens with the summary: the earlier recording leaves an ID position unread', async ({
    page,
  }) => {
    // The demo's APHU recording is Luna's earlier read of that photo (spec #27, ticket #37): the ID only.
    await runDemo(page)

    const card = found(page)
    await expect(card.locator('.qs-found__headline')).toHaveText('Some of what we found is uncertain')
    await expect(card.locator('.qs-found__block .qs-found__label').first()).toHaveText(
      'What remains uncertain',
    )
    await expect(card).toContainText('Markings and DG placards were not assessed in this inspection.')
    expect((await card.innerText()).match(BANNED)).toBeNull()
  })

  test('it follows the units toggle: the weights a live run read are said in the unit on screen', async ({
    page,
  }) => {
    // A live run answered with the COYU door's weights in both units (digit by digit).
    const weighed = JSON.stringify(
      openAiSurveyReply('COYU2668130', {
        details: {
          size_type_code: [['22G1', 0.95]],
          photo_face: [['rear_doors', 0.96]],
          ...weightChoices(COYU_WEIGHTS),
        },
      }),
    )
    await page.route(/api\.openai\.com\/v1\/decisions/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: weighed }),
    )
    await page.goto('/')
    await page.locator('#provider-button').click()
    await page.getByTestId('provider-option-luna').click()
    const key = page.getByLabel('OpenAI API key', { exact: true })
    await key.fill(PLACEHOLDER_KEY)
    await key.press('Enter')
    await page.locator('input[type="file"]').setInputFiles(samplePhoto)
    await page.locator('#stage.qs-arrived').waitFor()

    const card = found(page)
    await expect(card).toContainText('Maximum gross 30,480 kg, a rating, not the cargo weight')

    await page.getByRole('group', { name: 'Units' }).getByRole('button', { name: 'Imperial' }).click()
    await expect(card).toContainText('Maximum gross 67,200 lb, a rating, not the cargo weight')
    await expect(card).not.toContainText('30,480 kg')
    expect((await card.innerText()).match(BANNED)).toBeNull()
  })

  test('the summary has no horizontal scroll on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await runDemo(page)
    await expect(found(page)).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflow).toBe(false)
  })
})
