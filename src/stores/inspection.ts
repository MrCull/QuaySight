import { defineStore } from 'pinia'
import { defaultModelFor } from '../domain/providers'
import { runRecordedInspection, type SampleScenario } from '../domain/recordedRun'
import { runRecordedManifestRetry } from '../domain/manifest'
import type { InspectionRecord, ProviderId } from '../domain/inspection'

export interface SelectedPhoto {
  name: string
  /** Object URL for display. The view owns its lifecycle (revoke when replaced). */
  url: string
  orientation: 'landscape' | 'portrait' | 'square' | 'unknown'
}

export type RunStatus = 'idle' | 'running' | 'complete' | 'failed'

export interface ManifestRetryState {
  status: 'idle' | 'checking' | 'error'
  /** Provider message for the last failed check. */
  message: string | null
  /** Entries from the last check, so Try again sends the same list. */
  ids: string[]
  /** The presenter chose Keep first result for this run. */
  dismissed: boolean
}

/** Pause before a recorded result lands, so the staged progress can read. Within the 1.6s arrival budget. */
export const RECORDED_STAGE_DELAY_MS = 1600
/** Pause before a recorded manifest check lands. */
export const RECORDED_RETRY_DELAY_MS = 1600

const freshRetry = (): ManifestRetryState => ({
  status: 'idle',
  message: null,
  ids: [],
  dismissed: false,
})

export const useInspectionStore = defineStore('inspection', {
  state: () => ({
    provider: 'luna' as ProviderId,
    model: defaultModelFor('luna'),
    photo: null as SelectedPhoto | null,
    status: 'idle' as RunStatus,
    record: null as InspectionRecord | null,
    /** Bumped on every photo change; a run whose token is stale must not write its result. */
    runToken: 0,
    inFlight: null as Promise<void> | null,
    /** Recorded sample to replay on the next run (sample-only control). */
    scenario: 'identified' as SampleScenario,
    /** Sample-only control: the recorded manifest check fails. */
    retryFails: false,
    retry: freshRetry() as ManifestRetryState,
  }),
  actions: {
    setProvider(provider: ProviderId) {
      this.provider = provider
      this.model = defaultModelFor(provider)
    },
    setModel(model: string) {
      this.model = model
    },
    setPhoto(photo: SelectedPhoto) {
      this.runToken += 1
      this.inFlight = null
      this.photo = photo
      this.status = 'idle'
      this.record = null
      this.retry = freshRetry()
    },
    start(): Promise<void> {
      // Single-flight: repeated clicks while a run is in progress share it.
      if (this.inFlight) return this.inFlight
      if (!this.photo) return Promise.resolve()

      this.runToken += 1
      const token = this.runToken
      const photo = this.photo
      this.status = 'running'
      this.record = null
      this.retry = freshRetry()

      const run: Promise<void> = runRecordedInspection(this.provider, {
        delayMs: RECORDED_STAGE_DELAY_MS,
        scenario: this.scenario,
      })
        .then((record) => {
          if (token !== this.runToken) return
          this.record = {
            ...record,
            photo: { name: photo.name, orientation: photo.orientation },
          }
          this.status = 'complete'
        })
        .catch(() => {
          if (token === this.runToken) this.status = 'failed'
        })
        .finally(() => {
          if (this.inFlight === run) this.inFlight = null
        })

      this.inFlight = run
      return run
    },
    /**
     * Manifest retry (spec 3.2), recorded only. Replaces the container ID in place on success and
     * leaves the first result unchanged on failure. Recorded replays never reach the cost ledger
     * or the per-inspection cap: only live chargeable calls go through runChargeable (spec 8.5).
     */
    async retryManifest(ids: string[]): Promise<void> {
      const record = this.record
      if (!record || record.containerId !== null) return
      if (this.retry.status === 'checking' || ids.length === 0) return

      const token = this.runToken
      this.retry = { ...this.retry, status: 'checking', message: null, ids: [...ids] }
      try {
        const reading = await runRecordedManifestRetry(record.provider, ids, {
          delayMs: RECORDED_RETRY_DELAY_MS,
          fail: this.retryFails,
        })
        if (token !== this.runToken || this.record !== record) return
        this.record = { ...record, containerId: reading }
        this.retry = { ...this.retry, status: 'idle' }
      } catch (error) {
        if (token !== this.runToken) return
        this.retry = {
          ...this.retry,
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        }
      }
    },
    dismissRetry() {
      this.retry = { ...this.retry, dismissed: true }
    },
  },
})
