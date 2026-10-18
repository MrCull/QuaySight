import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Spec #27 ticket #30: the key-format warning and where focus lands after each step.

const samplePhoto = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../samples/rear-door-aphu-45g1.jpg',
)

// Placeholders typed into the real field. None is a credential and no provider receives one.
const WRONG_PREFIX_KEY = 'placeholder-without-prefix'
const OPENROUTER_SHAPED_KEY = 'sk-or-placeholder'

const setupCard = (page: Page) => page.getByRole('region', { name: 'Set up a provider' })
const keyField = (page: Page) => page.getByLabel('OpenRouter API key', { exact: true })
const warning = (page: Page) => page.locator('.qs-keywarn')
const dropZone = (page: Page) => page.locator('.qs-drop')
const newInspection = (page: Page) => page.getByRole('button', { name: 'New inspection' })

test.describe('key-format warning', () => {
  test('a wrong-prefix key shows the warning, without the key, and Continue still proceeds', async ({
    page,
  }) => {
    await page.goto('/')
    await keyField(page).fill(WRONG_PREFIX_KEY)
    await expect(warning(page)).toBeVisible()
    await expect(warning(page)).toContainText("This doesn't look like an OpenRouter key.")
    await expect(warning(page)).toContainText('OpenRouter keys start with sk-or-.')
    await expect(warning(page)).not.toContainText(WRONG_PREFIX_KEY)
    await expect(keyField(page)).toHaveAttribute('aria-describedby', /key-format/)

    const continueButton = setupCard(page).getByRole('button', { name: 'Continue' })
    await expect(continueButton).toBeEnabled()
    await continueButton.click()
    await expect(setupCard(page)).toHaveCount(0)
    await expect(page.getByText('Drop a container photo here')).toBeVisible()
  })

  test('a key with the right prefix shows nothing', async ({ page }) => {
    await page.goto('/')
    await keyField(page).fill(OPENROUTER_SHAPED_KEY)
    await expect(warning(page)).toHaveCount(0)
  })

  test('the drawer warns too, and Done keeps the key', async ({ page }) => {
    await page.goto('/')
    await keyField(page).fill(OPENROUTER_SHAPED_KEY)
    await keyField(page).press('Enter')
    await page
      .locator('.rs-top')
      .getByRole('button', { name: /^Settings:/ })
      .click()
    const drawer = page.getByRole('dialog', { name: 'Settings' })
    await drawer.getByLabel('OpenRouter API key', { exact: true }).fill(WRONG_PREFIX_KEY)
    await expect(drawer.locator('.qs-keywarn')).toContainText('OpenRouter keys start with sk-or-.')
    await drawer.getByRole('button', { name: 'Done' }).click()
    await page.locator('input[type="file"]').setInputFiles(samplePhoto)
    await expect(
      page.locator('#stage.qs-arriving, #stage.qs-arrived, .rs-photo__img').first(),
    ).toBeVisible()
  })
})

test.describe('focus after each step', () => {
  test('Continue moves focus to the photo drop zone', async ({ page }) => {
    await page.goto('/')
    await keyField(page).fill(OPENROUTER_SHAPED_KEY)
    await setupCard(page).getByRole('button', { name: 'Continue' }).click()
    await expect(dropZone(page)).toBeFocused()
  })

  test('Enter in the key field continues and moves focus to the photo drop zone', async ({
    page,
  }) => {
    await page.goto('/')
    await keyField(page).fill(OPENROUTER_SHAPED_KEY)
    await keyField(page).press('Enter')
    await expect(dropZone(page)).toBeFocused()
  })

  test('New inspection moves focus to the photo drop zone', async ({ page }) => {
    await page.goto('/')
    await keyField(page).fill(OPENROUTER_SHAPED_KEY)
    await keyField(page).press('Enter')
    await page.locator('input[type="file"]').setInputFiles(samplePhoto)
    await expect(page.locator('.rs-photo__img')).toBeVisible()

    await newInspection(page).focus()
    await page.keyboard.press('Enter')
    await expect(dropZone(page)).toBeFocused()
  })

  test('in demo mode, choosing a sample starts it and moves focus to Cancel, and New inspection to the sample picker', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Enter as demo user' }).click()

    await page.getByRole('button', { name: /Rear doors with markings/ }).click()
    // The recorded inspection starts at once; New inspection reads Cancel meanwhile and holds focus.
    await expect(page.locator('.rs-top .qs-newinsp')).toBeFocused()
    await page.locator('#stage.qs-arrived').waitFor()

    await newInspection(page).click()
    const samples = page.getByRole('group', { name: 'Choose a sample container' })
    await expect(samples.getByRole('button').first()).toBeFocused()

    // A keyboard user can run another sample straight away.
    await page.keyboard.press('Enter')
    await expect(page.locator('.rs-top .qs-newinsp')).toBeFocused()
  })

  test('a provider change in the drawer leaves focus in the drawer', async ({ page }) => {
    await page.goto('/')
    await keyField(page).fill(OPENROUTER_SHAPED_KEY)
    await keyField(page).press('Enter')
    await page
      .locator('.rs-top')
      .getByRole('button', { name: /^Settings:/ })
      .click()
    const drawer = page.getByRole('dialog', { name: 'Settings' })
    const model = drawer.getByLabel('Model version')
    await model.focus()
    await model.selectOption('typesafe/jev-1.13')
    await expect(page.locator('.rs-top')).toContainText('Jev 1.13')
    await expect(model).toBeFocused()
    await expect(drawer).toBeVisible()
  })
})
