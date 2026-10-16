import { test, expect, type Page, type Route } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Progress stages and Cancel on a live run (ticket #28). OpenAI's Decisions endpoint answers from the
 * recorded smoke response; nothing leaves the app origin and the key is a placeholder.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const samplePhoto = path.join(ROOT, 'samples', 'rear-door-aphu-45g1.jpg')
// The recorded smoke response leaves position 4 unread, so a run is the reading plus one re-check.
const lunaSmoke = fs.readFileSync(path.join(ROOT, 'src', 'fixtures', 'live', 'luna-smoke.json'), 'utf8')
const reply = JSON.stringify((JSON.parse(lunaSmoke) as { response: unknown }).response)
const PLACEHOLDER_KEY = 'playwright-placeholder-not-a-key'

/**
 * Routes the Decisions endpoint: calls are answered from the smoke response, except those numbered in
 * `hold`, which wait until released (or until the page aborts them).
 */
async function decisions(page: Page, hold: number[]) {
  const held: Route[] = []
  let calls = 0
  await page.route(/api\.openai\.com\/v1\/decisions/, (route) => {
    calls += 1
    if (hold.includes(calls)) {
      held.push(route)
      return
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: reply })
  })
  return {
    held,
    release: (i: number) =>
      held[i]!.fulfill({ status: 200, contentType: 'application/json', body: reply }),
  }
}

async function startLive(page: Page) {
  await page.goto('/')
  await page.locator('#provider-button').click()
  await page.getByTestId('provider-option-luna').click()
  const key = page.getByLabel('OpenAI API key', { exact: true })
  await key.fill(PLACEHOLDER_KEY)
  await key.press('Enter')
  await page.locator('input[type="file"]').setInputFiles(samplePhoto)
  await page.getByRole('button', { name: 'Run live inspection' }).click()
}

const stage = (page: Page, title: string) =>
  page.locator('.rs-stagecard li.qs-stage', { hasText: title })

test.describe('Live run progress and Cancel', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('stages advance as their requests settle; stages with no request say so', async ({
    page,
  }) => {
    const edge = await decisions(page, [1])
    await startLive(page)
    await expect.poll(() => edge.held.length).toBe(1)

    await expect(stage(page, 'Reading the ID')).toHaveClass(/qs-stage--active/)
    await expect(stage(page, 'Reading container details')).toHaveClass(/qs-stage--skipped/)
    await expect(stage(page, 'Reading container details')).toContainText('Not part of this run')
    await expect(stage(page, 'Checking for damage')).toContainText('Not part of this run')

    await edge.release(0)
    await page.locator('#stage.qs-arrived').waitFor()
    await expect(stage(page, 'Reading the ID')).toHaveClass(/qs-stage--done/)
    await expect(stage(page, 'Reading the ID').locator('.qs-stage__time')).toHaveText(/^\d+\.\d s$/)
    await expect(page.locator('.qs-id')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0)
  })

  test('Cancel before anything arrives ends the run, keeps the photo and records the call as cancelled', async ({
    page,
  }) => {
    const edge = await decisions(page, [1])
    await startLive(page)
    await expect.poll(() => edge.held.length).toBe(1)

    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByText('Inspection cancelled before any result arrived.')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.locator('.rs-photo__img')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run live inspection' })).toBeEnabled()
    await expect(page.locator('#stage')).not.toHaveClass(/qs-arriving/)

    const cost = page.locator('.rs-top .qs-cost__toggle')
    await expect(cost).not.toContainText('This container None yet')
    await cost.click()
    const line = page.locator('.qs-cost__table tbody tr').first()
    await expect(line).toContainText('cancelled')
    await expect(line).toContainText('Cost unknown')
  })

  test('Cancel during a run keeps what already arrived, marked partial', async ({ page }) => {
    // The reading answers; the closer look at the unread position is held, then cancelled.
    const edge = await decisions(page, [2])
    await startLive(page)
    await expect.poll(() => edge.held.length).toBe(1)

    await page.getByRole('button', { name: 'Cancel' }).click()

    await page.locator('#stage.qs-arrived').waitFor()
    const notice = page.locator('.qs-notice--partial')
    await expect(notice).toContainText('Partial result: cancelled before every part finished.')
    await expect(page.locator('.qs-id')).toBeVisible()
    await expect(page.getByRole('button', { name: 'New inspection' })).toBeVisible()
    await page.locator('.rs-top .qs-cost__toggle').click()
    await expect(page.locator('.qs-cost__table tbody tr')).toHaveCount(2)
    await expect(page.locator('.qs-cost__table tbody tr').nth(1)).toContainText('cancelled')
  })
})
