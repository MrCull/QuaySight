<script setup lang="ts">
import { computed } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { isMovingTarget, labelsFor, recordedDemonstrationLabel } from '../domain/providers'
import { idResultState, UNREAD, visibleAlternatives } from '../domain/certainty'
import type { StageId } from '../domain/runStages'
import CertaintyChip from './CertaintyChip.vue'
import ContainerId from './ContainerId.vue'
import ManifestRetry from './ManifestRetry.vue'
import ContainerDetails from './ContainerDetails.vue'
import ContainerMarkings from './ContainerMarkings.vue'
import ExportActions from './ExportActions.vue'
import WhatWeFound from './WhatWeFound.vue'
import { causeSentence } from '../domain/requestFailure'
import { unavailableStages } from '../domain/whatWeFound'

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

// Each part of the result lands on its own once its stage has settled, ahead of the rest of the run.
const running = computed(() => store.status === 'running')
const idLanded = computed(() => store.landed('id'))
// A part that lands while the run is still going plays its own arrival inside the arriving screen.
const arrivedEarly = computed(() => running.value && idLanded.value)
const detailsLanded = computed(() => store.landed('details'))
const detailsEarly = computed(() => running.value && detailsLanded.value)

// What we found: first in the readings once anything has landed. A part that has not arrived is named
// as missing (still arriving, failed, cancelled) and left out, never reported as not seen.
const foundShown = computed(
  () => !!record.value && (['id', 'details', 'damage'] as const).some((s) => store.landed(s)),
)
const foundEarly = computed(() => running.value && foundShown.value)
const foundUnavailable = computed(() => unavailableStages(store.stages, running.value))

// The parts a stage stands for, in plain words, for the partial and failure notices.
const PART: Record<StageId, string> = {
  id: 'the container ID',
  details: 'container details',
  damage: 'damage',
}
const FAILED_TITLE: Record<StageId, string> = {
  id: 'The container ID could not be read.',
  details: 'Container details could not be read.',
  damage: 'Damage could not be checked.',
}
const partial = computed(() => store.status === 'complete' && record.value?.status === 'partial')
/** After Cancel: the parts that did not finish. */
const unfinished = computed(() =>
  partial.value && store.cancelRequested
    ? store.stages.filter((s) => s.state === 'cancelled').map((s) => PART[s.id])
    : [],
)
/** The parts whose request failed while others answered. */
const failedParts = computed(() =>
  partial.value ? store.stages.filter((s) => s.state === 'failed').map((s) => s.id) : [],
)

/** The cause of a failed part in plain words, then what is kept. */
function failureBody(part: StageId): string {
  const failure = record.value?.failures?.find((f) => f.stages.includes(part))
  return `${failure ? `${causeSentence(failure)} ` : ''}Everything else found is shown.`
}

// Stagger position of each card in the arrival choreography (read by .qs-rise as --i).
const STAGGER = { card: 0, alternative: 1, explanation: 2 } as const

// Plain explanation for the uncertain, partial and insufficient-evidence states (spec 5.4, 8.4).
const idState = computed(() =>
  record.value?.containerId ? idResultState(record.value.containerId) : null,
)
const alternatives = computed(() =>
  record.value?.containerId ? visibleAlternatives(record.value.containerId) : [],
)
/**
 * A full container number as it is printed: owner code, serial, check digit ("APHU 658684 7").
 * An unread position shows as a middle dot, as in the ID above.
 */
function groupedId(id: string): string {
  const marked = id.split(UNREAD).join('·')
  return marked.length === 11
    ? `${marked.slice(0, 4)} ${marked.slice(4, 10)} ${marked.slice(10)}`
    : marked
}
// The reading as one string; groupedId marks its unread positions.
const bestInterpretation = computed(() =>
  (record.value?.containerId?.value ?? '').replace(/\s+/g, '').toUpperCase(),
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

    <div v-if="store.status === 'cancelled'" class="qs-notice qs-notice--partial" role="status">
      <i class="qs-glyph qs-glyph--cross" aria-hidden="true"></i>
      <div>
        <div class="qs-notice__title">Inspection cancelled before any result arrived.</div>
        <div class="qs-notice__body">Run the inspection again when you are ready.</div>
      </div>
      <span class="qs-notice__kicker">Partial</span>
    </div>

    <div v-if="unfinished.length" class="qs-notice qs-notice--partial" role="status">
      <i class="qs-glyph qs-glyph--cross" aria-hidden="true"></i>
      <div>
        <div class="qs-notice__title">Partial result: cancelled before every part finished.</div>
        <div class="qs-notice__body">
          What had arrived is shown. Not finished: {{ unfinished.join(', ') }}.
        </div>
      </div>
      <span class="qs-notice__kicker">Partial</span>
    </div>

    <div v-for="part in failedParts" :key="part" class="qs-notice qs-notice--error" role="alert">
      <i class="qs-glyph qs-glyph--error" aria-hidden="true"></i>
      <div>
        <div class="qs-notice__title">{{ FAILED_TITLE[part] }}</div>
        <div class="qs-notice__body">{{ failureBody(part) }}</div>
      </div>
    </div>

    <WhatWeFound
      v-if="foundShown && record"
      :record="record"
      :unavailable="foundUnavailable"
      :class="{ 'qs-arrived': foundEarly }"
    />

    <div v-if="running && !idLanded" class="rs-card" aria-busy="true">
      <div class="rs-card__head"><span class="rs-k">Container ID</span></div>
      <div class="qs-skeleton rs-id-skeleton"></div>
    </div>

    <div
      v-if="idLanded && record?.containerId"
      :class="['rs-card', 'qs-rise', { 'qs-arrived': arrivedEarly }]"
      :style="{ '--i': STAGGER.card }"
    >
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
        Also possible: <span class="qs-type-data">{{ groupedId(alt) }}</span>
      </p>

      <div
        v-if="showExplanation"
        class="rs-explain qs-rise qs-type-body-sm"
        :style="{ '--i': STAGGER.explanation }"
      >
        <p>
          <b>Best interpretation: </b>
          <span class="qs-type-data">{{ groupedId(bestInterpretation) }}</span>
        </p>
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

    <div
      v-else-if="idLanded && record"
      :class="['rs-card', 'qs-rise', { 'qs-arrived': arrivedEarly }]"
      :style="{ '--i': STAGGER.card }"
    >
      <div class="rs-card__head">
        <span class="rs-k">Container ID</span>
        <CertaintyChip level="Can't tell" />
      </div>
      <p class="rs-note qs-type-body-sm">The container ID could not be read from this photo.</p>
    </div>

    <!-- Live: a live call on the same model. Demo: the sample's own recorded check. Never a replay against another photo. -->
    <ManifestRetry v-if="store.canCheckManifest" />

    <template v-if="record && detailsLanded">
      <ContainerDetails :record="record" :class="{ 'qs-arrived': detailsEarly }" />
      <ContainerMarkings :record="record" :class="{ 'qs-arrived': detailsEarly }" />
    </template>

    <ExportActions v-if="!running" />
  </section>
</template>
