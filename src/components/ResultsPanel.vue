<script setup lang="ts">
import { computed, nextTick, useSlots, watch } from 'vue'
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
import { DETAIL_IDS, detailTab, type DetailTab } from '../composables/detailJump'
import { DIFFERENT_CONTAINERS_MESSAGE, droppedPhotoMessage } from '../domain/combinePhotos'
import { causeSentence, type RequestFailure } from '../domain/requestFailure'
import { idCloseUp, isoCloseUp, sealCloseUp } from '../domain/closeUpSources'

const store = useInspectionStore()
const record = computed(() => store.record)

const photoUrls = computed(() => store.photos.map((p) => p.url))

// Close-ups (ticket #85): the area found for the ID and the seal, cut from the photo whose reading won.
const idClose = computed(() => (record.value ? idCloseUp(record.value) : null))
const sealClose = computed(() => (record.value ? sealCloseUp(record.value) : null))
const isoClose = computed(() => (record.value ? isoCloseUp(record.value) : null))

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

// What the failure notice says for each part whose request failed.
const FAILED_TITLE: Record<StageId, string> = {
  id: 'The container ID could not be read.',
  details: 'Container details could not be read.',
  damage: 'Damage could not be checked.',
}
const partial = computed(() => store.status === 'complete' && record.value?.status === 'partial')
/** The parts whose request failed while others answered. */
const failedParts = computed(() =>
  partial.value ? store.stages.filter((s) => s.state === 'failed').map((s) => s.id) : [],
)

/** A cause in plain words, then what is kept. */
function keptBody(failure: RequestFailure | undefined): string {
  return `${failure ? `${causeSentence(failure)} ` : ''}Everything else found is shown.`
}

/** The cause of a failed part. */
function failureBody(part: StageId): string {
  return keptBody(record.value?.failures?.find((f) => f.stages.includes(part)))
}

/**
 * Photos that lost a request while another photo still gave the part: the result stands, but that
 * photo's readings are missing from it. A dropped photo adds nothing anyway, and a part no photo gave
 * has its own notice above.
 */
const photoFailures = computed(() => {
  const photos = record.value?.photos
  if (!partial.value || !photos) return []
  return store.photoFailures.flatMap(({ photo, stages }) => {
    const shown = photos.find((p) => p.index === photo)
    if (photo === null || !shown || shown.dropped) return []
    if (stages.every((s) => failedParts.value.includes(s))) return []
    const failures = record.value?.failures?.filter((f) => f.photo === photo) ?? []
    return [{ photo, body: keptBody(failures[0]) }]
  })
})

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

// Tabs under the readings (design-system Tabs): Characteristics, Damage, Markings. A tab shows once its part
// has arrived. Damage is left out after a failed damage request: the error notice names it as not checked,
// and "not assessed in this inspection" would be untrue.
const slots = useSlots()
const showDamage = computed(
  () => !!slots.default && store.landed('damage') && store.stageState('damage') !== 'failed',
)
const tabs = computed(() => {
  const list: { id: DetailTab; label: string; count?: number }[] = []
  const details = !!record.value && detailsLanded.value
  if (details) list.push({ id: 'characteristics', label: 'Characteristics' })
  if (showDamage.value) {
    const count = record.value?.damage?.findings.length
    list.push({ id: 'damage', label: 'Damage', count: count || undefined })
  }
  if (details) list.push({ id: 'markings', label: 'Markings' })
  return list
})
/** The chosen tab, or the first one there is while the chosen one has not arrived. */
const activeTab = computed(() =>
  tabs.value.some((t) => t.id === detailTab.value) ? detailTab.value : tabs.value[0]?.id,
)
// Each inspection opens on Characteristics.
watch(
  () => record.value === null,
  (cleared) => {
    if (cleared) detailTab.value = 'characteristics'
  },
)

// Keyboard (WAI-ARIA tabs): arrows, Home and End move along the tabs and open the one they land on.
async function onTabKey(event: KeyboardEvent) {
  const ids = tabs.value.map((t) => t.id)
  const at = ids.indexOf(activeTab.value!)
  const to =
    event.key === 'ArrowRight'
      ? (at + 1) % ids.length
      : event.key === 'ArrowLeft'
        ? (at - 1 + ids.length) % ids.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? ids.length - 1
            : -1
  if (to < 0) return
  event.preventDefault()
  detailTab.value = ids[to]!
  await nextTick()
  document.getElementById(`detail-tab-${ids[to]}`)?.focus()
}
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

      <div
        v-for="failed in photoFailures"
        :key="`photo-${failed.photo}`"
        class="qs-notice qs-notice--error"
        role="alert"
      >
        <i class="qs-glyph qs-glyph--error" aria-hidden="true"></i>
        <div>
          <div class="qs-notice__title">Photo {{ failed.photo }} could not be read in full.</div>
          <div class="qs-notice__body">{{ failed.body }}</div>
        </div>
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
        :photos="photoUrls"
        :close-ups="{ id: idClose, type: isoClose, seal: sealClose }"
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

      <!-- Live: a live call on the same model. Demo: the sample's own recorded check. Never a replay against another photo. -->
      <section
        v-if="store.canCheckManifest && !differentContainers"
        class="rs-right"
        aria-live="polite"
      >
        <ManifestRetry />
      </section>

      <!-- What is not painted on the doors, one tab at a time. Every panel stays in the page; only one shows. -->
      <div v-if="tabs.length" class="qs-tabs">
        <div
          class="qs-tabs__list"
          role="tablist"
          aria-label="Inspection detail"
          @keydown="onTabKey"
        >
          <button
            v-for="tab in tabs"
            :id="`detail-tab-${tab.id}`"
            :key="tab.id"
            type="button"
            role="tab"
            class="qs-tabs__tab"
            :aria-selected="tab.id === activeTab ? 'true' : 'false'"
            :aria-controls="`detail-panel-${tab.id}`"
            :tabindex="tab.id === activeTab ? 0 : -1"
            @click="detailTab = tab.id"
          >
            {{ tab.label }}
            <span v-if="tab.count" class="qs-tabs__count">{{ tab.count }}</span>
          </button>
        </div>
        <div
          v-if="record && detailsLanded"
          v-show="activeTab === 'characteristics'"
          id="detail-panel-characteristics"
          class="qs-tabs__panel"
          role="tabpanel"
          aria-labelledby="detail-tab-characteristics"
          data-detail-tab="characteristics"
        >
          <ContainerDetails
            :record="record"
            :omit="LEDGER_DETAIL_LABELS"
            :units-toggle="false"
            :class="{ 'qs-arrived': detailsEarly }"
          />
        </div>
        <div
          v-if="showDamage"
          v-show="activeTab === 'damage'"
          id="detail-panel-damage"
          class="qs-tabs__panel"
          role="tabpanel"
          aria-labelledby="detail-tab-damage"
          data-detail-tab="damage"
        >
          <slot />
        </div>
        <div
          v-if="record && detailsLanded"
          v-show="activeTab === 'markings'"
          id="detail-panel-markings"
          class="qs-tabs__panel"
          role="tabpanel"
          aria-labelledby="detail-tab-markings"
          data-detail-tab="markings"
        >
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
        </div>
      </div>

      <ExportActions v-if="!running" />
    </div>
  </div>
</template>
