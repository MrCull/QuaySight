<script setup lang="ts">
// PROTOTYPE variant B, "Read at the gate": the product at work. Words and the key field on the left; on the
// right the picture runs the full height, with each reading bracketed where it is painted and listed in a
// panel at the foot, every one with its certainty. The ID is shown as Uncertain because the check digit
// painted in this picture (8) does not agree with the ISO 6346 calculation (9).
import GateScene from './GateScene.vue'
import ProtoKeyField from './ProtoKeyField.vue'
import CertaintyChip from '../../components/CertaintyChip.vue'
</script>

<template>
  <main class="lb">
    <section class="lb__copy">
      <p class="lb__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
      <div class="lb__lead">
        <p class="lb__eyebrow">Container inspection from photos</p>
        <h1 class="lb__title">Read any container from a photo.</h1>
        <p class="lb__sub">
          The ID, the weights, the seal, the placards and the damage, read from one to five photos.
          Every reading tells you how sure it is.
        </p>
        <ProtoKeyField />
      </div>
      <ul class="lb__facts">
        <li><b>Your key</b>Stays in this tab</li>
        <li><b>Spend cap</b>$0.50 an inspection</li>
        <li><b>Result</b>Not a certified survey</li>
      </ul>
    </section>

    <section class="lb__stage" aria-label="A sample picture with its readings">
      <GateScene class="lb__scene" :fy="0.08" :fx="0.55">
        <i class="lb__beam" aria-hidden="true"></i>
        <i class="lb__mark lb__mark--id" style="--i: 0" aria-hidden="true"><b>1</b></i>
        <i class="lb__mark lb__mark--type" style="--i: 1" aria-hidden="true"><b>2</b></i>
        <i class="lb__mark lb__mark--weights" style="--i: 2" aria-hidden="true"><b>3</b></i>
        <i class="lb__mark lb__mark--plate" style="--i: 3" aria-hidden="true"><b>4</b></i>
        <i class="lb__mark lb__mark--marking" style="--i: 4" aria-hidden="true"><b>5</b></i>
      </GateScene>
      <span class="lb__tag"
        ><i class="qs-glyph qs-glyph--recorded" aria-hidden="true"></i>Sample picture</span
      >
      <ol class="lb__readout">
        <li style="--i: 0">
          <span class="lb__n">1</span>
          <span class="lb__k">Container ID</span>
          <span class="lb__v lb__v--mono">CMAU 210375 <b>8</b></span>
          <CertaintyChip level="Uncertain" />
          <span class="lb__why">The painted check digit is 8. The number works out to 9.</span>
        </li>
        <li style="--i: 1">
          <span class="lb__n">2</span>
          <span class="lb__k">Size and type</span>
          <span class="lb__v lb__v--mono">22G1</span>
          <CertaintyChip level="Confident" />
        </li>
        <li style="--i: 2">
          <span class="lb__n">3</span>
          <span class="lb__k">Max gross</span>
          <span class="lb__v lb__v--mono">30,480 kg</span>
          <CertaintyChip level="Confident" />
        </li>
        <li style="--i: 3">
          <span class="lb__n">4</span>
          <span class="lb__k">CSC plate</span>
          <span class="lb__v">Too small to read</span>
          <CertaintyChip level="Can't tell" />
        </li>
        <li style="--i: 4">
          <span class="lb__n">5</span>
          <span class="lb__k">Marking</span>
          <span class="lb__v">Super heavy</span>
          <CertaintyChip level="Likely" />
        </li>
      </ol>
    </section>
  </main>
</template>

<style scoped>
.lb {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 0.86fr) minmax(0, 1fr);
  background: var(--landing-bg);
  color: var(--landing-ink);
}

