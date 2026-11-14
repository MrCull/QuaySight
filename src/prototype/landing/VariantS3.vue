<script setup lang="ts">
// PROTOTYPE variant S3, "Marking area": a tight close-up of the right door where a container carries its ID,
// size code and weights. The ID line is the name (the check-digit box holds the mark), the size-code line is
// the headline, and the weights table is product facts, all at giant scale. One lock rod, the door edge and a
// sliver of the side wall frame it. No photographs.
import ProtoKeyField from './ProtoKeyField.vue'

const TABLE = [
  ['Reads', 'ID · Size · Weights', 'Seal · Placards'],
  ['Finds', 'Suspected damage', 'Marked on a drawing'],
  ['From', '1–5 photos', 'Of one container'],
  ['Says', 'How sure it is', 'In five plain words'],
  ['Not', 'A certified survey', ''],
]
const HINGES = [16, 50, 84]
</script>

<template>
  <main class="ls3">
    <div class="ls3__door">
      <i class="ls3__rod" aria-hidden="true"><b></b></i>
      <i v-for="y in HINGES" :key="y" class="ls3__hinge" :style="`top: ${y}%`" aria-hidden="true"></i>
      <i class="ls3__post" aria-hidden="true"></i>

      <div class="ls3__marks">
        <p class="ls3__id">Quay <span>Sight</span> <b><i class="qs-logo" aria-hidden="true"></i></b></p>
        <h1 class="ls3__title">The box, decoded.</h1>

        <div class="ls3__lower">
          <dl class="ls3__table">
            <div v-for="[label, value, second] in TABLE" :key="label">
              <dt>{{ label }}</dt>
              <dd>
                {{ value }}<small v-if="second">{{ second }}</small>
              </dd>
            </div>
          </dl>
          <div class="ls3__plate">
            <p class="ls3__plate-head">
              <span>Inspect a container</span><span>OpenRouter or OpenAI key</span>
            </p>
            <ProtoKeyField />
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.ls3 {
  --paint: var(--brand);
  --paint-hi: color-mix(in srgb, var(--brand) 84%, white);
  --paint-lo: color-mix(in srgb, var(--brand) 76%, black);
  --paint-deep: color-mix(in srgb, var(--brand) 52%, black);
  --stencil: color-mix(in srgb, var(--on-brand) 94%, var(--brand));
  --steel: var(--schem-rail);
  --steel-hi: var(--schem-top);
  --steel-lo: var(--schem-detail);
  --band: clamp(11rem, 26vh, 18rem);
  flex: 1;
  display: flex;
  padding: var(--space-4) var(--space-4) 0;
  background: var(--landing-bg);
}

/* One door panel, seen close: deep pressed bands */
.ls3__door {
  position: relative;
  flex: 1;
  display: flex;
  min-height: 740px;
  overflow: hidden;
  border-radius: var(--radius-sm);
  color: var(--stencil);
  box-shadow: var(--shadow-landing);
  background:
    linear-gradient(90deg, color-mix(in srgb, black 34%, transparent), transparent 4%, transparent 80%, color-mix(in srgb, black 22%, transparent) 91%),
    repeating-linear-gradient(
      180deg,
      var(--paint) 0,
      var(--paint) calc(var(--band) * 0.5),
      var(--paint-lo) calc(var(--band) * 0.535),
      var(--paint-deep) calc(var(--band) * 0.56),
      color-mix(in srgb, var(--paint) 86%, black) calc(var(--band) * 0.6),
      color-mix(in srgb, var(--paint) 91%, black) calc(var(--band) * 0.93),
      var(--paint-hi) calc(var(--band) * 0.965),
      color-mix(in srgb, var(--paint-hi) 66%, white) calc(var(--band) * 0.98),
      var(--paint) var(--band)
    );
}

/* The lock rod, its guide and the handle */
.ls3__rod {
  position: absolute;
  z-index: 1;
  left: 4.2%;
  top: 0;
  bottom: 0;
  width: 58px;
  background:
    linear-gradient(180deg, var(--steel-hi), var(--steel) 60%, var(--steel-lo)) 0 17% / 58px 34px no-repeat,
    linear-gradient(180deg, var(--steel-hi), var(--steel) 60%, var(--steel-lo)) 0 88% / 58px 34px no-repeat,
    linear-gradient(90deg, var(--steel-lo), var(--steel-hi) 36%, var(--steel) 62%, var(--steel-lo)) 50% 0 / 20px 100% no-repeat;
  filter: drop-shadow(7px 5px 5px color-mix(in srgb, black 45%, transparent));
}
.ls3__rod b {
  position: absolute;
  left: 6px;
  top: 47.5%;
  width: min(17vw, 16rem);
  height: 18px;
  border-radius: var(--radius-pill);
  background: linear-gradient(180deg, var(--steel-hi), var(--steel) 55%, var(--steel-lo));
}
.ls3__rod b::before,
.ls3__rod b::after {
  content: '';
  position: absolute;
  top: -13px;
  left: 0;
  width: 46px;
  height: 44px;
  border-radius: var(--radius-sm);
  background: linear-gradient(180deg, var(--steel-hi), var(--steel) 50%, var(--steel-lo));
}
.ls3__rod b::after {
  left: auto;
  right: 12px;
  top: -9px;
  width: 26px;
  height: 36px;
  background: var(--steel-lo);
}

