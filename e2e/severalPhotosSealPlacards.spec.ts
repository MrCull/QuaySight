import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Several photos of one container (ticket #72): the seal is read across two photos and a placard seen on both
 * faces is listed once. OpenAI's Decisions endpoint is answered here; nothing leaves the app origin and the key
 * is a placeholder.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const photos = [
  path.join(ROOT, 'samples', 'rear-door-coyu-22g1.jpg'),
  path.join(ROOT, 'samples', 'side-dented-grey.jpg'),
]
const SHOTS = process.env.QS_SHOT_DIR
const ID = 'COYU2668130'

const choice = (name: string, value: string, probability = 0.98) => ({
  type: 'choice',
  name,
  choice: value,
  probabilities: [{ value, probability }],
})
const predicate = (name: string, probability: number) => ({ type: 'predicate', name, probability })
const two = (n: number) => String(n).padStart(2, '0')

/** Photo 1 reads the seal's first three characters, photo 2 its last three; both read the same placard. */
function surveyReply(n: number) {
  const answers: unknown[] = ID.split('').map((ch, i) => choice(`id_char_${two(i + 1)}`, ch))
  answers.push(choice('photo_face', n === 0 ? 'rear_doors' : 'long_side', 0.96))
  answers.push(predicate('seal_visible', 0.97))
  const read = n === 0 ? ['A', 'B', '1', null, null, null] : [null, null, '1', '2', '3', '4']
  read.forEach((ch, i) => {
    answers.push(choice(`seal_char_${two(i + 1)}`, ch ?? 'unreadable', ch ? 0.97 : 0.9))
  })
  for (let i = 7; i <= 8; i++) answers.push(choice(`seal_char_${two(i)}`, 'none', 0.95))
  answers.push(predicate('placards_present', 0.95), predicate('placard_1_present', 0.95))
  answers.push(choice('placard_1_class', 'class_3', 0.93))
  for (const [i, d] of [...'1203'].entries()) answers.push(choice(`placard_1_un_${i + 1}`, d, 0.93))
  return { model: 'gpt-6-luna', answers, usage: { input_tokens: 6000, output_tokens: 0 } }
}

async function answer(page: Page) {
  let surveys = 0
  await page.route(/api\.openai\.com\/v1\/decisions/, async (route) => {
    const body = route.request().postData() ?? ''
    const damage = body.includes('Z1T_DT') || body.includes('D1T_DT')
    const reply = damage
      ? { model: 'gpt-6-luna', answers: [], usage: { input_tokens: 9000, output_tokens: 0 } }
      : surveyReply(surveys++)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(reply),
    })
  })
}

test.describe('Seal and placards across photos', () => {
  test.use({ viewport: { width: 1440, height: 1100 } })

  test('combines the seal across two photos and lists a placard seen on both faces once', async ({
    page,
  }) => {
    await answer(page)
    await page.goto('/')
    await page.locator('#provider-button').click()
    await page.getByTestId('provider-option-luna').click()
    const key = page.getByLabel('OpenAI API key', { exact: true })
    await key.fill('playwright-placeholder-not-a-key')
    await key.press('Enter')
    await page.locator('input[type="file"]').setInputFiles(photos)
    await page.locator('#stage.qs-arrived').waitFor()

    const seal = page.locator('.qs-ledger__row[data-row="seal"]')
    await expect(seal).toContainText('Seal')
    await expect(seal.locator('.qs-id__ch')).toHaveText(['A', 'B', '1', '2', '3', '4'])

    const markings = page.locator('.rs-card', { hasText: 'Markings' })
    await expect(markings.getByText('PLACARD 1')).toHaveCount(1)
    await expect(markings.getByText('PLACARD 2')).toHaveCount(0)
    await expect(markings).toContainText('Class 3, UN 1203')
    await expect(markings).toContainText('Seen on: doors, long side')
    if (SHOTS) {
      await seal.screenshot({ path: path.join(SHOTS, 'seal.png') })
      await markings.screenshot({ path: path.join(SHOTS, 'markings.png') })
    }
  })
})
