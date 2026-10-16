<script setup lang="ts">
import { computed } from 'vue'
import type { InspectionRecord } from '../domain/inspection'
import { markingRows } from './containerDetailRows'
import CertaintyChip from './CertaintyChip.vue'

const props = defineProps<{ record: InspectionRecord }>()

// One row per marking, each checked separately (spec 4.4). A marking that was seen is a MarkingBadge:
// the hazard diamond only for DG placards and safety markings, neutral for the high-container caution.
const rows = computed(() => markingRows(props.record))
</script>

<template>
  <div class="rs-card qs-rise" style="--i: 2">
    <div class="rs-card__head"><span class="rs-k">Markings</span></div>
    <p v-if="rows === null" class="rs-note qs-type-body-sm">
      Not assessed in this inspection: this run did not check the markings or DG placards.
    </p>
    <div v-for="row in rows ?? []" v-else :key="row.label" class="qs-field">
      <span class="qs-field__label">{{ row.label }}</span>
      <span :class="['qs-field__value', { 'qs-field__value--absent': row.badge === null }]">
        <span v-if="row.badge" :class="['qs-marking', { 'qs-marking--hazard': row.badge.hazard }]">
          <i :class="['qs-glyph', `qs-glyph--${row.badge.glyph}`]" aria-hidden="true"></i>
          <span
            >{{ row.badge.text
            }}<span v-if="row.badge.caveat" class="qs-marking__caveat">{{
              row.badge.caveat
            }}</span></span
          >
        </span>
        <template v-else>{{ row.absentText }}</template>
      </span>
      <CertaintyChip :level="row.certainty" />
    </div>
  </div>
</template>
