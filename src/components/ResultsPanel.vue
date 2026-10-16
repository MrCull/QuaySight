<script setup lang="ts">
import { computed } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { isMovingTarget, labelsFor, recordedDemonstrationLabel } from '../domain/providers'
import { idResultState, visibleAlternatives } from '../domain/certainty'
import CertaintyChip from './CertaintyChip.vue'
import ContainerId from './ContainerId.vue'
import ManifestRetry from './ManifestRetry.vue'
import ContainerDetails from './ContainerDetails.vue'
import ExportActions from './ExportActions.vue'

const store = useInspectionStore()
const record = computed(() => store.record)

// "Recorded demonstration: [provider/model]" (spec 13). Shown only for recorded runs.
const recordedLabel = computed(() => {
  const r = record.value
  if (!r || r.source !== 'recorded') return null
  return recordedDemonstrationLabel(r)
})

// "Live result: [provider/model]" for a result from a live call (spec 8.5). Never shown with the
// recorded label. The title names who answered; the body gives the exact version.
const liveLabel = computed(() => {
  const r = record.value
  if (!r || r.source !== 'live') return null
  const moving = isMovingTarget(r.provider, r.model)
  // A moving alias shows what was asked for and what answered, so the presenter can see the target moved.
  return {
    title: `Live result: ${labelsFor(r.provider, r.model).provider}`,
    version: moving
      ? `Answered by ${r.resolvedVersion} (requested ${r.model}, a moving target).`
      : `Answered by ${r.resolvedVersion}.`,
  }
})

// Stagger position of each card in the arrival choreography (read by .qs-rise as --i).
const STAGGER = { card: 0, alternative: 1, explanation: 2 } as const

// Plain explanation for the uncertain, partial and insufficient-evidence states (spec 5.4, 8.4).
const idState = computed(() =>
  record.value?.containerId ? idResultState(record.value.containerId) : null,
)
const alternatives = computed(() =>
  record.value?.containerId ? visibleAlternatives(record.value.containerId) : [],
)
const bestInterpretation = computed(() =>
  (record.value?.containerId?.value ?? '').replace(/\s+/g, '').toUpperCase().replace(/\?/g, '·'),
)
const remainsUncertain = computed(() => {
  const r = record.value?.containerId
  if (!r) return ''
  if (r.uncertainty) return r.uncertainty
  return idState.value === 'partial'
    ? 'some positions were not read, marked · above.'
    : 'some characters are hard to read, so the reading could be one of a few things.'
})
const showExplanation = computed(() => idState.value === 'uncertain' || idState.value === 'partial')
const showInsufficient = computed(() => idState.value === 'insufficient')
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

    <div v-if="liveLabel" class="qs-notice qs-notice--live" role="note">
      <div>
        <div class="qs-notice__title">{{ liveLabel.title }}</div>
        <div class="qs-notice__body">
          {{ liveLabel.version }} A live call to the provider. Its cost is as the provider reported
          it, or an estimate where it reported none; not an invoice.
        </div>
      </div>
      <span class="qs-notice__kicker">Live</span>
    </div>

    <div v-if="store.status === 'failed'" class="qs-notice qs-notice--error" role="alert">
      <i class="qs-glyph qs-glyph--error" aria-hidden="true"></i>
      <div>
        <div class="qs-notice__title">
          {{ store.errorMessage ?? 'The recorded result could not be loaded.' }}
        </div>
      </div>
    </div>

    <div v-if="store.status === 'running'" class="rs-card" aria-busy="true">
      <div class="rs-card__head"><span class="rs-k">Container ID</span></div>
      <div class="qs-skeleton rs-id-skeleton"></div>
    </div>

    <div v-if="record?.containerId" class="rs-card qs-rise" :style="{ '--i': STAGGER.card }">
      <div class="rs-card__head">
        <span class="rs-k">Container ID</span>
        <CertaintyChip :level="record.containerId.certainty" />
      </div>
      <ContainerId :reading="record.containerId" />

      <p
        v-for="alt in alternatives"
        :key="alt"
        class="rs-also qs-rise qs-type-body-sm"
        :style="{ '--i': STAGGER.alternative }"
      >
        Also possible: {{ alt }}
      </p>

      <div
        v-if="showExplanation"
        class="rs-explain qs-rise qs-type-body-sm"
        :style="{ '--i': STAGGER.explanation }"
      >
        <p><b>Best interpretation:</b> {{ bestInterpretation }}</p>
        <p><b>What remains uncertain:</b> {{ remainsUncertain }}</p>
      </div>

      <div
        v-if="showInsufficient"
        class="qs-notice qs-notice--suggestion rs-explain qs-rise qs-type-body-sm"
        :style="{ '--i': STAGGER.explanation }"
        role="status"
      >
        <i class="qs-glyph qs-glyph--unseen" aria-hidden="true"></i>
        <div>
          <div class="qs-notice__title">The container ID could not be read from this photo.</div>
          <div class="qs-notice__body">A closer photo of the door markings may help.</div>
        </div>
      </div>
    </div>

    <div v-else-if="record" class="rs-card qs-rise" :style="{ '--i': STAGGER.card }">
      <div class="rs-card__head">
        <span class="rs-k">Container ID</span>
        <CertaintyChip level="Can't tell" />
      </div>
      <p class="rs-note qs-type-body-sm">The container ID could not be read from this photo.</p>
    </div>

    <!-- Live: a live call on the same model. Demo: the sample's own recorded check. Never a replay against another photo. -->
    <ManifestRetry v-if="store.canCheckManifest" />

    <ContainerDetails v-if="record" :record="record" />

    <ExportActions />
  </section>
</template>
