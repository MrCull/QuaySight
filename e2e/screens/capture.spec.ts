/**
 * Screenshot harness for the Quay Sight POC. Test code only: it never changes product behaviour.
 *
 * Run:   npm run screenshots
 *        (wrapper: e2e/screens/run-screenshots.mjs sets CI=1 so Playwright starts its own preview
 *        server on port 4173 and never reuses a foreign dev server; QS_SCREENSHOTS=1 includes this file,
 *        which the normal `npm run check` skips.)
 * Output: screenshots/<state>-<width>x<height>.png (full page) and screenshots/index.json.
 *         screenshots/ is generated and git-ignored; never commit it.
 *
 * Recorded states run in demo mode (Enter as demo user: no key, the bundled samples that have a recording).
 * Network: every external request is aborted, so nothing leaves the machine. The only "live" calls are
 * OpenAI's Decisions endpoint, answered by a route with a copy of the recorded smoke response (variants
 * for uncertain, partial and insufficient readings), and OpenRouter's Decisions endpoint, answered with a
 * Jev reading in the shape seen live on 16 Oct 2026. The key is a placeholder typed into the real field.
 * Motion: non-animation captures freeze CSS animations; mid-animation captures and the reduced-motion
 * capture are taken live, after a fixed pause during the staged progress.
 */
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildIndex, certaintyLabelsIn, shotFileName, type ShotInput } from './indexBuilder'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '../..')
const OUT = path.join(ROOT, 'screenshots')
const samplePhoto = path.join(ROOT, 'samples', 'rear-door-aphu-45g1.jpg')
const lunaSmoke = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src', 'fixtures', 'live', 'luna-smoke.json'), 'utf8'),
).response as { answers: Array<Record<string, unknown>> }
/** GPT-6 Luna Decisions through OpenRouter, as recorded live on 16 Oct 2026 (no key, no headers). */
const openRouterLunaSmoke = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src', 'fixtures', 'live', 'openrouter-luna-smoke.json'), 'utf8'),
).response as unknown

// Placeholders typed through the real field. Neither is a credential and no provider receives one.
// The first starts the way both providers' keys do, so it shows no key-format warning; the second doesn't.
const PLACEHOLDER_KEY = 'sk-or-placeholder'
const WRONG_PREFIX_PLACEHOLDER = 'placeholder-without-prefix'
const PROVIDER_HOSTS = /openai\.com|openrouter\.ai|typesafe\.ai/

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]

/** Stops CSS animations and transitions and hides the caret. Used only for non-animation captures. */
const FREEZE_CSS =
  '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'

/** The arrival budget is about 1.6s; wait past it so the result has landed before any capture. */
const SETTLE_MS = 2000

type Motion = 'frozen' | 'animated'

interface Capture {
  state: string
  screen: 'setup' | 'start' | 'demo' | 'analysing' | 'results' | 'manifest-retry'
  steps: string[]
  motion: Motion
  /** Limit to some viewports; default all three. */
  viewports?: Array<{ width: number; height: number }>
  reducedMotion?: boolean
  /** Mocked Decisions body (OpenAI or OpenRouter) for live captures. */
  liveBody?: () => unknown
  run: (page: Page) => Promise<void>
}

// ---- Shared flows -------------------------------------------------------------------------------

const open = (page: Page) => page.goto('/')

const choosePhoto = (page: Page) =>
  page.locator('input[type="file"]').setInputFiles(samplePhoto)

/** On the setup card: picks OpenAI. OpenRouter is pre-selected; the Luna captures replay OpenAI responses. */
async function chooseOpenAI(page: Page) {
  await page.locator('#provider-button').click()
  await page.getByTestId('provider-option-luna').click()
}

/** On the setup card: Enter as demo user (no key), then the sample picker. */
async function enterDemo(page: Page) {
  await page.getByRole('button', { name: 'Enter as demo user' }).click()
  await page.getByRole('region', { name: 'Demo mode' }).waitFor()
}

// The damaged side has no recording yet (spec #27, ticket #37), so it is not offered; its captures return
// when that photo is recorded with the whole plan.
type SampleName = 'Rear doors with markings' | 'Clean grey rear doors'

