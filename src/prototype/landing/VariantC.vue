<script setup lang="ts">
// PROTOTYPE variant C, "Door markings": the page is a container's rear doors, drawn in CSS. The headline and
// the facts are stencilled where a door carries its ID and weights, the key field is the riveted data plate,
// and the demo is a label stuck on the right leaf. No photographs.
import ProtoKeyField from './ProtoKeyField.vue'
import CertaintyChip from '../../components/CertaintyChip.vue'
import { useSetupStore } from '../../stores/setup'

const setup = useSetupStore()
const MARKINGS = [
  ['From', 'Your photos'],
  ['Reads', 'ID · Weights · Seal'],
  ['Finds', 'Placards · Damage'],
  ['Photos', '1–5 per container'],
  ['Spend cap', '$0.50 an inspection'],
]
</script>

<template>
  <main class="lc">
    <div class="lc__door">
      <i
        v-for="n in 4"
        :key="n"
        :class="`qs-logo lc__casting lc__casting--${n}`"
        aria-hidden="true"
      ></i>

      <section class="lc__leaf lc__leaf--left">
        <i class="lc__rod lc__rod--outer" aria-hidden="true"></i>
        <i class="lc__rod lc__rod--inner" aria-hidden="true"><b></b></i>
        <p class="lc__owner"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
        <h1 class="lc__title">Read<br />the box.</h1>
        <div class="lc__plate">
          <p class="lc__plate-head">
            <span>Inspect a container</span><span>OpenRouter or OpenAI key</span>
          </p>
          <ProtoKeyField :demo="false" />
        </div>
      </section>

      <section class="lc__leaf lc__leaf--right">
        <i class="lc__rod lc__rod--inner" aria-hidden="true"><b></b></i>
        <i class="lc__rod lc__rod--outer" aria-hidden="true"></i>
        <div class="lc__id">
          <p>JDLU <span>200690</span> <b>2</b></p>
          <p>22G1</p>
          <span class="lc__sample">Sample reading <CertaintyChip level="Confident" /></span>
        </div>
        <dl class="lc__table">
          <div v-for="[label, value] in MARKINGS" :key="value">
            <dt>{{ label }}</dt>
            <dd>{{ value }}</dd>
          </div>
        </dl>
        <div class="lc__foot">
          <div class="lc__label">
            <p><b>No key to hand?</b> Open a sample container and see what it read. No charge.</p>
            <button type="button" @click="setup.enterDemo()">
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
          <p class="lc__caveat">Observations and estimates.<br />Not a certified survey.</p>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.lc {
  --paint: var(--landing-ink);
  --paint-hi: color-mix(in srgb, var(--landing-ink) 91%, var(--landing-on-ink));
  --paint-lo: color-mix(in srgb, var(--landing-ink) 80%, black);
  --stencil: color-mix(in srgb, var(--landing-on-ink) 94%, var(--landing-ink));
  --steel: var(--schem-rail);
  --steel-hi: var(--schem-top);
  --steel-lo: var(--schem-detail);
  --pad: clamp(var(--space-6), 5.5vw, 104px);
  flex: 1;
  display: flex;
  padding: var(--space-4) var(--space-4) 0;
  background: var(--landing-bg);
}
.lc__door {
  position: relative;
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-height: 720px;
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--paint-lo);
  color: var(--stencil);
  box-shadow: var(--shadow-landing);
}

/* Corner castings: the logo is one */
.lc__casting {
  position: absolute;
  z-index: 2;
  width: 34px;
  height: 34px;
  color: var(--paint-hi);
}
.lc__casting--1 {
  left: 0;
  top: 0;
}
.lc__casting--2 {
  right: 0;
  top: 0;
}
.lc__casting--3 {
  left: 0;
  bottom: 0;
}
.lc__casting--4 {
  right: 0;
  bottom: 0;
}

/* Two leaves of pressed steel */
.lc__leaf {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: var(--space-7) var(--pad);
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, black 28%, transparent),
      transparent 6%,
      transparent 94%,
      color-mix(in srgb, black 28%, transparent)
    ),
    repeating-linear-gradient(
      180deg,
      var(--paint) 0 84px,
      var(--paint-lo) 84px 88px,
      var(--paint-hi) 88px 150px,
      color-mix(in srgb, var(--paint-hi) 80%, var(--landing-on-ink)) 150px 152px,
      var(--paint) 152px 156px
    );
}
.lc__leaf--left {
  border-right: 3px solid var(--paint-lo);
  animation: lc-swing 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  transform-origin: left;
}
.lc__leaf--right {
  border-left: 3px solid var(--paint-lo);
  animation: lc-swing 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  transform-origin: right;
}

/* Lock rods, brackets and handles */
.lc__rod {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 30px;
  background:
    linear-gradient(var(--steel), var(--steel)) 0 9% / 30px 18px no-repeat,
    linear-gradient(var(--steel), var(--steel)) 0 50% / 30px 18px no-repeat,
    linear-gradient(var(--steel), var(--steel)) 0 91% / 30px 18px no-repeat,
    linear-gradient(90deg, var(--steel-lo), var(--steel-hi) 45%, var(--steel) 70%, var(--steel-lo))
      50% 0 / 10px 100% no-repeat;
  filter: drop-shadow(3px 2px 3px color-mix(in srgb, black 45%, transparent));
}
.lc__leaf--left .lc__rod--outer {
  left: calc(var(--pad) * 0.34);
}
.lc__leaf--left .lc__rod--inner {
  right: calc(var(--pad) * 0.34);
}
.lc__leaf--right .lc__rod--inner {
  left: calc(var(--pad) * 0.34);
}
.lc__leaf--right .lc__rod--outer {
  right: calc(var(--pad) * 0.34);
}
.lc__rod b {
  position: absolute;
  top: 68%;
  width: calc(var(--pad) * 0.9);
  height: 10px;
  border-radius: var(--radius-pill);
  background: linear-gradient(180deg, var(--steel-hi), var(--steel) 55%, var(--steel-lo));
}
.lc__rod b::after {
  content: '';
  position: absolute;
  top: -7px;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  background: var(--steel);
}
.lc__leaf--left .lc__rod b {
  right: 2px;
}
.lc__leaf--left .lc__rod b::after {
  right: 0;
}
.lc__leaf--right .lc__rod b {
  left: 2px;
}
.lc__leaf--right .lc__rod b::after {
  left: 0;
}

