<script setup lang="ts">
import { computed } from 'vue'
import {
  VIEWS,
  faceStatus,
  findingsInView,
  viewHasPhotos,
  type DamageAssessment,
  type FaceStatus,
} from '../../domain/damage'
import SchematicFigure from './SchematicFigure.vue'

const props = defineProps<{ assessment: DamageAssessment; selectedId: number | null }>()
const emit = defineEmits<{ select: [id: number] }>()

type FixedFace = 'rear' | 'front' | 'left' | 'right' | 'roof'

// Coverage strip: every face is photographed, can't tell, or not seen. Never clear.
const COVERAGE: { face: FixedFace; name: string }[] = [
  { face: 'rear', name: 'Rear doors' },
  { face: 'right', name: 'Right side' },
  { face: 'front', name: 'Front end' },
  { face: 'left', name: 'Left side' },
  { face: 'roof', name: 'Roof' },
]

function photoNumber(face: FixedFace): number {
  return props.assessment.photos.findIndex((p) => p.face === face) + 1
}

// A side picked by default, not from the doors, is said to be uncertain wherever it is named.
function sideUncertain(face: FixedFace): boolean {
  const inference = props.assessment.sideInference
  return inference?.basis === 'defaulted' && inference.side === face
}

function coverageText(face: FixedFace, status: FaceStatus): string {
  if (status === 'photographed') {
    return `Photo ${photoNumber(face)}${sideUncertain(face) ? ' · side Uncertain' : ''}`
  }
  if (status === 'side-unknown') return "Can't tell"
  return 'Not seen'
}

const coverage = computed(() =>
  COVERAGE.map((row) => {
    const status = faceStatus(props.assessment, row.face)
    return { ...row, status, text: coverageText(row.face, status) }
  }),
)

function faceText(name: string, status: FaceStatus, uncertain = false): string {
  if (status === 'photographed') return uncertain ? `${name} · side Uncertain` : name
  if (status === 'side-unknown') return "Long side · Can't tell"
  return `${name} · Not seen`
}

const views = computed(() =>
  Object.values(VIEWS).map((spec) => {
    const sideStatus = faceStatus(props.assessment, spec.side)
    const endStatus = faceStatus(props.assessment, spec.end)
    const endName = spec.end === 'rear' ? 'Rear doors' : 'Front end'
    return {
      spec,
      noPhotos: !viewHasPhotos(props.assessment, spec.id),
      markers: findingsInView(props.assessment, spec.id),
      // Zones are drawn on the face of the view that holds them: the door set's on its end, the side set's on its side.
      zones: (props.assessment.zones ?? []).filter(
        (z) => z.face === spec.end || z.face === spec.side,
      ),
      side: {
        status: sideStatus,
        text: faceText(
          `${spec.side === 'right' ? 'Right' : 'Left'} side`,
          sideStatus,
          sideUncertain(spec.side),
        ),
      },
      end: { status: endStatus, text: faceText(endName, endStatus) },
    }
  }),
)

const sideNotCertain = computed(() => props.assessment.sideInference?.basis === 'defaulted')
// Any zone grid in the assessment keeps its dashed edges visible.
const hasZones = computed(() => (props.assessment.zones ?? []).length > 0)
</script>

<template>
  <div :class="['qs-schem', { 'qs-schem--show-grid': hasZones }]">
    <div class="qs-schem__views">
      <div class="qs-schem__views-in">
        <SchematicFigure
          v-for="v in views"
          :key="v.spec.id"
          :id="v.spec.id"
          :caption="v.spec.label"
          :no-photos="v.noPhotos"
          :side="v.side"
          :end="v.end"
          :roof="true"
          :markers="v.markers"
          :zones="v.zones"
          :length-ft="assessment.lengthFt"
          :selected-id="selectedId"
          @select="emit('select', $event)"
        />
      </div>
    </div>

    <div v-if="sideNotCertain" class="qs-notice" role="note">
      <i class="qs-glyph qs-glyph--unknown" aria-hidden="true"></i>
      <div>
        <div class="qs-notice__title">Right side · side Uncertain</div>
        <div class="qs-notice__body">
          The door end cannot be made out in the photo, so we are unsure which long side it is. The
          findings are drawn on the right side.
        </div>
      </div>
    </div>

    <ul class="qs-coverage" aria-label="Inspection coverage">
      <li
        v-for="row in coverage"
        :key="row.face"
        :class="['qs-coverage__item', { 'qs-coverage__item--unseen': row.status === 'not-seen' }]"
      >
        <i
          :class="[
            'qs-glyph',
            row.status === 'photographed'
              ? 'qs-glyph--check'
              : row.status === 'side-unknown'
                ? 'qs-glyph--unknown'
                : 'qs-glyph--unseen',
          ]"
          aria-hidden="true"
        ></i>
        <span>{{ row.name }}</span>
        <small>{{ row.text }}</small>
      </li>
    </ul>

    <p class="qs-schem__caption">
      Approximate areas on an illustrative drawing. Not measured, not pixel-precise and not a
      certified location.
    </p>
  </div>
</template>
