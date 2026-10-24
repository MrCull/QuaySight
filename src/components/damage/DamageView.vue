<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { potentiallySignificant, type DamageAssessment } from '../../domain/damage'
import { UNIDENTIFIED_FACE_HEADING } from '../../domain/combineDamage'
import { cedexLocation, type CedexLocation } from '../../domain/cedexLocation'
import DamageSchematic from './DamageSchematic.vue'
import DamageFindings from './DamageFindings.vue'
import DamageDetail from './DamageDetail.vue'
import { prefersReducedMotion } from '../../composables/reducedMotion'
import '../../styles/damage.css'

// Follows design-system/components/DamageAssessment: the set's own photo checks, the significance
// flag, then the schematic with the selected finding's details beside it, and every finding in a grid
// across the full width below; or "Damage not assessed for this view" with the reason.
const props = defineProps<{ assessment: DamageAssessment | null }>()

// Selection is shared: a marker, its area and its finding card select together.
// The app binds it to the inspection store (v-model:selected) so New inspection clears it.
const selectedId = defineModel<number | null>('selected', { default: null })

// A finding is always open once there is one: a marker or card selects it (selecting it again keeps it),
// and the arrows on the details step through the findings in number order.
function select(id: number) {
  selectedId.value = id
}

const detail = ref<InstanceType<typeof DamageDetail> | null>(null)

