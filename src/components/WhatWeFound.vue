<script setup lang="ts">
import { computed, useId } from 'vue'
import { useUnits } from '../composables/units'
import type { InspectionRecord } from '../domain/inspection'
import { buildWhatWeFound, type FoundTopic, type WhatWeFoundOptions } from '../domain/whatWeFound'

// "What we found" (design-system/components/WhatWeFound): the summary at the top of every result. All
// of its words come from the pure builder; this only lays them out: headline, the caveats first, what
// is missing from a partial run, then one row per topic. Plain ink: no certainty, severity or hazard colour.
const props = defineProps<{
  record: InspectionRecord
  /** Stages that have not delivered (still running, failed or cancelled): left out and named as missing. */
  unavailable?: WhatWeFoundOptions['unavailable']
}>()

// Metric or Imperial, as the Container details toggle says.
const { units } = useUnits()

const found = computed(() =>
  buildWhatWeFound(props.record, { units: units.value, unavailable: props.unavailable }),
)

const TOPIC: Record<FoundTopic, string> = {
  id: 'ID',
  type: 'Type',
  weights: 'Weights',
  markings: 'Markings',
  damage: 'Damage',
}

const headingId = `found-${useId()}`
</script>

<template>
  <section class="qs-found qs-rise" style="--i: 0" :aria-labelledby="headingId">
    <h2 :id="headingId" class="qs-found__k qs-type-label">What we found</h2>
    <p class="qs-found__headline qs-type-display-md">{{ found.headline }}</p>

    <div v-if="found.caveats.length > 0" class="qs-found__block">
      <div class="qs-found__label qs-type-label">What remains uncertain</div>
      <ul class="qs-found__list qs-type-body">
        <li v-for="caveat in found.caveats" :key="caveat">{{ caveat }}</li>
      </ul>
    </div>

    <div v-if="found.gaps.length > 0" class="qs-found__block">
      <div class="qs-found__label qs-type-label">What is missing</div>
      <ul class="qs-found__list qs-type-body">
        <li v-for="gap in found.gaps" :key="gap">{{ gap }}</li>
      </ul>
    </div>

    <ul v-if="found.statements.length > 0" class="qs-found__facts">
      <li v-for="s in found.statements" :key="s.topic" class="qs-found__fact">
        <span class="qs-found__topic qs-type-label">{{ TOPIC[s.topic] }}</span>
        <p class="qs-type-body">{{ s.text }}</p>
      </li>
    </ul>
  </section>
</template>
