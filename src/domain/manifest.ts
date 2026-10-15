import { recordedFixtures } from '../fixtures/recorded'
import { runRecordedInspection } from './recordedRun'
import type { ContainerIdReading, ProviderId } from './inspection'

// Manifest retry (spec 3.2). Pasted entries are used as supplied: no ISO 6346 or check-digit checks.

/** Limit for one paste, for this POC (spec 3.2). */
export const MANIFEST_LIMIT = 500

export interface ParsedManifest {
  /** Unique entries in the order pasted, spelled as pasted (first occurrence wins). */
  ids: string[]
  /** Entries ignored because an earlier entry matched, ignoring case. */
  duplicates: number
}

/** Every run of whitespace, comma or semicolon separates entries (lines, CSV, TSV, ;-lists, spaces). */
export function parseManifest(text: string): ParsedManifest {
  const seen = new Set<string>()
  const ids: string[] = []
  let duplicates = 0
  for (const raw of text.split(/[\s,;]+/)) {
    const entry = raw.trim()
    if (!entry) continue
    const key = entry.toUpperCase()
    if (seen.has(key)) {
      duplicates += 1
      continue
    }
    seen.add(key)
    ids.push(entry)
  }
  return { ids, duplicates }
}

export class ManifestRetryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManifestRetryError'
  }
}

export interface RecordedManifestRetryOptions {
  /** Pause before the reply, so the staged progress can read. Tests pass 0. */
  delayMs?: number
  /** Replays the recorded provider failure instead of a reading. */
  fail?: boolean
}

/**
 * Replays the manifest retry on the recorded fixture only: no network, no key, no ledger entry.
 * Resolves with the replacement ID reading. Rejects with ManifestRetryError on the recorded failure.
 */
export async function runRecordedManifestRetry(
  providerId: ProviderId,
  entries: string[],
  options: RecordedManifestRetryOptions = {},
): Promise<ContainerIdReading> {
  const fixture = recordedFixtures[providerId]
  if (!fixture) throw new Error(`No recorded fixture for ${providerId}`)

  const delayMs = options.delayMs ?? 0
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))

  if (options.fail) throw new ManifestRetryError(fixture.retryFailureMessage)

  const record = await runRecordedInspection(providerId, { delayMs: 0 })
  const reading = record.containerId
  if (!reading) throw new Error('The recorded retry has no reading')

  const matched = entries.some((entry) => entry.replace(/\s+/g, '').toUpperCase() === reading.value)
  return {
    ...reading,
    provenance: matched ? 'manifest' : 'printed',
    manifestChecked: true,
  }
}
