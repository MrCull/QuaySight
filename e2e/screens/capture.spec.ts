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
 * the Decisions endpoints, answered request by request (survey, long-side damage, door-end damage, second
 * looks) from e2e/screens/mockRuns.ts: hand-written replies built from the COYU 266813 0 door figures, a copy
 * of the recorded smoke responses for the earlier ID-only states, and a Jev reading in the shape seen live
 * on 16 Oct 2026. They show how the screens treat such answers; they are not recordings. The key is a
 * placeholder typed into the real field.
 * Motion: non-animation captures freeze CSS animations; mid-animation captures and the reduced-motion
 * capture are taken live, after a fixed pause during the staged progress.
 */
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildIndex, certaintyLabelsIn, shotFileName, type ShotInput } from './indexBuilder'
import {
  CONFLICTING_WEIGHTS,
  HOLD,
  SERVER_ERROR,
  MARKINGS_SEEN,
  kindOfRequest,
  longSideScript,
  rearDoorsScript,
  roofScript,
  surveyWithIdAnswers,
  type Script,
} from './mockRuns'
import { doorReply as jevDoorReply, notASideReply } from '../../src/__tests__/planReplies'
import { openRouterSurveyReply } from '../../src/__tests__/surveyReplies'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '../..')
const OUT = path.join(ROOT, 'screenshots')
const samplePhoto = path.join(ROOT, 'samples', 'rear-door-aphu-45g1.jpg')
const coyuPhoto = path.join(ROOT, 'samples', 'rear-door-coyu-22g1.jpg')
const sidePhoto = path.join(ROOT, 'samples', 'side-dented-grey.jpg')
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
  /** Answers each Decisions request of a live capture (OpenAI or OpenRouter); HOLD leaves it in flight. */
  script?: () => Script
  run: (page: Page) => Promise<void>
}

// ---- Shared flows -------------------------------------------------------------------------------

const open = (page: Page) => page.goto('/')

const choosePhoto = (page: Page) => page.locator('input[type="file"]').setInputFiles(samplePhoto)

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

/**
 * A Jev reading of the APHU sample through OpenRouter, in the response shape seen live on 16 Oct 2026, with the
 * details answered like a clean door and the damage sets answering as OpenRouter's keyed shape does.
 */
function openRouterJevScript(): Script {
  return (kind) => {
    if (kind === 'door') return jevDoorReply()
    if (kind === 'side') return notASideReply()
    return {
      ...openRouterSurveyReply('APHU6586847', {
        details: {
          size_type_code: [['45G1', 0.9]],
          photo_face: [['rear_doors', 0.95]],
        },
        cost: 0.000077448,
      }),
      id: 'gen-dec-screenshot',
      provider: 'TypeSafe',
    }
  }
}

