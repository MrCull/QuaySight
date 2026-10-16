<script setup lang="ts">
import { computed } from 'vue'
import type { CertaintyLabel, InspectionRecord } from '../domain/inspection'
import CertaintyChip from './CertaintyChip.vue'

const props = defineProps<{ record: InspectionRecord }>()

interface DetailRow {
  label: string
  value: string | null
  /** Shown when value is null, in place of the value. */
  absentText: string
  provenance: string
  provenanceClass: string
  certainty: CertaintyLabel
  note: string | null
}

// A run that never read the size code or the weights (every live run today reads the ID only) has
// nothing to say about them: one plain sentence, not a column of Not seen chips (Not seen means "in no photo").
const assessed = computed(() => props.record.sizeCode !== null || props.record.weights !== null)

const kg = (value: number) => `${value.toLocaleString('en-GB')} kg`

// Each value keeps its source label: Printed, Decoded from ISO or Calculated (spec 4.3, 4.4).
const rows = computed<DetailRow[]>(() => {
  const r = props.record
  const size = r.sizeCode
  const weights = r.weights
  const payload = weights?.payload ?? null
  const decoded = (value: string, certainty: CertaintyLabel): DetailRow => ({
    label: '',
    value,
    absentText: 'Not visible in this photo',
    provenance: 'Decoded from ISO',
    provenanceClass: '',
    certainty,
    note: null,
  })

  const sizeRows: DetailRow[] = size
    ? [
        {
          label: 'ISO CODE',
          value: size.code,
          absentText: 'Not visible in this photo',
          provenance: 'Printed',
          provenanceClass: '',
          certainty: size.certainty,
          note: size.summary,
        },
        { ...decoded(size.length.label, size.certainty), label: 'LENGTH' },
        { ...decoded(size.height.label, size.certainty), label: 'HEIGHT' },
        { ...decoded(size.width.label, size.certainty), label: 'WIDTH' },
      ]
    : ['ISO CODE', 'LENGTH', 'HEIGHT', 'WIDTH'].map((label) => ({
        label,
        value: null,
        absentText: 'Not visible in this photo',
        provenance: '',
        provenanceClass: '',
        certainty: 'Not seen' as const,
        note: null,
      }))

  const weightRows: DetailRow[] = [
    {
      label: 'MAX GROSS',
      value: weights?.maxGross ? kg(weights.maxGross.valueKg) : null,
      absentText: 'Not visible in this photo',
      provenance: 'Printed',
      provenanceClass: '',
      certainty: weights?.maxGross?.certainty ?? 'Not seen',
      note: 'A maximum rating, not the cargo weight.',
    },
    {
      label: 'TARE',
      value: weights?.tare ? kg(weights.tare.valueKg) : null,
      absentText: 'Not visible in this photo',
      provenance: 'Printed',
      provenanceClass: '',
      certainty: weights?.tare?.certainty ?? 'Not seen',
      note: null,
    },
    {
      label: 'PAYLOAD',
      value: payload ? kg(payload.valueKg) : null,
      absentText: 'Not calculated: needs maximum gross and tare',
      provenance: 'Calculated',
      provenanceClass: 'qs-prov--calculated',
      certainty: payload?.certainty ?? 'Not seen',
      note: weights?.conflict ?? (payload ? 'Maximum gross minus tare.' : null),
    },
  ]

  return [...sizeRows, ...weightRows]
})
</script>

<template>
  <div class="rs-card qs-rise" style="--i: 1">
    <div class="rs-card__head"><span class="rs-k">Container details</span></div>
    <p v-if="!assessed" class="rs-note qs-type-body-sm">
      Not assessed in this inspection: this run read the container ID only. Nothing is said about
      the size code or the weights.
    </p>
    <template v-else>
      <div v-for="row in rows" :key="row.label" class="qs-field">
        <span class="qs-field__label">{{ row.label }}</span>
        <span :class="['qs-field__value', { 'qs-field__value--absent': row.value === null }]">
          <template v-if="row.value !== null">
            {{ row.value }}
            <span :class="['qs-prov', row.provenanceClass]">{{ row.provenance }}</span>
          </template>
          <template v-else>{{ row.absentText }}</template>
        </span>
        <CertaintyChip :level="row.certainty" />
        <span v-if="row.note" class="qs-field__note">{{ row.note }}</span>
      </div>
    </template>
  </div>
</template>
