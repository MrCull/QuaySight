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
const lunaSmoke = fs.readFileSync(
  path.join(ROOT, 'src', 'fixtures', 'live', 'luna-smoke.json'),
  'utf8',
)
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
}

const stage = (page: Page, title: string) =>
  page.locator('.rs-stagecard li.qs-stage', { hasText: title })

test.describe('Live run progress and Cancel', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('stages advance as their requests settle (the ID, the details and the face share a request, the damage check is its own)', async ({
    page,
  }) => {
    // The survey (call 1) is held; the long-side and door-end damage requests (calls 2 and 3) answer at once.
    const edge = await decisions(page, [1])
    await startLive(page)
    await expect.poll(() => edge.held.length).toBe(1)

    await expect(stage(page, 'Reading the ID')).toHaveClass(/qs-stage--active/)
    await expect(stage(page, 'Reading container details')).toHaveClass(/qs-stage--active/)
    await expect(stage(page, 'Checking for damage')).toHaveClass(/qs-stage--done/)

    await edge.release(0)
    await page.locator('#stage.qs-arrived').waitFor()
    await expect(stage(page, 'Reading the ID')).toHaveClass(/qs-stage--done/)
    await expect(stage(page, 'Reading container details')).toHaveClass(/qs-stage--done/)
    await expect(stage(page, 'Reading the ID').locator('.qs-stage__time')).toHaveText(/^\d+\.\d s$/)
    await expect(page.locator('.qs-id')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0)
  })

  test('Cancel before anything arrives ends the run, keeps the photo and records the call as cancelled', async ({
    page,
  }) => {
    // The survey and both damage requests (long side, door end) are held, so nothing has arrived.
    const edge = await decisions(page, [1, 2, 3])
    await startLive(page)
    await expect.poll(() => edge.held.length).toBe(3)

    await page.getByRole('button', { name: 'Cancel' }).click()

    // Cancel clears straight back to the empty picker; the money already spent stays in the session total.
    await expect(page.getByText('Drop a container photo here')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.locator('.rs-photo__img')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'New inspection' })).toBeVisible()
    await expect(page.locator('#stage')).not.toHaveClass(/qs-arriving/)

    const cost = page.locator('.rs-top .qs-cost__toggle')
    await expect(cost).toContainText(/Session \$[0-9.]*[1-9]/)
    await cost.click()
    const line = page.locator('.qs-cost__table tbody tr', { hasText: 'cancelled' }).first()
    await expect(line).toContainText('Cost unknown')
  })

  test('a part that lands early is visible while the rest is still in flight (opacity, not just in the DOM)', async ({
    page,
  }) => {
    // The survey (call 1) answers; both damage requests (calls 2 and 3) stay held.
    const edge = await decisions(page, [2, 3])
    await startLive(page)
    await expect.poll(() => edge.held.length).toBe(2)
    await expect(stage(page, 'Reading the ID')).toHaveClass(/qs-stage--done/)
    await expect(page.locator('#stage')).toHaveClass(/qs-arriving/)

    // Each card plays its own arrival and ends fully drawn, inside the still-arriving screen.
    await expect(page.locator('.qs-found')).toHaveCSS('opacity', '1')
    await expect(page.locator('.rs-card', { has: page.locator('.qs-id') })).toHaveCSS(
      'opacity',
      '1',
    )
    await expect(page.locator('.rs-card', { hasText: 'Container details' })).toHaveCSS(
      'opacity',
      '1',
    )
    await expect(page.locator('.qs-id__ch').first()).toHaveCSS('opacity', '1')

    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('Cancel while the damage checks are in flight clears everything, with no damage view', async ({
    page,
  }) => {
    // The survey (call 1) answers; the long-side and door-end damage requests (calls 2 and 3) are held, then cancelled.
    const edge = await decisions(page, [2, 3])
    await startLive(page)
    await expect.poll(() => edge.held.length).toBe(2)
    await expect(stage(page, 'Reading the ID')).toHaveClass(/qs-stage--done/)

    await page.getByRole('button', { name: 'Cancel' }).click()

    // Cancel clears to the empty picker: nothing of the run is shown, not even what had arrived.
    await expect(page.getByText('Drop a container photo here')).toBeVisible()
    await expect(page.locator('.qs-notice--partial')).toHaveCount(0)
    await expect(page.locator('.qs-id')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Damage view' })).toHaveCount(0)
  })

  test('Cancel during a run clears to the picker but keeps the spent calls in the session', async ({
    page,
  }) => {
    // The reading and the damage checks answer; the closer look at the unread position (call 4) is held, then cancelled.
    const edge = await decisions(page, [4])
    await startLive(page)
    await expect.poll(() => edge.held.length).toBe(1)

    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByText('Drop a container photo here')).toBeVisible()
    await expect(page.locator('.qs-notice--partial')).toHaveCount(0)
    await expect(page.locator('.qs-id')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'New inspection' })).toBeVisible()
    await page.locator('.rs-top .qs-cost__toggle').click()
    await expect(page.locator('.qs-cost__table tbody tr', { hasText: 'cancelled' })).toHaveCount(1)
  })
})
