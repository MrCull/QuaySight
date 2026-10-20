<script setup lang="ts">
// The readings ledger (design-system ReadingsLedger): the DoorFace in the middle, each reading beside it
// level with where it is painted on the doors, character by character, with the crop it was read from.
// The rows come from ledgerRows.ts; this measures them and places each one as near its slot as it can.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { InspectionRecord } from '../domain/inspection'
import { DOOR_WIDTH, SLOT_Y, ledgerModel, placeRows, type LedgerRow } from './ledgerRows'
import { useUnits } from '../composables/units'
import CertaintyChip from './CertaintyChip.vue'
import DoorFace from './DoorFace.vue'
import UnitsToggle from './UnitsToggle.vue'

const props = defineProps<{
  record: InspectionRecord | null
  /** Which parts have landed: the ID and seal come with the ID stage, the rest with the details. */
  parts: { id: boolean; details: boolean }
  /** The run is going and the ID has not landed: the door bare, skeletons for the values. */
  busy: boolean
}>()

const { units, set: setUnits } = useUnits()

const model = computed(() =>
  props.record ? ledgerModel(props.record, units.value, props.parts) : null,
)
const left = computed(() => model.value?.rows.filter((r) => r.side === 'left') ?? [])
const right = computed(() => model.value?.rows.filter((r) => r.side === 'right') ?? [])
// Weights are said in one unit system at a time; the toggle shows once they have landed.
const showUnits = computed(() => right.value.some((r) => r.unit !== null))

// While the ID has not landed: the door bare, the right-hand labels with a skeleton for each value.
const SKELETON: Pick<LedgerRow, 'key' | 'glyph' | 'label' | 'slot'>[] = [
  { key: 'id', glyph: 'tag', label: 'ID', slot: 'id' },
  { key: 'type', glyph: 'container', label: 'Type', slot: 'type' },
  { key: 'gross', glyph: 'weight', label: 'Max gross', slot: 'gross' },
  { key: 'tare', glyph: 'scale', label: 'Tare', slot: 'tare' },
  { key: 'seal', glyph: 'padlock', label: 'Seal', slot: 'seal' },
]
const reading = computed(() => props.busy)

const doorLabel = computed(() => {
  const painted = model.value?.rows.filter((r) => r.slot !== null).map((r) => r.label) ?? []
  return painted.length
    ? `Rear doors drawn flat, with ${painted.join(', ')} painted where they are usually stencilled`
    : 'Rear doors drawn flat, readings pending'
})

// ---- Placing the rows: measured after each render, so a row with a note pushes the next one down.
const door = ref<HTMLElement | null>(null)
const leftSide = ref<HTMLElement | null>(null)
const rightSide = ref<HTMLElement | null>(null)
const tops = ref<Record<string, number>>({})
const anchors = ref<Record<string, number>>({})
const heights = ref<{ left: number; right: number; door: number }>({ left: 0, right: 0, door: 0 })
/** Half a row's first line (control-sm): a row is centred on its slot by its first line. */
const HALF_LINE = 16
const GAP = 8

/** The drawing itself, not its grid cell: the cell stretches to the tallest side. */
const drawing = () => door.value?.querySelector('svg')?.getBoundingClientRect() ?? null

function placeSide(side: HTMLElement | null, rows: { key: string; slot: string | null }[]) {
  if (!side) return 0
  const scale = (drawing()?.width || DOOR_WIDTH) / DOOR_WIDTH
  const els = rows.map((r) => side.querySelector<HTMLElement>(`[data-row="${r.key}"]`))
  const placed = placeRows(
    rows.map((r, i) => ({
      ideal: r.slot ? SLOT_Y[r.slot as keyof typeof SLOT_Y] * scale - HALF_LINE : null,
      height: els[i]?.offsetHeight ?? 0,
    })),
    GAP,
  )
  rows.forEach((r, i) => {
    tops.value[r.key] = placed[i]!
    if (r.slot) anchors.value[r.key] = SLOT_Y[r.slot as keyof typeof SLOT_Y] * scale
  })
  const last = rows.length - 1
  return last < 0 ? 0 : placed[last]! + (els[last]?.offsetHeight ?? 0)
}

function layout() {
  // A row that wraps (a long note, a font that loads late) moves the rows under it: watch every row.
  for (const el of [leftSide.value, rightSide.value]) {
    el?.querySelectorAll<HTMLElement>('[data-row]').forEach((row) => observer?.observe(row))
  }
  const shownRight = reading.value ? SKELETON : right.value
  heights.value = {
    left: placeSide(leftSide.value, left.value),
    right: placeSide(rightSide.value, shownRight),
    door: drawing()?.height ?? 0,
  }
}

const sideHeight = computed(() =>
  Math.max(heights.value.left, heights.value.right, heights.value.door),
)

/** A dashed link from the door's edge at a slot's height to the middle of the row's first line. */
function link(key: string, side: 'left' | 'right'): string | null {
  const a = anchors.value[key]
  const t = tops.value[key]
  if (a === undefined || t === undefined) return null
  const y = t + HALF_LINE
  return side === 'right' ? `M0 ${a} H8 L24 ${y} H32` : `M32 ${a} H24 L8 ${y} H0`
}

