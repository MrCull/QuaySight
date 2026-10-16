import type { ProviderId } from './inspection'

/** How a model is reached: straight to its maker's endpoint, or through OpenRouter. */
export type ModelRoute = 'direct' | 'openrouter'

/** The request and response format spoken on the wire. */
export type WireFormat = 'openai-decisions' | 'typesafe-system-one' | 'openrouter-decisions'

/** Photo size the model accepts, in pixels. A photo outside these limits must be fitted or refused. */
export interface PhotoLimits {
  /** Longest side allowed. */
  maxSide: number
  /** Shortest side allowed. 0 when the provider documents no minimum. */
  minSide: number
  /** Largest total pixel count allowed, or null when only the side limit applies. */
  maxPixels: number | null
  /** Smallest total pixel count allowed. 0 when the provider documents no minimum. */
  minPixels: number
}

export interface ModelOption {
  id: string
  /** Shown in the model selector. */
  label: string
  /** Who makes the model, e.g. OpenAI or TypeSafe. */
  maker: string
  route: ModelRoute
  wireFormat: WireFormat
  /** Whether the model accepts the box question. Nothing else decides this. */
  box: boolean
  photoLimits: PhotoLimits
  /** A moving alias: the provider can point it at a newer version between runs. */
  movingTarget: boolean
  recommended: boolean
}

/** The key field's copy. Each key is labelled for, and sent to, its own provider's endpoint only. */
export interface KeyFieldCopy {
  /** e.g. "OpenAI API key". Also the field's accessible name. */
  label: string
  placeholder: string
  /** Says whose endpoint receives the photo and the key. */
  hint: string
}

export interface ProviderInfo {
  id: ProviderId
  name: string
  vendor: string
  api: string
  monogram: string
  keyField: KeyFieldCopy
  models: ModelOption[]
}

const KEPT_IN_MEMORY = "The key stays in this tab's memory and is never saved."

/** Jev (TypeSafe docs, checked 16 Oct 2026): 256–1,568 px per side, 78,400–2,458,624 px in total. */
const JEV_LIMITS: PhotoLimits = {
  maxSide: 1568,
  minSide: 256,
  maxPixels: 2_458_624,
  minPixels: 78_400,
}
/** Luna: up to 2,048 px on the long side. */
const LUNA_LIMITS: PhotoLimits = { maxSide: 2048, minSide: 0, maxPixels: null, minPixels: 0 }

const JEV_DIRECT = {
  maker: 'TypeSafe',
  route: 'direct',
  wireFormat: 'typesafe-system-one',
  photoLimits: JEV_LIMITS,
} as const

// Catalogue (spec 11.1): provider, endpoint family, model identifier and display name are separate.
// Adding a provider here should not require changes to the results screen.
export const providers: ProviderInfo[] = [
  {
    id: 'luna',
    name: 'GPT-6 Luna',
    vendor: 'OpenAI',
    api: 'Decisions API',
    monogram: 'OA',
    keyField: {
      label: 'OpenAI API key',
      placeholder: 'Paste your OpenAI key',
      hint: `The photo and this key go only to OpenAI's Decisions endpoint, and only for a live run. ${KEPT_IN_MEMORY}`,
    },
    models: [
      {
        id: 'gpt-6-luna',
        label: 'gpt-6-luna (pinned)',
        maker: 'OpenAI',
        route: 'direct',
        wireFormat: 'openai-decisions',
        box: false,
        photoLimits: LUNA_LIMITS,
        movingTarget: false,
        recommended: true,
      },
    ],
  },
  {
    id: 'jev',
    name: 'Jev',
    vendor: 'TypeSafe',
    api: 'System One API',
    monogram: 'TS',
    keyField: {
      label: 'TypeSafe API key',
      placeholder: 'Paste your TypeSafe console key',
      hint: `The photo and this key go only to TypeSafe's System One endpoint, and only for a live run. It needs a TypeSafe console key from console.typesafe.ai. ${KEPT_IN_MEMORY}`,
    },
    models: [
      {
        ...JEV_DIRECT,
        id: 'jev-latest',
        label: 'jev-latest (moving target)',
        box: false,
        movingTarget: true,
        recommended: true,
      },
      {
        ...JEV_DIRECT,
        id: 'jev-1.14.0',
        label: 'jev-1.14.0 (pinned, experimental box)',
        box: true,
        movingTarget: false,
        recommended: false,
      },
      {
        ...JEV_DIRECT,
        id: 'jev-1.13.0',
        label: 'jev-1.13.0 (pinned)',
        box: false,
        movingTarget: false,
        recommended: false,
      },
    ],
  },
]

export function getProvider(id: ProviderId): ProviderInfo {
  const provider = providers.find((p) => p.id === id)
  if (!provider) throw new Error(`Unknown provider: ${id}`)
  return provider
}

/** The catalogue entry for a model the provider offers, or undefined when it offers no such model. */
export function findModel(provider: ProviderId, model: string): ModelOption | undefined {
  return getProvider(provider).models.find((m) => m.id === model)
}

/** Box-capable only when the catalogue says so. Unlisted models never are. */
export function supportsBox(provider: ProviderId, model: string): boolean {
  return findModel(provider, model)?.box ?? false
}

/** A moving alias only when the catalogue says so. The version that answers is recorded with each run. */
export function isMovingTarget(provider: ProviderId, model: string): boolean {
  return findModel(provider, model)?.movingTarget ?? false
}

/** The provider names a result label, ledger line or export shows for a run. The selector reads ModelOption.label. */
export interface ModelLabels {
  /** The name a run is attributed to on result labels and exports, e.g. "GPT-6 Luna". */
  provider: string
  /** The ledger's provider column, e.g. "OpenAI · GPT-6 Luna". */
  ledger: string
  /** The provider in running text, e.g. "OpenAI GPT-6 Luna". */
  prose: string
}

/** Labels for a provider and model. A model the catalogue no longer lists keeps its provider's names. */
export function labelsFor(provider: ProviderId, model: string): ModelLabels {
  const info = getProvider(provider)
  const entry = findModel(provider, model)
  const maker = entry?.maker ?? info.vendor
  return {
    provider: info.name,
    ledger: `${maker} · ${info.name}`,
    prose: `${maker} ${info.name}`,
  }
}

export function defaultModelFor(id: ProviderId): string {
  const model = getProvider(id).models.find((m) => m.recommended)
  if (!model) throw new Error(`No recommended model for ${id}`)
  return model.id
}
