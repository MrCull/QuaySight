import type { ProviderId } from './inspection'
import { getProvider } from './providers'

/** A key counts only when it has visible content. Keys are never trimmed in storage; this is a gate check only. */
export function hasKey(key: string): boolean {
  return key.trim() !== ''
}

/** The model must be one the selected provider offers. */
export function modelIsOffered(provider: ProviderId, model: string): boolean {
  return getProvider(provider).models.some((m) => m.id === model)
}

/**
 * The key gate (presenter rule): nothing starts, recorded or live, until a photo is chosen,
 * a key for the selected provider is entered and the model belongs to that provider.
 */
export function canStart(input: {
  hasPhoto: boolean
  provider: ProviderId
  model: string
  apiKey: string
}): boolean {
  return input.hasPhoto && hasKey(input.apiKey) && modelIsOffered(input.provider, input.model)
}

/**
 * Which selector view shows. 'collapsed' is the single quiet summary row, shown only once a key is
 * entered and the selection is valid, and only while the presenter is not editing.
 */
export function selectorView(input: {
  provider: ProviderId
  model: string
  apiKey: string
  editing: boolean
}): 'entry' | 'collapsed' {
  const valid = hasKey(input.apiKey) && modelIsOffered(input.provider, input.model)
  return valid && !input.editing ? 'collapsed' : 'entry'
}
