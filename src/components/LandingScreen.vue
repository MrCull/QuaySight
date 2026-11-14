<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { useSetupStore } from '../stores/setup'
import { getProvider, providers } from '../domain/providers'
import { keyFormatWarning } from '../domain/keyGate'
import { focusNextStep } from './nextStepFocus'
import CertaintyChip from './CertaintyChip.vue'
import {
  CONTAINER_ID,
  POINTERS,
  TYPE_READING,
  WEIGHTS_CERTAINTY,
  WEIGHT_ROWS,
  boxStyle,
} from './landingReadings'
import doors from '../../samples/jdlu-200690-1-rear-doors.jpg'

// design-system/components/Landing: the first screen. Pick a provider, paste its key, Start. Each provider's
// recommended model is used; the settings chip on the inspection screen changes it. Try the demo needs no key.
// Beside the copy, the bundled JDLU rear-doors photo and what was read from it: static decoration.
const store = useInspectionStore()
const setup = useSetupStore()
const key = useTemplateRef<HTMLInputElement>('key')

const copy = computed(() => getProvider(store.provider).keyField)
// Advice only: it never closes the gate and never repeats the key.
const keyWarning = computed(() => keyFormatWarning(store.provider, store.apiKey))

// Shown after Start is pressed without a key; goes once a key makes Start ready.
const needsKey = ref(false)
watch(
  () => setup.canContinue,
  (ready) => {
    if (ready) needsKey.value = false
  },
)

// After Start, the photo drop zone is the next step. Without a key, Start points to the key field instead:
// it is never drawn as switched off, so pressing it has to say what is missing.
function start() {
  if (setup.continueToInspection()) {
    void focusNextStep('photo')
    return
  }
  needsKey.value = true
  key.value?.focus()
}

// Arrow keys move the choice, as in any radio group.
function onPickKey(event: KeyboardEvent) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
  if (!step) return
  event.preventDefault()
  const index = providers.findIndex((p) => p.id === store.provider)
  const next = providers[(index + step + providers.length) % providers.length]!
  setup.chooseProvider(next.id)
  const group = event.currentTarget as HTMLElement
  group.querySelector<HTMLElement>(`[data-testid="provider-option-${next.id}"]`)?.focus()
}

// The photo is hung from the landing's measured height (--h). Each leader line is measured from the laid-out
// reading to the left edge of its first outline, at mid-height: horizontal, vertical, horizontal.
// jsdom has no layout and no ResizeObserver, so there nothing is measured or drawn.
const page = useTemplateRef<HTMLElement>('page')
const height = ref(844)
const links = ref<{ key: string; d: string; x: number; y: number }[]>([])
let observer: ResizeObserver | undefined

function measure() {
  const root = page.value
  if (!root) return
  height.value = root.clientHeight || height.value
  void nextTick(() => {
    const origin = root.getBoundingClientRect()
    const panel = root.querySelector('.qs-landing__panel')?.getBoundingClientRect()
    // Narrow screens stack the photo and cards and draw no lines; the SVG is hidden there.
    const svg = root.querySelector<SVGElement>('.qs-landing__links')
    if (!panel || !svg || getComputedStyle(svg).display === 'none') {
      links.value = []
      return
    }
    links.value = POINTERS.flatMap((p, n) => {
      const row = root.querySelector(`[data-row="${p.key}"]`)?.getBoundingClientRect()
      const box = root.querySelector(`[data-box="${p.key}"]`)?.getBoundingClientRect()
      if (!row || !box) return []
      const x0 = panel.right - origin.left
      const y0 = row.top + row.height / 2 - origin.top
      const x1 = box.left - origin.left
      const y1 = box.top + box.height / 2 - origin.top
      // Each line bends a little further out than the one below it, so the verticals never overlap.
      const bend = x0 + 14 + (POINTERS.length - 1 - n) * 8
      return [{ key: p.key, d: `M${x0} ${y0}H${bend}V${y1}H${x1}`, x: x1, y: y1 }]
    })
  })
}

onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !page.value) return
  measure()
  observer = new ResizeObserver(measure)
  observer.observe(page.value)
  void document.fonts?.ready.then(measure)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <main ref="page" class="qs-landing">
    <div class="qs-landing__stage" :style="`--h: ${height}px`">
      <figure class="qs-landing__photo" aria-hidden="true">
        <img :src="doors" alt="" />
        <template v-for="(p, n) in POINTERS" :key="p.key">
          <i
            v-for="(o, k) in p.outlines"
            :key="k"
            :data-box="k === 0 ? p.key : undefined"
            class="qs-landing__box"
            :style="`--i: ${n}; ${boxStyle(o.box)}`"
            ><b v-if="o.caption">{{ o.caption }}</b></i
          >
        </template>
      </figure>
      <i class="qs-landing__shade" aria-hidden="true"></i>

      <p class="qs-landing__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>

      <section class="qs-landing__lead">
        <h1 class="qs-landing__title">The whole <em>Quay</em>, <br />in <em>Sight</em>.</h1>
        <p class="qs-landing__sub">To OCR, and beyond…</p>
        <form class="qs-landing__field" novalidate @submit.prevent="start">
          <div
            class="qs-landing__pick"
            role="radiogroup"
            aria-label="AI provider"
            @keydown="onPickKey"
          >
            <button
              v-for="p in providers"
              :key="p.id"
              type="button"
              role="radio"
              class="qs-landing__opt"
              :data-testid="`provider-option-${p.id}`"
              :aria-checked="p.id === store.provider ? 'true' : 'false'"
              :tabindex="p.id === store.provider ? 0 : -1"
              @click="setup.chooseProvider(p.id)"
            >
              {{ p.name }}
            </button>
          </div>
          <input
            :id="`${store.provider}-key`"
            ref="key"
            class="qs-landing__key"
            type="password"
            autocomplete="off"
            spellcheck="false"
            placeholder="API key"
            :value="store.apiKey"
            :aria-label="copy.label"
            :aria-describedby="
              needsKey ? 'landing-needs-key' : keyWarning ? 'landing-key-format' : undefined
            "
            @input="store.setApiKey(($event.target as HTMLInputElement).value)"
          />
          <!-- Enter in the key field submits the form; the button starts on its own click. -->
          <button
            type="button"
            class="qs-landing__go"
            :aria-disabled="!setup.canContinue"
            @click="start"
          >
            Start
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M4 12h16M14 6l6 6-6 6" />
            </svg>
          </button>
        </form>
        <p v-if="needsKey" id="landing-needs-key" class="qs-landing__hint" role="status">
          Paste your API key to start.
        </p>
        <p v-else-if="keyWarning" id="landing-key-format" class="qs-landing__hint" role="status">
          <b>This doesn't look like an {{ keyWarning.provider }} key.</b>
          {{ keyWarning.provider }} keys start with <code>{{ keyWarning.prefix }}</code
          >. If yours is right, you can still start.
        </p>
        <p class="qs-landing__note">
          Never stored. Your key lives in this tab and goes only to your provider.
        </p>
        <div class="qs-landing__patch">
          <p><b>No key to hand?</b> Open a sample container and see what it read. No charge.</p>
          <button type="button" class="qs-landing__demo" @click="setup.enterDemo()">
            Try the demo
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M4 12h16M14 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </section>

      <svg class="qs-landing__links" aria-hidden="true">
        <g v-for="(l, n) in links" :key="l.key" class="qs-landing__link" :style="`--i: ${n}`">
          <path :d="l.d" pathLength="1" />
          <circle :cx="l.x" :cy="l.y" r="4" />
        </g>
      </svg>

      <section class="qs-landing__panel" aria-label="Read from a sample photo">
        <div class="qs-landing__card qs-landing__card--id" data-row="id" style="--i: 0">
          <span class="qs-landing__k"><b>01</b>Container ID</span>
          <span
            class="qs-id qs-id--md"
            role="img"
            aria-label="J D L U, 2 0 0, 6 9 0, check digit 2"
          >
            <span class="qs-id__group"
              ><span v-for="(c, k) in CONTAINER_ID.owner" :key="k" class="qs-id__ch">{{
                c
              }}</span></span
            >
            <span v-for="group in CONTAINER_ID.serial" :key="group" class="qs-id__group"
              ><span v-for="(c, k) in group" :key="k" class="qs-id__ch">{{ c }}</span></span
            >
            <span class="qs-id__check">{{ CONTAINER_ID.check }}</span>
          </span>
          <span class="qs-landing__meta">
            <CertaintyChip level="Confident" />
            <span class="qs-prov qs-prov--calculated">Check digit valid</span>
          </span>
        </div>
        <div class="qs-landing__card" data-row="type" style="--i: 1">
          <span class="qs-landing__k"><b>02</b>Size and type</span>
          <span class="qs-landing__v qs-landing__v--code"
            >{{ TYPE_READING.code }} <small>{{ TYPE_READING.meaning }}</small></span
          >
          <CertaintyChip level="Confident" />
        </div>
        <div class="qs-landing__card qs-landing__card--weights" style="--i: 2">
          <span class="qs-landing__k"><b>03</b>Weights</span>
          <CertaintyChip :level="WEIGHTS_CERTAINTY" />
          <dl>
            <div v-for="w in WEIGHT_ROWS" :key="w.key" :data-row="w.key">
              <dt>{{ w.label }}</dt>
              <dd>{{ w.value }}</dd>
            </div>
          </dl>
        </div>
        <div class="qs-landing__card" data-row="marking" style="--i: 3">
          <span class="qs-landing__k"><b>04</b>Marking</span>
          <span class="qs-landing__v">Super heavy <small>No DG placard visible</small></span>
          <CertaintyChip level="Confident" />
        </div>
        <div class="qs-landing__card" style="--i: 4">
          <span class="qs-landing__k"><b>05</b>Seal</span>
          <span class="qs-landing__v">Not in this photo</span>
          <CertaintyChip level="Not seen" />
        </div>
      </section>
    </div>
  </main>
</template>
