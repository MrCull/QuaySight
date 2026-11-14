<script setup lang="ts">
// PROTOTYPE variant S2, "Livery": the page is the long corrugated side of a container, drawn in CSS. QUAY SIGHT
// is painted across it like a shipping line's name, the headline is stencilled beneath, a sample ID runs down
// the door end, the key field is a riveted plate and the facts are a data decal. No photographs.
import ProtoKeyField from './ProtoKeyField.vue'
import CertaintyChip from '../../components/CertaintyChip.vue'

const FACTS = [
  ['Reads', 'ID · size · weights · seal'],
  ['Finds', 'Placards · suspected damage'],
  ['From', '1–5 photos of one container'],
  ['Says', 'How sure it is, every time'],
  ['Not', 'A certified survey'],
]
</script>

<template>
  <main class="ls2">
    <div class="ls2__box">
      <i v-for="n in 4" :key="n" :class="`qs-logo ls2__casting ls2__casting--${n}`" aria-hidden="true"></i>
      <i class="ls2__rail ls2__rail--top" aria-hidden="true"></i>

      <div class="ls2__wall">
        <p class="ls2__livery"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
        <h1 class="ls2__title">Know the box before it moves.</h1>

        <div class="ls2__id">
          <p aria-label="JDLU 200690 2">JDLU&nbsp;200690&nbsp;<b>2</b></p>
          <p>22G1</p>
        </div>
        <span class="ls2__sample">Sample reading <CertaintyChip level="Confident" /></span>

        <div class="ls2__row">
          <div class="ls2__plate">
            <p class="ls2__plate-head">
              <span>Inspect a container</span><span>OpenRouter or OpenAI key</span>
            </p>
            <ProtoKeyField />
          </div>
          <dl class="ls2__decal">
            <div v-for="[label, value] in FACTS" :key="label">
              <dt>{{ label }}</dt>
              <dd>{{ value }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <i class="ls2__rail ls2__rail--bottom" aria-hidden="true"><b></b><b></b></i>
    </div>
  </main>
</template>

<style scoped>
.ls2 {
  --paint: var(--brand);
  --paint-hi: color-mix(in srgb, var(--brand) 82%, white);
  --paint-lo: color-mix(in srgb, var(--brand) 74%, black);
  --paint-deep: color-mix(in srgb, var(--brand) 50%, black);
  --stencil: color-mix(in srgb, var(--on-brand) 95%, var(--brand));
  --steel-hi: var(--schem-top);
  --steel-lo: var(--schem-detail);
  --rib: clamp(3.25rem, 4.4vw, 5.5rem);
  flex: 1;
  display: flex;
  padding: var(--space-4) var(--space-4) 0;
  background: var(--landing-bg);
}
.ls2__box {
  position: relative;
  flex: 1;
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 740px;
  border-radius: var(--radius-sm);
  background: var(--paint-deep);
  color: var(--stencil);
  box-shadow: var(--shadow-landing);
}
.ls2__casting {
  position: absolute;
  z-index: 4;
  width: 40px;
  height: 40px;
  color: var(--paint-hi);
  filter: drop-shadow(0 1px 1px color-mix(in srgb, black 60%, transparent));
}
.ls2__casting--1 { left: 0; top: 0; }
.ls2__casting--2 { right: 0; top: 0; }
.ls2__casting--3 { left: 0; bottom: 0; }
.ls2__casting--4 { right: 0; bottom: 0; }

/* Top and bottom side rails; the bottom one has the fork pockets */
.ls2__rail {
  display: block;
  height: 26px;
  background: linear-gradient(180deg, var(--paint-hi), var(--paint) 22%, var(--paint-lo) 80%, var(--paint-deep));
}
.ls2__rail--bottom {
  position: relative;
  height: 44px;
  background: linear-gradient(180deg, var(--paint-deep), var(--paint-lo) 14%, var(--paint) 40%, var(--paint-lo) 86%, var(--paint-deep));
}
.ls2__rail--bottom b {
  position: absolute;
  top: 9px;
  bottom: 9px;
  width: 7%;
  border-radius: var(--radius-xs);
  background: linear-gradient(180deg, black, color-mix(in srgb, var(--paint-deep) 60%, black));
  box-shadow:
    0 0 0 2px var(--paint-lo),
    0 0 0 3px color-mix(in srgb, white 14%, transparent);
}
.ls2__rail--bottom b:first-child { left: 31%; }
.ls2__rail--bottom b:last-child { right: 31%; }

/* The corrugated wall. The same ribs are laid over the paint so the lettering follows the steel. */
.ls2__wall {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: clamp(var(--space-5), 4.5vh, var(--space-7)) clamp(var(--space-6), 5vw, calc(var(--space-8) * 1.4)) clamp(var(--space-5), 4.5vh, var(--space-7));
  overflow: hidden;
  background:
    linear-gradient(180deg, color-mix(in srgb, black 34%, transparent), transparent 5%, transparent 93%, color-mix(in srgb, black 36%, transparent)),
    repeating-linear-gradient(
      90deg,
      var(--paint-hi) 0,
      var(--paint) calc(var(--rib) * 0.06),
      var(--paint) calc(var(--rib) * 0.38),
      var(--paint-deep) calc(var(--rib) * 0.48),
      var(--paint-lo) calc(var(--rib) * 0.54),
      color-mix(in srgb, var(--paint) 86%, black) calc(var(--rib) * 0.86),
      var(--paint-hi) calc(var(--rib) * 0.97),
      var(--paint-hi) var(--rib)
    );
}
.ls2__wall::after {
  content: '';
  position: absolute;
  z-index: 1;
  inset: 0;
  background: repeating-linear-gradient(
    90deg,
    color-mix(in srgb, white 10%, transparent) 0,
    transparent calc(var(--rib) * 0.06),
    transparent calc(var(--rib) * 0.38),
    color-mix(in srgb, black 30%, transparent) calc(var(--rib) * 0.48),
    color-mix(in srgb, black 17%, transparent) calc(var(--rib) * 0.54),
    color-mix(in srgb, black 9%, transparent) calc(var(--rib) * 0.86),
    color-mix(in srgb, white 14%, transparent) calc(var(--rib) * 0.97),
    color-mix(in srgb, white 10%, transparent) var(--rib)
  );
  pointer-events: none;
}

/* The line's name, painted large */
.ls2__livery {
  display: flex;
  align-items: center;
  gap: 0.2em;
  margin: 0;
  font: 700 clamp(4.5rem, 13.6vw, 17rem)/0.92 var(--font-display);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
  animation: ls2-paint 1100ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.ls2__livery .qs-logo {
  width: 0.8em;
  height: 0.8em;
  color: inherit;
}
.ls2__title {
  margin: clamp(var(--space-3), 2vh, var(--space-5)) 0 0;
  font: 500 clamp(1.75rem, 4.5vw, 5.5rem)/1 var(--font-display);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  animation: ls2-paint 1100ms cubic-bezier(0.2, 0.8, 0.2, 1) 180ms both;
}

/* The ID, running down the door end */
.ls2__id {
  position: absolute;
  right: clamp(var(--space-5), 2.6vw, var(--space-7));
  top: clamp(var(--space-5), 4.5vh, var(--space-7));
  font: 500 clamp(1.375rem, 2vw, 2.25rem)/1.25 var(--font-display);
  letter-spacing: 0.05em;
  writing-mode: vertical-rl;
  text-orientation: upright;
}
.ls2__id p {
  margin: 0;
}
.ls2__id b {
  padding: 0.12em 0;
  border: 0.06em solid currentColor;
  font-weight: 500;
}
.ls2__sample {
  position: absolute;
  z-index: 2;
  right: clamp(var(--space-4), 1.6vw, var(--space-6));
  bottom: clamp(var(--space-5), 4.5vh, var(--space-7));
  display: grid;
  justify-items: end;
  gap: var(--space-1);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--landing-surface);
  color: var(--landing-ink-muted);
  font: 500 0.6875rem/1 var(--font-sans);
}

/* Data plate and decal */
.ls2__row {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: end;
  gap: clamp(var(--space-5), 3vw, var(--space-8));
  margin-top: auto;
  padding-right: clamp(6rem, 9vw, 10rem);
}
.ls2__plate {
  --lp-align: stretch;
  --lp-field-width: 100%;
  --lp-field-radius: var(--radius-sm);
  --lp-field-inner-radius: var(--radius-xs);
  --lp-field-shadow: inset 0 0 0 1px var(--line-strong);
  --lp-field-bg: var(--landing-surface);
  flex: 1 1 0;
  max-width: 40rem;
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
}
.ls2__plate-head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  margin: 0 var(--space-1) var(--space-3);
  font: 600 0.75rem/1 var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ls2__plate-head span:last-child {
  color: var(--landing-ink-muted);
}
.ls2__decal {
  flex: 0 1 30rem;
  display: grid;
  margin: 0;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-xs);
  background: var(--landing-surface);
  color: var(--landing-ink);
  box-shadow: 0 12px 24px -14px black;
}
.ls2__decal div {
  display: grid;
  grid-template-columns: 4.5rem 1fr;
  align-items: baseline;
  gap: var(--space-4);
  padding: var(--space-2) 0;
  border-top: 1px solid var(--line);
}
.ls2__decal div:first-child {
  border-top: 0;
}
.ls2__decal dt {
  color: var(--landing-ink-muted);
  font: 600 0.75rem/1.25rem var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ls2__decal dd {
  margin: 0;
  font: 500 1.25rem/1.375rem var(--font-display);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

@keyframes ls2-paint {
  from {
    opacity: 0;
    clip-path: inset(0 100% 0 0);
  }
  to {
    opacity: 1;
    clip-path: inset(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ls2 * {
    animation: none !important;
  }
}
@media (max-width: 1000px) {
  .ls2__id,
  .ls2__sample {
    display: none;
  }
  .ls2__row {
    flex-direction: column;
    align-items: stretch;
    padding-right: 0;
  }
  .ls2__plate,
  .ls2__decal {
    flex: none;
  }
}
</style>
