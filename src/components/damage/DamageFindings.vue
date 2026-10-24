<script setup lang="ts">
import { computed } from 'vue'
import type { CedexLocation } from '../../domain/cedexLocation'
import { cedexType } from '../../domain/cedexType'
import type { DamageFinding } from '../../domain/damage'
import CertaintyChip from '../CertaintyChip.vue'
import SeverityBadge from './SeverityBadge.vue'

// The findings grid (design-system FindingCard, compact): number, title, the CEDEX damage type and location
// codes, severity and certainty. Selecting a card opens its details beside the drawing (DamageDetail).
const props = defineProps<{
  findings: DamageFinding[]
  selectedId: number | null
  locations: Record<number, CedexLocation>
}>()
const emit = defineEmits<{ select: [id: number] }>()

const ordered = computed(() =>
  [...props.findings]
    .sort((a, b) => a.id - b.id)
    .map((f) => ({ f, type: cedexType(f).best, location: props.locations[f.id] ?? null })),
)

function uncertaintyClass(f: DamageFinding): string {
  return f.certainty === 'Likely'
    ? 'qs-finding__n--likely'
    : f.certainty === 'Uncertain'
      ? 'qs-finding__n--uncertain'
      : ''
}
</script>

<template>
  <div class="rs-findings">
    <button
      v-for="({ f, type, location }, i) in ordered"
      :key="f.id"
      type="button"
      class="qs-finding qs-finding--compact qs-rise"
      :style="{ '--i': i }"
      :data-finding="f.id"
      :aria-pressed="f.id === selectedId ? 'true' : 'false'"
      @click="emit('select', f.id)"
    >
      <span
        :class="['qs-finding__n', `qs-finding__n--${f.severity ?? 'unrated'}`, uncertaintyClass(f)]"
        >{{ f.id }}</span
      >
      <span>
        <span class="qs-finding__title">{{ f.title }}</span>
        <br />
        <span class="qs-finding__loc">{{ f.location }}</span>
      </span>
      <span class="qs-finding__codes">
        <span
          v-if="type"
          class="qs-type-code"
          :title="`CEDEX damage type: ${type.code} ${type.name}`"
          :aria-label="`CEDEX damage type ${type.code}, ${type.name}`"
          >{{ type.code }}</span
        >
        <span
          v-else-if="f.types.length > 0"
          class="qs-type-code qs-type-code--none"
          aria-label="CEDEX damage type Uncertain"
          >Type Uncertain</span
        >
        <span
          v-if="location?.code"
          class="qs-cedex-code"
          :title="`CEDEX location: ${location.parts.join(' · ')}`"
          :aria-label="`CEDEX location ${location.code}${location.basis === 'estimated' ? ', estimated' : ''}`"
          >{{ location.basis === 'estimated' ? '≈ ' : '' }}{{ location.code }}</span
        >
      </span>
      <span class="qs-finding__tags">
        <SeverityBadge :severity="f.severity" />
        <CertaintyChip :level="f.certainty" />
      </span>
    </button>
  </div>
</template>
