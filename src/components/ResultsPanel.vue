<script setup lang="ts">
import { computed } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { getProvider } from '../domain/providers'
import CertaintyChip from './CertaintyChip.vue'
import ContainerId from './ContainerId.vue'
import ContainerDetails from './ContainerDetails.vue'

const store = useInspectionStore()
const record = computed(() => store.record)

// "Recorded demonstration: [provider/model]" (spec 13). Shown only for recorded runs.
const recordedLabel = computed(() => {
  const r = record.value
  if (!r || r.source !== 'recorded') return null
  return `Recorded demonstration: ${getProvider(r.provider).name} / ${r.model}`
})
</script>

<template>
  <section class="rs-right" aria-live="polite">
    <div v-if="recordedLabel" class="qs-notice qs-notice--recorded" role="note">
      <i class="qs-glyph qs-glyph--recorded" aria-hidden="true"></i>
      <div>
        <div class="qs-notice__title">{{ recordedLabel }}</div>
        <div class="qs-notice__body">
          A result saved from an earlier inspection, replayed offline: no live API call, no key and
          no charge.
        </div>
      </div>
      <span class="qs-notice__kicker">Sample</span>
    </div>

    <div v-if="store.status === 'failed'" class="qs-notice qs-notice--error" role="alert">
      <i class="qs-glyph qs-glyph--error" aria-hidden="true"></i>
      <div>
        <div class="qs-notice__title">The recorded result could not be loaded.</div>
      </div>
    </div>

    <div v-if="store.status === 'running'" class="rs-card" aria-busy="true">
      <div class="rs-card__head"><span class="rs-k">Container ID</span></div>
      <div class="qs-skeleton" style="height: 46px"></div>
    </div>

    <div v-if="record?.containerId" class="rs-card qs-rise" style="--i: 0">
      <div class="rs-card__head">
        <span class="rs-k">Container ID</span>
        <CertaintyChip :level="record.containerId.certainty" />
      </div>
      <ContainerId :reading="record.containerId" />
    </div>

    <ContainerDetails v-if="record" :record="record" />
  </section>
</template>
