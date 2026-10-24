<script setup lang="ts">
import { computed } from 'vue'
import { sectionCount } from '../../domain/sideSections'
import type { ContainerLengthFt } from '../../domain/chosenLength'
import {
  VIEWS,
  type DamageFinding,
  type FaceStatus,
  type FindingZone,
  type ViewId,
  type ZoneCoverage,
} from '../../domain/damage'

// One fixed view of the neutral container drawing, following
// design-system/components/ContainerSchematic. Markers are approximate areas on a flat face, drawn
// with the same oblique projection in both views so they read as one object turned round.
const props = defineProps<{
  id: string
  caption: string
  noPhotos: boolean
  side: { text: string; status: FaceStatus }
  end: { text: string; status: FaceStatus } | null
  roof: boolean
  markers: DamageFinding[]
  selectedId: number | null
  /** The damage set's photo-relative zones on this view's faces, with how well each was seen. */
  zones?: ZoneCoverage[]
  /** The container length the long side is drawn to: 20, 40 or 45 ft. 40 when not given. */
  lengthFt?: ContainerLengthFt
  /**
   * Number the long side's CEDEX sections from the door end. Only when the photos show which end is the
   * door end, so the numbering is never a guess.
   */
  sectionNumbers?: boolean
  /** The selected finding's CEDEX sections (on the side) or positions (on the end), to light up. */
  cedex?: { on: 'side' | 'end'; first: number; last: number } | null
}>()

const emit = defineEmits<{ select: [id: number] }>()

type Pt = [number, number]
type Projection = (u: number, v: number) => Pt

// Oblique projection taken from the design-system drawing: 8 ft end, 9.5 ft high. The long side is drawn
// to the container's length (20, 40 or 45 ft) at one scale, set so a 45 ft side fills the box the drawing
// had; a shorter one is centred in it. The end face and the height do not change with the length.
const MAX_FT = 45
const RUN_X = 698.4 / MAX_FT
const RUN_Y = 122.4 / MAX_FT
const END_X = 122.4
const END_Y = -60.48
const HEIGHT = 171
const LEFT = 34
const TOP = 91

const feet = computed(() => props.lengthFt ?? 40)
const runX = computed(() => RUN_X * feet.value)
const runY = computed(() => RUN_Y * feet.value)
const left = computed(() => LEFT + (RUN_X * (MAX_FT - feet.value)) / 2)

// The drawing is the corner a viewer sees: the end face on the left of the long side. Standing outside the
// right side the door end is on your left, and outside the left side the front end is, so each face's own u
// (photo left to photo right) runs left to right here and the end meets the side where they meet on the
// container. The projection is drawn mirrored from the design-system figure's construction (x → 900 − x).
const WIDTH = 900
const mirror = ([x, y]: Pt): Pt => [WIDTH - x, y]

const sidePt: Projection = (u, v) =>
  mirror([left.value + runX.value * (1 - u), TOP + runY.value * (1 - u) + HEIGHT * v])
const endPt: Projection = (u, v) =>
  mirror([
    left.value + runX.value + END_X * (1 - u),
    TOP + runY.value + END_Y * (1 - u) + HEIGHT * v,
  ])
const ROOF_POINTS = computed(() =>
  (
    [
      [left.value, TOP],
      [left.value + runX.value, TOP + runY.value],
      [left.value + runX.value + END_X, TOP + runY.value + END_Y],
      [left.value + END_X, TOP + END_Y],
    ] as Pt[]
  )
    .map(mirror)
    .map(([x, y]) => `${x},${y}`)
    .join(' '),
)
const roofTag = computed(
  () =>
    `translate(${WIDTH - (left.value + (runX.value + END_X) / 2)} ${TOP + (runY.value + END_Y) / 2})`,
)
// Labels sit under each face. Numbered sections sit just under the side, so its label drops below them.
const sideLabel = computed(() => sidePt(0.97, props.sectionNumbers ? 1.3 : 1.1836))
const endLabel = computed(() => endPt(0.03, 1.58))

function quad(pt: Projection, u0: number, u1: number, v0: number, v1: number): string {
  return [pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)].map(([x, y]) => `${x},${y}`).join(' ')
}

const inSpan = (on: 'side' | 'end', n: number) =>
  !!props.cedex && props.cedex.on === on && n >= props.cedex.first && n <= props.cedex.last

