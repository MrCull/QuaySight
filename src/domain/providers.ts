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
  /** The model id sent on the wire, exactly as the endpoint expects it. */
  id: string
  /** Shown in the model selector. */
  label: string
  /** The model's own name on result labels, ledger lines and exports, e.g. "Jev 1.14". */
  displayName: string
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

/** Jev through OpenRouter's Decisions endpoint: one JSON body, the photo as a data-URL part (docs/adr/0001). */
const JEV_VIA_OPENROUTER = {
  maker: 'TypeSafe',
  route: 'openrouter',
  wireFormat: 'openrouter-decisions',
  photoLimits: JEV_LIMITS,
} as const

// Catalogue (spec 11.1): provider, endpoint family, model identifier and display name are separate.
// Adding a provider here should not require changes to the results screen.
// TypeSafe direct (System One) is not offered: browsers cannot reach it (its preflight is refused,
// checked 16 Oct 2026). Its adapter stays in services/jev.ts. See docs/adr/0001.
// OpenRouter with Jev latest comes first: it is the pre-selected choice on a first visit (spec #16).
export const providers: ProviderInfo[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    vendor: 'OpenRouter',
    api: 'Decisions API',
    monogram: 'OR',
    keyField: {
      label: 'OpenRouter API key',
      placeholder: 'Paste your OpenRouter key (sk-or-…)',
      hint: `The photo and this key go only to OpenRouter's Decisions endpoint, and only for a live run. OpenRouter passes the photo, never your key, on to the model's maker. ${KEPT_IN_MEMORY}`,
    },
    models: [
      {
        ...JEV_VIA_OPENROUTER,
        id: '~typesafe/jev-latest',
        label: 'Jev latest (recommended, moving target)',
        displayName: 'Jev latest',
        // Resolved to typesafe/jev-1.14-20261014 on 16 Oct 2026, which answers the box question.
        box: true,
        movingTarget: true,
        recommended: true,
      },
      {
        ...JEV_VIA_OPENROUTER,
        id: 'typesafe/jev-1.14',
        label: 'Jev 1.14 (pinned)',
        displayName: 'Jev 1.14',
        box: true,
        movingTarget: false,
        recommended: false,
      },
      {
        ...JEV_VIA_OPENROUTER,
        id: 'typesafe/jev-1.13',
        label: 'Jev 1.13 (pinned)',
        displayName: 'Jev 1.13',
        // Answers a box question with 400 "Invalid request." (checked 16 Oct 2026).
        box: false,
        movingTarget: false,
        recommended: false,
      },
      {
        // GPT-6 Luna on OpenRouter's Decisions endpoint (ticket #23). Asked the Luna question set, not
        // Jev's (see questionSetOf). Resolved to openai/gpt-6-luna-decisions-20261006 on 16 Oct 2026.
        id: 'openai/gpt-6-luna-decisions',
        label: 'GPT-6 Luna Decisions',
        displayName: 'GPT-6 Luna Decisions',
        maker: 'OpenAI',
        route: 'openrouter',
        wireFormat: 'openrouter-decisions',
        // Luna takes no box question.
        box: false,
        photoLimits: LUNA_LIMITS,
        movingTarget: false,
        recommended: false,
      },
    ],
  },
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
        displayName: 'GPT-6 Luna',
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

/** The question set a model is asked. Fixed by the model's maker, whichever route reaches it. */
export type QuestionSet = 'luna' | 'jev'

/**
 * OpenAI's models get the Luna question set (check-digit guidance, position re-check); TypeSafe's get
 * Jev's. OpenRouter carries both under one wire format, so the wire format cannot decide this (ticket #23).
 */
export function questionSetOf(model: ModelOption): QuestionSet {
  return model.maker === 'OpenAI' ? 'luna' : 'jev'
}

/** A moving alias only when the catalogue says so. The version that answers is recorded with each run. */
export function isMovingTarget(provider: ProviderId, model: string): boolean {
  return findModel(provider, model)?.movingTarget ?? false
}

/** The names a result label, ledger line or export shows for a run. The selector reads ModelOption.label. */
export interface ModelLabels {
  /** The name a run is attributed to on result labels and exports, e.g. "GPT-6 Luna" or "Jev 1.14 (TypeSafe) via OpenRouter". */
  provider: string
  /** The ledger's provider column, e.g. "OpenAI · GPT-6 Luna". */
  ledger: string
  /** The provider in running text, e.g. "OpenAI GPT-6 Luna". */
  prose: string
  /** The model alone, for messages about the model itself, e.g. "Jev 1.14". */
  model: string
}

/**
 * Labels for a provider and model. A direct model is named by its maker; a model reached through
 * OpenRouter by model, maker and route (spec #16 stories 44-45). A model the catalogue no longer
 * lists keeps its provider's names.
 */
export function labelsFor(provider: ProviderId, model: string): ModelLabels {
  const info = getProvider(provider)
  const entry = findModel(provider, model)
  if (entry?.route === 'openrouter' || (!entry && info.id === 'openrouter')) {
    const attributed = entry
      ? `${entry.displayName} (${entry.maker}) via ${info.name}`
      : `${model} via ${info.name}`
    return {
      provider: attributed,
      ledger: attributed,
      prose: attributed,
      model: entry?.displayName ?? model,
    }
  }
  const maker = entry?.maker ?? info.vendor
  return {
    provider: info.name,
    ledger: `${maker} · ${info.name}`,
    prose: `${maker} ${info.name}`,
    model: entry?.displayName ?? info.name,
  }
}

/**
 * "Recorded demonstration: [provider/model]" (spec 13): the one label every recorded result carries,
 * on screen and in the exports alike. The model is the one the recording names.
 */
export function recordedDemonstrationLabel(record: { provider: ProviderId; model: string }): string {
  return `Recorded demonstration: ${labelsFor(record.provider, record.model).provider} / ${record.model}`
}

export function defaultModelFor(id: ProviderId): string {
  const model = getProvider(id).models.find((m) => m.recommended)
  if (!model) throw new Error(`No recommended model for ${id}`)
  return model.id
}
