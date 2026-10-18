import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const samplePhoto = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../samples/rear-door-aphu-45g1.jpg',
)

// A placeholder typed into the real field. It is not a credential and no provider receives it.
const PLACEHOLDER_KEY = 'playwright-placeholder-not-a-key'

const setupCard = (page: Page) => page.getByRole('region', { name: 'Set up a provider' })

test.describe('first visit', () => {
  test('shows only the setup card, with the recommended provider and model chosen', async ({
    page,
  }) => {
    await page.goto('/')
    const card = setupCard(page)
    await expect(card).toBeVisible()
    await expect(card.locator('#provider-button')).toContainText('OpenRouter')
    await expect(card.locator('#provider-button')).toContainText('Recommended')
    await expect(card.getByLabel('Model version')).toHaveValue('~typesafe/jev-latest')
    await expect(card.getByLabel('OpenRouter API key', { exact: true })).toHaveValue('')
    await expect(card.getByText("OpenRouter's Decisions endpoint")).toBeVisible()

    await expect(page.locator('input[type="file"]')).toHaveCount(0)
    await expect(page.getByText('Drop a container photo here')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: /Run live inspection|Start inspection|Replace photo/ }),
    ).toHaveCount(0)
    await expect(page.locator('#stage')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'New inspection' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Enter as demo user' })).toBeVisible()
  })
})

async function continueWithKey(page: Page) {
  await page.goto('/')
  const key = setupCard(page).getByLabel('OpenRouter API key', { exact: true })
  await key.fill(PLACEHOLDER_KEY)
  await setupCard(page).getByRole('button', { name: 'Continue' }).click()
}

const chip = (page: Page) => page.locator('.rs-top').getByRole('button', { name: /^Settings:/ })
const drawer = (page: Page) => page.getByRole('dialog', { name: 'Settings' })

