<script setup lang="ts">
// PROTOTYPE variant S1, "Rear doors": the page is a container's rear doors, front-on, drawn in CSS in shipping
// navy. The name is painted on the left leaf above the headline; the right leaf carries a sample ID where an
// ID goes and product facts where the weights table goes. The key field is the riveted data plate and the
// demo is a label stuck on the right leaf. No photographs.
import ProtoKeyField from './ProtoKeyField.vue'
import CertaintyChip from '../../components/CertaintyChip.vue'
import { useSetupStore } from '../../stores/setup'

const setup = useSetupStore()
const MARKINGS = [
  ['Reads', 'ID · Size · Weights · Seal'],
  ['Finds', 'Placards · Damage'],
  ['From', '1–5 photos'],
  ['Says', 'How sure it is'],
  ['Key', 'Stays in this tab'],
  ['Not', 'A certified survey'],
]
const HINGES = [9, 30, 51, 72, 91]
</script>

<template>
  <main class="ls1">
    <div class="ls1__box">
      <i v-for="n in 4" :key="n" :class="`qs-logo ls1__casting ls1__casting--${n}`" aria-hidden="true"></i>

      <section class="ls1__leaf ls1__leaf--left">
        <i v-for="y in HINGES" :key="y" class="ls1__hinge" :style="`top: ${y}%`" aria-hidden="true"></i>
        <i class="ls1__rod ls1__rod--outer" aria-hidden="true"><b></b></i>
        <i class="ls1__rod ls1__rod--inner" aria-hidden="true"><b></b></i>

        <p class="ls1__name"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
        <h1 class="ls1__title">Every box,<br />in plain sight.</h1>
        <div class="ls1__plate">
          <p class="ls1__plate-head">
            <span>Inspect a container</span><span>OpenRouter or OpenAI key</span>
          </p>
          <ProtoKeyField :demo="false" />
        </div>
      </section>

      <section class="ls1__leaf ls1__leaf--right">
        <i v-for="y in HINGES" :key="y" class="ls1__hinge" :style="`top: ${y}%`" aria-hidden="true"></i>
        <i class="ls1__rod ls1__rod--inner" aria-hidden="true"><b></b></i>
        <i class="ls1__rod ls1__rod--outer" aria-hidden="true"><b></b></i>

        <div class="ls1__id">
          <p>JDLU <span>200690</span> <b>2</b></p>
          <p>22G1</p>
          <span class="ls1__sample">Sample reading <CertaintyChip level="Confident" /></span>
        </div>
        <dl class="ls1__table">
          <div v-for="[label, value] in MARKINGS" :key="label">
            <dt>{{ label }}</dt>
            <dd>{{ value }}</dd>
          </div>
        </dl>
        <div class="ls1__label">
          <p><b>No key to hand?</b> Open a sample container and see what was read from it. No charge.</p>
          <button type="button" @click="setup.enterDemo()">
            Try the demo
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6" /></svg>
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.ls1 {
  --paint: var(--brand);
  --paint-hi: color-mix(in srgb, var(--brand) 84%, white);
  --paint-lo: color-mix(in srgb, var(--brand) 76%, black);
  --paint-deep: color-mix(in srgb, var(--brand) 52%, black);
  --stencil: color-mix(in srgb, var(--on-brand) 94%, var(--brand));
  --steel: var(--schem-rail);
  --steel-hi: var(--schem-top);
  --steel-lo: var(--schem-detail);
  --pad: clamp(3.5rem, 6.4vw, 8rem);
  flex: 1;
  display: flex;
  padding: var(--space-4) var(--space-4) 0;
  background: var(--landing-bg);
}

/* The frame: header, sill and corner posts */
.ls1__box {
  position: relative;
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-height: 740px;
  padding: var(--space-5) var(--space-4);
  border-radius: var(--radius-sm);
  background:
    linear-gradient(180deg, color-mix(in srgb, white 16%, transparent), transparent 3%, transparent 96%, color-mix(in srgb, black 40%, transparent)),
    linear-gradient(90deg, var(--paint-deep), var(--paint-lo) 1.2%, var(--paint-deep) 2.4%, var(--paint-deep) 97.6%, var(--paint-lo) 98.8%, var(--paint-deep));
  color: var(--stencil);
  box-shadow: var(--shadow-landing);
}
.ls1__casting {
  position: absolute;
  z-index: 3;
  width: 38px;
  height: 38px;
  color: var(--paint-hi);
  filter: drop-shadow(0 1px 1px color-mix(in srgb, black 60%, transparent));
}
.ls1__casting--1 { left: 0; top: 0; }
.ls1__casting--2 { right: 0; top: 0; }
.ls1__casting--3 { left: 0; bottom: 0; }
.ls1__casting--4 { right: 0; bottom: 0; }

