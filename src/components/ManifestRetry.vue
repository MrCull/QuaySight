<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { getProvider, labelsFor } from '../domain/providers'
import { MANIFEST_LIMIT, parseManifest } from '../domain/manifest'

// Optional manifest paste when the container ID was not identified (spec 3.2, design-system ManifestRetry).
// Neutral colours only: no certainty, severity or hazard styling on this panel.
const store = useInspectionStore()
const text = ref('')
const leaving = ref(false)
const closed = ref(false)
const tryAgainButton = ref<HTMLButtonElement | null>(null)
const LEAVE_MS = 200

const uid = useId()
const titleId = `${uid}-title`
const inputId = `${uid}-input`
const countId = `${uid}-count`
const costId = `${uid}-cost`

const parsed = computed(() => parseManifest(text.value))
const count = computed(() => parsed.value.ids.length)
const duplicates = computed(() => parsed.value.duplicates)
const overLimit = computed(() => count.value > MANIFEST_LIMIT)
const canCheck = computed(() => count.value > 0 && !overLimit.value)

const checking = computed(() => store.retry.status === 'checking')
const failed = computed(() => store.retry.status === 'error')
const provider = computed(() => getProvider(store.provider))
const runName = computed(() => labelsFor(store.provider, store.model).prose)

// Offered only while the ID is not identified and the presenter has not chosen Keep first result.
const offering = computed(
  () => store.record !== null && store.record.containerId === null && !store.retry.dismissed,
)
const visible = computed(() => !closed.value && (offering.value || leaving.value))

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

function startLeave() {
  if (leaving.value || closed.value) return
  if (reducedMotion()) {
    closed.value = true
    return
  }
  leaving.value = true
  setTimeout(() => {
    closed.value = true
  }, LEAVE_MS)
}

// A checked ID closes the panel; the new reading replaces the ID card in place.
watch(
  () => store.record?.containerId ?? null,
  (value) => {
    if (value !== null) startLeave()
  },
)

// After an error, focus moves to Try again.
watch(failed, async (isFailed) => {
  if (!isFailed) return
  await nextTick()
  tryAgainButton.value?.focus()
})

function check() {
  if (!canCheck.value) return
  void store.retryManifest(parsed.value.ids)
}

function tryAgain() {
  void store.retryManifest(store.retry.ids)
}

function keepFirstResult() {
  startLeave()
  store.dismissRetry()
}
</script>

<template>
  <section
    v-if="visible"
    :class="['qs-manifest', { 'is-leaving': leaving }]"
    :aria-labelledby="titleId"
  >
    <div class="qs-manifest__head">
      <i class="qs-glyph qs-glyph--list" aria-hidden="true"></i>
      <div>
        <h3 :id="titleId" class="qs-manifest__title">Container ID not identified</h3>
        <p class="qs-manifest__body">
          If you have the manifest, paste the container numbers and check again.
        </p>
      </div>
      <span class="qs-manifest__kicker">Optional</span>
    </div>

    <ol v-if="checking" class="qs-stages" aria-live="polite">
      <li class="qs-stage qs-stage--active">
        <span class="qs-stage__dot"></span>
        <span class="qs-stage__title">Checking against manifest</span>
        <span class="qs-stage__time"></span>
      </li>
      <li class="qs-stage">
        <span class="qs-stage__dot"></span>
        <span class="qs-stage__title">Reading the container ID again</span>
        <span class="qs-stage__time"></span>
      </li>
      <li class="qs-stage">
        <span class="qs-stage__dot"></span>
        <span class="qs-stage__title">Updating the result</span>
        <span class="qs-stage__time"></span>
      </li>
    </ol>

    <template v-else-if="failed">
      <div class="qs-notice qs-notice--error" role="alert">
        <i class="qs-glyph qs-glyph--error" aria-hidden="true"></i>
        <div>
          <div class="qs-notice__title">The check didn't finish</div>
          <div class="qs-notice__body">
            {{ provider.vendor }} said: "{{ store.retry.message }}" Your first result is unchanged.
          </div>
        </div>
      </div>
      <div class="qs-manifest__actions">
        <button ref="tryAgainButton" type="button" class="qs-btn qs-btn--primary" @click="tryAgain">
          Try again
        </button>
        <button type="button" class="qs-btn qs-btn--secondary" @click="keepFirstResult">
          Keep first result
        </button>
      </div>
      <p :id="costId" class="qs-manifest__cost">
        This replays a saved sample on <b>{{ runName }}</b
        >. No live call and no charge.
      </p>
    </template>

    <template v-else>
      <div class="qs-manifest__field">
        <label class="qs-manifest__label" :for="inputId">Container numbers from the manifest</label>
        <textarea
          :id="inputId"
          v-model="text"
          class="qs-manifest__input"
          rows="6"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="characters"
          placeholder="Paste from a manifest or spreadsheet. One per line, or separated by commas, tabs or spaces."
          :aria-describedby="`${countId} ${costId}`"
        ></textarea>
        <div :id="countId" class="qs-manifest__count" role="status" aria-live="polite">
          <span v-if="count > 0"
            ><b>{{ count }}</b>
            {{ count === 1 ? 'container number found' : 'container numbers found' }}</span
          >
          <span v-if="duplicates > 0"
            ><b>{{ duplicates }}</b>
            {{ duplicates === 1 ? 'duplicate ignored' : 'duplicates ignored' }}</span
          >
          <span v-if="overLimit" class="qs-manifest__limit"
            ><i class="qs-glyph qs-glyph--cross" aria-hidden="true"></i>Limit for this demo is 500.
            Remove some to continue.</span
          >
        </div>
      </div>
      <div class="qs-manifest__actions">
        <button
          type="button"
          class="qs-btn qs-btn--primary"
          :aria-disabled="canCheck ? undefined : 'true'"
          :aria-describedby="`${countId} ${costId}`"
          @click="check"
        >
          Check again with this manifest
        </button>
        <button type="button" class="qs-btn qs-btn--secondary" @click="keepFirstResult">
          Keep first result
        </button>
      </div>
      <p :id="costId" class="qs-manifest__cost">
        This replays a saved sample on <b>{{ runName }}</b
        >. No live call and no charge.
      </p>
    </template>
  </section>
</template>
