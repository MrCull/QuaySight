import type { ProviderId } from './inspection'
import { defaultModelFor, providers } from './providers'
import { modelIsOffered } from './keyGate'

/** What survives a page refresh: the provider and model only. A key is never part of it. */
export interface RememberedSelection {
  provider: ProviderId
  model: string
}

/** The browser-storage key the selection is written under. */
export const REMEMBERED_SELECTION_KEY = 'quay-sight.selection'

/** Text to store. Built field by field so nothing but the provider and model can be written. */
export function rememberSelection(selection: RememberedSelection): string {
  return JSON.stringify({ provider: selection.provider, model: selection.model })
}

/**
 * The stored selection, checked against the catalogue. A provider it no longer lists is ignored;
 * a listed provider whose model is gone falls back to that provider's recommended model.
 */
export function readRememberedSelection(text: string | null): RememberedSelection | null {
  if (text === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { provider, model } = parsed as { provider?: unknown; model?: unknown }
  const listed = providers.find((p) => p.id === provider)
  if (!listed) return null
  const offered = typeof model === 'string' && modelIsOffered(listed.id, model)
  return { provider: listed.id, model: offered ? model : defaultModelFor(listed.id) }
}