// The long side's CEDEX/IICL sections (5 for 20 ft, 10 for 40 and 45 ft), as columns along the face,
// numbered from the door end: from the left of the right side (beside the door end), from the right of the
// left side (the front end is on its left).
const sectionShapes = computed(() => {
  const n = sectionCount(feet.value)
  return Array.from({ length: n }, (_, i) => {
    const num = VIEWS[props.id as ViewId]?.side === 'left' ? n - i : i + 1
    const [x, y] = sidePt((i + 0.5) / n, 1.07)
    return {
      id: i,
      num,
      points: quad(sidePt, i / n, (i + 1) / n, 0, 1),
      lit: inSpan('side', num),
      label: { x, y },
    }
  })
})

// The end's four CEDEX positions, drawn only for the selected finding's code: photo-left is position 1.
const positionShapes = computed(() =>
  [1, 2, 3, 4]
    .filter((p) => inSpan('end', p))
    .map((p) => ({ id: p, points: quad(endPt, (p - 1) / 4, p / 4, 0, 1) })),
)

const SIDE_POINTS = computed(() => quad(sidePt, 0, 1, 0, 1))
const END_POINTS = computed(() => quad(endPt, 0, 1, 0, 1))

type Placed = DamageFinding & { zone: FindingZone }

// A finding whose place the set does not give (e.g. one of the castings) has a card but no pin.
const placed = computed(() => props.markers.filter((m): m is Placed => m.zone !== null))

function isEnd(f: DamageFinding): boolean {
  return f.face === 'rear' || f.face === 'front'
}

function regionPoints(f: Placed): string {
  const pt = isEnd(f) ? endPt : sidePt
  const z = f.zone
  return quad(pt, z.u0, z.u1, z.v0, z.v1)
}

function pinFoot(f: Placed): Pt {
  const pt = isEnd(f) ? endPt : sidePt
  return pt((f.zone.u0 + f.zone.u1) / 2, (f.zone.v0 + f.zone.v1) / 2)
}

function severityClass(f: DamageFinding): string {
  return f.severity ?? 'unrated'
}

function pinClass(f: DamageFinding): string[] {
  const cert =
    f.certainty === 'Likely'
      ? 'qs-pin--likely'
      : f.certainty === 'Uncertain'
        ? 'qs-pin--uncertain'
        : ''
  return ['qs-pin', `qs-marker--${severityClass(f)}`, cert].filter(Boolean)
}

function pinLabel(f: DamageFinding): string {
  const severity = f.severity ? `apparent ${f.severity}` : "severity can't tell"
  return `Finding ${f.id}: ${f.title.toLowerCase()}, ${severity}, ${f.certainty.toLowerCase()}. ${f.location}`
}

// Zone visibility: an unseen zone is hatched and tagged Not seen; one the reply did not judge is
// hatched and tagged Can't tell. Never drawn as clean.
const zoneShapes = computed(() =>
  (props.zones ?? []).map((z) => {
    const unseen = z.visibility === 'not-visible' || z.visibility === null
    const onEnd = z.face === 'rear' || z.face === 'front'
    const pt = onEnd ? endPt : sidePt
    const [x, y] = pt((z.zone.u0 + z.zone.u1) / 2, (z.zone.v0 + z.zone.v1) / 2)
    return {
      id: z.id,
      points: quad(pt, z.zone.u0, z.zone.u1, z.zone.v0, z.zone.v1),
      // The end face is narrow, so its tags are the narrower variant: two sit side by side.
      tagHalf: onEnd ? 28 : 34,
      unseen,
      partial: z.visibility === 'partial',
      tag: z.visibility === null ? "Can't tell" : 'Not seen',
      centre: `translate(${x} ${y})`,
      title: `${z.label.charAt(0).toUpperCase()}${z.label.slice(1)}: ${
        z.visibility === 'clear'
          ? 'clearly visible'
          : z.visibility === 'partial'
            ? 'partly visible'
            : z.visibility === 'not-visible'
              ? 'not seen'
              : "can't tell how well it was seen"
      }`,
    }
  }),
)

function select(id: number) {
  emit('select', id)
}
</script>

