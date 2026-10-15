import { defineStore } from 'pinia'
import { defaultModelFor } from '../domain/providers'
import { runRecordedInspection } from '../domain/recordedRun'
import type { InspectionRecord, ProviderId } from '../domain/inspection'

export interface SelectedPhoto {
  name: string
  /** Object URL for display. The view owns its lifecycle (revoke when replaced). */
  url: string
  orientation: 'landscape' | 'portrait' | 'square' | 'unknown'
}

export type RunStatus = 'idle' | 'running' | 'complete' | 'failed'

/** Pause before a recorded result lands, so the staged progress can read. Within the 1.6s arrival budget. */
export const RECORDED_STAGE_DELAY_MS = 1600

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

      const run: Promise<void> = runRecordedInspection(this.provider, {
        delayMs: RECORDED_STAGE_DELAY_MS,
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
  },
})