/** GPT-6 Luna Decisions through OpenRouter: the recorded smoke response answers the survey; no damage question is answered. */
function openRouterLunaScript(): Script {
  return (kind) => {
    if (kind === 'side') return notASideReply()
    if (kind === 'door') return { model: 'openai/gpt-6-luna-decisions', answers: {} }
    return openRouterLunaSmoke
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
    body.answers = body.answers.filter(
      (a) => !['id_char_05', 'id_char_09'].includes(String(a.name)),
    )
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

/** An ID reading variant of the recorded Luna smoke response, with the details and damage of a clean rear-door photo. */
function idVariantScript(kind: 'uncertain' | 'partial' | 'insufficient'): Script {
  const base = rearDoorsScript({ face: 'rear_doors' })
  const answers = lunaVariant(kind).answers
  return (k, n) =>
    k === 'survey' ? surveyWithIdAnswers(answers, { id: 'APHU6586847' }) : base(k, n)
}

/** Starts a live run on the COYU door photo (or another) and returns without waiting for it to finish. */
async function liveStart(page: Page, photo = coyuPhoto) {
  await open(page)
  await liveKey(page)
  await page.locator('input[type="file"]').setInputFiles(photo)
  await page.getByRole('button', { name: 'Run live inspection' }).click()
}

/** A live run on the COYU door photo, landed. */
async function liveLanded(page: Page, photo = coyuPhoto) {
  await liveStart(page, photo)
  await page.locator('#stage.qs-arrived').waitFor()
  await page.waitForTimeout(SETTLE_MS)
}

const units = (page: Page, name: 'Metric' | 'Imperial') =>
  page.getByRole('group', { name: 'Units' }).getByRole('button', { name })

const stageRow = (page: Page, title: string) =>
  page.locator('.rs-stagecard li.qs-stage', { hasText: title })

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
    steps: [
      'Open /',
      'Press ArrowDown on the provider button (list open, OpenAI active)',
      'Press ArrowDown',
    ],
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
    steps: [
      'Demo-picker steps',
      'Choose Rear doors with markings (photo on the stage, Start inspection)',
    ],
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
    steps: [
      'Demo-sample-ready steps',
      'Click Start inspection',
      'Capture 500ms in, during the staged progress (animations live)',
    ],
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
    steps: [
      'Reduced-motion emulation',
      'Demo-sample-ready steps',
      'Click Start inspection',
      'Capture 500ms in',
    ],
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
    steps: [
      'Demo mode',
      'Rear doors with markings (recorded Luna, earlier ID-only run)',
      'Start inspection, settle',
    ],
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
    steps: [
      'Demo mode',
      'Clean grey rear doors (recorded Jev latest through OpenRouter, uncertain digits)',
      'Start inspection, settle',
    ],
    motion: 'frozen',
    run: (page) => demoResult(page, 'Clean grey rear doors'),
  },
  // The demo's recordings carry no weights, markings or damage yet, and the damaged side has no recording
  // (spec #27, ticket #37): the states that need them (the demo in lb, the demo's side damage) are captured on
  // live runs below (rear-door-damage-*, side-damage) until those photos are recorded with the whole plan.
  {
    state: 'found-reduced-motion',
    screen: 'results',
    steps: [
      'Reduced-motion emulation',
      'Demo rear-doors result, captured as soon as it lands (no pause)',
      'What we found is simply there, with no animation',
    ],
    motion: 'animated',
    viewports: [{ width: 1440, height: 900 }],
    reducedMotion: true,
    run: async (page) => {
      await open(page)
      await enterDemo(page)
      await openSample(page, 'Rear doors with markings')
      await page.getByRole('button', { name: 'Start inspection' }).click()
      await page.locator('#stage.qs-arrived').waitFor()
      await expect(page.locator('.qs-found')).toBeVisible()
    },
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
    script: openRouterJevScript,
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
    script: openRouterLunaScript,
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
    script: openRouterJevScript,
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
    steps: [
      'Open /',
      'Type placeholder key, Enter',
      'Choose photo',
      'Run live inspection (mocked Decisions: uncertain)',
      'settle',
    ],
    motion: 'frozen',
    script: () => idVariantScript('uncertain'),
    run: liveRun,
  },
  {
    state: 'live-partial',
    screen: 'results',
    steps: [
      'Open /',
      'Type placeholder key, Enter',
      'Choose photo',
      'Run live inspection (mocked Decisions: positions 5 and 9 unread)',
      'settle',
    ],
    motion: 'frozen',
    script: () => idVariantScript('partial'),
    run: liveRun,
  },
  {
    state: 'live-survey-failed',
    screen: 'results',
    steps: [
      'Open /',
      'Type placeholder key, Enter',
      'Choose photo',
      'Run live inspection (mocked: the survey fails with an HTTP 500, damage answers)',
      'settle',
    ],
    motion: 'frozen',
    viewports: [{ width: 1440, height: 900 }],
    script: () => rearDoorsScript({}, { survey: SERVER_ERROR }),
    run: liveRun,
  },
  {
    state: 'live-insufficient',
    screen: 'results',
    steps: [
      'Open /',
      'Type placeholder key, Enter',
      'Choose photo',
      'Run live inspection (mocked Decisions: nothing read)',
      'settle',
    ],
    motion: 'frozen',
    script: () => idVariantScript('insufficient'),
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
    steps: [
      'Manifest offer steps',
      'Paste APHU 658684 and click Check again with this manifest',
      'Capture 500ms in',
    ],
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
    steps: [
      'Manifest offer steps',
      'Paste APHU 658684 and click Check again with this manifest',
      'No entry matches; the panel stays open',
    ],
    motion: 'frozen',
    run: async (page) => {
      await unidentifiedRun(page)
      await typeManifest(page)
      await expect(page.locator('.qs-manifest__nomatch')).toBeVisible()
      await page.waitForTimeout(300)
    },
  },
  // ---- Spec #27 states: the whole plan on a live run (mocked replies from e2e/screens/mockRuns.ts) ----
  {
    state: 'settings-drawer-key-warning',
    screen: 'start',
    steps: [
      'Settings-chip steps',
      'Click the settings chip',
      "Type a placeholder without the sk- prefix into 'OpenAI API key' (warning under the field, Continue still enabled)",
    ],
    motion: 'frozen',
    run: async (page) => {
      await open(page)
      await liveKey(page)
      await settingsChip(page).click()
      const drawer = page.getByRole('dialog', { name: 'Settings' })
      await drawer.waitFor()
      await drawer.getByLabel('OpenAI API key', { exact: true }).fill(WRONG_PREFIX_PLACEHOLDER)
      await drawer.locator('.qs-keywarn').waitFor()
    },
  },
  {
    state: 'progress-survey-pending',
    screen: 'analysing',
    steps: [
      'Settings-chip steps (OpenAI), choose the COYU door photo',
      'Run live inspection (mocked: the damage checks answer, the survey is still in flight)',
      'Capture after the damage part has landed: its stage done, ID and details active, Cancel offered',
    ],
    motion: 'animated',
    script: () => rearDoorsScript({}, { survey: HOLD }),
    run: async (page) => {
      await liveStart(page)
      await expect(stageRow(page, 'Checking for damage')).toHaveClass(/qs-stage--done/)
      // The damage part has landed on its own; let its arrival finish. The ID and details are still in flight.
      await page.waitForTimeout(SETTLE_MS)
    },
  },
  {
    state: 'progress-damage-pending',
    screen: 'analysing',
    steps: [
      'Settings-chip steps (OpenAI), choose the COYU door photo',
      'Run live inspection (mocked: the survey answers, both damage checks are still in flight)',
      'Capture after the ID and details have landed: their stages done, damage active, Cancel offered',
    ],
    motion: 'animated',
    script: () => rearDoorsScript({}, { side: HOLD, door: HOLD }),
    run: async (page) => {
      await liveStart(page)
      await expect(stageRow(page, 'Reading the ID')).toHaveClass(/qs-stage--done/)
      // The ID and details have landed on their own; let their arrival finish. Damage is still in flight.
      await page.waitForTimeout(SETTLE_MS)
    },
  },
  {
    state: 'progress-cancel-focused',
    screen: 'analysing',
    steps: ['Progress (survey pending) steps', 'Tab to Cancel so the keyboard focus ring shows'],
    motion: 'frozen',
    script: () => rearDoorsScript({}, { survey: HOLD }),
    run: async (page) => {
      await liveStart(page)
      await expect(stageRow(page, 'Checking for damage')).toHaveClass(/qs-stage--done/)
      await page.getByRole('button', { name: 'Cancel' }).focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
    },
  },
  {
    state: 'cancelled-before-results',
    screen: 'results',
    steps: [
      'Progress steps with every request held',
      'Click Cancel before anything arrives (photo kept, the calls recorded as cancelled)',
    ],
    motion: 'frozen',
    script: () => () => HOLD,
    run: async (page) => {
      await liveStart(page)
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByText('Inspection cancelled before any result arrived.')).toBeVisible()
    },
  },
  {
    state: 'cancelled-partial',
    screen: 'results',
    steps: [
      'Progress steps (the survey answers, both damage checks held)',
      'Click Cancel: the ID and details stay, marked as a partial result, damage named as not finished',
    ],
    motion: 'frozen',
    script: () => rearDoorsScript({}, { side: HOLD, door: HOLD }),
    run: async (page) => {
      await liveStart(page)
      await expect(stageRow(page, 'Reading the ID')).toHaveClass(/qs-stage--done/)
      await page.getByRole('button', { name: 'Cancel' }).click()
      await page.locator('.qs-notice--partial').waitFor()
      await page.waitForTimeout(SETTLE_MS)
    },
  },
  {
    state: 'rear-door-damage-metric',
    screen: 'results',
    steps: [
      'Settings-chip steps (OpenAI), choose the COYU door photo',
      'Run live inspection (mocked: ID and details read, weights agree in kg and lb, door-end damage found)',
      'settle; Container details on Metric',
    ],
    motion: 'frozen',
    script: () => rearDoorsScript(),
    run: (page) => liveLanded(page),
  },
  {
    state: 'rear-door-damage-imperial',
    screen: 'results',
    steps: ['Rear-door steps', 'Click Imperial in the Container details heading'],
    motion: 'frozen',
    script: () => rearDoorsScript(),
    run: async (page) => {
      await liveLanded(page)
      await units(page, 'Imperial').click()
    },
  },
  {
    state: 'units-toggle-focused',
    screen: 'results',
    steps: ['Rear-door steps', 'Tab to the Imperial button so the keyboard focus ring shows'],
    motion: 'frozen',
    script: () => rearDoorsScript(),
    run: async (page) => {
      await liveLanded(page)
      await units(page, 'Metric').focus()
      await page.keyboard.press('Tab')
    },
  },
  {
    state: 'weights-conflict',
    screen: 'results',
    steps: [
      'Rear-door steps',
      'Mocked: max gross read as 30,480 kg but 67,900 lb, and the second look reads the same',
      'settle: Uncertain with both readings, said first in What we found',
    ],
    motion: 'frozen',
    script: () => rearDoorsScript({ weights: CONFLICTING_WEIGHTS }),
    run: (page) => liveLanded(page),
  },
  {
    state: 'markings-seen',
    screen: 'results',
    steps: [
      'Rear-door steps',
      'Mocked: a class 3 DG placard, fumigation and high-container markings seen, overwidth not clear',
    ],
    motion: 'frozen',
    script: () => rearDoorsScript(MARKINGS_SEEN),
    run: (page) => liveLanded(page),
  },
  {
    state: 'side-damage',
    screen: 'results',
    steps: [
      'Settings-chip steps (OpenAI), choose the dented grey side photo',
      'Run live inspection (mocked: face long side, no readable size code so the length is estimated from shape; findings at each of the four severities and a bent bottom rail; the door-end set sees no door end)',
      'settle',
    ],
    motion: 'frozen',
    script: () => longSideScript({ shapeLength: '40_ft', sizeTypeCode: [['not_visible', 0.95]] }),
    run: (page) => liveLanded(page, sidePhoto),
  },
  {
    state: 'damage-not-assessed',
    screen: 'results',
    steps: [
      'Settings-chip steps (OpenAI), choose the COYU door photo',
      'Run live inspection (mocked: the survey says the photo shows the roof, neither damage set can inspect it)',
      'settle: Damage not assessed for this view',
    ],
    motion: 'frozen',
    script: () => roofScript(),
    run: (page) => liveLanded(page),
  },
]