/* Words */
.lb__copy {
  --lp-align: start;
  --lp-field-width: 580px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  padding: var(--space-6) clamp(var(--space-5), 4.4vw, var(--space-8)) var(--space-5)
    clamp(var(--space-5), 5vw, calc(var(--space-8) * 1.5));
}
.lb__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2rem/1 var(--font-hero);
  letter-spacing: -0.03em;
}
.lb__brand .qs-logo {
  width: 46px;
  height: 46px;
  color: inherit;
}
.lb__lead {
  align-self: center;
  padding-block: var(--space-6);
}
.lb__eyebrow {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0 0 var(--space-4);
  color: var(--landing-ink-muted);
  font: 500 0.8125rem/1 var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.lb__eyebrow::before {
  content: '';
  width: var(--space-5);
  height: 1.5px;
  background: currentColor;
}
.lb__title {
  margin: 0;
  font: 700 clamp(2.75rem, 5.3vw, 6rem)/0.94 var(--font-hero);
  letter-spacing: -0.05em;
  text-wrap: balance;
}
.lb__sub {
  max-width: 33rem;
  margin: var(--space-5) 0 var(--space-6);
  color: var(--landing-ink-muted);
  font: 400 1.125rem/1.75rem var(--font-sans);
  text-wrap: pretty;
}
.lb__facts {
  display: flex;
  gap: var(--space-6);
  margin: 0;
  padding: var(--space-4) 0 0;
  border-top: 1px solid color-mix(in srgb, var(--landing-ink) 16%, transparent);
  list-style: none;
  font: 400 0.875rem/1.25rem var(--font-sans);
}
.lb__facts b {
  display: block;
  color: var(--landing-ink-muted);
  font: 600 0.6875rem/1.25rem var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* Picture */
.lb__stage {
  position: relative;
  margin: var(--space-4) var(--space-4) 0 0;
  overflow: hidden;
  border-radius: var(--radius-lg);
  min-height: 620px;
}
.lb__scene {
  position: absolute;
  inset: 0;
}
.lb__tag {
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
.lb__beam {
  position: absolute;
  left: 27.6%;
  width: 46.6%;
  top: 24.4%;
  height: 43%;
  overflow: hidden;
  pointer-events: none;
}
.lb__beam::after {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 22%;
  border-bottom: 1.5px solid var(--landing-surface);
  background: linear-gradient(
    180deg,
    transparent,
    color-mix(in srgb, var(--landing-surface) 34%, transparent)
  );
  transform: translateY(-110%);
  animation: lb-scan 1500ms cubic-bezier(0.45, 0, 0.25, 1) 300ms both;
}

/* Corner brackets round each reading, with its number */
.lb__mark {
  --c: var(--landing-surface);
  position: absolute;
  background:
    linear-gradient(var(--c), var(--c)) 0 0 / 9px 2px,
    linear-gradient(var(--c), var(--c)) 0 0 / 2px 9px,
    linear-gradient(var(--c), var(--c)) 100% 0 / 9px 2px,
    linear-gradient(var(--c), var(--c)) 100% 0 / 2px 9px,
    linear-gradient(var(--c), var(--c)) 0 100% / 9px 2px,
    linear-gradient(var(--c), var(--c)) 0 100% / 2px 9px,
    linear-gradient(var(--c), var(--c)) 100% 100% / 9px 2px,
    linear-gradient(var(--c), var(--c)) 100% 100% / 2px 9px;
  background-repeat: no-repeat;
  animation: lb-mark var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(1300ms + var(--i) * 150ms);
}
.lb__mark b {
  position: absolute;
  right: calc(100% + 6px);
  top: 50%;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-pill);
  background: var(--landing-surface);
  color: var(--landing-ink);
  font: 600 0.75rem/1 var(--font-mono);
  translate: 0 -50%;
  box-shadow: var(--shadow-landing-chip);
}
.lb__mark--id {
  left: 55.2%;
  top: 31%;
  width: 17.2%;
  height: 3.5%;
}
.lb__mark--type {
  left: 62%;
  top: 34.3%;
  width: 6%;
  height: 2.6%;
}
.lb__mark--type b {
  right: auto;
  left: calc(100% + 6px);
}
.lb__mark--weights {
  left: 55.6%;
  top: 39.4%;
  width: 15.2%;
  height: 12.6%;
}
.lb__mark--plate {
  left: 32.4%;
  top: 56%;
  width: 6.6%;
  height: 6.4%;
}
.lb__mark--marking {
  left: 63%;
  top: 55.8%;
  width: 6.6%;
  height: 5.4%;
}

/* Readings panel */
.lb__readout {
  position: absolute;
  left: var(--space-4);
  right: var(--space-4);
  bottom: var(--space-4);
  display: grid;
  grid-template-columns: 1.5fr repeat(4, 1fr);
  margin: 0;
  padding: 0;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--landing-surface) 88%, transparent);
  backdrop-filter: blur(18px) saturate(1.4);
  box-shadow: var(--shadow-landing);
  list-style: none;
}
.lb__readout li {
  position: relative;
  display: grid;
  justify-items: start;
  align-content: start;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4) var(--space-4);
  border-left: 1px solid color-mix(in srgb, var(--landing-ink) 12%, transparent);
  animation: lb-rise var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(1400ms + var(--i) * 150ms);
}
.lb__readout li:first-child {
  border-left: 0;
}
.lb__n {
  position: absolute;
  right: var(--space-3);
  top: var(--space-3);
  color: var(--landing-ink-muted);
  font: 500 0.75rem/1 var(--font-mono);
}
.lb__k {
  color: var(--landing-ink-muted);
  font: 600 0.6875rem/1.25rem var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.lb__v {
  margin-bottom: var(--space-2);
  font: 600 1rem/1.5rem var(--font-sans);
  white-space: nowrap;
}
.lb__v--mono {
  font: 500 1.0625rem/1.5rem var(--font-mono);
}
.lb__v b {
  padding: 0 var(--space-1);
  border: 1.5px solid var(--cert-uncertain-line);
  border-radius: var(--radius-xs);
  background: var(--cert-uncertain-bg);
  color: var(--cert-uncertain-fg);
  font-weight: 500;
}
.lb__why {
  margin-top: var(--space-1);
  color: var(--landing-ink-muted);
  font: 400 0.75rem/1.0625rem var(--font-sans);
}

@keyframes lb-scan {
  to {
    transform: translateY(460%);
    opacity: 0;
  }
}
@keyframes lb-mark {
  from {
    opacity: 0;
    scale: 1.25;
  }
}
@keyframes lb-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lb *,
  .lb *::after {
    animation: none !important;
  }
}
@media (max-width: 1100px) {
  .lb {
    grid-template-columns: minmax(0, 1fr);
  }
  .lb__stage {
    margin: 0 var(--space-4);
    min-height: 640px;
  }
  .lb__readout {
    grid-template-columns: repeat(2, 1fr);
  }
  .lb__facts {
    flex-wrap: wrap;
  }
}
</style>
