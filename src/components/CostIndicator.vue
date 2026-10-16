<script setup lang="ts">
import { computed, ref } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { useLedgerStore } from '../stores/ledger'
import { formatUsd, type LedgerEntry } from '../domain/ledger'
import { getProvider } from '../domain/providers'

const inspection = useInspectionStore()
const ledgerStore = useLedgerStore()
const expanded = ref(false)
const panelId = 'cost-ledger-panel'

const isSample = computed(() => inspection.record?.source === 'recorded')
const containerId = computed(() => (isSample.value ? null : (inspection.record?.id ?? null)))

const container = computed(() =>
  containerId.value ? ledgerStore.inspectionTotals(containerId.value) : null,
)
const session = computed(() => ledgerStore.session)
const rows = computed(() => ledgerStore.entries())

function providerLabel(entry: LedgerEntry): string {
  const p = getProvider(entry.provider)
  return `${p.vendor} · ${p.name}`
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour12: false })
}

function tokensLabel(entry: LedgerEntry): string {
  const u = entry.usage
  if (!u || u.inputTokens === null) return '—'
  const total = u.inputTokens + (u.outputTokens ?? 0)
  return total.toLocaleString('en-US')
}

function costLabel(entry: LedgerEntry): string {
  return entry.costState === 'estimated' ? formatUsd(entry.costUsd) : formatUsd(null)
}

function latencyLabel(entry: LedgerEntry): string {
  return entry.status === 'failed' ? '—' : `${(entry.latencyMs / 1000).toFixed(1)} s`
}

// Container and session totals use the same cost wording: "Partial estimate" marks incomplete data.
function amount(totals: { costUsd: number | null; requests: number } | null): string {
  if (!totals || totals.requests === 0) return 'None yet'
  return formatUsd(totals.costUsd)
}
</script>

<template>
  <div class="qs-cost">
    <button
      type="button"
      class="qs-cost__toggle"
      :aria-expanded="expanded ? 'true' : 'false'"
      :aria-controls="panelId"
      @click="expanded = !expanded"
    >
      <template v-if="isSample">Saved result · no live API charge</template>
      <template v-else>
        This container <b>{{ amount(container) }}</b>
        <template v-if="container?.incomplete">
          <span class="rs-cost__partial">Partial estimate</span></template
        >
        · Session <b>{{ amount(session) }}</b>
        <template v-if="session.incomplete">
          <span class="rs-cost__partial">Partial estimate</span></template
        >
      </template>
      <i class="qs-glyph qs-glyph--chevron" aria-hidden="true"></i>
    </button>

    <div v-if="expanded" :id="panelId" class="qs-cost__panel">
      <div class="qs-cost__head">
        <div class="qs-cost__stat">
          <span>This container</span><b>{{ amount(container) }}</b>
        </div>
        <div class="qs-cost__stat">
          <span>Session · {{ session.inspections }} containers</span><b>{{ amount(session) }}</b>
        </div>
        <div class="qs-cost__stat">
          <span>Requests</span><b>{{ session.requests }}</b>
        </div>
        <div class="qs-cost__stat">
          <span>API time</span><b>{{ (session.latencyMs / 1000).toFixed(1) }} s</b>
        </div>
      </div>
      <table v-if="rows.length" class="qs-cost__table">
        <thead>
          <tr>
            <th>#</th>
            <th>Purpose</th>
            <th>Provider · model</th>
            <th>Status</th>
            <th>Time</th>
            <th class="num">Tokens</th>
            <th class="num">Est. cost</th>
            <th class="num">Latency</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, index) in rows" :key="entry.id">
            <td>{{ index + 1 }}</td>
            <td class="qs-cost__purpose">{{ entry.purpose }}</td>
            <td class="qs-cost__model">{{ providerLabel(entry) }} · {{ entry.resolvedModel }}</td>
            <td>{{ entry.status }}</td>
            <td>{{ timeLabel(entry.startedAt) }}</td>
            <td class="num">{{ tokensLabel(entry) }}</td>
            <td class="num" :class="{ 'qs-cost__unknown': entry.costState !== 'estimated' }">
              {{ costLabel(entry) }}
            </td>
            <td class="num">{{ latencyLabel(entry) }}</td>
          </tr>
        </tbody>
      </table>
      <div class="qs-cost__foot">
        Estimated API usage at each provider's configured rates, not an invoice. Recorded samples
        are never added to live totals.
      </div>
    </div>
  </div>
</template>
