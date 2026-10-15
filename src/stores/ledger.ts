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
      this.version += 1
      return result
    },
  },
})