/* The door edge: gasket, hinges, corner post and a sliver of the side wall */
.ls3__post {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 7.5%;
  background:
    linear-gradient(90deg, black 0, var(--paint-deep) 6%, var(--paint-lo) 12%, var(--paint-hi) 22%, var(--paint) 30%, var(--paint-lo) 42%, var(--paint-deep) 44%, transparent 44%),
    repeating-linear-gradient(90deg, var(--paint-lo) 0, var(--paint-deep) 0.5rem, color-mix(in srgb, var(--paint) 80%, black) 1.5rem, var(--paint-hi) 1.9rem, var(--paint) 2.3rem, var(--paint-lo) 3.2rem);
}
.ls3__hinge {
  position: absolute;
  z-index: 2;
  right: 4.4%;
  width: 5.4%;
  height: 34px;
  border-radius: var(--radius-xs);
  background:
    radial-gradient(circle at 22% 50%, var(--paint-deep) 0 4px, transparent 4.5px),
    radial-gradient(circle at 52% 50%, var(--paint-deep) 0 4px, transparent 4.5px),
    linear-gradient(180deg, var(--paint-hi), var(--paint) 45%, var(--paint-lo));
  box-shadow: 0 4px 6px color-mix(in srgb, black 45%, transparent);
  translate: 0 -50%;
}
.ls3__hinge::after {
  content: '';
  position: absolute;
  right: 0;
  top: -6px;
  width: 22px;
  height: 46px;
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, var(--paint-lo), var(--paint-hi) 50%, var(--paint-lo));
}

/* The markings */
.ls3__marks {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: clamp(var(--space-5), 5vh, var(--space-8)) 11.5% clamp(var(--space-5), 4.5vh, var(--space-7)) 12.5%;
}
.ls3__id,
.ls3__title {
  margin: 0;
  font: 500 clamp(3.5rem, 10.4vw, 13.5rem)/0.98 var(--font-display);
  letter-spacing: 0.035em;
  text-transform: uppercase;
  white-space: nowrap;
  animation: ls3-rise 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.ls3__id span {
  margin-left: 0.22em;
}
.ls3__id b {
  display: inline-grid;
  place-items: center;
  width: 0.78em;
  height: 0.84em;
  margin-left: 0.08em;
  border: 0.035em solid currentColor;
  vertical-align: 0.02em;
}
.ls3__id .qs-logo {
  width: 0.56em;
  height: 0.56em;
  color: inherit;
}
.ls3__title {
  animation-delay: 140ms;
}
.ls3__lower {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 30rem);
  align-items: end;
  gap: clamp(var(--space-6), 4vw, var(--space-8));
  margin-top: auto;
  padding-top: var(--space-5);
}
.ls3__table {
  display: grid;
  gap: 0.34em;
  margin: 0;
  font: 500 clamp(1.25rem, 2.5vw, 3rem)/1 var(--font-display);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  animation: ls3-rise 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 280ms both;
}
.ls3__table div {
  display: grid;
  grid-template-columns: 4.6em 1fr;
  align-items: baseline;
}
.ls3__table dd {
  display: grid;
  margin: 0;
  white-space: nowrap;
}
.ls3__table small {
  font-size: 0.62em;
  line-height: 1.25;
  letter-spacing: 0.07em;
  opacity: 0.86;
}
.ls3__plate {
  --lp-align: stretch;
  --lp-field-width: 100%;
  --lp-field-wrap: wrap;
  --lp-pick-flex: 1 1 100%;
  --lp-opt-flex: 1;
  --lp-field-radius: var(--radius-sm);
  --lp-field-inner-radius: var(--radius-xs);
  --lp-field-shadow: inset 0 0 0 1px var(--line-strong);
  --lp-field-bg: var(--landing-surface);
  padding: var(--space-4) var(--space-5) var(--space-3);
  border-radius: var(--radius-sm);
  background:
    radial-gradient(circle at 10px 10px, var(--steel-lo) 0 2.5px, transparent 3px),
    radial-gradient(circle at calc(100% - 10px) 10px, var(--steel-lo) 0 2.5px, transparent 3px),
    radial-gradient(circle at 10px calc(100% - 10px), var(--steel-lo) 0 2.5px, transparent 3px),
    radial-gradient(circle at calc(100% - 10px) calc(100% - 10px), var(--steel-lo) 0 2.5px, transparent 3px),
    linear-gradient(135deg, var(--landing-bg), var(--steel-hi) 50%, var(--landing-bg));
  color: var(--landing-ink);
  box-shadow: 0 14px 26px -12px black;
  animation: ls3-rise 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 380ms both;
}
.ls3__plate-head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  margin: 0 var(--space-1) var(--space-3);
  font: 600 0.75rem/1 var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ls3__plate-head span:last-child {
  color: var(--landing-ink-muted);
}

@keyframes ls3-rise {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ls3 * {
    animation: none !important;
  }
}
@media (max-width: 1000px) {
  .ls3__rod,
  .ls3__hinge,
  .ls3__post {
    display: none;
  }
  .ls3__marks {
    padding-inline: var(--space-5);
  }
  .ls3__id,
  .ls3__title {
    white-space: normal;
  }
  .ls3__lower {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
