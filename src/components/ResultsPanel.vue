<script setup lang="ts">
import { computed } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { recordedDemonstrationLabel } from '../domain/providers'
import { idResultState, UNREAD } from '../domain/certainty'
import type { StageId } from '../domain/runStages'
import ManifestRetry from './ManifestRetry.vue'
import ContainerDetails from './ContainerDetails.vue'
import ContainerMarkings from './ContainerMarkings.vue'
import ExportActions from './ExportActions.vue'
import KeyFacts from './KeyFacts.vue'
import ReadingsLedger from './ReadingsLedger.vue'
import { LEDGER_DETAIL_LABELS, ledgerModel } from './ledgerRows'
import { useUnits } from '../composables/units'
import { DETAIL_IDS } from '../composables/detailJump'
import { DIFFERENT_CONTAINERS_MESSAGE, droppedPhotoMessage } from '../domain/combinePhotos'
import { causeSentence } from '../domain/requestFailure'

const store = useInspectionStore()
const record = computed(() => store.record)

const photoUrls = computed(() => store.photos.map((p) => p.url))

// "Recorded demonstration: [provider/model]" (spec 13). Shown only for recorded runs.
const recordedLabel = computed(() => {
  const r = record.value
  if (!r || r.source !== 'recorded') return null
  return recordedDemonstrationLabel(r)
})

// Several photos (ticket #70): photos that show no container are named, and so are photos of different containers.
const droppedPhotos = computed(() =>
  (record.value?.photos ?? []).filter((p) => p.dropped).map((p) => droppedPhotoMessage(p.index)),
)
const differentContainers = computed(() => record.value?.differentContainers === true)

// Each part of the result lands on its own once its stage has settled, ahead of the rest of the run.
const running = computed(() => store.status === 'running')
const idLanded = computed(() => store.landed('id'))
// A part that lands while the run is still going plays its own arrival inside the arriving screen.
const arrivedEarly = computed(() => running.value && idLanded.value)
const detailsLanded = computed(() => store.landed('details'))
const detailsEarly = computed(() => running.value && detailsLanded.value)

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

// The readings ledger: the door drawing with each reading beside its painted place. The rows it shows
// are left out of the Container details and Markings cards below it.
const { units } = useUnits()
const ledgerParts = computed(() => ({ id: idLanded.value, details: detailsLanded.value }))
const ledger = computed(() =>
  record.value ? ledgerModel(record.value, units.value, ledgerParts.value) : null,
)
const showLedger = computed(
  () => (running.value && !idLanded.value) || (ledger.value?.rows.length ?? 0) > 0,
)
const markingOmit = computed(() => ledger.value?.markingLabels ?? [])
// The key-facts Placards tile leads to the ledger's DG placard row when there is one, else to the card.
const markingsInLedger = computed(
  () => ledger.value?.rows.some((r) => r.key === 'placard') ?? false,
)

// Plain explanation for the uncertain, partial and insufficient-evidence states (spec 5.4, 8.4).
const idState = computed(() =>
  record.value?.containerId ? idResultState(record.value.containerId) : null,
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
</script>

<template>
  <div class="rs-results">
    <!-- Notices sit compactly under the photo strip. -->
    <div class="rs-notices" aria-live="polite">
      <div v-if="recordedLabel" class="qs-notice qs-notice--recorded" role="note">
        <i class="qs-glyph qs-glyph--recorded" aria-hidden="true"></i>
        <div>
          <div class="qs-notice__title">{{ recordedLabel }}</div>
          <div class="qs-notice__body">
            A result saved from an earlier inspection, replayed offline: no live API call, no key
            and no charge.
          </div>
        </div>
        <span class="qs-notice__kicker">Sample</span>
      </div>

      <div v-if="differentContainers" class="qs-notice qs-notice--partial" role="status">
        <i class="qs-glyph qs-glyph--cross" aria-hidden="true"></i>
        <div>
          <div class="qs-notice__title">{{ DIFFERENT_CONTAINERS_MESSAGE }}</div>
          <div class="qs-notice__body">
            Two photos read different container IDs, so nothing from them is combined. Start a new
            inspection for each container.
          </div>
        </div>
        <span class="qs-notice__kicker">Check</span>
      </div>

      <div
        v-for="message in droppedPhotos"
        :key="message"
        class="qs-notice qs-notice--partial"
        role="status"
      >
        <i class="qs-glyph qs-glyph--cross" aria-hidden="true"></i>
        <div>
          <div class="qs-notice__title">{{ message }}</div>
          <div class="qs-notice__body">Nothing from it is used.</div>
        </div>
      </div>

      <div v-if="store.status === 'failed'" class="qs-notice qs-notice--error" role="alert">
        <i class="qs-glyph qs-glyph--error" aria-hidden="true"></i>
        <div>
          <div class="qs-notice__title">
            {{ store.errorMessage ?? 'The recorded result could not be loaded.' }}
          </div>
          <div class="qs-notice__body">
            <button
              type="button"
              class="qs-btn qs-btn--secondary qs-btn--sm"
              @click="store.start()"
            >
              Try again
            </button>
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
    </div>

    <!-- The headline at a glance: Reading… placeholders from the start, filled in as each part arrives. -->
    <KeyFacts />

    <!-- Detail: the readings ledger, the cards for what is not painted on the doors, then damage at full width. -->
    <div class="rs-detail">
      <ReadingsLedger
        v-if="showLedger"
        :record="record"
        :parts="ledgerParts"
        :busy="running && !idLanded"
        :class="['qs-rise', { 'qs-arrived': arrivedEarly }]"
      >
        <div v-if="idLanded && showExplanation" class="rs-explain qs-type-body-sm">
          <p>
            <b>Best interpretation: </b>
            <span class="qs-type-data">{{ groupedId(bestInterpretation) }}</span>
          </p>
          <p><b>What remains uncertain:</b> {{ remainsUncertain }}</p>
        </div>
      </ReadingsLedger>

      <section class="rs-right" aria-live="polite">
        <!-- Live: a live call on the same model. Demo: the sample's own recorded check. Never a replay against another photo. -->
        <ManifestRetry v-if="store.canCheckManifest && !differentContainers" />

        <template v-if="record && detailsLanded">
          <ContainerDetails
            :record="record"
            :omit="LEDGER_DETAIL_LABELS"
            :units-toggle="false"
            :class="{ 'qs-arrived': detailsEarly }"
          />
          <ContainerMarkings
            :id="markingsInLedger ? undefined : DETAIL_IDS.markings"
            :tabindex="markingsInLedger ? undefined : -1"
            :data-detail="markingsInLedger ? undefined : ''"
            :record="record"
            :omit="markingOmit"
            :photo="store.photo?.url ?? null"
            :photos="photoUrls"
            :class="{ 'qs-arrived': detailsEarly }"
          />
        </template>

        <ExportActions v-if="!running" />
      </section>
      <div class="rs-detail__main"><slot /></div>
    </div>
  </div>
</template>
