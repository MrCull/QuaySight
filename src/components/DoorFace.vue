<script setup lang="ts">
// The rear doors drawn flat (design-system DoorFace), each reading painted where it is normally
// stencilled. A template, not a trace of the photo: only what was read is painted, and never any damage.
import { computed, useId } from 'vue'
import type { DoorPaint } from './ledgerRows'

const props = defineProps<{ paint: DoorPaint; label: string }>()

const caution = `qs-door-caution-${useId()}`

const LEAVES = [34, 300]
const PANEL_X = [48, 314]
const PANEL_Y = [150, 228, 306, 430, 508]
const CASTINGS = [
  [0, 0],
  [556, 0],
  [0, 582],
  [556, 582],
]
const HINGE_Y = [70, 230, 390, 550]
const BARS = [150, 256, 336, 552]
const KEEPER_Y = [42, 296, 560]
const HANDLES = [
  [150, -48],
  [256, -48],
  [336, 120],
  [552, -36],
]

// The weight block: field name stencilled on the left, value right-aligned, one underline per value.
const WEIGHT_ROWS = [
  ['gross', 'MAX GROSS', 206],
  ['tare', 'TARE', 232],
  ['net', 'NET', 258],
  ['cube', 'CU. CAP.', 284],
] as const
const weights = computed(() =>
  WEIGHT_ROWS.flatMap(([key, label, y]) => {
    const value = props.paint[key]
    return value ? [{ key, label, y, ...value, width: Math.round(8.4 * value.text.length) }] : []
  }),
)
</script>

<template>
  <svg class="qs-door" viewBox="0 0 600 620" role="img" :aria-label="label">
    <defs>
      <pattern
        :id="caution"
        width="12"
        height="12"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect class="qs-door__caution-a" width="12" height="12" />
        <rect class="qs-door__caution-b" width="6" height="12" />
      </pattern>
    </defs>
    <rect class="qs-door__frame" x="0" y="0" width="600" height="620" rx="4" />
    <rect
      v-for="x in LEAVES"
      :key="x"
      class="qs-door__leaf"
      :x="x"
      y="40"
      width="266"
      height="540"
    />
    <template v-for="x in PANEL_X" :key="x">
      <template v-for="y in PANEL_Y" :key="y">
        <rect class="qs-door__panel" :x="x" :y="y" width="238" height="34" rx="4" />
        <line class="qs-door__crease" :x1="x" :y1="y + 34" :x2="x + 238" :y2="y + 34" />
      </template>
    </template>
    <template v-for="[cx, cy] in CASTINGS" :key="`${cx}-${cy}`">
      <rect class="qs-door__frame" :x="cx" :y="cy" width="44" height="38" rx="3" />
      <ellipse class="qs-door__hole" :cx="cx! + 22" :cy="cy! + 19" rx="11" ry="7" />
    </template>
    <template v-for="y in HINGE_Y" :key="y">
      <rect class="qs-door__hw" x="4" :y="y" width="26" height="22" rx="2" />
      <rect class="qs-door__hw" x="570" :y="y" width="26" height="22" rx="2" />
    </template>
    <line class="qs-door__gap" x1="300" y1="40" x2="300" y2="580" />
    <template v-for="x in BARS" :key="x">
      <line class="qs-door__bar" :x1="x" y1="34" :x2="x" y2="586" />
      <rect
        v-for="y in KEEPER_Y"
        :key="y"
        class="qs-door__hw"
        :x="x - 11"
        :y="y"
        width="22"
        height="18"
        rx="3"
      />
    </template>
    <template v-for="[x, dx] in HANDLES" :key="x">
      <line class="qs-door__handle" :x1="x" y1="392" :x2="x! + dx!" y2="392" />
      <circle class="qs-door__hw" :cx="x" cy="392" r="7" />
    </template>

    <template v-if="paint.caution">
      <rect x="6" y="44" width="22" height="64" :fill="`url(#${caution})`" />
      <rect x="572" y="44" width="22" height="64" :fill="`url(#${caution})`" />
    </template>
    <path
      v-if="paint.placard"
      :class="['qs-door__placard', { 'qs-door__placard--unseen': paint.placard === 'unseen' }]"
      d="M167 290 L207 330 L167 370 L127 330 Z"
    />

    <template v-if="paint.id">
      <text class="qs-door__paint" x="350" y="80">{{ paint.id.text }}</text>
      <rect class="qs-door__check" x="518" y="59" width="21" height="27" />
      <text class="qs-door__paint" x="522" y="80">{{ paint.id.check }}</text>
      <line class="qs-door__u" :data-c="paint.id.state" x1="350" y1="91" x2="539" y2="91" />
    </template>
    <template v-if="paint.type">
      <text class="qs-door__paint" x="436" y="120">{{ paint.type.text }}</text>
      <line class="qs-door__u" :data-c="paint.type.state" x1="436" y1="128" x2="494" y2="128" />
    </template>
    <template v-for="w in weights" :key="w.key">
      <text class="qs-door__stencil" x="352" :y="w.y">{{ w.label }}</text>
      <text class="qs-door__paint qs-door__paint--sm" x="538" :y="w.y" text-anchor="end">
        {{ w.text }}
      </text>
      <line
        class="qs-door__u"
        :data-c="w.state"
        :x1="538 - w.width"
        :y1="w.y + 5"
        x2="538"
        :y2="w.y + 5"
      />
    </template>
    <template v-if="paint.seal">
      <rect class="qs-door__seal" x="342" y="398" width="16" height="28" rx="4" />
      <circle class="qs-door__hole" cx="350" cy="407" r="3" />
    </template>
  </svg>
</template>