<template>
  <figure :class="['qs-schem__view', { 'qs-schem__view--unseen': noPhotos }]" :data-view="id">
    <figcaption>
      {{ caption }}
      <small v-if="noPhotos">No photos</small>
    </figcaption>
    <svg
      class="qs-c"
      viewBox="0 0 900 430"
      role="group"
      :aria-label="`Container drawing, ${caption}`"
    >
      <defs>
        <pattern
          :id="`${id}-hatch`"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line class="qs-c-hatch" x1="0" y1="0" x2="0" y2="8" vector-effect="non-scaling-stroke" />
        </pattern>
      </defs>

      <g v-if="roof" class="qs-c-roof">
        <polygon class="qs-c-top" :points="ROOF_POINTS" />
      </g>
      <g v-if="roof" class="qs-c-unseen-tag" :transform="roofTag">
        <rect x="-56.5" y="-13" width="113" height="26" rx="4" />
        <text x="0" y="1">Roof · Not seen</text>
      </g>

      <polygon class="qs-c-side" :points="SIDE_POINTS" />
      <polygon
        v-if="side.status === 'side-unknown'"
        class="qs-c-face-edge"
        :points="SIDE_POINTS"
        stroke-dasharray="6 4"
      />
      <polygon
        v-if="side.status === 'not-seen'"
        class="qs-c-unseen-face"
        :points="SIDE_POINTS"
        :fill="`url(#${id}-hatch)`"
      />
      <g v-if="side.status !== 'not-seen'" class="qs-c-sections">
        <g
          v-for="s in sectionShapes"
          :key="s.id"
          :class="['qs-c-section', { 'is-cedex': s.lit }]"
          :data-section="sectionNumbers ? s.num : undefined"
        >
          <polygon :points="s.points" />
          <text v-if="sectionNumbers" class="qs-c-section__num" :x="s.label.x" :y="s.label.y">
            {{ s.num }}
          </text>
        </g>
      </g>
      <text class="qs-c-label" text-anchor="end" :x="sideLabel[0]" :y="sideLabel[1]">
        {{ side.text }}
      </text>

      <template v-if="end">
        <polygon class="qs-c-end" :points="END_POINTS" />
        <polygon
          v-if="end.status === 'not-seen'"
          class="qs-c-unseen-face"
          :points="END_POINTS"
          :fill="`url(#${id}-hatch)`"
        />
        <text class="qs-c-label" :x="endLabel[0]" :y="endLabel[1]">
          {{ end.text }}
        </text>
        <g
          v-for="p in positionShapes"
          :key="`position-${p.id}`"
          class="qs-c-section is-cedex"
          :data-position="p.id"
        >
          <polygon :points="p.points" />
        </g>
      </template>

      <g v-if="zoneShapes.length > 0" class="qs-c-zones">
        <g
          v-for="z in zoneShapes"
          :key="z.id"
          :class="['qs-c-zone', { 'qs-c-zone--partial': z.partial, 'qs-c-zone--unseen': z.unseen }]"
        >
          <title>{{ z.title }}</title>
          <polygon
            v-if="z.unseen"
            class="qs-c-unseen-face"
            :points="z.points"
            :fill="`url(#${id}-hatch)`"
          />
          <polygon :points="z.points" />
          <g v-if="z.unseen" class="qs-c-zone__tag" :transform="z.centre">
            <rect :x="-z.tagHalf" y="-11" :width="z.tagHalf * 2" height="22" rx="4" />
            <text x="0" y="1">{{ z.tag }}</text>
          </g>
        </g>
      </g>

      <g class="qs-c-regions">
        <g
          v-for="m in placed"
          :key="`region-${m.id}`"
          :class="[
            'qs-region',
            `qs-region--${severityClass(m)}`,
            { 'is-selected': m.id === selectedId },
          ]"
          :data-finding="m.id"
        >
          <polygon :points="regionPoints(m)" />
        </g>
      </g>

      <g class="qs-c-pins">
        <g
          v-for="m in placed"
          :key="`pin-${m.id}`"
          :class="[...pinClass(m), { 'is-selected': m.id === selectedId }]"
          :data-finding="m.id"
          tabindex="0"
          role="button"
          :aria-pressed="m.id === selectedId ? 'true' : 'false'"
          :aria-label="pinLabel(m)"
          @click="select(m.id)"
          @keydown.enter.prevent="select(m.id)"
          @keydown.space.prevent="select(m.id)"
        >
          <circle class="qs-pin__halo" :cx="pinFoot(m)[0]" :cy="pinFoot(m)[1]" r="7" />
          <circle class="qs-pin__foot" :cx="pinFoot(m)[0]" :cy="pinFoot(m)[1]" r="3.5" />
          <g class="qs-pin__drop">
            <line
              class="qs-pin__stem"
              :x1="pinFoot(m)[0]"
              :y1="pinFoot(m)[1]"
              :x2="pinFoot(m)[0]"
              :y2="pinFoot(m)[1] - 40"
            />
            <circle class="qs-pin__head" :cx="pinFoot(m)[0]" :cy="pinFoot(m)[1] - 40" r="15" />
            <text class="qs-pin__num" :x="pinFoot(m)[0]" :y="pinFoot(m)[1] - 40">{{ m.id }}</text>
          </g>
        </g>
      </g>
    </svg>
  </figure>
</template>
