import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COYU_WEIGHTS, weightChoices } from '../src/__tests__/weightReplies'
import { openAiSurveyReply, type SurveyChoice } from '../src/__tests__/surveyReplies'

/**
 * The Metric / Imperial toggle in the Container details heading (spec #27, ticket #34): it starts on
 * Metric, switches the display only, and is remembered in this browser across reloads. A live run on
 * OpenAI's route answered from a stubbed survey reply (COYU 266813 0's door, weights read in both units):
 * nothing leaves the app origin and the key is a placeholder. Demo mode cannot show weights until the
 * demo photos are recorded with the whole plan.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const photo = path.join(ROOT, 'samples', 'rear-door-coyu-22g1.jpg')
const PLACEHOLDER_KEY = 'playwright-placeholder-not-a-key'

const DETAILS: Record<string, SurveyChoice> = {
  size_type_code: [['22G1', 0.95]],
  photo_face: [['rear_doors', 0.96]],
}
const surveyReply = JSON.stringify(
  openAiSurveyReply('COYU2668130', { details: { ...DETAILS, ...weightChoices(COYU_WEIGHTS) } }),
)

async function inspectRearDoors(page: Page) {
  // Every Decisions call answers with the survey reply; the damage sets find none of their own answers in it.
  await page.route(/api\.openai\.com\/v1\/decisions/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: surveyReply }),
  )
  await page.goto('/')
  await page.locator('#provider-button').click()
  await page.getByTestId('provider-option-luna').click()
  const key = page.getByLabel('OpenAI API key', { exact: true })
  await key.fill(PLACEHOLDER_KEY)
  await key.press('Enter')
  await page.locator('input[type="file"]').setInputFiles(photo)
  await page.getByRole('button', { name: 'Run live inspection' }).click()
  await page.locator('#stage.qs-arrived').waitFor()
}

const units = (page: Page) => page.getByRole('group', { name: 'Units' })
const maxGross = (page: Page) =>
  page.locator('.qs-field', { has: page.locator('.qs-field__label', { hasText: 'MAX GROSS' }) })

test.describe('units toggle', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('starts on Metric, switches the display and survives a reload', async ({ page }) => {
    await inspectRearDoors(page)

    await expect(units(page).getByRole('button', { name: 'Metric' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(maxGross(page)).toContainText('30,480 kg')

    await units(page).getByRole('button', { name: 'Imperial' }).click()
    await expect(units(page).getByRole('button', { name: 'Imperial' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(maxGross(page)).toContainText('67,200 lb')
    await expect(maxGross(page)).not.toContainText('30,480 kg')

    await page.reload()
    await inspectRearDoors(page)
    await expect(units(page).getByRole('button', { name: 'Imperial' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(maxGross(page)).toContainText('67,200 lb')

    await units(page).getByRole('button', { name: 'Metric' }).click()
    await page.reload()
    await inspectRearDoors(page)
    await expect(maxGross(page)).toContainText('30,480 kg')
  })

  test('is in the Container details heading, and the exports still carry both units', async ({
    page,
  }) => {
    await inspectRearDoors(page)
    const heading = page.locator('.rs-card__head', { hasText: 'Container details' })
    await expect(heading.getByRole('group', { name: 'Units' })).toBeVisible()

    await units(page).getByRole('button', { name: 'Imperial' }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: /Export JSON/ }).click()
    const file = await (await download).createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of file) chunks.push(chunk as Buffer)
    const exported = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
      values: { field: string; value: number; unit?: string }[]
    }
    expect(exported.values.find((v) => v.field === 'maxGross')).toMatchObject({
      value: 30480,
      unit: 'kg',
    })
    expect(exported.values.find((v) => v.field === 'maxGross.lb')).toMatchObject({
      value: 67200,
      unit: 'lb',
    })
  })
})