/** Demo mode: puts a bundled sample on the stage, ready to start. */
async function openSample(page: Page, name: SampleName) {
  await page.getByRole('button', { name: new RegExp(name) }).click()
  await page.locator('.rs-photo__img').waitFor()
}

/** On the setup card: types the placeholder and presses Enter, which continues to the inspection screen. */
async function liveKey(page: Page, label = 'OpenAI API key') {
  if (label === 'OpenAI API key') await chooseOpenAI(page)
  const key = page.getByLabel(label, { exact: true })
  await key.fill(PLACEHOLDER_KEY)
  await key.press('Enter')
}

const settingsChip = (page: Page) => page.getByRole('button', { name: /^Settings:/ })

/** Waits for the arriving stage, then for the arrived stage, then lets the choreography finish. */
async function startAndSettle(page: Page, button = 'Start inspection') {
  await page.getByRole('button', { name: button }).click()
  await page.locator('#stage.qs-arriving').waitFor()
  await page.locator('#stage.qs-arrived').waitFor()
  await page.waitForTimeout(SETTLE_MS)
}

/** Demo mode: a sample's recorded result, landed. */
async function demoResult(page: Page, name: SampleName) {
  await open(page)
  await enterDemo(page)
  await openSample(page, name)
  await startAndSettle(page)
}

/** The rear doors in demo mode: the recorded ID has an unread position, so the manifest offer opens. */
async function unidentifiedRun(page: Page) {
  await demoResult(page, 'Rear doors with markings')
  await expect(page.getByRole('heading', { name: 'Container ID not identified' })).toBeVisible()
}

async function typeManifest(page: Page) {
  await page.getByLabel('Container numbers from the manifest').fill('APHU 658684')
  await page.getByRole('button', { name: 'Check again with this manifest' }).click()
}

/** A live run through the mocked Decisions endpoint (placeholder key, no replay). */
async function liveRun(page: Page) {
  await open(page)
  await liveKey(page)
  await choosePhoto(page)
  await startAndSettle(page, 'Run live inspection')
}

/** A Jev reading of the APHU sample through OpenRouter, in the response shape seen live on 16 Oct 2026. */
function openRouterJevBody() {
  const answers: Record<string, unknown> = {}
  'APHU6586847'.split('').forEach((ch, i) => {
    answers[`id_char_${String(i + 1).padStart(2, '0')}`] = {
      type: 'choice',
      choice: ch,
      probabilities: { [ch]: 0.93, unreadable: 0.07 },
      confidence: 0.9,
    }
  })
  answers.full_number_visible = { type: 'noul', noul: 0.97 }
  return {
    model: 'typesafe/jev-1.14-20261014',
    answers,
    usage: { input_tokens: 1844, output_tokens: 75, cost: 0.000077448 },
    id: 'gen-dec-screenshot',
    provider: 'TypeSafe',
  }
}

/**
 * Variants of the recorded Luna smoke response, for states the recorded fixtures never reach.
 * uncertain: every position read at 45%, with a 30% runner-up (Uncertain, alternatives shown).
 * partial: positions 5 and 9 missing from the answer (marked unread).
 * insufficient: no answers at all (nothing read).
 */
function lunaVariant(kind: 'uncertain' | 'partial' | 'insufficient') {
  const body = structuredClone(lunaSmoke)
  if (kind === 'insufficient') body.answers = []
  if (kind === 'partial') {
    body.answers = body.answers.filter((a) => !['id_char_05', 'id_char_09'].includes(String(a.name)))
  }
  if (kind === 'uncertain') {
    for (const answer of body.answers) {
      const probabilities = answer.probabilities as Array<{ value: string; probability: number }>
      const chosen = probabilities.find((p) => p.value === answer.choice)
      const runner = probabilities
        .filter((p) => p.value !== answer.choice)
        .sort((a, b) => b.probability - a.probability)[0]
      if (chosen) chosen.probability = 0.45
      if (runner) runner.probability = 0.3
    }
  }
  return body
}

// ---- Captures -----------------------------------------------------------------------------------

