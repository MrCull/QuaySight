import type { ProviderId } from './inspection'

export interface ModelOption {
  id: string
  label: string
  recommended: boolean
}

export interface ProviderInfo {
  id: ProviderId
  name: string
  vendor: string
  api: string
  monogram: string
  models: ModelOption[]
}

// Catalogue (spec 11.1): provider, endpoint family, model identifier and display name are separate.
// Adding a provider here should not require changes to the results screen.
export const providers: ProviderInfo[] = [
  {
    id: 'luna',
    name: 'GPT-6 Luna',
    vendor: 'OpenAI',
    api: 'Decisions API',
    monogram: 'OA',
    models: [{ id: 'gpt-6-luna', label: 'gpt-6-luna (pinned)', recommended: true }],
  },
  {
    id: 'jev',
    name: 'Jev',
    vendor: 'TypeSafe',
    api: 'System One API',
    monogram: 'TS',
    models: [{ id: 'jev-1.14.0', label: 'jev-1.14.0 (pinned)', recommended: true }],
  },
]

export function getProvider(id: ProviderId): ProviderInfo {
  const provider = providers.find((p) => p.id === id)
  if (!provider) throw new Error(`Unknown provider: ${id}`)
  return provider
}

export function defaultModelFor(id: ProviderId): string {
  const model = getProvider(id).models.find((m) => m.recommended)
  if (!model) throw new Error(`No recommended model for ${id}`)
  return model.id
}