// A card in the grid below the drawing selects its finding; when the details panel and the drawing are
// scrolled out of view, they are brought back so the selection can be seen.
async function selectFromCard(id: number) {
  select(id)
  if (selectedId.value === null) return
  await nextTick()
  const el = detail.value?.$el as HTMLElement | undefined
  if (!el || typeof el.getBoundingClientRect !== 'function') return
  const box = el.getBoundingClientRect()
  if (box.top >= 0 && box.top < window.innerHeight) return
  el.scrollIntoView?.({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

/** The assessment when it assessed a face; null when there is none or the view was not assessed. */
const assessed = computed(() =>
  props.assessment && !props.assessment.notAssessed ? props.assessment : null,
)

const summary = computed(() => {
  const a = assessed.value
  if (!a) return ''
  const n = a.findings.length + (a.unplaced?.length ?? 0)
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
    const longSide = !!a.sideInference || a.photos.some((p) => p.face === 'long-side')
    const doorEnd = a.photos.some((p) => p.face === 'rear')
    rows.push({
      label: longSide ? 'Side sheet visible' : doorEnd ? 'Door end visible' : 'Face visible',
      value: COVERAGE[a.coverage],
    })
  }
  if (a.doorEnd) rows.push({ label: 'Door end', value: DOOR_END[a.doorEnd] })
  return rows
})

// Every finding's CEDEX location, by finding number. Findings on a face we couldn't identify have none.
const locations = computed(() => {
  const a = assessed.value
  const out: Record<number, CedexLocation> = {}
  if (!a) return out
  for (const f of a.findings) out[f.id] = cedexLocation(f, a)
  for (const f of a.unplaced ?? []) out[f.id] = cedexLocation(f, a, true)
  return out
})

/** Every finding's number, in order: the drawn ones, then any on a face we couldn't identify. */
const order = computed(() => {
  const a = assessed.value
  return a ? [...a.findings, ...(a.unplaced ?? [])].map((f) => f.id).sort((x, y) => x - y) : []
})

// Finding 1 is open when the findings arrive, and again whenever the open one is no longer listed.
watch(
  () => order.value.join(','),
  () => {
    const ids = order.value
    if (selectedId.value === null || !ids.includes(selectedId.value)) {
      selectedId.value = ids[0] ?? null
    }
  },
  { immediate: true },
)

const position = computed(() => {
  const index = selectedId.value === null ? -1 : order.value.indexOf(selectedId.value)
  return index < 0 ? null : { index, total: order.value.length }
})

function step(delta: -1 | 1) {
  const pos = position.value
  const id = pos ? order.value[pos.index + delta] : undefined
  if (id !== undefined) selectedId.value = id
}

const selected = computed(() => {
  const a = assessed.value
  if (!a || selectedId.value === null) return null
  return [...a.findings, ...(a.unplaced ?? [])].find((f) => f.id === selectedId.value) ?? null
})
const selectedLocation = computed(() =>
  selected.value ? (locations.value[selected.value.id] ?? null) : null,
)

const aboutOpen = ref(false)

const significant = computed(() => !!assessed.value && potentiallySignificant(assessed.value))
</script>

<template>
  <section class="rs-damage" aria-label="Damage view">
    <div class="rs-damage__head">
      <span class="rs-damage__title">Damage view</span>
      <span v-if="assessed" class="damage-summary qs-type-body-sm">{{ summary }}</span>
      <span v-if="assessed" class="qs-cedex-note">
        Damage types and locations classified using CEDEX (ISO 9897).
        <button
          type="button"
          class="qs-cedex-note__toggle"
          aria-controls="cedex-about"
          :aria-expanded="aboutOpen ? 'true' : 'false'"
          aria-label="About CEDEX"
          title="About CEDEX"
          @click="aboutOpen = !aboutOpen"
        >
          <i class="qs-glyph qs-glyph--info" aria-hidden="true"></i>
        </button>
      </span>
    </div>
    <div
      v-if="assessed"
      v-show="aboutOpen"
      id="cedex-about"
      class="qs-cedex-note__body"
      role="note"
    >
      <p>
        CEDEX is the container industry's standard shorthand for damage, set out in ISO 9897. A
        two-letter damage type says what kind of damage it is (DT Dent, HO Holed, CO Corroded). A
        four-character location says where: the face (D door end, F front end, L left side, R right
        side), the part of it (T top half, B bottom half, X both, H top rail or header, G bottom
        rail or sill), then the section. Long sides have 5 sections on a 20 ft container and 10 on a
        40 ft one, numbered from the door end; each end has 4 positions.
      </p>
      <p>
        Using the same codes as depot and survey reports makes these findings easy to compare. They
        are estimated from photos: a code is only given where the photos show which face and which
        end it is, and it is never a measured or surveyed location. Severity is judged separately.
      </p>
    </div>

    <template v-if="assessed">
      <ul v-if="facts.length > 0" class="qs-damage-facts" aria-label="Photo checks">
        <li v-for="fact in facts" :key="fact.label">
          <span>{{ fact.label }}</span
          >{{ fact.value }}
        </li>
      </ul>
      <p v-if="significant" class="qs-significant">
        Potentially significant damage, closer inspection advised
      </p>

      <!-- The drawing with every finding under it on the left; the selected finding's details down the right. -->
      <div class="rs-damage__grid">
        <DamageSchematic
          class="rs-damage__schem"
          :assessment="assessed"
          :selected-id="selectedId"
          :selected-code="selectedLocation?.code ?? null"
          @select="select"
        />
        <DamageDetail
          ref="detail"
          class="rs-damage__detail"
          :finding="selected"
          :location="selectedLocation"
          :position="position"
          @previous="step(-1)"
          @next="step(1)"
        />
        <div
          v-if="assessed.findings.length > 0 || assessed.unplaced?.length"
          class="rs-damage__cards"
        >
          <h3 class="qs-type-body-sm rs-damage__list-title">All findings</h3>
          <DamageFindings
            :findings="assessed.findings"
            :selected-id="selectedId"
            :locations="locations"
            @select="selectFromCard"
          />
          <template v-if="assessed.unplaced?.length">
            <h3 class="qs-type-body-sm rs-damage__unplaced">{{ UNIDENTIFIED_FACE_HEADING }}</h3>
            <DamageFindings
              :findings="assessed.unplaced"
              :selected-id="selectedId"
              :locations="locations"
              @select="selectFromCard"
            />
          </template>
        </div>
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
