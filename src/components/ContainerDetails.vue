<script setup lang="ts">
import { computed } from 'vue'
import type { InspectionRecord } from '../domain/inspection'
import { lengthDisagreement } from '../domain/shapeLength'
import { detailGroups } from './containerDetailRows'
import CertaintyChip from './CertaintyChip.vue'
import UnitsToggle from './UnitsToggle.vue'
import { causeSentence } from '../domain/requestFailure'
import { useUnits } from '../composables/units'

const props = withDefaults(
  defineProps<{
    record: InspectionRecord
    /** Rows shown elsewhere (the readings ledger), by label: left out here so nothing is said twice. */
    omit?: readonly string[]
    /** The Metric / Imperial toggle in this card's heading; off where the ledger carries it. */
    unitsToggle?: boolean
  }>(),
  { omit: () => [], unitsToggle: true },
)

// Metric or Imperial: display only, remembered in this browser. The record and the exports never change.
const { units, set: setUnits } = useUnits()

const lengthWarning = computed(() => lengthDisagreement(props.record))
const groups = computed(() => detailGroups(props.record, units.value))

// A run that read none of the details (an ID-only run) has nothing to say about them: one plain
// sentence, not a column of Not seen chips (Not seen means "in no photo").
const assessed = computed(
  () =>
    props.record.details !== undefined ||
    props.record.sizeCode !== null ||
    props.record.weights !== null,
)

// The survey was asked and failed: say the details could not be read, which is not the same as not asked.
const detailsFailure = computed(() =>
  props.record.failures?.find((f) => f.stages.includes('details')),
)

// Each value keeps its source label: Printed, Decoded from ISO, Calculated or Model-selected (spec 4.3, 4.4).
const rows = computed(() =>
  groups.value.flatMap((g) => g.rows).filter((row) => !props.omit.includes(row.label)),
)
const notAssessed = computed(() => groups.value.flatMap((g) => g.notAssessed ?? []))
</script>

<template>
  <div class="rs-card qs-rise" style="--i: 1">
    <div class="rs-card__head">
      <span class="rs-k">Container details</span>
      <UnitsToggle
        v-if="assessed && unitsToggle"
        :model-value="units"
        @update:model-value="setUnits"
      />
    </div>
    <p v-if="detailsFailure" class="rs-note qs-type-body-sm">
      The container details could not be read in this inspection.
      {{ causeSentence(detailsFailure) }}
    </p>
    <p v-if="!assessed && !detailsFailure" class="rs-note qs-type-body-sm">
      Not assessed in this inspection: this run read the container ID only. Nothing is said about
      the size code or the weights.
    </p>
    <template v-else-if="assessed">
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
      <div v-if="lengthWarning" class="qs-notice qs-notice--partial" role="status">
        <div>
          <div class="qs-notice__title">{{ lengthWarning }}</div>
        </div>
      </div>
      <p v-for="line in notAssessed" :key="line" class="rs-note qs-type-body-sm">{{ line }}</p>
    </template>
  </div>
</template>
