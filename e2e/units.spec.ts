import { test, expect, type Page } from '@playwright/test'

/**
 * The Metric / Imperial toggle in the Container details heading (spec #27, ticket #34): it starts on
 * Metric, switches the display only, and is remembered in this browser across reloads. The recorded
 * sample is used, so no key and no request.
 */

async function inspectRearDoors(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter as demo user' }).click()
  await page.getByRole('button', { name: /Rear doors with markings/ }).click()
  await page.getByRole('button', { name: 'Start inspection' }).click()
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
    await expect(maxGross(page)).toContainText('32,500 kg')

    await units(page).getByRole('button', { name: 'Imperial' }).click()
    await expect(units(page).getByRole('button', { name: 'Imperial' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(maxGross(page)).toContainText('71,650 lb')
    await expect(maxGross(page)).not.toContainText('32,500 kg')

    await page.reload()
    await inspectRearDoors(page)
    await expect(units(page).getByRole('button', { name: 'Imperial' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(maxGross(page)).toContainText('71,650 lb')

    await units(page).getByRole('button', { name: 'Metric' }).click()
    await page.reload()
    await inspectRearDoors(page)
    await expect(maxGross(page)).toContainText('32,500 kg')
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
      value: 32500,
      unit: 'kg',
    })
    expect(exported.values.find((v) => v.field === 'maxGross.lb')).toMatchObject({
      value: 71650,
      unit: 'lb',
    })
  })
})
