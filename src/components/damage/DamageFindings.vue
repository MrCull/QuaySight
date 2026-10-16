<script setup lang="ts">
import { computed } from 'vue'
import { sortFindings, type DamageFinding } from '../../domain/damage'
import CertaintyChip from '../CertaintyChip.vue'
import SeverityBadge from './SeverityBadge.vue'

const props = defineProps<{ findings: DamageFinding[]; selectedId: number | null }>()
const emit = defineEmits<{ select: [id: number] }>()

const ordered = computed(() => sortFindings(props.findings))

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
      v-for="(f, i) in ordered"
      :key="f.id"
      type="button"
      class="qs-finding qs-rise"
      :style="{ '--i': i }"
      :data-finding="f.id"
      :aria-pressed="f.id === selectedId ? 'true' : 'false'"
      @click="emit('select', f.id)"
    >
      <span
        :class="['qs-finding__n', `qs-finding__n--${f.severity ?? 'unrated'}`, uncertaintyClass(f)]"
        >{{
        f.id
      }}</span>
      <span>
        <span class="qs-finding__title">{{ f.title }}</span>
        <br />
        <span class="qs-finding__loc">{{ f.location }}</span>
      </span>
      <span class="qs-finding__tags">
        <SeverityBadge :severity="f.severity" :code="f.types[0]?.code" />
        <CertaintyChip :level="f.certainty" />
      </span>
      <span class="qs-finding__more">
        <span>{{ f.description }}</span>
        <span><strong>Best interpretation:</strong> {{ f.bestInterpretation }}</span>
        <span><strong>What remains uncertain:</strong> {{ f.uncertainty }}</span>
        <span class="qs-finding__probs" aria-label="Damage types">
          <span v-for="t in f.types" :key="t.code" class="damage-type">
            <span class="damage-type__name">{{ t.code }} {{ t.name }}</span>
            <span v-if="t.probability === null" class="damage-unavailable"
              >Probability unavailable</span
            >
            <span v-else class="qs-prob damage-type__prob">
              <span class="qs-prob__bar"
                ><i :style="{ '--p': `${Math.round(t.probability * 100)}%` }"></i
              ></span>
              <span>{{ t.probability.toFixed(2) }}</span>
            </span>
          </span>
        </span>
        <span class="damage-caveats">
          <span v-for="c in f.caveats" :key="c">{{ c }}</span>
        </span>
      </span>
    </button>
  </div>
</template>
