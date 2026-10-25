import { test, expect } from '@playwright/test'

/**
 * The hover loupe renders 384 px square (6 × --space-8), not the 224 px it once was. Demo mode, so no key and
 * no requests.
 */
test.describe('photo loupe', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // Headless Chromium reports `hover: none`, which the loupe treats as a touch device; present a mouse.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window)
      window.matchMedia = (query: string) =>
        /hover: none|pointer: coarse/.test(query)
          ? ({ ...real('(min-width: 0px)'), matches: false, media: query } as MediaQueryList)
          : real(query)
    })
  })

  test('renders 384 px square beside the pointer', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Enter as demo user' }).click()
    await page.getByRole('button', { name: /Rear doors with markings/ }).click()

    await page.locator('#stage.qs-arrived').waitFor()
    const photo = page.locator('.rs-frame img').first()
    await expect(photo).toBeVisible()
    const box = await photo.boundingBox()
    const x = box!.x + box!.width / 2
    const y = box!.y + box!.height / 2
    await page.mouse.move(x, y)
    await page.mouse.move(x + 4, y + 4, { steps: 4 })

    const loupe = page.locator('.qs-loupe')
    await expect(loupe).toBeVisible()
    // The CSS width and height (6 × --space-8); the 1px border sits outside them.
    const css = await loupe.evaluate((el) => {
      const style = getComputedStyle(el)
      return [style.width, style.height]
    })
    expect(css).toEqual(['384px', '384px'])
  })

  // The ledger's close-up hangs down beside the rows below it; their empty boxes once took its lower half.
  test('shows over the whole of a ledger close-up', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Enter as demo user' }).click()
    await page.getByRole('button', { name: /Dusty blue container/ }).click()

    await page.locator('#stage.qs-arrived').waitFor()
    const crop = page.locator('.qs-ledger__crop .rs-crop__frame').first()
    await crop.scrollIntoViewIfNeeded()
    const box = (await crop.boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height * 0.75
    await page.mouse.move(x, y)
    await page.mouse.move(x + 2, y + 2, { steps: 4 })

    await expect(page.locator('.qs-loupe')).toBeVisible()
  })
})
