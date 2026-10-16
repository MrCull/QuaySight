<script setup lang="ts">
import { computed } from 'vue'
import type { CertaintyLabel, ContainerIdReading } from '../domain/inspection'
import { UNREAD } from '../domain/certainty'

const props = defineProps<{ reading: ContainerIdReading }>()

interface Cell {
  ch: string
  index: number
  notRead: boolean
  state: string | undefined
}

// Layout mirrors the printed ID: owner code + category (4), serial in groups of 3 and 3, then the check digit.
// Positions the photo did not show are marked with a dot and never filled in.
const chars = computed(() => {
  const value = props.reading.value.replace(/\s+/g, '').toUpperCase().padEnd(11, UNREAD)
  return value
    .slice(0, 11)
    .split('')
    .map((ch, index): Cell => {
      const level = props.reading.positionCertainty?.[index] ?? props.reading.certainty
      const notRead = ch === UNREAD
      return {
        ch: notRead ? '·' : ch,
        index,
        notRead,
        state: notRead ? 'unknown' : charState(level),
      }
    })
})

const layout = computed(() => {
  const all = chars.value
  let index = 0
  const groups = [all.slice(0, 4), all.slice(4, 7), all.slice(7, 10)].map((group) =>
    group.map((c) => ({ ...c, index: index++ })),
  )
  return { groups, check: all[10] ?? UNREAD_CELL }
})

const UNREAD_CELL: Cell = { ch: '·', index: 10, notRead: true, state: 'unknown' }

const incomplete = computed(() => chars.value.some((c) => c.notRead))

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
  const spelledChars = chars.value.map((c) => {
    if (c.notRead) return `position ${c.index + 1} not read`
    if (c.state === 'uncertain' || c.state === 'unknown' || c.state === 'likely') {
      return `${c.ch} (${c.state === 'likely' ? 'likely' : 'uncertain'})`
    }
    return c.ch
  })
  const body = spelledChars.slice(0, 10).join(' ')
  const check = chars.value[10] ?? UNREAD_CELL
  const checkPart = check.notRead ? 'check digit not read' : `check digit ${check.ch}`
  const note =
    incomplete.value || r.calculatedCheckDigit === null
      ? 'check digit not checked, ID incomplete'
      : r.checkDigitValid
        ? 'check digit valid'
        : `check digit does not match, calculated ${r.calculatedCheckDigit}`
  return `${body}, ${checkPart}, ${note}`
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
      <span class="qs-id__check" :data-c="layout.check.state" :style="{ '--c': 10 }">{{
        layout.check.ch
      }}</span>
    </div>
    <div class="qs-id__meta">
      <span v-if="origin === 'manifest'" class="qs-prov qs-prov--manifest"
        >Matched against manifest</span
      >
      <span v-else class="qs-prov">{{ origin === 'image' ? 'Read from image' : 'Printed' }}</span>
      <span v-if="incomplete" class="qs-prov">ID incomplete, check digit not checked</span>
      <span v-else :class="['qs-prov', { 'qs-prov--calculated': reading.checkDigitValid }]">
        {{ reading.checkDigitValid ? 'Check digit valid' : 'Check digit does not match' }}
      </span>
      <span
        v-if="
          !incomplete &&
          !reading.checkDigitValid &&
          reading.observedCheckDigit !== null &&
          reading.calculatedCheckDigit !== null
        "
        class="qs-prov qs-prov--calculated"
        >Calculated {{ reading.calculatedCheckDigit }}</span
      >
    </div>
  </div>
</template>
