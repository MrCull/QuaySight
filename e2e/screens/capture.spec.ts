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
 * Network: every external request is aborted, so nothing leaves the machine. The only "live" call is
 * OpenAI's Decisions endpoint, answered by a route with a copy of the recorded smoke response (variants
 * for uncertain, partial and insufficient readings). The key is a placeholder typed into the real field.
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

// A placeholder typed through the real field. It is not a credential and no provider receives it.
const PLACEHOLDER_KEY = 'playwright-placeholder-not-a-key'
const PROVIDER_HOSTS = /openai\.com|typesafe\.ai/

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
  screen: 'start' | 'analysing' | 'results' | 'manifest-retry'
  steps: string[]
  motion: Motion
  /** Limit to some viewports; default all three. */
  viewports?: Array<{ width: number; height: number }>
  reducedMotion?: boolean
  /** Mocked OpenAI Decisions body for live captures. */
  liveBody?: () => unknown
  run: (page: Page) => Promise<void>
}

// ---- Shared flows -------------------------------------------------------------------------------

const open = (page: Page) => page.goto('/')

const choosePhoto = (page: Page) =>
  page.locator('input[type="file"]').setInputFiles(samplePhoto)

/** Types the placeholder into the named key field, ticks replay and presses Done. */
async function replayKey(page: Page, label = 'OpenAI API key') {
  await page.getByLabel(label, { exact: true }).first().fill(PLACEHOLDER_KEY)
  await page.getByRole('checkbox', { name: /Replay the recorded sample/ }).check()
  await page.getByRole('button', { name: 'Done' }).click()
}

/** Waits for the arriving stage, then for the arrived stage, then lets the choreography finish. */
async function startAndSettle(page: Page, button = 'Start inspection') {
  await page.getByRole('button', { name: button }).click()
  await page.locator('#stage.qs-arriving').waitFor()
  await page.locator('#stage.qs-arrived').waitFor()
  await page.waitForTimeout(SETTLE_MS)
}

async function recordedLuna(page: Page) {
  await open(page)
  await choosePhoto(page)
  await replayKey(page)
  await startAndSettle(page)
}

/** Recorded run with the container ID not visible: the manifest offer opens. */
async function unidentifiedRun(page: Page) {
  await recordedLuna(page)
  await page.getByRole('checkbox', { name: 'Container ID not visible in this sample' }).check()
  await startAndSettle(page)
  await expect(page.getByRole('heading', { name: 'Container ID not identified' })).toBeVisible()
}

async function typeManifest(page: Page) {
  await page.getByLabel('Container numbers from the manifest').fill('APHU 658684')
  await page.getByRole('button', { name: 'Check again with this manifest' }).click()
}

