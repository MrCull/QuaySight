<script setup lang="ts">
import { computed } from 'vue'
import { potentiallySignificant, type DamageAssessment } from '../../domain/damage'
import DamageSchematic from './DamageSchematic.vue'
import DamageFindings from './DamageFindings.vue'
import '../../styles/damage.css'

// Follows design-system/components/DamageAssessment: the set's own photo checks, the significance
// flag, the schematic and the finding cards; or "Damage not assessed for this view" with the reason.
const props = defineProps<{ assessment: DamageAssessment | null }>()

// Selection is shared: a marker, its area and its finding card select together.
// The app binds it to the inspection store (v-model:selected) so New inspection clears it.
const selectedId = defineModel<number | null>('selected', { default: null })

function select(id: number) {
  selectedId.value = selectedId.value === id ? null : id
}

/** The assessment when it assessed a face; null when there is none or the view was not assessed. */
const assessed = computed(() =>
  props.assessment && !props.assessment.notAssessed ? props.assessment : null,
)

const summary = computed(() => {
  const a = assessed.value
  if (!a) return ''
  const n = a.findings.length
  if (n === 0) return 'No suspected damage in the photographed faces'
  return `${n} suspected finding${n === 1 ? '' : 's'}`
})

const QUALITY = { good: 'Good', limited: 'Limited', poor: 'Poor' } as const
const COVERAGE = {
  full: 'Full',
  most: 'Most',
  partial: 'Partial',
  'not-inspectable': 'Not inspectable',
} as const
const DOOR_END = { 'image-left': 'At photo left', 'image-right': 'At photo right' } as const

// The damage set's own photo checks. A check the reply did not answer is left out, never shown as good.
const facts = computed(() => {
  const a = assessed.value
  if (!a) return []
  const rows: { label: string; value: string }[] = []
  if (a.imageQuality) rows.push({ label: 'Photo quality', value: QUALITY[a.imageQuality] })
  if (a.coverage) {
    const longSide = a.photos.some((p) => p.face === 'long-side')
    rows.push({
      label: longSide ? 'Side sheet visible' : 'Face visible',
      value: COVERAGE[a.coverage],
    })
  }
  if (a.doorEnd) rows.push({ label: 'Door end', value: DOOR_END[a.doorEnd] })
  return rows
})

const significant = computed(() => !!assessed.value && potentiallySignificant(assessed.value))
</script>

<template>
  <section class="rs-damage" aria-label="Damage view">
    <div class="rs-damage__head">
      <span class="rs-damage__title">Damage view</span>
      <span v-if="assessed" class="damage-summary qs-type-body-sm">{{ summary }}</span>
    </div>

    <template v-if="assessed">
      <ul v-if="facts.length > 0" class="qs-damage-facts" aria-label="Photo checks">
        <li v-for="fact in facts" :key="fact.label">
          <span>{{ fact.label }}</span>{{ fact.value }}
        </li>
      </ul>
      <p v-if="significant" class="qs-significant">
        Potentially significant damage, closer inspection advised
      </p>

      <div class="rs-damage__grid">
        <DamageSchematic :assessment="assessed" :selected-id="selectedId" @select="select" />
        <DamageFindings :findings="assessed.findings" :selected-id="selectedId" @select="select" />
      </div>
    </template>

    <div v-else-if="assessment?.notAssessed" class="qs-notice" role="note">
      <i class="qs-glyph qs-glyph--unseen" aria-hidden="true"></i>
      <div>
        <div class="qs-notice__title">Damage not assessed for this view</div>
        <div class="qs-notice__body">{{ assessment.notAssessed.reason }}</div>
      </div>
    </div>

    <div v-else class="qs-notice" role="note">
      <i class="qs-glyph qs-glyph--unseen" aria-hidden="true"></i>
      <div>
        <div class="qs-notice__title">Damage not assessed in this inspection</div>
        <div class="qs-notice__body">Nothing is said about any face of this container.</div>
      </div>
    </div>
  </section>
</template>
