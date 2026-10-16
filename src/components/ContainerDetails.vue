<script setup lang="ts">
import { computed } from 'vue'
import type { InspectionRecord } from '../domain/inspection'
import { detailGroups } from './containerDetailRows'
import CertaintyChip from './CertaintyChip.vue'
import UnitsToggle from './UnitsToggle.vue'
import { useUnits } from '../composables/units'

const props = defineProps<{ record: InspectionRecord }>()

// Metric or Imperial: display only, remembered in this browser. The record and the exports never change.
const { units, set: setUnits } = useUnits()

const groups = computed(() => detailGroups(props.record, units.value))

// A run that read none of the details (an ID-only run) has nothing to say about them: one plain
// sentence, not a column of Not seen chips (Not seen means "in no photo").
const assessed = computed(
  () =>
    props.record.details !== undefined ||
    props.record.sizeCode !== null ||
    props.record.weights !== null,
)

// Each value keeps its source label: Printed, Decoded from ISO, Calculated or Model-selected (spec 4.3, 4.4).
const rows = computed(() => groups.value.flatMap((g) => g.rows))
const notAssessed = computed(() => groups.value.flatMap((g) => g.notAssessed ?? []))
</script>

<template>
  <div class="rs-card qs-rise" style="--i: 1">
    <div class="rs-card__head">
      <span class="rs-k">Container details</span>
      <UnitsToggle v-if="assessed" :model-value="units" @update:model-value="setUnits" />
    </div>
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
      <p v-for="line in notAssessed" :key="line" class="rs-note qs-type-body-sm">{{ line }}</p>
    </template>
  </div>
</template>
