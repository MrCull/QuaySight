<script setup lang="ts">
import { computed } from 'vue'
import { findSample } from '../domain/demoSamples'
import { labelsFor } from '../domain/providers'
import type { StageState } from '../domain/runStages'
import { useInspectionStore } from '../stores/inspection'

const store = useInspectionStore()
// A sample names the model it was recorded with; a live run names the model in settings.
const modelName = computed(() => {
  const run = store.demo && store.sample ? findSample(store.sample) : store
  return labelsFor(run.provider, run.model).model
})

// design-system StageProgress: each state's class, dot glyph and plain-words detail.
const LOOK: Record<StageState, { modifier: string; glyph: string | null; detail: string | null }> =
  {
    'not-in-run': { modifier: 'skipped', glyph: null, detail: 'Not part of this run' },
    active: { modifier: 'active', glyph: null, detail: null },
    done: { modifier: 'done', glyph: 'check', detail: null },
    failed: {
      modifier: 'failed',
      glyph: 'error',
      detail: 'Could not be completed. Everything else is kept.',
    },
    cancelled: { modifier: 'cancelled', glyph: 'cross', detail: 'Cancelled' },
  }

const stages = computed(() =>
  store.stages.map((stage) => ({
    ...stage,
    ...LOOK[stage.state],
    // Measured, never estimated: only a settled stage has a time.
    time:
      stage.state === 'done' && stage.elapsedMs !== null
        ? `${(stage.elapsedMs / 1000).toFixed(1)} s`
        : '',
  })),
)
</script>

<template>
  <div class="rs-stagecard">
    <div class="rs-stagecard__k">Analysing with {{ modelName }}</div>
    <ol class="qs-stages" aria-live="polite">
      <li
        v-for="stage in stages"
        :key="stage.id"
        :class="['qs-stage', `qs-stage--${stage.modifier}`]"
      >
        <span class="qs-stage__dot"
          ><i
            v-if="stage.glyph"
            :class="['qs-glyph', `qs-glyph--${stage.glyph}`]"
            aria-hidden="true"
          ></i
        ></span>
        <span class="qs-stage__title">{{ stage.title }}</span>
        <span class="qs-stage__time">{{ stage.time }}</span>
        <span v-if="stage.detail" class="qs-stage__detail">{{ stage.detail }}</span>
      </li>
    </ol>
  </div>
</template>