/* Left leaf: owner line, headline, data plate */
.lc__owner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 600 1.75rem/1 var(--font-display);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.lc__owner .qs-logo {
  width: 30px;
  height: 30px;
  color: inherit;
}
.lc__title {
  margin: auto 0;
  padding-block: var(--space-6);
  font: 600 clamp(4.5rem, 12.5vw, 15rem)/0.84 var(--font-display);
  letter-spacing: 0.005em;
  text-transform: uppercase;
}
.lc__plate {
  --lp-align: stretch;
  --lp-field-width: 100%;
  --lp-field-radius: var(--radius-sm);
  --lp-field-inner-radius: var(--radius-xs);
  --lp-field-shadow: inset 0 0 0 1px var(--line-strong);
  --lp-field-bg: var(--landing-surface);
  position: relative;
  padding: var(--space-4) var(--space-5) var(--space-3);
  border-radius: var(--radius-sm);
  background:
    radial-gradient(circle at 10px 10px, var(--steel-lo) 0 2.5px, transparent 3px),
    radial-gradient(circle at calc(100% - 10px) 10px, var(--steel-lo) 0 2.5px, transparent 3px),
    radial-gradient(circle at 10px calc(100% - 10px), var(--steel-lo) 0 2.5px, transparent 3px),
    radial-gradient(
      circle at calc(100% - 10px) calc(100% - 10px),
      var(--steel-lo) 0 2.5px,
      transparent 3px
    ),
    linear-gradient(135deg, var(--landing-bg), var(--steel-hi) 50%, var(--landing-bg));
  color: var(--landing-ink);
  box-shadow: 0 10px 24px -12px black;
}
[data-theme='dark'] .lc__plate {
  box-shadow: var(--shadow-landing);
}
.lc__plate-head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  margin: 0 var(--space-1) var(--space-3);
  font: 600 0.75rem/1 var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.lc__plate-head span:last-child {
  color: var(--landing-ink-muted);
}

/* Right leaf: ID, markings table, label */
.lc__id {
  position: relative;
  align-self: end;
  text-align: right;
}
.lc__id p {
  margin: 0;
  font: 500 clamp(2.5rem, 4.6vw, 5rem)/1.05 var(--font-display);
  letter-spacing: 0.06em;
}
.lc__id p span {
  margin-left: 0.4em;
}
.lc__id p b {
  display: inline-block;
  margin-left: 0.15em;
  padding: 0 0.16em;
  border: 0.045em solid currentColor;
  font-weight: 500;
  line-height: 0.95;
}
.lc__sample {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--landing-surface);
  color: var(--landing-ink-muted);
  font: 500 0.75rem/1 var(--font-sans);
}
.lc__table {
  display: grid;
  gap: var(--space-1);
  align-self: end;
  width: min(100%, 520px);
  margin: auto 0;
  padding-block: var(--space-5);
}
.lc__table div {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: baseline;
  gap: var(--space-4);
}
.lc__table dt,
.lc__table dd {
  margin: 0;
  font: 500 clamp(1.5rem, 2.5vw, 2.5rem)/1.12 var(--font-display);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}
.lc__table dd {
  text-align: right;
}
.lc__foot {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-5);
}
.lc__label {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  width: 280px;
  padding: var(--space-4);
  border-radius: var(--radius-xs);
  background: var(--landing-surface);
  color: var(--landing-ink);
  box-shadow: 0 10px 24px -14px black;
  rotate: -1.2deg;
}
.lc__label p {
  margin: 0;
  font: 400 0.875rem/1.25rem var(--font-sans);
}
.lc__label button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--control-md);
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-xs);
  background: var(--landing-ink);
  color: var(--landing-on-ink);
  font: 600 0.875rem/1 var(--font-sans);
  cursor: pointer;
}
.lc__label button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.lc__label svg {
  width: 16px;
  height: 16px;
}
.lc__caveat {
  margin: 0;
  font: 500 0.875rem/1.25rem var(--font-display);
  letter-spacing: 0.1em;
  text-align: right;
  text-transform: uppercase;
  opacity: 0.75;
}

@keyframes lc-swing {
  from {
    opacity: 0;
    transform: perspective(1600px) rotateY(var(--swing, 14deg));
  }
}
.lc__leaf--right {
  --swing: -14deg;
}
@media (prefers-reduced-motion: reduce) {
  .lc * {
    animation: none !important;
  }
}
@media (max-width: 900px) {
  .lc__door {
    grid-template-columns: minmax(0, 1fr);
  }
  .lc__rod,
  .lc__id {
    display: none;
  }
  .lc__foot {
    flex-direction: column;
    align-items: start;
  }
  .lc__caveat {
    text-align: left;
  }
}
</style>