const CAPTURES: Capture[] = [
  {
    state: 'setup-card',
    screen: 'setup',
    steps: ['Open / (first visit: only the setup card, no key)'],
    motion: 'frozen',
    run: open,
  },
  {
    state: 'setup-provider-list',
    screen: 'setup',
    steps: ['Open /', 'Press ArrowDown on the provider button (list open, OpenAI active)', 'Press ArrowDown'],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await page.locator('#provider-button').press('ArrowDown')
      await page.getByRole('listbox').press('ArrowDown')
    },
  },
  {
    state: 'setup-key-focused',
    screen: 'setup',
    steps: ['Open /', 'Focus the OpenRouter API key field on the setup card'],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await page.getByLabel('OpenRouter API key', { exact: true }).focus()
    },
  },
  {
    state: 'setup-key-entered',
    screen: 'setup',
    steps: ['Open /', "Type placeholder into 'OpenRouter API key' (Continue enabled)"],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await page.getByLabel('OpenRouter API key', { exact: true }).fill(PLACEHOLDER_KEY)
    },
  },
  {
    state: 'setup-key-format-warning',
    screen: 'setup',
    steps: [
      'Open /',
      "Type a placeholder without the sk-or- prefix into 'OpenRouter API key' (warning shown, Continue enabled)",
    ],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await page.getByLabel('OpenRouter API key', { exact: true }).fill(WRONG_PREFIX_PLACEHOLDER)
      await page.locator('.qs-keywarn').waitFor()
    },
  },
  {
    state: 'settings-chip',
    screen: 'start',
    steps: ['Open /', 'Type placeholder key', 'Press Enter (setup folds into the header chip)'],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await liveKey(page)
    },
  },
  {
    state: 'settings-drawer-open',
    screen: 'start',
    steps: ['Settings-chip steps', 'Click the settings chip (drawer open, focus on the provider)'],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await liveKey(page)
      await settingsChip(page).click()
      await page.getByRole('dialog', { name: 'Settings' }).waitFor()
    },
  },
  {
    state: 'photo-added',
    screen: 'start',
    steps: ['Settings-chip steps', 'Choose samples/rear-door-aphu-45g1.jpg (landscape)'],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await liveKey(page)
      await choosePhoto(page)
    },
  },
  {
    state: 'demo-picker',
    screen: 'demo',
    steps: ['Open /', 'Click Enter as demo user (demo banner, sample picker, no upload)'],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await enterDemo(page)
    },
  },
  {
    state: 'demo-sample-ready',
    screen: 'demo',
    steps: ['Demo-picker steps', 'Choose Rear doors with markings (photo on the stage, Start inspection)'],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await enterDemo(page)
      await openSample(page, 'Rear doors with markings')
    },
  },
  {
    state: 'demo-after-new-inspection',
    screen: 'demo',
    steps: ['Demo rear-doors result', 'Click New inspection (back to the sample picker)'],
    motion: 'frozen',
    run: async (page) => {
      await demoResult(page, 'Rear doors with markings')
      await page.getByRole('button', { name: 'New inspection' }).click()
      await page.getByRole('button', { name: /Rear doors with markings/ }).waitFor()
    },
  },
  {
    state: 'analysing-mid',
    screen: 'analysing',
    steps: ['Demo-sample-ready steps', 'Click Start inspection', 'Capture 500ms in, during the staged progress (animations live)'],
    motion: 'animated',
    run: async (page) => {
      await open(page)
      await enterDemo(page)
      await openSample(page, 'Rear doors with markings')
      await page.getByRole('button', { name: 'Start inspection' }).click()
      await page.locator('.rs-analysing').waitFor()
      await page.waitForTimeout(500)
    },
  },
  {
    state: 'analysing-reduced-motion',
    screen: 'analysing',
    steps: ['Reduced-motion emulation', 'Demo-sample-ready steps', 'Click Start inspection', 'Capture 500ms in'],
    motion: 'animated',
    viewports: [{ width: 1440, height: 900 }],
    reducedMotion: true,
    run: async (page) => {
      await open(page)
      await enterDemo(page)
      await openSample(page, 'Rear doors with markings')
      await page.getByRole('button', { name: 'Start inspection' }).click()
      await page.locator('.rs-analysing').waitFor()
      await page.waitForTimeout(500)
    },
  },
  {
    state: 'demo-rear-result',
    screen: 'results',
    steps: ['Demo mode', 'Rear doors with markings (recorded Luna, earlier ID-only run)', 'Start inspection, settle'],
    motion: 'frozen',
    run: (page) => demoResult(page, 'Rear doors with markings'),
  },
  {
    state: 'demo-cost-expanded',
    screen: 'results',
    steps: ['Demo rear-doors result', 'Click the cost line toggle'],
    motion: 'frozen',
    run: async (page) => {
      await demoResult(page, 'Rear doors with markings')
      await page.locator('button.qs-cost__toggle').click()
    },
  },
  {
    state: 'demo-exports',
    screen: 'results',
    steps: ['Demo rear-doors result', 'Focus the first export button (Export JSON)'],
    motion: 'frozen',
    run: async (page) => {
      await demoResult(page, 'Rear doors with markings')
      await page.locator('.rs-exports button').first().focus()
    },
  },
  {
    state: 'demo-clean-result',
    screen: 'results',
    steps: ['Demo mode', 'Clean grey rear doors (recorded Jev latest through OpenRouter, uncertain digits)', 'Start inspection, settle'],
    motion: 'frozen',
    run: (page) => demoResult(page, 'Clean grey rear doors'),
  },
  {
    state: 'openrouter-live-result',
    screen: 'results',
    steps: [
      'Open / (OpenRouter, Jev latest pre-selected)',
      "Type placeholder into 'OpenRouter API key', Enter",
      'Choose photo',
      'Run live inspection (mocked OpenRouter Decisions: Jev reading)',
      'settle',
    ],
    motion: 'frozen',
    liveBody: openRouterJevBody,
    run: async (page) => {
      await open(page)
      await liveKey(page, 'OpenRouter API key')
      await choosePhoto(page)
      await startAndSettle(page, 'Run live inspection')
    },
  },
  {
    state: 'openrouter-luna-result',
    screen: 'results',
    steps: [
      'Open /',
      "Choose model 'GPT-6 Luna Decisions' on the setup card (OpenRouter)",
      "Type placeholder into 'OpenRouter API key', Enter",
      'Choose photo',
      'Run live inspection (mocked OpenRouter Decisions: the recorded Luna Decisions smoke response)',
      'settle',
    ],
    motion: 'frozen',
    liveBody: () => openRouterLunaSmoke,
    run: async (page) => {
      await open(page)
      await page.getByLabel('Model version').selectOption('openai/gpt-6-luna-decisions')
      await liveKey(page, 'OpenRouter API key')
      await choosePhoto(page)
      await startAndSettle(page, 'Run live inspection')
    },
  },
  {
    state: 'live-after-new-inspection',
    screen: 'start',
    steps: ['OpenRouter live result steps', 'Click New inspection (blank screen, key kept)'],
    motion: 'frozen',
    liveBody: openRouterJevBody,
    run: async (page) => {
      await open(page)
      await liveKey(page, 'OpenRouter API key')
      await choosePhoto(page)
      await startAndSettle(page, 'Run live inspection')
      await page.getByRole('button', { name: 'New inspection' }).click()
      await page.getByText('Drop a container photo here').waitFor()
    },
  },
  {
    state: 'live-uncertain',
    screen: 'results',
    steps: ['Open /', 'Type placeholder key, Enter', 'Choose photo', 'Run live inspection (mocked Decisions: uncertain)', 'settle'],
    motion: 'frozen',
    liveBody: () => lunaVariant('uncertain'),
    run: liveRun,
  },
  {
    state: 'live-partial',
    screen: 'results',
    steps: ['Open /', 'Type placeholder key, Enter', 'Choose photo', 'Run live inspection (mocked Decisions: positions 5 and 9 unread)', 'settle'],
    motion: 'frozen',
    liveBody: () => lunaVariant('partial'),
    run: liveRun,
  },
  {
    state: 'live-insufficient',
    screen: 'results',
    steps: ['Open /', 'Type placeholder key, Enter', 'Choose photo', 'Run live inspection (mocked Decisions: nothing read)', 'settle'],
    motion: 'frozen',
    liveBody: () => lunaVariant('insufficient'),
    run: liveRun,
  },
  {
    state: 'manifest-offer',
    screen: 'manifest-retry',
    steps: ['Demo mode', 'Rear doors with markings, Start, settle', 'Manifest offer open'],
    motion: 'frozen',
    run: unidentifiedRun,
  },
  {
    state: 'manifest-checking',
    screen: 'manifest-retry',
    steps: ['Manifest offer steps', 'Paste APHU 658684 and click Check again with this manifest', 'Capture 500ms in'],
    motion: 'animated',
    run: async (page) => {
      await unidentifiedRun(page)
      await typeManifest(page)
      await expect(page.getByText('Checking against manifest')).toBeVisible()
      await page.waitForTimeout(500)
    },
  },
  {
    state: 'manifest-error',
    screen: 'manifest-retry',
    steps: [
      'Manifest offer steps',
      "Tick 'Make the manifest check fail'",
      'Paste APHU 658684 and click Check again with this manifest',
      'Error panel shown',
    ],
    motion: 'frozen',
    run: async (page) => {
      await unidentifiedRun(page)
      await page.getByRole('checkbox', { name: 'Make the manifest check fail' }).check()
      await typeManifest(page)
      await expect(page.locator('.qs-manifest .qs-notice--error')).toBeVisible()
      await page.waitForTimeout(300)
    },
  },
  {
    state: 'manifest-no-match',
    screen: 'manifest-retry',
    steps: ['Manifest offer steps', 'Paste APHU 658684 and click Check again with this manifest', 'No entry matches; the panel stays open'],
    motion: 'frozen',
    run: async (page) => {
      await unidentifiedRun(page)
      await typeManifest(page)
      await expect(page.locator('.qs-manifest__nomatch')).toBeVisible()
      await page.waitForTimeout(300)
    },
  },
]

