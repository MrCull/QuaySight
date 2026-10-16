import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const samplePhoto = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../samples/rear-door-aphu-45g1.jpg',
)

// A placeholder typed into the field. It is not a credential and no provider receives it in these tests.
const PLACEHOLDER_KEY = 'playwright-placeholder-not-a-key'

async function choosePhoto(page: Page) {
  await page.locator('input[type="file"]').setInputFiles(samplePhoto)
}

/** Types the placeholder on the setup card, optionally ticks replay, then continues to the inspection screen. */
async function enterKey(page: Page, { replay = false }: { replay?: boolean } = {}) {
  // OpenRouter is pre-selected; these runs use OpenAI's recorded Luna responses.
  await page.locator('#provider-button').click()
  await page.getByRole('option', { name: /GPT-6 Luna/ }).click()
  const key = page.getByLabel('OpenAI API key', { exact: true })
  await key.fill(PLACEHOLDER_KEY)
  if (replay) {
    await page.getByRole('checkbox', { name: /Replay the recorded sample/ }).check()
    await page.getByRole('button', { name: 'Continue' }).click()
  } else {
    await key.press('Enter')
  }
}

function trackProviderRequests(page: Page): string[] {
  const hits: string[] = []
  page.on('request', (request) => {
    if (/openai\.com|openrouter\.ai|typesafe\.ai/.test(request.url())) hits.push(request.url())
  })
  return hits
}

test('start is impossible without a key, for a recorded sample or a live run', async ({ page }) => {
  const providerRequests = trackProviderRequests(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()

  // Continue with a key, then clear it from the settings drawer: nothing can start.
  await enterKey(page)
  await page.getByRole('button', { name: /^Settings:/ }).click()
  await page.getByRole('button', { name: 'Clear' }).click()
  await page.keyboard.press('Escape')
  await choosePhoto(page)
  const start = page.getByRole('button', { name: 'Run live inspection' })
  await expect(start).toBeDisabled()
  await expect(page.getByText("Enter this provider's key in settings to start")).toBeVisible()
  expect(providerRequests).toEqual([])
})

test('the cost line is quiet and the detailed panel opens only on click', async ({ page }) => {
  await page.goto('/')
  await enterKey(page, { replay: true })
  await choosePhoto(page)
  await page.getByRole('button', { name: 'Start inspection' }).click()
  await expect(page.getByText('Recorded demonstration: GPT-6 Luna / gpt-6-luna')).toBeVisible()

  const toggle = page.locator('button.qs-cost__toggle')
  await expect(toggle).toContainText('Saved result · no live API charge')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.qs-cost__panel')).toHaveCount(0)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.qs-cost__panel')).toBeVisible()
  await expect(page.locator('.qs-cost__foot')).toContainText('not an invoice')
})

// Recorded-sample walking skeleton: key entered, replay chosen, no network call to any provider.
test('recorded run shows the container ID and the recorded label', async ({ page }) => {
  const providerRequests = trackProviderRequests(page)
  await page.goto('/')
  await enterKey(page, { replay: true })
  await choosePhoto(page)
  const start = page.getByRole('button', { name: 'Start inspection' })
  await expect(start).toBeEnabled()
  await start.click()
  await expect(page.getByText('Recorded demonstration: GPT-6 Luna / gpt-6-luna')).toBeVisible()
  // Scope to the Container ID card: other cards (details, checks) also carry certainty chips.
  const idCard = page
    .locator('.rs-card')
    .filter({ has: page.locator('.rs-k', { hasText: 'Container ID' }) })
  await expect(idCard.locator('.qs-cert', { hasText: 'Confident' })).toBeVisible()
  expect(providerRequests).toEqual([])
})