/** A live run through the mocked Decisions endpoint (placeholder key, no replay). */
async function liveRun(page: Page) {
  await open(page)
  await choosePhoto(page)
  const key = page.getByLabel('OpenAI API key', { exact: true }).first()
  await key.fill(PLACEHOLDER_KEY)
  await key.press('Enter')
  await startAndSettle(page, 'Run live inspection')
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
    state: 'first-load',
    screen: 'start',
    steps: ['Open / (no photo, no key)'],
    motion: 'frozen',
    run: open,
  },
  {
    state: 'photo-added',
    screen: 'start',
    steps: ['Open /', 'Choose samples/rear-door-aphu-45g1.jpg (landscape)'],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await choosePhoto(page)
    },
  },
  {
    state: 'key-focused',
    screen: 'start',
    steps: ['Open /', 'Choose photo', 'Focus the OpenAI API key field'],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await choosePhoto(page)
      await page.getByLabel('OpenAI API key', { exact: true }).first().focus()
    },
  },
  {
    state: 'key-entered',
    screen: 'start',
    steps: ['Open /', 'Choose photo', "Type placeholder into 'OpenAI API key' (selector still expanded)"],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await choosePhoto(page)
      await page.getByLabel('OpenAI API key', { exact: true }).first().fill(PLACEHOLDER_KEY)
    },
  },
  {
    state: 'selector-collapsed',
    screen: 'start',
    steps: ['Open /', 'Choose photo', 'Type placeholder key', 'Press Enter (selector collapses)'],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await choosePhoto(page)
      const key = page.getByLabel('OpenAI API key', { exact: true }).first()
      await key.fill(PLACEHOLDER_KEY)
      await key.press('Enter')
    },
  },
  {
    state: 'ready-recorded',
    screen: 'start',
    steps: ['Open /', 'Choose photo', 'Type placeholder key', 'Tick Replay the recorded sample', 'Click Done'],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await choosePhoto(page)
      await replayKey(page)
    },
  },
  {
    state: 'analysing-mid',
    screen: 'analysing',
    steps: ['Ready-recorded steps', "Click Start inspection", 'Capture 500ms in, during the staged progress (animations live)'],
    motion: 'animated',
    run: async (page) => {
      await open(page)
      await choosePhoto(page)
      await replayKey(page)
      await page.getByRole('button', { name: 'Start inspection' }).click()
      await page.locator('.rs-analysing').waitFor()
      await page.waitForTimeout(500)
    },
  },
  {
    state: 'analysing-reduced-motion',
    screen: 'analysing',
    steps: ['Reduced-motion emulation', 'Ready-recorded steps', 'Click Start inspection', 'Capture 500ms in'],
    motion: 'animated',
    viewports: [{ width: 1440, height: 900 }],
    reducedMotion: true,
    run: async (page) => {
      await open(page)
      await choosePhoto(page)
      await replayKey(page)
      await page.getByRole('button', { name: 'Start inspection' }).click()
      await page.locator('.rs-analysing').waitFor()
      await page.waitForTimeout(500)
    },
  },
  {
    state: 'luna-result',
    screen: 'results',
    steps: ['Recorded Luna: photo, replay key, Start inspection, settle'],
    motion: 'frozen',
    run: recordedLuna,
  },
  {
    state: 'luna-cost-expanded',
    screen: 'results',
    steps: ['Recorded Luna result', 'Click the cost line toggle'],
    motion: 'frozen',
    run: async (page) => {
      await recordedLuna(page)
      await page.locator('button.qs-cost__toggle').click()
    },
  },
  {
    state: 'luna-damage-marker',
    screen: 'results',
    steps: ['Recorded Luna result', 'Click the first damage marker (pin)'],
    motion: 'frozen',
    run: async (page) => {
      await recordedLuna(page)
      await page.locator('.qs-c-pins [role="button"]').first().click()
    },
  },
  {
    state: 'luna-exports',
    screen: 'results',
    steps: ['Recorded Luna result', 'Focus the first export button (Export JSON)'],
    motion: 'frozen',
    run: async (page) => {
      await recordedLuna(page)
      await page.locator('.rs-exports button').first().focus()
    },
  },
  {
    state: 'jev-result',
    screen: 'results',
    steps: [
      'Open /',
      'Choose photo',
      'Choose provider Jev (TypeSafe)',
      "Type placeholder into 'TypeSafe API key', tick replay, Done",
      'Start inspection, settle',
    ],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await choosePhoto(page)
      await page.locator('#provider-button').click()
      await page.getByRole('option', { name: /Jev/ }).click()
      await replayKey(page, 'TypeSafe API key')
      await startAndSettle(page)
    },
  },
  {
    state: 'live-uncertain',
    screen: 'results',
    steps: ['Open /', 'Choose photo', 'Type placeholder key, Enter', 'Run live inspection (mocked Decisions: uncertain)', 'settle'],
    motion: 'frozen',
    liveBody: () => lunaVariant('uncertain'),
    run: liveRun,
  },
  {
    state: 'live-partial',
    screen: 'results',
    steps: ['Open /', 'Choose photo', 'Type placeholder key, Enter', 'Run live inspection (mocked Decisions: positions 5 and 9 unread)', 'settle'],
    motion: 'frozen',
    liveBody: () => lunaVariant('partial'),
    run: liveRun,
  },
  {
    state: 'live-insufficient',
    screen: 'results',
    steps: ['Open /', 'Choose photo', 'Type placeholder key, Enter', 'Run live inspection (mocked Decisions: nothing read)', 'settle'],
    motion: 'frozen',
    liveBody: () => lunaVariant('insufficient'),
    run: liveRun,
  },
  {
    state: 'manifest-offer',
    screen: 'manifest-retry',
    steps: [
      'Recorded Luna, replay',
      'Start, settle',
      "Tick 'Container ID not visible in this sample', Start again",
      'Manifest offer open',
    ],
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
    state: 'manifest-resolved',
    screen: 'manifest-retry',
    steps: ['Manifest offer steps', 'Paste APHU 658684 and click Check again with this manifest', 'Panel closes, ID replaced'],
    motion: 'frozen',
    run: async (page) => {
      await unidentifiedRun(page)
      await typeManifest(page)
      await expect(page.locator('.qs-manifest')).toHaveCount(0)
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
    if (liveBody !== undefined && /api\.openai\.com\/v1\/decisions/.test(url)) {
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
