<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DamageAssessment } from '../../domain/damage'
import DamageSchematic from './DamageSchematic.vue'
import DamageFindings from './DamageFindings.vue'
import '../../styles/damage.css'

const props = defineProps<{ assessment: DamageAssessment | null }>()

// Selection is shared: a marker, its area and its finding card select together.
const selectedId = ref<number | null>(null)

function select(id: number) {
  selectedId.value = selectedId.value === id ? null : id
}

const summary = computed(() => {
  const a = props.assessment
  if (!a) return ''
  const n = a.findings.length
  if (n === 0) return 'No suspected damage in the photographed faces'
  return `${n} suspected finding${n === 1 ? '' : 's'}`
})
</script>

<template>
  <section class="rs-damage" aria-label="Damage view">
    <div class="rs-damage__head">
      <span class="rs-damage__title">Damage view</span>
      <span v-if="assessment" class="damage-summary qs-type-body-sm">{{ summary }}</span>
    </div>

    <div v-if="assessment" class="rs-damage__grid">
      <DamageSchematic :assessment="assessment" :selected-id="selectedId" @select="select" />
      <DamageFindings :findings="assessment.findings" :selected-id="selectedId" @select="select" />
    </div>

    <div v-else class="qs-notice" role="note">
      <i class="qs-glyph qs-glyph--unseen" aria-hidden="true"></i>
      <div>
        <div class="qs-notice__title">Damage not assessed in this recording</div>
        <div class="qs-notice__body">
          Nothing is said about the faces of this container in this recording.
        </div>
      </div>
    </div>
  </section>
</template>
