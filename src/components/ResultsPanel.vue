<script setup lang="ts">
import { computed } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { recordedDemonstrationLabel } from '../domain/providers'
import { idResultState, UNREAD, visibleAlternatives } from '../domain/certainty'
import type { StageId } from '../domain/runStages'
import CertaintyChip from './CertaintyChip.vue'
import ContainerId from './ContainerId.vue'
import ManifestRetry from './ManifestRetry.vue'
import PhotoCrop from './PhotoCrop.vue'
import SealCard from './SealCard.vue'
import ContainerDetails from './ContainerDetails.vue'
import ContainerMarkings from './ContainerMarkings.vue'
import ExportActions from './ExportActions.vue'
import KeyFacts from './KeyFacts.vue'
import { DETAIL_IDS } from '../composables/detailJump'
import { DIFFERENT_CONTAINERS_MESSAGE, droppedPhotoMessage } from '../domain/combinePhotos'
import { causeSentence } from '../domain/requestFailure'
import { idCloseUp, sealCloseUp } from '../domain/closeUpSources'

const store = useInspectionStore()
const record = computed(() => store.record)

const photoUrl = (n: number | undefined) => (n ? store.photos[n - 1]?.url : undefined)

// Close-ups (ticket #85): the area found for the ID and the seal, cut from the photo whose reading won.
const idClose = computed(() => (record.value ? idCloseUp(record.value) : null))
const idCloseUrl = computed(() => photoUrl(idClose.value?.photo))
const sealClose = computed(() => (record.value ? sealCloseUp(record.value) : null))

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

// Stagger position of each card in the arrival choreography (read by .qs-rise as --i).
const STAGGER = { card: 0, alternative: 1, crop: 1, explanation: 2 } as const

// Plain explanation for the uncertain, partial and insufficient-evidence states (spec 5.4, 8.4).
const idState = computed(() =>
  record.value?.containerId ? idResultState(record.value.containerId) : null,
)
// The size code in plain words, decoded from the ISO code with no model call (ticket #66). Said only when
// the code itself was read at Confident or Likely.
const sizeLine = computed(() => {
  const size = record.value?.sizeCode
  return size && (size.certainty === 'Confident' || size.certainty === 'Likely')
    ? size.summary
    : null
})
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

    <!-- Detail: damage (the slot) wide on the left, the readings narrower on the right. -->
    <div class="rs-detail">
      <div class="rs-detail__main"><slot /></div>
      <section class="rs-right" aria-live="polite">
        <div v-if="running && !idLanded" class="rs-card" aria-busy="true">
          <div class="rs-card__head"><span class="rs-k">Container ID</span></div>
          <div class="qs-skeleton rs-id-skeleton"></div>
        </div>

        <div
          v-if="idLanded && record?.containerId"
          :id="DETAIL_IDS.id"
          tabindex="-1"
          data-detail
          :class="['rs-card', 'qs-rise', { 'qs-arrived': arrivedEarly }]"
          :style="{ '--i': STAGGER.card }"
        >
          <div class="rs-card__head">
            <span class="rs-k">Container ID</span>
            <CertaintyChip :level="record.containerId.certainty" />
          </div>
          <p v-if="showInsufficient" class="rs-note qs-type-body-sm" role="status">
            ID not readable in this photo
          </p>
          <template v-else>
            <ContainerId :reading="record.containerId" />
            <p v-if="sizeLine" class="rs-note qs-type-body-sm">{{ sizeLine }}</p>

            <!-- Where the ID was read, cut from the photo on screen; absent when the reading has no usable box. -->
            <PhotoCrop
              v-if="idClose && idCloseUrl"
              class="qs-rise"
              :style="{ '--i': STAGGER.crop }"
              :src="idCloseUrl"
              :box="idClose.box"
              :margin="idClose.margin"
              :photo-number="idClose.photo"
              caption="Where we read the ID"
              label="The container ID"
            />

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
          </template>
        </div>

        <div
          v-else-if="idLanded && record && !differentContainers"
          :id="DETAIL_IDS.id"
          tabindex="-1"
          data-detail
          :class="['rs-card', 'qs-rise', { 'qs-arrived': arrivedEarly }]"
          :style="{ '--i': STAGGER.card }"
        >
          <div class="rs-card__head">
            <span class="rs-k">Container ID</span>
            <CertaintyChip level="Can't tell" />
          </div>
          <p class="rs-note qs-type-body-sm">The container ID could not be read from this photo.</p>
        </div>

        <!-- The seal, under the ID. Absent when the survey did not assess it. -->
        <SealCard
          v-if="idLanded && record?.seal"
          :id="DETAIL_IDS.seal"
          tabindex="-1"
          data-detail
          :reading="record.seal"
          :photo-url="photoUrl(sealClose?.photo) ?? null"
          :close-up="sealClose"
          :class="['qs-rise', { 'qs-arrived': arrivedEarly }]"
          :style="{ '--i': STAGGER.card }"
        />

        <!-- Live: a live call on the same model. Demo: the sample's own recorded check. Never a replay against another photo. -->
        <ManifestRetry v-if="store.canCheckManifest && !differentContainers" />

        <template v-if="record && detailsLanded">
          <ContainerDetails :record="record" :class="{ 'qs-arrived': detailsEarly }" />
          <ContainerMarkings
            :id="DETAIL_IDS.markings"
            tabindex="-1"
            data-detail
            :record="record"
            :photo="store.photo?.url ?? null"
            :photos="store.photos.map((p) => p.url)"
            :class="{ 'qs-arrived': detailsEarly }"
          />
        </template>

        <ExportActions v-if="!running" />
      </section>
    </div>
  </div>
</template>
