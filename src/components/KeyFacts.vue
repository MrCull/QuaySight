<script setup lang="ts">
import { computed } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { buildKeyFacts, type KeyFactId, type PartState, type PartStates } from '../domain/keyFacts'
import { RUN_STAGES, stageSettled, type StageId } from '../domain/runStages'
import { jumpToDetail } from '../composables/detailJump'
import CertaintyChip from './CertaintyChip.vue'
import ContainerId from './ContainerId.vue'
import SeverityBadge from './damage/SeverityBadge.vue'

// The key-facts tiles (design-system/components/KeyFactTile): the headline of a result at a glance, between
// the photo strip and the detail area. All words come from the pure builder; this lays them out, plays the
// arrival of each part and jumps to the matching detail section on click.
const store = useInspectionStore()
const record = computed(() => store.record)
const running = computed(() => store.status === 'running')

// Nothing to show before a run starts, or after one that gave no record.
const shown = computed(() => running.value || record.value !== null)

function partState(stage: StageId): PartState {
  const progress = store.stages.find((s) => s.id === stage)?.state
  if (progress === 'failed' || progress === 'cancelled') return 'unavailable'
  return store.landed(stage) && record.value ? 'arrived' : 'reading'
}

const parts = computed<PartStates>(() => ({
  id: partState('id'),
  details: partState('details'),
  damage: partState('damage'),
}))
const tiles = computed(() => buildKeyFacts(record.value, parts.value))

/** A tile that fills in while the run is still going plays its own arrival inside the arriving screen. */
const arrivesEarly = (state: PartState) => running.value && state === 'arrived'

// The detail section each tile leads to.
const DETAIL: Record<KeyFactId, string> = {
  id: 'detail-id',
  seal: 'detail-seal',
  damage: 'detail-damage',
  placards: 'detail-markings',
}

// A thin progress indicator while the run is going: how many parts have settled.
const progress = computed(() => {
  const inRun = store.stages.filter((s) => s.state !== 'not-in-run')
  const settled = inRun.filter((s) => stageSettled(s.state)).length
  return { settled, total: inRun.length || RUN_STAGES.length }
})
</script>

<template>
  <section v-if="shown" class="qs-keyfacts" aria-label="Key facts" aria-live="polite">
    <div
      v-if="running"
      class="qs-keyfacts__progress"
      role="progressbar"
      aria-label="Inspection progress"
      aria-valuemin="0"
      :aria-valuemax="progress.total"
      :aria-valuenow="progress.settled"
    >
      <i :style="{ width: `${(progress.settled / progress.total) * 100}%` }"></i>
    </div>
    <ul class="qs-keytiles">
      <li
        v-for="(tile, index) in tiles"
        :key="tile.id"
        :class="['qs-keytile', `qs-keytile--${tile.id}`]"
      >
        <div
          role="button"
          tabindex="0"
          :class="[
            'qs-keytile__body',
            { 'qs-rise': tile.state === 'arrived', 'qs-arrived': arrivesEarly(tile.state) },
          ]"
          :style="{ '--i': index }"
          :data-tile="tile.id"
          :data-state="tile.state"
          :aria-busy="tile.state === 'reading' ? 'true' : undefined"
          @click="jumpToDetail(DETAIL[tile.id])"
          @keydown.enter.prevent="jumpToDetail(DETAIL[tile.id])"
          @keydown.space.prevent="jumpToDetail(DETAIL[tile.id])"
        >
          <span class="qs-keytile__head">
            <span class="qs-keytile__label qs-type-label">{{ tile.label }}</span>
            <CertaintyChip v-if="tile.certainty" :level="tile.certainty" />
          </span>

          <ContainerId v-if="tile.reading" :reading="tile.reading" />
          <template v-else>
            <span
              v-if="tile.state === 'reading'"
              class="qs-skeleton qs-keytile__skeleton"
              aria-hidden="true"
            ></span>
            <span
              :class="[
                'qs-keytile__value',
                'qs-type-display-md',
                {
                  'qs-keytile__value--mono': tile.id === 'seal' && tile.state === 'arrived',
                  'qs-keytile__value--quiet': tile.state !== 'arrived',
                },
              ]"
              >{{ tile.headline }}</span
            >
          </template>

          <span v-if="tile.severity" class="qs-keytile__extra">
            <SeverityBadge :severity="tile.severity" />
          </span>
          <span v-if="tile.id === 'placards'" class="qs-keytile__extra">
            <span class="qs-marking qs-marking--hazard">
              <i class="qs-glyph qs-glyph--hazard" aria-hidden="true"></i>
              <span>DG placard</span>
            </span>
          </span>
          <span
            v-if="!tile.reading && tile.notes.length > 0"
            class="qs-keytile__notes qs-type-body-sm"
            >{{ tile.notes.join(' · ') }}</span
          >
        </div>
      </li>
    </ul>
  </section>
</template>
