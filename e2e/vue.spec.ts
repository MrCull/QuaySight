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

/** Types the placeholder. Replay is ticked while the entry view is open; Done (or Enter) then collapses it. */
async function enterKey(page: Page, { replay = false }: { replay?: boolean } = {}) {
  const key = page.getByLabel('OpenAI API key', { exact: true }).first()
  await key.fill(PLACEHOLDER_KEY)
  if (replay) {
    await page.getByRole('checkbox', { name: /Replay the recorded sample/ }).check()
    await page.getByRole('button', { name: 'Done' }).click()
  } else {
    await key.press('Enter')
  }
}

function trackProviderRequests(page: Page): string[] {
  const hits: string[] = []
  page.on('request', (request) => {
    if (/openai\.com|typesafe\.ai/.test(request.url())) hits.push(request.url())
  })
  return hits
}

test('start is impossible without a key, for a recorded sample or a live run', async ({ page }) => {
  const providerRequests = trackProviderRequests(page)
  await page.goto('/')
  await choosePhoto(page)
  const start = page.getByRole('button', { name: 'Run live inspection' })
  await expect(start).toBeDisabled()
  await expect(page.getByText("Enter this provider's key to start")).toBeVisible()
  expect(providerRequests).toEqual([])
})

test('after a key is entered the selector collapses to one quiet summary row', async ({ page }) => {
  await page.goto('/')
  await choosePhoto(page)
  await expect(page.locator('input[type="password"]')).toBeVisible()
  await enterKey(page)

  const summary = page.locator('.rs-setup__summary')
  await expect(summary).toContainText('GPT-6 Luna')
  await expect(summary).toContainText('gpt-6-luna')
  await expect(summary).toContainText('key set')
  await expect(page.locator('input[type="password"]')).toHaveCount(0)

  await summary.getByRole('button', { name: 'Edit' }).click()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test('the cost line is quiet and the detailed panel opens only on click', async ({ page }) => {
  await page.goto('/')
  await choosePhoto(page)
  await enterKey(page, { replay: true })
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
  await choosePhoto(page)
  await enterKey(page, { replay: true })
  const start = page.getByRole('button', { name: 'Start inspection' })
  await expect(start).toBeEnabled()
  await start.click()
  await expect(page.getByText('Recorded demonstration: GPT-6 Luna / gpt-6-luna')).toBeVisible()
  // Scope to the Container ID card: other cards (details, checks) also carry certainty chips.
  const idCard = page
    .locator('.rs-card')
    .filter({ has: page.locator('.rs-k', { hasText: 'Container ID' }) })
  await expect(idCard.locator('.qs-cert', { hasText: 'Confident' })).toBeVisible()
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
  expect(providerRequests).toEqual([])
})
