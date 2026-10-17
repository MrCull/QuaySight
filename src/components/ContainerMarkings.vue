<script setup lang="ts">
import { computed } from 'vue'
import type { InspectionRecord } from '../domain/inspection'
import { markingRows } from './containerDetailRows'
import { placardRows } from './placardRows'
import CertaintyChip from './CertaintyChip.vue'
import PhotoCrop from './PhotoCrop.vue'

const props = defineProps<{
  record: InspectionRecord
  /** The photo on screen, which the placards' boxes were asked on; without it no crop is shown. */
  photo?: string | null
}>()

// One row per marking, each checked separately (spec 4.4). A marking that was seen is a MarkingBadge:
// the hazard diamond only for DG placards and safety markings, neutral for the high-container caution.
// Placards (ticket #69) follow, one row each with a crop of where it was read, then the two DG marks.
const details = computed(() => markingRows(props.record))
const placards = computed(() => placardRows(props.record))
const rows = computed(() => [
  ...(details.value ?? []).map((row) => ({ ...row, key: row.label, box: null })),
  ...placards.value,
])
</script>

<template>
  <div class="rs-card qs-rise" style="--i: 2">
    <div class="rs-card__head"><span class="rs-k">Markings</span></div>
    <p v-if="rows.length === 0" class="rs-note qs-type-body-sm">
      Not assessed in this inspection: this run did not check the markings or DG placards.
    </p>
    <template v-for="row in rows" v-else :key="row.key">
      <div class="qs-field">
        <span class="qs-field__label">{{ row.label }}</span>
        <span :class="['qs-field__value', { 'qs-field__value--absent': row.badge === null }]">
          <span
            v-if="row.badge"
            :class="['qs-marking', { 'qs-marking--hazard': row.badge.hazard }]"
          >
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
      <PhotoCrop
        v-if="row.box && photo"
        class="rs-marking-row__crop"
        :src="photo"
        :box="row.box"
        :caption="`Where we read ${row.label.toLowerCase()}`"
        :label="`The ${row.label.toLowerCase()}`"
      />
    </template>
  </div>
</template>

<style scoped>
.rs-card .rs-marking-row__crop {
  margin-top: var(--space-2);
  margin-bottom: var(--space-3);
}
</style>
