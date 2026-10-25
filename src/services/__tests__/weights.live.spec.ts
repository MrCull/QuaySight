// Opt-in live smoke test for the weights (ticket #34): the COYU 22G1 door photo.
// Makes up to three real, chargeable survey requests on samples/rear-door-coyu-22g1.jpg (1079 x 1080):
//   - GPT-6 Luna, OpenAI direct            (needs OPENAI_API_KEY)
//   - Jev latest, via OpenRouter           (needs OPENROUTER_API_KEY)
// Keys are supplied at run time and never stored in the repo:
//   Bash: OPENAI_API_KEY='<key>' OPENROUTER_API_KEY='<key>' npx vitest run src/services/__tests__/weights.live.spec.ts
// Nothing is recorded. Not yet run: no keys were available when it was written.
//
// The door prints MAX GROSS 30,480 KG 67,200 LB, TARE 2,180 KG 4,810 LB, NET 28,300 KG 62,390 LB and
// CU. CAP. 33.2 M3 1,173 CU.FT. The bar is the ticket's: each figure is read as printed, or the app flags
// exactly where it does not (a figure left unread, or its row Uncertain). A wrong figure shown Confident fails.
//
// Behind an HTTP proxy, set HTTPS_PROXY (and NODE_EXTRA_CA_CERTS if the proxy re-signs TLS).
import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici'
import { LUNA_ENDPOINT_ID, LUNA_MODEL } from '../../domain/luna'
import type { ProviderId } from '../../domain/inspection'
import { OPENROUTER_ENDPOINT_ID } from '../../domain/openrouter'
import { findModel, labelsFor } from '../../domain/providers'
import { evaluateWeights, rereadQuantities, type WeightChecks } from '../../domain/weights'
import { survey } from '../../plan/requests/survey'
import type { RunRoute } from '../../plan/requestPlan'

const openAiKey = process.env.OPENAI_API_KEY ?? ''
const openRouterKey = process.env.OPENROUTER_API_KEY ?? ''
if ((openAiKey || openRouterKey) && (process.env.HTTPS_PROXY || process.env.https_proxy)) {
  setGlobalDispatcher(new EnvHttpProxyAgent())
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

if (!openAiKey && !openRouterKey) {
  console.warn(
    'Skipping the live weights smoke test: set OPENAI_API_KEY or OPENROUTER_API_KEY to run it.',
  )
}

async function weightsOn(provider: ProviderId, model: string, apiKey: string) {
  const entry = findModel(provider, model)!
  const route: RunRoute = {
    provider,
    model,
    entry,
    endpoint:
      entry.wireFormat === 'openrouter-decisions' ? OPENROUTER_ENDPOINT_ID : LUNA_ENDPOINT_ID,
    describe: { name: labelsFor(provider, model).model, maxSide: entry.photoLimits.maxSide },
  }
  const photo = new Blob([await readFile(resolve(root, 'samples/rear-door-coyu-22g1.jpg'))], {
    type: 'image/jpeg',
  })
  const reply = await survey.send({
    route,
    apiKey,
    photo,
    signal: new AbortController().signal,
    answer: () => undefined,
  })
  const { readings } = reply.answer.findings.weights
  return { weights: evaluateWeights(readings), again: rereadQuantities(readings) }
}

/** Every figure that is shown Confident or Likely and is not the printed one. Reports every figure read. */
function wrongButSure({ weights, again }: { weights: WeightChecks; again: string[] }): string[] {
  const sure = (certainty: string | undefined) =>
    certainty === 'Confident' || certainty === 'Likely'
  const wrong: string[] = []
  const check = (
    name: string,
    read: number | null | undefined,
    printed: number,
    certainty?: string,
  ) => {
    if (sure(certainty) && read !== null && read !== undefined && read !== printed) {
      wrong.push(`${name}: read ${read}, printed ${printed}`)
    }
  }
  const rows = [
    ['max gross', weights.maxGross, 30480, 67200],
    ['tare', weights.tare, 2180, 4810],
    ['payload', weights.printedPayload ?? null, 28300, 62390],
  ] as const
  for (const [name, row, kg, lb] of rows) {
    console.info(
      `${name}: ${row?.printed?.kg ?? 'unread'} kg, ${row?.printed?.lb ?? 'unread'} lb, ${row?.certainty ?? 'not read'}${row?.units ? `, kg and lb ${row.units}` : ''}`,
    )
    check(`${name} kg`, row?.printed?.kg, kg, row?.certainty)
    check(`${name} lb`, row?.printed?.lb, lb, row?.certainty)
  }
  const cap = weights.capacity
  console.info(
    `capacity: ${cap?.printed.m3 ?? 'unread'} m3, ${cap?.printed.cuFt ?? 'unread'} cu ft, ${cap?.certainty ?? 'not read'}`,
  )
  check('capacity m3', cap?.printed.m3, 33.2, cap?.certainty)
  check('capacity cu ft', cap?.printed.cuFt, 1173, cap?.certainty)
  console.info(`weights to look at again: ${again.join(', ') || 'none'}`)
  return wrong
}

describe('COYU 22G1 weights live smoke test (opt-in, chargeable)', () => {
  it.skipIf(!openAiKey)(
    'GPT-6 Luna on OpenAI reads the door weights or flags where it does not',
    async () => {
      expect(wrongButSure(await weightsOn('luna', LUNA_MODEL, openAiKey))).toEqual([])
    },
    120_000,
  )

  it.skipIf(!openRouterKey)(
    'Jev latest through OpenRouter reads the door weights or flags where it does not',
    async () => {
      expect(
        wrongButSure(await weightsOn('openrouter', '~typesafe/jev-latest', openRouterKey)),
      ).toEqual([])
    },
    120_000,
  )
})
