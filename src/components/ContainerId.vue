<script setup lang="ts">
import { computed } from 'vue'
import type { ContainerIdReading } from '../domain/inspection'
import { CHECK_DIGIT_INDEX, idCells, idLayout, idSpelled, idTags } from './idDisplay'

const props = defineProps<{ reading: ContainerIdReading }>()

// Layout mirrors the printed ID: owner code + category (4), serial in groups of 3 and 3, then the check digit.
// Positions the photo did not show are marked with a dot and never filled in.
const cells = computed(() => idCells(props.reading))
const layout = computed(() => idLayout(cells.value))
// Provenance tag, check-digit result and owner-code note.
const tags = computed(() => idTags(props.reading, cells.value))
const spelled = computed(() => idSpelled(props.reading, cells.value))
</script>

<template>
  <div>
    <div class="qs-id" :aria-label="spelled">
      <span v-for="(group, gi) in layout.groups" :key="gi" class="qs-id__group">
        <span
          v-for="c in group"
          :key="c.index"
          class="qs-id__ch"
          :data-c="c.state"
          :style="{ '--c': c.index }"
          >{{ c.ch }}</span
        >
      </span>
      <span
        class="qs-id__check"
        :data-c="layout.check.state"
        :style="{ '--c': CHECK_DIGIT_INDEX }"
        >{{ layout.check.ch }}</span
      >
    </div>
    <div class="qs-id__meta">
      <span v-for="tag in tags" :key="tag.text" :class="['qs-prov', tag.modifier]">{{
        tag.text
      }}</span>
    </div>
  </div>
</template>