// ---- Harness ------------------------------------------------------------------------------------

const shots = new Map<string, ShotInput & { file: string }>()

function writeIndex() {
  fs.mkdirSync(OUT, { recursive: true })
  const index = buildIndex([...shots.values()])
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n')
}

/** Routes every request: the app origin passes; each Decisions request is answered by the script; the rest is aborted. */
async function guardNetwork(
  page: Page,
  origin: string,
  script: Script | undefined,
  blocked: string[],
) {
  let calls = 0
  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (!/^https?:/.test(url)) return route.continue()
    if (url.startsWith(origin)) return route.continue()
    const decisions = /api\.openai\.com\/v1\/decisions|openrouter\.ai\/api\/alpha\/decisions/
    if (script !== undefined && decisions.test(url)) {
      calls += 1
      const reply = script(kindOfRequest(route.request().postData() ?? ''), calls)
      // A held request stays in flight until the page aborts it or the capture ends.
      if (reply === HOLD) return
      if (reply === SERVER_ERROR) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'server error' } }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(reply),
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
      await guardNetwork(page, origin, capture.script?.(), blocked)

      await capture.run(page)
      if (capture.motion === 'frozen') await page.addStyleTag({ content: FREEZE_CSS })
      // A click or focus may have scrolled the page; a full-page shot from mid-page draws the sticky
      // top bar halfway down. Capture from the top (focus and selection stay where they are).
      await page.evaluate(() => window.scrollTo(0, 0))

      // No state may scroll sideways (390 x 844 included).
      const sideways = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(sideways, `${label} scrolls sideways`).toBeLessThanOrEqual(0)

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
