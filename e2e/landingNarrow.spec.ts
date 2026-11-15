import { test, expect } from '@playwright/test'

// The landing on a phone: one column, nothing wider than the screen, Start in reach.
test.describe('landing on a narrow screen', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  test('has no horizontal scroll, and Start is visible and clickable', async ({ page }) => {
    await page.goto('/')
    const landing = page.locator('.qs-landing')
    await expect(landing).toBeVisible()
    // Let the fonts land and the layout settle before measuring.
    await page.evaluate(() => document.fonts.ready)

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

    const start = landing.getByRole('button', { name: 'Start' })
    await expect(start).toBeInViewport({ ratio: 1 })
    const box = await start.boundingBox()
    if (!box) throw new Error('Start has no box')
    expect(box.height).toBeGreaterThanOrEqual(44)
    // Start is aria-disabled until a key is pasted, but it is never switched off, so press it where it is
    // drawn: a real pointer click that also proves nothing covers it.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    // Without a key, Start says what is missing and moves focus to the key field.
    await expect(landing.getByText('Paste your API key to start.')).toBeVisible()
    await expect(landing.getByLabel('OpenRouter API key', { exact: true })).toBeFocused()
  })
})
