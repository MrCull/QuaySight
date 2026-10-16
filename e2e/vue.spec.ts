import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const samplePhoto = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../samples/rear-door-aphu-45g1.jpg',
)

// Recorded-sample walking skeleton: no key, no network call.
test('recorded run shows the container ID and the recorded label', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles(samplePhoto)
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
})
