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
import { doorReply, keyedReply } from '../src/__tests__/planReplies'
import { openRouterSurveyReply } from '../src/__tests__/surveyReplies'
import { fileURLToPath } from 'node:url'

test('a synthetic damage observation opens an aligned approximate highlight and unchanged original', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openDamage(page)
  const source = page.getByRole('button', { name: /^View photo 1:/ }).first()
  await source.click()
  const dialog = page.getByRole('dialog')
  const overlay = dialog.getByLabel('Approximate damage highlight')
  await expect(overlay).toBeVisible()
  const image = dialog.locator('img')
  const original = await image.getAttribute('src')
  async function aligned() {
    const img = (await image.boundingBox())!
    const rect = (await overlay.boundingBox())!
    expect(Math.abs(rect.x - (img.x + img.width * 0.6))).toBeLessThan(2)
    expect(Math.abs(rect.y - (img.y + img.height * 0.55))).toBeLessThan(2)
    expect(Math.abs(rect.width - img.width * 0.3)).toBeLessThan(2)
  }
  await aligned()
  if (SHOTS)
    await page.screenshot({
      path: path.join(SHOTS, 'damage-highlight.png'),
      animations: 'disabled',
    })
  await page.setViewportSize({ width: 390, height: 844 })
  await aligned()
  await dialog.getByRole('button', { name: 'Zoom to highlight' }).click()
  await aligned()
  await dialog.getByRole('button', { name: 'Show original' }).click()
  await expect(overlay).toHaveCount(0)
  await expect(image).toHaveAttribute('src', original!)
  await page.keyboard.press('Escape')
  await expect(source).toBeFocused()
})

const GOOD_LOCATION = keyedReply({
  target_present: { type: 'noul', noul: 0.95 },
  target_box: {
    type: 'box',
    confidence: 0.67,
    box: { top: 0.55, bottom: 0.8, left: 0.6, right: 0.9 },
  },
})
async function openDamage(
  page: Page,
  location: unknown = GOOD_LOCATION,
  enabled = true,
  unsupported = false,
  fail = false,
) {
  let locations = 0
  await page.route(/openrouter.ai\/api\/alpha\/decisions/, async (route) => {
    const body = route.request().postData() ?? ''
    if (body.includes('target_box')) locations++
    const response = body.includes('target_box')
      ? location
      : body.includes('D1T_DT')
        ? doorReply()
        : openRouterSurveyReply('COYU2668130', { details: { photo_face: [['rear_doors', 0.96]] } })
    await route.fulfill({
      status: fail && body.includes('target_box') ? 500 : 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })
  await page.goto('/')
  await expect(page.getByRole('checkbox', { name: 'Experimental damage highlights' })).toBeChecked()
  if (!enabled)
    await page.getByRole('checkbox', { name: 'Experimental damage highlights' }).uncheck()
  if (unsupported)
    await page.getByRole('combobox', { name: 'Model version' }).selectOption('typesafe/jev-1.13')
  const key = page.getByLabel('OpenRouter API key', { exact: true })
  await key.fill('playwright-placeholder-not-a-key')
  await key.press('Enter')
  await page
    .locator('input[type=file]')
    .setInputFiles(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../samples/rear-door-coyu-22g1.jpg'),
    )
  return () => locations
}

for (const scenario of ['absent', 'invalid', 'disabled', 'unsupported', 'failed'] as const) {
  test(`synthetic ${scenario} localisation keeps the finding and opens the original`, async ({
    page,
  }) => {
    const location =
      scenario === 'absent'
        ? keyedReply({
            target_present: { type: 'noul', noul: 0.2 },
            target_box: {
              type: 'box',
              confidence: 0.9,
              box: { top: 0.55, bottom: 0.8, left: 0.6, right: 0.9 },
            },
          })
        : scenario === 'invalid'
          ? keyedReply({
              target_present: { type: 'noul', noul: 0.95 },
              target_box: {
                type: 'box',
                confidence: 0.9,
                box: { top: 0.55, bottom: 0.8, left: -0.1, right: 0.9 },
              },
            })
          : GOOD_LOCATION
    const requests = await openDamage(
      page,
      location,
      scenario !== 'disabled',
      scenario === 'unsupported',
      scenario === 'failed',
    )
    await expect(page.locator('#stage.qs-arrived')).toBeVisible()
    await page
      .getByRole('button', { name: /^View photo 1:/ })
      .first()
      .click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('img')).toBeVisible()
    await expect(dialog.getByLabel('Approximate damage highlight')).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Show original' })).toHaveCount(0)
    expect(requests()).toBe(scenario === 'disabled' || scenario === 'unsupported' ? 0 : 1)
  })
}
