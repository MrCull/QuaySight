<script setup lang="ts">
import { useInspectionStore } from '../stores/inspection'
import {
  buildInspectionExport,
  buildRawResponsesExport,
  buildSummaryText,
  exportFilenames,
} from '../domain/exports'
import { downloadText } from '../services/download'

const store = useInspectionStore()

// Each export is built from the inspection record alone. No key or credential is an input.
function exportJson() {
  const record = store.record
  if (!record) return
  downloadText(
    exportFilenames(record).json,
    JSON.stringify(buildInspectionExport(record), null, 2) + '\n',
    'application/json',
  )
}

function exportRaw() {
  const record = store.record
  if (!record) return
  downloadText(
    exportFilenames(record).raw,
    JSON.stringify(buildRawResponsesExport(record), null, 2) + '\n',
    'application/json',
  )
}

function exportSummary() {
  const record = store.record
  if (!record) return
  downloadText(exportFilenames(record).summary, buildSummaryText(record), 'text/plain')
}
</script>

<template>
  <div v-if="store.record" class="rs-exports" role="group" aria-label="Export this result">
    <button type="button" class="qs-btn qs-btn--secondary" @click="exportJson">
      <i class="qs-glyph qs-glyph--upload" aria-hidden="true"></i>Export JSON
    </button>
    <button type="button" class="qs-btn qs-btn--secondary" @click="exportRaw">
      Download raw response
    </button>
    <button type="button" class="qs-btn qs-btn--secondary" @click="exportSummary">
      Download summary
    </button>
  </div>
</template>