let observer: ResizeObserver | null = null
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => layout())
    if (door.value) observer.observe(door.value)
  }
  void nextTick(layout)
  void document.fonts?.ready.then(layout)
})
onBeforeUnmount(() => observer?.disconnect())
watch([model, reading], () => void nextTick(layout), { deep: true })
</script>

<template>
  <section class="qs-ledger" aria-label="Readings" aria-live="polite">
    <div class="qs-ledger__head">
      <h2 class="qs-ledger__title">Readings</h2>
      <UnitsToggle v-if="showUnits" :model-value="units" @update:model-value="setUnits" />
    </div>
    <div class="qs-ledger__body" :style="{ '--ledger-h': `${sideHeight}px` }">
      <div ref="leftSide" class="qs-ledger__side qs-ledger__side--left">
        <svg class="qs-ledger__links" :height="sideHeight" aria-hidden="true">
          <template v-for="row in left" :key="row.key">
            <path v-if="link(row.key, 'left')" :d="link(row.key, 'left')!" />
            <circle v-if="anchors[row.key] !== undefined" cx="32" :cy="anchors[row.key]" r="2.5" />
          </template>
        </svg>
        <div
          v-for="(row, i) in left"
          :id="row.detail ?? undefined"
          :key="row.key"
          :data-row="row.key"
          :data-detail="row.detail ? '' : undefined"
          :tabindex="row.detail ? -1 : undefined"
          class="qs-ledger__row qs-rise"
          :style="{ '--y': `${tops[row.key] ?? 0}px`, '--i': i }"
        >
          <i
            :class="['qs-glyph', 'qs-glyph--lg', `qs-glyph--${row.glyph}`, 'qs-ledger__icon']"
            aria-hidden="true"
          ></i>
          <span class="qs-ledger__label qs-type-label">{{ row.label }}</span>
          <span class="qs-ledger__value qs-ledger__value--words">{{ row.words }}</span>
          <CertaintyChip :level="row.certainty" />
          <p v-if="row.note" class="qs-ledger__note">{{ row.note }}</p>
        </div>
      </div>

      <div ref="door" class="qs-ledger__door">
        <DoorFace :paint="model?.door ?? {}" :label="doorLabel" />
      </div>

      <div ref="rightSide" class="qs-ledger__side qs-ledger__side--right">
        <svg class="qs-ledger__links" :height="sideHeight" aria-hidden="true">
          <template v-for="row in reading ? SKELETON : right" :key="row.key">
            <path v-if="link(row.key, 'right')" :d="link(row.key, 'right')!" />
            <circle v-if="anchors[row.key] !== undefined" cx="0" :cy="anchors[row.key]" r="2.5" />
          </template>
        </svg>
        <template v-if="reading">
          <div
            v-for="row in SKELETON"
            :key="row.key"
            :data-row="row.key"
            class="qs-ledger__row"
            aria-busy="true"
            :style="{ '--y': `${tops[row.key] ?? 0}px` }"
          >
            <i
              :class="['qs-glyph', 'qs-glyph--lg', `qs-glyph--${row.glyph}`, 'qs-ledger__icon']"
              aria-hidden="true"
            ></i>
            <span class="qs-ledger__label qs-type-label">{{ row.label }}</span>
            <span class="qs-ledger__value"
              ><span class="qs-skeleton rs-ledger-skeleton"></span
            ></span>
          </div>
        </template>
        <div
          v-for="(row, i) in right"
          v-else
          :id="row.detail ?? undefined"
          :key="row.key"
          :data-row="row.key"
          :data-detail="row.detail ? '' : undefined"
          :tabindex="row.detail ? -1 : undefined"
          class="qs-ledger__row qs-rise"
          :style="{ '--y': `${tops[row.key] ?? 0}px`, '--i': i }"
        >
          <i
            :class="['qs-glyph', 'qs-glyph--lg', `qs-glyph--${row.glyph}`, 'qs-ledger__icon']"
            aria-hidden="true"
          ></i>
          <span class="qs-ledger__label qs-type-label">{{ row.label }}</span>
          <span v-if="row.groups" class="qs-ledger__value">
            <span class="qs-id qs-id--sm" :aria-label="row.spoken ?? undefined">
              <template v-for="(group, gi) in row.groups" :key="gi">
                <span v-if="!group[0]?.check" class="qs-id__group">
                  <span
                    v-for="(c, ci) in group"
                    :key="ci"
                    class="qs-id__ch"
                    :data-c="c.state"
                    :style="{ '--c': ci }"
                    >{{ c.ch }}</span
                  >
                </span>
                <span v-else class="qs-id__check" :data-c="group[0].state">{{ group[0].ch }}</span>
              </template>
            </span>
            <span v-if="row.unit" class="qs-ledger__unit">{{ ` ${row.unit}` }}</span>
          </span>
          <span v-else class="qs-ledger__value qs-ledger__value--words">{{ row.words }}</span>
          <CertaintyChip :level="row.certainty" />
          <p v-if="row.tags.length || row.note || row.alternatives.length" class="qs-ledger__note">
            <span v-for="tag in row.tags" :key="tag.text" :class="['qs-prov', tag.modifier]">{{
              tag.text
            }}</span>
            <span v-for="alt in row.alternatives" :key="alt" class="rs-also"
              >Also possible: <span class="qs-type-data">{{ alt }}</span></span
            >
            <span v-if="row.note">{{ row.note }}</span>
          </p>
        </div>
      </div>
    </div>
    <slot />
  </section>
</template>
