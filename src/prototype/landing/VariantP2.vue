<script setup lang="ts">
// PROTOTYPE variant P2, "Pointers, numbered": words, key field and a numbered legend on the left; the gate
// picture full height on the right with a numbered pin on each area that was read. Pointing at a legend
// row lights its pin, and the other way round. The ID is Uncertain because the check digit painted in this
// picture (8) does not agree with the ISO 6346 calculation (9).
import { ref } from 'vue'
import GateScene from './GateScene.vue'
import ProtoKeyField from './ProtoKeyField.vue'
import CertaintyChip from '../../components/CertaintyChip.vue'
import type { CertaintyLabel } from '../../domain/inspection'

interface Pointer {
  key: string
  glyph: string
  label: string
  value: string
  mono?: boolean
  note?: string
  certainty: CertaintyLabel
  pinned: boolean
}
const POINTERS: Pointer[] = [
  { key: 'id', glyph: 'tag', label: 'Container ID', value: 'CMAU 210375 8', mono: true, note: 'Painted 8, works out to 9', certainty: 'Uncertain', pinned: true },
  { key: 'type', glyph: 'container', label: 'Size and type', value: '22G1', mono: true, note: '20 ft general purpose', certainty: 'Confident', pinned: true },
  { key: 'weights', glyph: 'weight', label: 'Max gross', value: '30,480 kg', mono: true, note: 'Tare 2,185 kg', certainty: 'Confident', pinned: true },
  { key: 'cube', glyph: 'cube', label: 'Cubic capacity', value: '33.2 m³', mono: true, certainty: 'Confident', pinned: true },
  { key: 'plate', glyph: 'document', label: 'CSC plate', value: 'Too small to read', certainty: "Can't tell", pinned: true },
  { key: 'marking', glyph: 'hazard', label: 'Marking', value: 'Super heavy', note: 'No DG placard visible', certainty: 'Likely', pinned: true },
  { key: 'seal', glyph: 'padlock', label: 'Seal', value: 'Not in this picture', certainty: 'Not seen', pinned: false },
]
const active = ref<string | null>(null)
</script>

<template>
  <main class="lp2">
    <section class="lp2__copy">
      <p class="lp2__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>

      <div class="lp2__lead">
        <h1 class="lp2__title">If it's on the quay,<br />it's in sight.</h1>
        <p class="lp2__sub">
          Photograph a container. Each thing Quay Sight reads is pinned to the place it was read,
          with a plain word for how sure it is.
        </p>
        <ProtoKeyField />
      </div>

      <div class="lp2__legend">
        <p class="lp2__legend-head"><span>Read from the sample picture</span><span>How sure</span></p>
        <ol @mouseleave="active = null">
          <li
            v-for="(p, n) in POINTERS"
            :key="p.key"
            :class="{ 'lp2__row--on': active === p.key, 'lp2__row--unpinned': !p.pinned }"
            :style="`--i: ${n}`"
            @mouseenter="active = p.pinned ? p.key : null"
          >
            <span class="lp2__n">{{ n + 1 }}</span>
            <span class="lp2__k"
              ><i :class="`qs-glyph qs-glyph--${p.glyph}`" aria-hidden="true"></i>{{ p.label }}</span
            >
            <span class="lp2__v"
              ><b :class="{ 'lp2__mono': p.mono }">{{ p.value }}</b
              ><small v-if="p.note">{{ p.note }}</small></span
            >
            <CertaintyChip :level="p.certainty" />
          </li>
        </ol>
      </div>
    </section>

    <section class="lp2__stage" aria-label="A sample picture with numbered pins on each reading">
      <GateScene class="lp2__scene" :fy="0.02">
        <i class="lp2__beam" aria-hidden="true"></i>
        <template v-for="(p, n) in POINTERS" :key="p.key">
          <i
            v-if="p.pinned"
            :class="[`lp2__mark lp2__mark--${p.key}`, { 'lp2__mark--on': active === p.key, 'lp2__mark--dim': active && active !== p.key }]"
            :style="`--i: ${n}`"
            aria-hidden="true"
            @mouseenter="active = p.key"
            @mouseleave="active = null"
            ><b>{{ n + 1 }}</b></i
          >
        </template>
      </GateScene>
      <span class="lp2__tag"><i class="qs-glyph qs-glyph--recorded" aria-hidden="true"></i>Sample picture</span>
    </section>
  </main>
</template>

<style scoped>
.lp2 {
  --rule: color-mix(in srgb, var(--landing-ink) 14%, transparent);
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1fr);
  background: var(--landing-bg);
  color: var(--landing-ink);
}

/* Words, key field, legend */
.lp2__copy {
  --lp-align: start;
  --lp-field-width: 600px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: var(--space-5);
  min-width: 0;
  padding: var(--space-5) clamp(var(--space-5), 3.6vw, var(--space-8)) var(--space-4)
    clamp(var(--space-5), 4.6vw, calc(var(--space-8) * 1.4));
}
.lp2__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2rem/1 var(--font-hero);
  letter-spacing: -0.03em;
}
.lp2__brand .qs-logo {
  width: 46px;
  height: 46px;
  color: inherit;
}
.lp2__lead {
  align-self: center;
}
.lp2__title {
  margin: 0;
  font: 700 clamp(2.25rem, 4.05vw, 4.75rem)/0.98 var(--font-hero);
  white-space: nowrap;
  letter-spacing: -0.05em;
}
.lp2__sub {
  max-width: 34rem;
  margin: var(--space-4) 0 var(--space-5);
  color: var(--landing-ink-muted);
  font: 400 1.0625rem/1.625rem var(--font-sans);
  text-wrap: pretty;
}
.lp2__lead :deep(.lp-key__note) {
  margin-top: var(--space-3);
}