/* A leaf: pressed panels between a rubber gasket */
.ls1__leaf {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: var(--space-6) var(--pad) var(--space-6);
  border: 3px solid var(--paint-deep);
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb, white 10%, transparent),
    inset 0 0 0 5px color-mix(in srgb, black 22%, transparent);
  background:
    linear-gradient(90deg, color-mix(in srgb, black 30%, transparent), transparent 5%, transparent 95%, color-mix(in srgb, black 30%, transparent)),
    repeating-linear-gradient(
      180deg,
      var(--paint) 0,
      var(--paint) 5.2rem,
      var(--paint-lo) 5.5rem,
      var(--paint-deep) 5.75rem,
      color-mix(in srgb, var(--paint) 88%, black) 6rem,
      color-mix(in srgb, var(--paint) 92%, black) 9.2rem,
      var(--paint-hi) 9.5rem,
      color-mix(in srgb, var(--paint-hi) 70%, white) 9.65rem,
      var(--paint) 9.9rem
    );
}
.ls1__leaf--left {
  margin-right: 2px;
  animation: ls1-swing 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  transform-origin: left;
}
.ls1__leaf--right {
  --swing: -12deg;
  margin-left: 2px;
  animation: ls1-swing 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  transform-origin: right;
}

/* Hinges on the corner posts */
.ls1__hinge {
  position: absolute;
  z-index: 2;
  width: 46px;
  height: 18px;
  border-radius: var(--radius-xs);
  background:
    radial-gradient(circle at 34px 9px, var(--paint-deep) 0 2.5px, transparent 3px),
    linear-gradient(180deg, var(--paint-hi), var(--paint) 45%, var(--paint-lo));
  box-shadow: 0 2px 3px color-mix(in srgb, black 45%, transparent);
  translate: 0 -50%;
}
.ls1__hinge::before {
  content: '';
  position: absolute;
  top: -3px;
  width: 12px;
  height: 24px;
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, var(--paint-lo), var(--paint-hi) 50%, var(--paint-lo));
}
.ls1__leaf--left .ls1__hinge { left: -14px; }
.ls1__leaf--left .ls1__hinge::before { left: 0; }
.ls1__leaf--right .ls1__hinge { right: -14px; background-position-x: -22px, 0; }
.ls1__leaf--right .ls1__hinge::before { right: 0; }

/* Lock rods: tube, guide brackets, cam keepers and handle */
.ls1__rod {
  position: absolute;
  z-index: 1;
  top: -6px;
  bottom: -6px;
  width: 34px;
  background:
    linear-gradient(var(--steel-lo), var(--steel-lo)) 50% 0 / 30px 20px no-repeat,
    linear-gradient(var(--steel-lo), var(--steel-lo)) 50% 100% / 30px 20px no-repeat,
    linear-gradient(180deg, var(--steel-hi), var(--steel) 60%, var(--steel-lo)) 0 13% / 34px 20px no-repeat,
    linear-gradient(180deg, var(--steel-hi), var(--steel) 60%, var(--steel-lo)) 0 40% / 34px 20px no-repeat,
    linear-gradient(180deg, var(--steel-hi), var(--steel) 60%, var(--steel-lo)) 0 87% / 34px 20px no-repeat,
    linear-gradient(90deg, var(--steel-lo), var(--steel-hi) 38%, var(--steel) 64%, var(--steel-lo)) 50% 0 / 11px 100% no-repeat;
  filter: drop-shadow(4px 3px 3px color-mix(in srgb, black 45%, transparent));
}
.ls1__leaf--left .ls1__rod--outer { left: calc(var(--pad) * 0.3); }
.ls1__leaf--left .ls1__rod--inner { right: calc(var(--pad) * 0.3); }
.ls1__leaf--right .ls1__rod--inner { left: calc(var(--pad) * 0.3); }
.ls1__leaf--right .ls1__rod--outer { right: calc(var(--pad) * 0.3); }
.ls1__rod b {
  position: absolute;
  top: 71.5%;
  width: calc(var(--pad) * 1.15);
  height: 11px;
  border-radius: var(--radius-pill);
  background: linear-gradient(180deg, var(--steel-hi), var(--steel) 55%, var(--steel-lo));
}
.ls1__rod b::before,
.ls1__rod b::after {
  content: '';
  position: absolute;
  top: -8px;
  width: 26px;
  height: 27px;
  border-radius: var(--radius-sm);
  background: linear-gradient(180deg, var(--steel-hi), var(--steel) 50%, var(--steel-lo));
}
.ls1__rod b::after {
  top: -5px;
  width: 16px;
  height: 21px;
  background: var(--steel-lo);
}
.ls1__rod--outer b { top: 68%; }
.ls1__leaf--left .ls1__rod--outer b,
.ls1__leaf--right .ls1__rod--inner b { left: 4px; }
.ls1__leaf--left .ls1__rod--outer b::before,
.ls1__leaf--right .ls1__rod--inner b::before { left: 0; }
.ls1__leaf--left .ls1__rod--outer b::after,
.ls1__leaf--right .ls1__rod--inner b::after { right: 6px; }
.ls1__leaf--left .ls1__rod--inner b,
.ls1__leaf--right .ls1__rod--outer b { right: 4px; }
.ls1__leaf--left .ls1__rod--inner b::before,
.ls1__leaf--right .ls1__rod--outer b::before { right: 0; }
.ls1__leaf--left .ls1__rod--inner b::after,
.ls1__leaf--right .ls1__rod--outer b::after { left: 6px; }

