import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'

const SHOTS = process.env.QS_SHOT_DIR

/**
 * Full-screen photo viewer (ticket #93): clicking the container photo shows the original filling the screen;
 * a click, the × or Esc closes it and focus returns to the photo. Runs in demo mode, so no key and no requests.
 */
async function openSample(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter as demo user' }).click()
  await page.getByRole('button', { name: /Rear doors with markings/ }).click()
}

const viewer = (page: Page) => page.getByRole('dialog')

test.describe('photo viewer', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('opens the photo full screen and closes on a click, the × or Esc', async ({ page }) => {
    await openSample(page)
    const photo = page.getByRole('button', { name: /^Enlarge photo/ }).first()

    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'stage.png') })
    await photo.click()
    await expect(viewer(page)).toBeVisible()
    const img = viewer(page).locator('img')
    await expect(img).toBeVisible()
    if (SHOTS)
      await page.screenshot({ path: path.join(SHOTS, 'viewer.png'), animations: 'disabled' })
    const box = await img.boundingBox()
    // Fitted to the screen: far larger than the stage photo it came from.
    expect(box!.width > 900 || box!.height > 600).toBe(true)

    await img.click()
    await expect(viewer(page)).toHaveCount(0)
    await expect(photo).toBeFocused()

    await photo.click()
    await viewer(page).getByRole('button', { name: 'Close photo' }).click()
    await expect(viewer(page)).toHaveCount(0)

    await photo.press('Enter')
    await expect(viewer(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(viewer(page)).toHaveCount(0)
    await expect(photo).toBeFocused()

    // Space opens it too; Tab stays inside it while it is open.
    await photo.press(' ')
    await expect(viewer(page)).toBeVisible()
    for (let i = 0; i < 3; i++) await page.keyboard.press('Tab')
    await expect(viewer(page).getByRole('button', { name: 'Close photo' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(viewer(page)).toHaveCount(0)
  })

  test('opens while the inspection is analysing, over the sweep', async ({ page }) => {
    await openSample(page)
    await page
      .getByRole('button', { name: /^Enlarge photo/ })
      .first()
      .click()
    await expect(viewer(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(viewer(page)).toHaveCount(0)
  })
})
