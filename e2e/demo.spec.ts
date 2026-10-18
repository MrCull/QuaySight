import { test, expect, type Page } from '@playwright/test'

/**
 * Demo mode (spec #16, ticket #24; spec #27, ticket #37): a visitor with no key enters from the setup card,
 * chooses one of the bundled samples and sees its recorded result under a banner that never leaves the
 * screen. A sample is offered only when its photo has a real recording; the damaged side has none yet, so
 * these specs use the two that do. When that photo is recorded, add its tile here.
 * Every request to a provider host is recorded and aborted; none may happen.
 */

const PROVIDER_HOSTS = /openai\.com|openrouter\.ai|typesafe\.ai/

async function blockProviders(page: Page): Promise<string[]> {
  const hits: string[] = []
  await page.route(PROVIDER_HOSTS, (route) => {
    hits.push(route.request().url())
    return route.abort()
  })
  return hits
}

const banner = (page: Page) => page.getByRole('region', { name: 'Demo mode' })
const setupCard = (page: Page) => page.getByRole('region', { name: 'Set up a provider' })
const sampleTile = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(name) })

async function enterDemo(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter as demo user' }).click()
}

async function inspectSample(page: Page, name: string) {
  await sampleTile(page, name).click()
  await page.locator('#stage.qs-arrived').waitFor()
}

test.describe('demo mode', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('is entered from the setup card with no key, under the demo banner', async ({ page }) => {
    const hits = await blockProviders(page)
    await enterDemo(page)

    await expect(setupCard(page)).toHaveCount(0)
    await expect(banner(page)).toBeVisible()
    await expect(banner(page)).toContainText('DEMO — sample results, not a real inspection')
    await expect(banner(page)).toContainText('Inspecting your own photos needs an API provider')
    await expect(banner(page).getByRole('button', { name: 'Connect a provider' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Settings:/ })).toHaveCount(0)
    expect(hits).toEqual([])
  })

  test('offers the recorded samples and no photo upload, with a note why', async ({ page }) => {
    await enterDemo(page)

    for (const name of ['Rear doors with markings', 'Clean grey rear doors']) {
      await expect(sampleTile(page, name)).toBeVisible()
    }
    await expect(page.locator('input[type="file"]')).toHaveCount(0)
    await expect(page.getByText('Drop a container photo here')).toHaveCount(0)
    await expect(page.getByText(/Inspecting your own photos needs an API provider/)).toHaveCount(2)
  })

  test('each sample shows its recorded result, labelled, with no request and no live charge', async ({
    page,
  }) => {
    const hits = await blockProviders(page)
    await enterDemo(page)
    const cost = page.locator('.rs-top .qs-cost__toggle')

    const samples = [
      [
        'Rear doors with markings',
        'rear-door-aphu-45g1.jpg',
        'Recorded demonstration: GPT-6 Luna / gpt-6-luna',
        'OpenAI · gpt-6-luna',
      ],
      [
        'Clean grey rear doors',
        'rear-door-chsu-22g1.jpg',
        'Recorded demonstration: Jev latest (TypeSafe) via OpenRouter / ~typesafe/jev-latest',
        'TypeSafe via OpenRouter · ~typesafe/jev-latest',
      ],
    ] as const
    for (const [name, photo, label, run] of samples) {
      await inspectSample(page, name)
      await expect(page.locator('.rs-photo__img')).toHaveAttribute(
        'alt',
        `Container photo: ${photo}`,
      )
      await expect(page.getByText(label)).toBeVisible()
      // The run chip names who answered the recording, where the settings chip would be.
      await expect(page.locator('.rs-top .qs-runchip__detail')).toHaveText(run)
      await expect(banner(page)).toBeVisible()
      await expect(cost).toContainText('Saved result · no live API charge')
      await expect(
        page.getByRole('button', { name: /Replace photo|Start inspection/ }),
      ).toHaveCount(0)

      // New inspection returns to the sample picker, still in demo mode.
      await page.getByRole('button', { name: 'New inspection' }).click()
      await expect(sampleTile(page, 'Rear doors with markings')).toBeVisible()
      await expect(page.locator('.rs-photo__img')).toHaveCount(0)
      await expect(banner(page)).toBeVisible()
    }
    await expect(cost).not.toContainText('$')
    expect(hits).toEqual([])
  })

  test('the banner stays on screen while analysing and when the page scrolls', async ({ page }) => {
    await enterDemo(page)
    await sampleTile(page, 'Rear doors with markings').click()
    await expect(page.locator('#stage.qs-arriving')).toBeVisible()
    await expect(banner(page)).toBeVisible()
    await page.locator('#stage.qs-arrived').waitFor()

    await page.mouse.wheel(0, 2000)
    const box = await banner(page).boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeLessThan(900)
  })

  test('Connect a provider opens the setup form and leaves demo mode', async ({ page }) => {
    await enterDemo(page)
    await inspectSample(page, 'Rear doors with markings')

    await banner(page).getByRole('button', { name: 'Connect a provider' }).click()

    await expect(setupCard(page)).toBeVisible()
    await expect(banner(page)).toHaveCount(0)
    await expect(setupCard(page).getByLabel('OpenRouter API key', { exact: true })).toHaveValue('')
    await expect(setupCard(page).getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  test('is never remembered: a refresh opens the setup card', async ({ page }) => {
    await enterDemo(page)
    await expect(banner(page)).toBeVisible()
    await page.reload()
    await expect(setupCard(page)).toBeVisible()
    await expect(banner(page)).toHaveCount(0)
  })

  test('the rear doors, whose recorded ID has an unread position, open the manifest offer; its check finds no match', async ({
    page,
  }) => {
    const hits = await blockProviders(page)
    await enterDemo(page)
    await inspectSample(page, 'Rear doors with markings')
    await expect(page.getByRole('heading', { name: 'Container ID not identified' })).toBeVisible()

    await page.getByLabel('Container numbers from the manifest').fill('APHU 658684 7')
    await page.getByRole('button', { name: 'Check again with this manifest' }).click()
    await expect(
      page.getByText('No entry in this manifest matches what the photo shows.'),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Container ID not identified' })).toBeVisible()
    expect(hits).toEqual([])
  })
})

test.describe('demo mode at phone width (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  const noSideScroll = async (page: Page) => {
    const size = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    expect(size.scroll).toBeLessThanOrEqual(size.client)
  }

  test('the banner, the sample picker and a result fit without horizontal scroll', async ({
    page,
  }) => {
    await enterDemo(page)
    await expect(banner(page)).toBeVisible()
    await noSideScroll(page)
    // The longest run label: Jev latest reached through OpenRouter.
    await sampleTile(page, 'Clean grey rear doors').click()
    await expect(page.locator('#stage.qs-arriving')).toBeVisible()
    await noSideScroll(page)
    await page.locator('#stage.qs-arrived').waitFor()
    await noSideScroll(page)
  })
})