/* Left leaf: the name, the headline, the data plate */
.ls1__name {
  display: flex;
  align-items: center;
  gap: 0.28em;
  margin: 0;
  font: 700 clamp(2.5rem, 4.3vw, 5.25rem)/1 var(--font-display);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}
.ls1__name .qs-logo {
  width: 0.92em;
  height: 0.92em;
  color: inherit;
}
.ls1__title {
  margin: auto 0;
  padding-block: var(--space-5);
  font: 600 clamp(3.25rem, 6.5vw, 8.25rem)/0.88 var(--font-display);
  letter-spacing: 0.012em;
  text-transform: uppercase;
  white-space: nowrap;
}
.ls1__plate {
  --lp-align: stretch;
  --lp-field-width: 100%;
  --lp-field-radius: var(--radius-sm);
  --lp-field-inner-radius: var(--radius-xs);
  --lp-field-shadow: inset 0 0 0 1px var(--line-strong);
  --lp-field-bg: var(--landing-surface);
  position: relative;
  z-index: 2;
  padding: var(--space-4) var(--space-5) var(--space-3);
  border-radius: var(--radius-sm);
  background:
    radial-gradient(circle at 10px 10px, var(--steel-lo) 0 2.5px, transparent 3px),
    radial-gradient(circle at calc(100% - 10px) 10px, var(--steel-lo) 0 2.5px, transparent 3px),
    radial-gradient(circle at 10px calc(100% - 10px), var(--steel-lo) 0 2.5px, transparent 3px),
    radial-gradient(circle at calc(100% - 10px) calc(100% - 10px), var(--steel-lo) 0 2.5px, transparent 3px),
    linear-gradient(135deg, var(--landing-bg), var(--steel-hi) 50%, var(--landing-bg));
  color: var(--landing-ink);
  box-shadow: 0 12px 24px -12px black;
}
.ls1__plate-head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  margin: 0 var(--space-1) var(--space-3);
  font: 600 0.75rem/1 var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ls1__plate-head span:last-child {
  color: var(--landing-ink-muted);
}

/* Right leaf: ID line, markings table, demo label */
.ls1__id {
  align-self: end;
  text-align: right;
}
.ls1__id p {
  margin: 0;
  font: 500 clamp(2.25rem, 4.1vw, 4.75rem)/1.06 var(--font-display);
  letter-spacing: 0.06em;
  white-space: nowrap;
}
.ls1__id p span {
  margin-left: 0.35em;
}
.ls1__id p b {
  display: inline-block;
  margin-left: 0.12em;
  padding: 0 0.16em;
  border: 0.045em solid currentColor;
  font-weight: 500;
  line-height: 0.95;
}
.ls1__sample {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--landing-surface);
  color: var(--landing-ink-muted);
  font: 500 0.75rem/1 var(--font-sans);
}
.ls1__table {
  display: grid;
  gap: 0.1em;
  align-self: end;
  width: min(100%, 34rem);
  margin: auto 0;
  padding-block: var(--space-4);
  font: 500 clamp(1.375rem, 2.25vw, 2.5rem)/1.14 var(--font-display);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.ls1__table div {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: baseline;
  gap: var(--space-5);
}
.ls1__table dd {
  margin: 0;
  text-align: right;
  white-space: nowrap;
}
.ls1__label {
  position: relative;
  z-index: 2;
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  align-self: start;
  width: 18rem;
  padding: var(--space-4);
  border-radius: var(--radius-xs);
  background: var(--landing-surface);
  color: var(--landing-ink);
  box-shadow: 0 10px 24px -14px black;
  rotate: -1.2deg;
}
.ls1__label p {
  margin: 0;
  font: 400 0.875rem/1.25rem var(--font-sans);
}
.ls1__label button {
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
.ls1__label button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.ls1__label svg {
  width: 16px;
  height: 16px;
}

@keyframes ls1-swing {
  from {
    opacity: 0;
    transform: perspective(1600px) rotateY(var(--swing, 12deg));
  }
}
@media (prefers-reduced-motion: reduce) {
  .ls1 * {
    animation: none !important;
  }
}
@media (max-width: 1000px) {
  .ls1__box {
    grid-template-columns: minmax(0, 1fr);
  }
  .ls1__leaf {
    padding-inline: var(--space-5);
  }
  .ls1__rod,
  .ls1__hinge,
  .ls1__id {
    display: none;
  }
  .ls1__title {
    white-space: normal;
  }
  .ls1__table {
    font-size: 1.25rem;
  }
}
</style>
