<script setup lang="ts">
import { computed } from 'vue'
import type { CertaintyLabel, ContainerIdReading } from '../domain/inspection'

const props = defineProps<{ reading: ContainerIdReading }>()

// Layout mirrors the printed ID: owner code + category (4), serial in groups of 3 and 3, then the check digit.
const layout = computed(() => {
  const value = props.reading.value.replace(/\s+/g, '').toUpperCase()
  const body = value.slice(0, 10)
  const check = value.slice(10)
  const state = charState(props.reading.certainty)
  let index = 0
  const groups = [body.slice(0, 4), body.slice(4, 7), body.slice(7, 10)].map((group) =>
    [...group].map((ch) => ({ ch, state, index: index++ })),
  )
  return { groups, check }
})

function charState(level: CertaintyLabel): string | undefined {
  if (level === 'Confident') return undefined
  if (level === 'Likely') return 'likely'
  if (level === 'Uncertain') return 'uncertain'
  return 'unknown'
}

// Provenance tag: a manifest match, a reading from the image after a manifest check, or the first printed reading.
const origin = computed(() => {
  if (props.reading.provenance === 'manifest') return 'manifest'
  return props.reading.manifestChecked ? 'image' : 'printed'
})

const spelled = computed(() => {
  const r = props.reading
  const body = r.value.slice(0, 10).split('').join(' ')
  const check = r.value.slice(10)
  const note = r.checkDigitValid
    ? 'check digit valid'
    : `check digit does not match, calculated ${r.calculatedCheckDigit}`
  return `${body}, check digit ${check}, ${note}`
})
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
      <span class="qs-id__check" :style="{ '--c': 10 }">{{ layout.check }}</span>
    </div>
    <div class="qs-id__meta">
      <span v-if="origin === 'manifest'" class="qs-prov qs-prov--manifest"
        >Matched against manifest</span
      >
      <span v-else class="qs-prov">{{ origin === 'image' ? 'Read from image' : 'Printed' }}</span>
      <span :class="['qs-prov', { 'qs-prov--calculated': reading.checkDigitValid }]">
        {{ reading.checkDigitValid ? 'Check digit valid' : 'Check digit does not match' }}
      </span>
    </div>
  </div>
</template>