.lp2__legend-head {
  display: flex;
  justify-content: space-between;
  margin: 0;
  padding-bottom: var(--space-2);
  color: var(--landing-ink-muted);
  font: 500 0.6875rem/1 var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.lp2__legend ol {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1.5px solid var(--landing-ink);
}
.lp2__legend li {
  display: grid;
  grid-template-columns: 26px 9.25rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  min-height: 42px;
  padding: 0 var(--space-2);
  border-bottom: 1px solid var(--rule);
  transition: background-color var(--duration-fast);
  animation: lp2-rise var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(1300ms + var(--i) * 90ms);
}
.lp2__row--on {
  background: var(--landing-surface);
}
.lp2__n {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-pill);
  background: var(--landing-ink);
  color: var(--landing-on-ink);
  font: 600 0.75rem/1 var(--font-mono);
}
.lp2__row--unpinned .lp2__n {
  border: 1.5px dashed var(--line-strong);
  background: none;
  color: var(--landing-ink-muted);
}
.lp2__k {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--landing-ink-muted);
  font: 600 0.75rem/1.25rem var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}
.lp2__k .qs-glyph--hazard {
  color: var(--hazard-fg);
}
.lp2__v {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  min-width: 0;
  white-space: nowrap;
}
.lp2__v b {
  font: 600 0.9375rem/1.25rem var(--font-sans);
}
.lp2__v b.lp2__mono {
  font: 500 1rem/1.25rem var(--font-mono);
}
.lp2__v small {
  overflow: hidden;
  color: var(--landing-ink-muted);
  font: 400 0.8125rem/1.25rem var(--font-sans);
  text-overflow: ellipsis;
}

/* Picture and pins */
.lp2__stage {
  position: relative;
  min-height: 640px;
  margin: var(--space-4) var(--space-4) 0 0;
  overflow: hidden;
  border-radius: var(--radius-lg);
}
/* Larger than its window, so the doors fill it and the trailer falls below the edge. */
.lp2__scene {
  position: absolute;
  inset: -3% -19% -36% -25%;
}
.lp2__tag {
  position: absolute;
  right: var(--space-4);
  top: var(--space-4);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3) var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--landing-surface);
  font: 500 0.75rem/1.25rem var(--font-sans);
  box-shadow: var(--shadow-landing-chip);
}
.lp2__beam {
  position: absolute;
  left: 27.6%;
  top: 24.4%;
  width: 46.6%;
  height: 43%;
  overflow: hidden;
  pointer-events: none;
}
.lp2__beam::after {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 22%;
  border-bottom: 1.5px solid var(--landing-surface);
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--landing-surface) 34%, transparent));
  transform: translateY(-110%);
  animation: lp2-scan 1400ms cubic-bezier(0.45, 0, 0.25, 1) 250ms both;
}
.lp2__mark {
  --c: var(--landing-surface);
  position: absolute;
  border: 2px solid var(--c);
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--landing-ink) 30%, transparent);
  transition:
    opacity var(--duration-base),
    background-color var(--duration-base);
  animation: lp2-mark var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(1100ms + var(--i) * 110ms);
}
.lp2__mark b {
  position: absolute;
  right: calc(100% + 7px);
  top: 50%;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 2px solid var(--landing-surface);
  border-radius: var(--radius-pill);
  background: var(--landing-ink);
  color: var(--landing-on-ink);
  font: 600 0.8125rem/1 var(--font-mono);
  translate: 0 -50%;
  box-shadow: var(--shadow-landing-chip);
  transition: scale var(--duration-base);
}
.lp2__mark--on {
  background: color-mix(in srgb, var(--landing-surface) 22%, transparent);
}
.lp2__mark--on b {
  scale: 1.25;
}
.lp2__mark--dim {
  opacity: 0.35;
}
.lp2__mark--id { left: 55.2%; top: 31%; width: 17.2%; height: 3.5%; }
.lp2__mark--type { left: 62%; top: 34.4%; width: 6%; height: 2.6%; }
.lp2__mark--type b { right: auto; left: calc(100% + 7px); }
.lp2__mark--weights { left: 55.6%; top: 39.5%; width: 15.2%; height: 9%; }
.lp2__mark--cube { left: 55.6%; top: 48.8%; width: 15.2%; height: 3.2%; }
.lp2__mark--plate { left: 32.4%; top: 56%; width: 6.6%; height: 6.4%; }
.lp2__mark--marking { left: 63%; top: 55.8%; width: 6.6%; height: 5.4%; }

@keyframes lp2-scan {
  to {
    transform: translateY(460%);
    opacity: 0;
  }
}
@keyframes lp2-mark {
  from {
    opacity: 0;
    scale: 1.25;
  }
}
@keyframes lp2-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lp2 *,
  .lp2 *::after {
    animation: none !important;
    transition: none !important;
  }
}
@media (max-width: 1000px) {
  .lp2 {
    grid-template-columns: minmax(0, 1fr);
  }
  .lp2__stage {
    order: -1;
    min-height: 0;
    aspect-ratio: 1;
    margin: var(--space-4) var(--space-4) 0;
  }
  .lp2__legend li {
    grid-template-columns: 26px minmax(0, 1fr) auto;
    padding-block: var(--space-2);
  }
  .lp2__k {
    display: none;
  }
  .lp2__v {
    flex-direction: column;
    gap: 0;
    white-space: normal;
  }
}
</style>
