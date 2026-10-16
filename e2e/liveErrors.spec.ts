import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Live OpenAI errors, as the browser sees them (spec #16, Clear errors). OpenAI leaves CORS headers
 * off its error responses, so a refused call reaches the page as a failed fetch, the same as being
 * offline. The page tells them apart by whether the browser is online. The Decisions route is
 * aborted here, so nothing reaches OpenAI; the key is a placeholder.
 */
const samplePhoto = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../samples/rear-door-aphu-45g1.jpg',
)
const PLACEHOLDER_KEY = 'playwright-placeholder-not-a-key'

async function liveOpenAI(page: Page) {
  await page.route(/api\.openai\.com\/v1\/decisions/, (route) => route.abort('failed'))
  await page.goto('/')
  await page.locator('#provider-button').click()
  await page.getByTestId('provider-option-luna').click()
  const key = page.getByLabel('OpenAI API key', { exact: true })
  await key.fill(PLACEHOLDER_KEY)
  await key.press('Enter')
  await page.locator('input[type="file"]').setInputFiles(samplePhoto)
}

test('a refused OpenAI call while online says it was refused and names the likely causes', async ({
  page,
}) => {
  await liveOpenAI(page)
  await page.getByRole('button', { name: 'Run live inspection' }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('OpenAI refused the request.')
  await expect(alert).toContainText('Check the key, then try again.')
  await expect(alert).not.toContainText('Could not reach')
  await expect(alert).not.toContainText(PLACEHOLDER_KEY)
})

test('an offline browser says it could not reach OpenAI', async ({ page, context }) => {
  await liveOpenAI(page)
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Run live inspection' }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Could not reach OpenAI.')
  await expect(alert).not.toContainText('refused')
  await context.setOffline(false)
})