test.describe('continue', () => {
  test('stays disabled until a key is entered, and Enter in the key field continues', async ({
    page,
  }) => {
    await page.goto('/')
    const continueButton = setupCard(page).getByRole('button', { name: 'Continue' })
    const key = setupCard(page).getByLabel('OpenRouter API key', { exact: true })
    await expect(continueButton).toBeDisabled()
    await key.fill('   ')
    await expect(continueButton).toBeDisabled()
    await key.fill(PLACEHOLDER_KEY)
    await expect(continueButton).toBeEnabled()

    await key.press('Enter')
    await expect(setupCard(page)).toHaveCount(0)
    await expect(page.getByText('Drop a container photo here')).toBeVisible()
  })

  test('starts focus on the provider and moves in a logical order to Continue', async ({
    page,
  }) => {
    await page.goto('/')
    const card = setupCard(page)
    await expect(card.locator('#provider-button')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(card.getByLabel('Model version')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(card.getByLabel('OpenRouter API key', { exact: true })).toBeFocused()
    await page.keyboard.type(PLACEHOLDER_KEY)
    await page.keyboard.press('Tab')
    await expect(card.getByRole('button', { name: 'Show key' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(card.getByRole('button', { name: 'Clear' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(card.getByRole('button', { name: 'Continue' })).toBeFocused()
    // Then the demo entry under the card.
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Enter as demo user' })).toBeFocused()
  })
})

test.describe('header chip and settings drawer', () => {
  test('the chip shows provider, model and key status, and no key characters', async ({ page }) => {
    await continueWithKey(page)
    await expect(chip(page)).toBeVisible()
    await expect(chip(page)).toContainText('OpenRouter')
    await expect(chip(page)).toContainText('Jev latest')
    await expect(chip(page)).not.toContainText('key set')
    await expect(chip(page)).toHaveAttribute('title', /Jev latest \(TypeSafe\).* · key set$/)
    const shown =
      (await page.locator('.rs-top').innerText()) + (await chip(page).getAttribute('aria-label'))
    expect(shown).not.toContain(PLACEHOLDER_KEY)
    expect(shown).not.toContain(PLACEHOLDER_KEY.slice(-4))
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
  })

  test('the chip opens the drawer; Escape, the close control and a click outside each close it', async ({
    page,
  }) => {
    await continueWithKey(page)

    await chip(page).click()
    await expect(drawer(page)).toBeVisible()
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(drawer(page).locator('#provider-button')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(drawer(page)).toHaveCount(0)
    await expect(chip(page)).toBeFocused()

    await chip(page).click()
    await drawer(page).getByRole('button', { name: 'Close settings' }).click()
    await expect(drawer(page)).toHaveCount(0)
    await expect(chip(page)).toBeFocused()

    await chip(page).click()
    await expect(drawer(page)).toBeVisible()
    await page.locator('.qs-brand').click()
    await expect(drawer(page)).toHaveCount(0)
    await expect(chip(page)).toBeFocused()
  })

  test('the drawer reveals, hides and clears the key; a cleared key stops live runs', async ({
    page,
  }) => {
    await continueWithKey(page)
    await page.locator('input[type="file"]').setInputFiles(samplePhoto)
    await expect(page.locator('.rs-photo__img')).toBeVisible()

    await chip(page).click()
    const key = drawer(page).getByLabel('OpenRouter API key', { exact: true })
    await expect(key).toHaveAttribute('type', 'password')
    await drawer(page).getByRole('button', { name: 'Show key' }).click()
    await expect(key).toHaveAttribute('type', 'text')
    await drawer(page).getByRole('button', { name: 'Hide key' }).click()
    await expect(key).toHaveAttribute('type', 'password')

    await drawer(page).getByRole('button', { name: 'Clear' }).click()
    await expect(key).toHaveValue('')
    await drawer(page).getByRole('button', { name: 'Done' }).click()
    await expect(chip(page)).toContainText('no key')

    // Choosing photos with no key opens the drawer; saving the key starts the inspection.
    await page.getByRole('button', { name: 'New inspection' }).click()
    await page.locator('input[type="file"]').setInputFiles(samplePhoto)
    await expect(drawer(page)).toBeVisible()
    await key.fill(PLACEHOLDER_KEY)
    await key.press('Enter')
    await expect(drawer(page)).toHaveCount(0)
    await expect(page.locator('#stage.qs-arriving, #stage.qs-arrived')).toBeVisible()
  })

  test('changing the provider blanks the screen; changing only the key does not', async ({
    page,
  }) => {
    await continueWithKey(page)
    await page.locator('input[type="file"]').setInputFiles(samplePhoto)
    await expect(page.locator('.rs-photo__img')).toBeVisible()

    // Only the key: the photo stays.
    await chip(page).click()
    await drawer(page)
      .getByLabel('OpenRouter API key', { exact: true })
      .fill(`${PLACEHOLDER_KEY}-2`)
    await page.keyboard.press('Escape')
    await expect(page.locator('.rs-photo__img')).toBeVisible()

    // A new provider: a blank screen, the new provider in the chip, and its own empty key.
    await chip(page).click()
    await drawer(page).locator('#provider-button').click()
    await expect(drawer(page).getByTestId('provider-option-luna').locator('strong')).toHaveText(
      'OpenAI',
    )
    await drawer(page).getByTestId('provider-option-luna').click()
    await expect(drawer(page).locator('#provider-button strong')).toHaveText('OpenAI')
    await expect(page.locator('.rs-photo__img')).toHaveCount(0)
    await expect(page.getByText('Drop a container photo here')).toBeVisible()
    await expect(drawer(page).getByLabel('OpenAI API key', { exact: true })).toHaveValue('')
    await expect(chip(page)).toContainText('GPT-6 Luna')
    await expect(chip(page)).toContainText('OpenAI')
    await expect(chip(page)).toContainText('no key')
  })

  test('changing the model blanks the screen', async ({ page }) => {
    await continueWithKey(page)
    await page.locator('input[type="file"]').setInputFiles(samplePhoto)
    await expect(page.locator('.rs-photo__img')).toBeVisible()

    await chip(page).click()
    await drawer(page).getByLabel('Model version').selectOption('typesafe/jev-1.13')
    await expect(page.locator('.rs-photo__img')).toHaveCount(0)
    await expect(chip(page)).toContainText('Jev 1.13')
    await expect(chip(page)).toHaveAttribute('title', /key set$/)
  })
})

test.describe('refresh', () => {
  test('remembers the provider and model, never the key', async ({ page }) => {
    await page.goto('/')
    await setupCard(page).getByLabel('Model version').selectOption('typesafe/jev-1.14')
    await setupCard(page).getByLabel('OpenRouter API key', { exact: true }).fill(PLACEHOLDER_KEY)
    await setupCard(page).getByRole('button', { name: 'Continue' }).click()
    await expect(chip(page)).toContainText('Jev 1.14')

    await page.reload()
    await expect(setupCard(page)).toBeVisible()
    await expect(setupCard(page).locator('#provider-button')).toContainText('OpenRouter')
    await expect(setupCard(page).getByLabel('Model version')).toHaveValue('typesafe/jev-1.14')
    await expect(setupCard(page).getByLabel('OpenRouter API key', { exact: true })).toHaveValue('')
    await expect(setupCard(page).getByRole('button', { name: 'Continue' })).toBeDisabled()

    const stored = await page.evaluate(() =>
      JSON.stringify([{ ...localStorage }, { ...sessionStorage }]),
    )
    expect(stored).toContain('typesafe/jev-1.14')
    expect(stored).not.toContain(PLACEHOLDER_KEY)
  })
})

test.describe('phone width (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  const noSideScroll = async (page: Page) => {
    const size = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    expect(size.scroll).toBeLessThanOrEqual(size.client)
  }

  test('the setup card and the drawer fit without horizontal scroll', async ({ page }) => {
    await page.goto('/')
    await setupCard(page).locator('#provider-button').click()
    await expect(setupCard(page).getByTestId('provider-option-luna')).toBeVisible()
    await noSideScroll(page)
    await setupCard(page).locator('#provider-button').click()

    await setupCard(page).getByLabel('OpenRouter API key', { exact: true }).fill(PLACEHOLDER_KEY)
    await setupCard(page).getByRole('button', { name: 'Continue' }).click()
    await noSideScroll(page)
    await chip(page).click()
    await expect(drawer(page)).toBeVisible()
    // Measure once the slide-in has finished.
    await drawer(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
    const box = await drawer(page).boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
    await noSideScroll(page)
  })
})