// ---- Harness ------------------------------------------------------------------------------------

const shots = new Map<string, ShotInput & { file: string }>()

function writeIndex() {
  fs.mkdirSync(OUT, { recursive: true })
  const index = buildIndex([...shots.values()])
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n')
}

/** Routes every request: the app origin passes; the Decisions endpoint is answered by the mock; the rest is aborted. */
async function guardNetwork(page: Page, origin: string, liveBody: unknown, blocked: string[]) {
  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (!/^https?:/.test(url)) return route.continue()
    if (url.startsWith(origin)) return route.continue()
    const decisions = /api\.openai\.com\/v1\/decisions|openrouter\.ai\/api\/alpha\/decisions/
    if (liveBody !== undefined && decisions.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(liveBody),
      })
    }
    blocked.push(url)
    return route.abort()
  })
}

for (const viewport of VIEWPORTS) {
  for (const capture of CAPTURES) {
    const allowed = capture.viewports ?? VIEWPORTS
    if (!allowed.some((v) => v.width === viewport.width && v.height === viewport.height)) continue

    const label = `${capture.state} @ ${viewport.width}x${viewport.height}`
    test(label, async ({ browser }, testInfo) => {
      test.setTimeout(60_000)
      const origin = new URL(testInfo.project.use.baseURL ?? 'http://localhost:4173').origin
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
        locale: 'en-GB',
        reducedMotion: capture.reducedMotion ? 'reduce' : 'no-preference',
      })
      const page = await context.newPage()
      const blocked: string[] = []
      await guardNetwork(page, origin, capture.liveBody?.(), blocked)

      await capture.run(page)
      if (capture.motion === 'frozen') await page.addStyleTag({ content: FREEZE_CSS })
      // A click or focus may have scrolled the page; a full-page shot from mid-page draws the sticky
      // top bar halfway down. Capture from the top (focus and selection stay where they are).
      await page.evaluate(() => window.scrollTo(0, 0))

      const certaintyLabels = certaintyLabelsIn(await page.locator('.qs-cert').allTextContents())
      const file = shotFileName(capture.state, viewport)
      fs.mkdirSync(OUT, { recursive: true })
      await page.screenshot({ path: path.join(OUT, file), fullPage: true })
      expect(fs.statSync(path.join(OUT, file)).size).toBeGreaterThan(0)

      // Nothing may reach a provider: only the mocked Decisions call is allowed, and it is never blocked.
      expect(blocked.filter((url) => PROVIDER_HOSTS.test(url))).toEqual([])

      shots.set(file, {
        file,
        screen: capture.screen,
        state: capture.state,
        viewport,
        steps: capture.steps,
        certaintyLabels,
        motion: capture.motion,
      })
      writeIndex()
      await context.close()
    })
  }
}
