<script setup lang="ts">
import { computed } from 'vue'
import {
  VIEWS,
  faceStatus,
  findingsInView,
  imageRelativeFindings,
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

function coverageText(face: FixedFace, status: FaceStatus): string {
  if (status === 'photographed') return `Photo ${photoNumber(face)}`
  if (status === 'side-unknown') return "Can't tell"
  return 'Not seen'
}

const coverage = computed(() =>
  COVERAGE.map((row) => {
    const status = faceStatus(props.assessment, row.face)
    return { ...row, status, text: coverageText(row.face, status) }
  }),
)

function faceText(name: string, status: FaceStatus): string {
  if (status === 'photographed') return name
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
      // The door set's regions are drawn on the end of the view that holds the end.
      zones: (props.assessment.zones ?? []).filter((z) => z.face === spec.end),
      side: {
        status: sideStatus,
        text: faceText(`${spec.side === 'right' ? 'Right' : 'Left'} side`, sideStatus),
      },
      end: { status: endStatus, text: faceText(endName, endStatus) },
    }
  }),
)

const imageFindings = computed(() => imageRelativeFindings(props.assessment))
const showImage = computed(() => props.assessment.photos.some((p) => p.face === 'long-side'))
// The long side's photo-relative zone grid (a live long-side assessment), with each zone's visibility.
const imageZones = computed(() =>
  (props.assessment.zones ?? []).filter((z) => z.face === 'long-side'),
)
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
          :selected-id="selectedId"
          @select="emit('select', $event)"
        />
      </div>
    </div>

    <div v-if="showImage" class="qs-schem__views">
      <div class="qs-schem__views-in">
        <SchematicFigure
          id="image-relative"
          caption="Long side, image-relative"
          :no-photos="false"
          :side="{ status: 'photographed', text: 'Long side' }"
          :end="null"
          :roof="false"
          :markers="imageFindings"
          :zones="imageZones"
          :selected-id="selectedId"
          @select="emit('select', $event)"
        />
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
