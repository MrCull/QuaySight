import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import {
  CostLedger,
  runChargeable,
  type ChargeableRequest,
  type ChargeableResult,
  type LedgerEntry,
  type Totals,
} from '../domain/ledger'
import { rateSchedules, spendCaps } from '../domain/rates'
import { track } from '../services/analytics'

/** Inspections that already sent spend_cap_hit: once each, however many calls the cap refuses. */
const capReported = new Set<string>()

/**
 * Session ledger for live, chargeable calls only. Recorded samples never call run().
 * The ledger object is kept outside reactive state; `version` bumps on every change so views update.
 */
export const useLedgerStore = defineStore('ledger', {
  state: () => ({
    ledger: markRaw(new CostLedger(spendCaps, rateSchedules)),
    version: 0,
  }),
  getters: {
    session(): Totals {
      void this.version
      return this.ledger.sessionTotals()
    },
  },
  actions: {
    entries(): LedgerEntry[] {
      void this.version
      return this.ledger.entries()
    },
    inspectionTotals(inspectionId: string): Totals {
      void this.version
      return this.ledger.inspectionTotals(inspectionId)
    },
    async run(request: ChargeableRequest): Promise<ChargeableResult> {
      const result = await runChargeable(this.ledger, request)
      // Only live runs reach the ledger; recorded samples never call run().
      if (result.status === 'blocked' && !capReported.has(request.inspectionId)) {
        capReported.add(request.inspectionId)
        track({ name: 'spend_cap_hit', mode: 'live', reason: result.reason })
      }
      this.version += 1
      return result
    },
  },
})
