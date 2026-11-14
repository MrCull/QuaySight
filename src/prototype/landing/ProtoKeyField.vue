<script setup lang="ts">
// PROTOTYPE (throwaway): provider choice, key and Start. Each variant re-skins it through the --lp-* custom
// properties, so the behaviour stays in one place and the look stays the variant's own.
import { useTemplateRef } from 'vue'
import { useLandingForm } from './useLandingForm'

withDefaults(defineProps<{ demo?: boolean; go?: string }>(), { demo: true, go: 'Start' })

const key = useTemplateRef<HTMLInputElement>('key')
const { store, setup, providers, copy, keyWarning, needsKey, start, onPickKey } = useLandingForm(
  () => key.value?.focus(),
)
defineExpose({ focus: () => key.value?.focus() })
</script>

<template>
  <div class="lp-key">
    <form class="lp-key__field" novalidate @submit.prevent="start">
      <div class="lp-key__pick" role="radiogroup" aria-label="AI provider" @keydown="onPickKey">
        <button
          v-for="p in providers"
          :key="p.id"
          type="button"
          role="radio"
          class="lp-key__opt"
          :data-provider="p.id"
          :aria-checked="p.id === store.provider ? 'true' : 'false'"
          :tabindex="p.id === store.provider ? 0 : -1"
          @click="setup.chooseProvider(p.id)"
        >
          {{ p.name }}
        </button>
      </div>
      <input
        ref="key"
        class="lp-key__input"
        type="password"
        autocomplete="off"
        spellcheck="false"
        placeholder="API key"
        :value="store.apiKey"
        :aria-label="copy.label"
        @input="store.setApiKey(($event.target as HTMLInputElement).value)"
      />
      <button type="button" class="lp-key__go" :aria-disabled="!setup.canContinue" @click="start">
        {{ go }}
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
    <p v-if="needsKey" class="lp-key__hint" role="status">Paste your API key to start.</p>
    <p v-else-if="keyWarning" class="lp-key__hint" role="status">
      <b>This doesn't look like an {{ keyWarning.provider }} key.</b>
      {{ keyWarning.provider }} keys start with <code>{{ keyWarning.prefix }}</code
      >. If yours is right, you can still start.
    </p>
    <p class="lp-key__note">
      <span>Your key stays in this tab.</span>
      <button v-if="demo" type="button" class="lp-key__demo" @click="setup.enterDemo()">
        Try the demo
      </button>
    </p>
  </div>
</template>

<style scoped>
.lp-key {
  --_bg: var(--lp-field-bg, var(--landing-surface));
  --_ink: var(--lp-field-ink, var(--landing-ink));
  --_muted: var(--lp-field-muted, var(--landing-ink-muted));
  --_well: var(--lp-field-well, var(--landing-bg));
  --_go-bg: var(--lp-go-bg, var(--landing-ink));
  --_go-ink: var(--lp-go-ink, var(--landing-on-ink));
  --_radius: var(--lp-field-radius, 34px);
  --_inner: var(--lp-field-inner-radius, var(--radius-pill));
  --_note: var(--lp-note-ink, var(--landing-ink-muted));
  --_note-strong: var(--lp-note-strong, var(--landing-ink));
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  justify-items: var(--lp-align, center);
  width: 100%;
}
.lp-key__field {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: min(var(--lp-field-width, 660px), 100%);
  padding: var(--space-2);
  border: var(--lp-field-border, 0);
  border-radius: var(--_radius);
  background: var(--_bg);
  box-shadow: var(--lp-field-shadow, var(--shadow-landing));
  backdrop-filter: var(--lp-field-blur, none);
}
.lp-key__field:has(.lp-key__input:focus-visible) {
  outline: 2px solid var(--lp-focus, var(--focus-ring));
  outline-offset: 2px;
}
.lp-key__pick {
  display: flex;
  flex: none;
  padding: var(--space-1);
  border-radius: var(--_inner);
  background: var(--_well);
}
.lp-key__opt {
  height: 44px;
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--_inner);
  background: transparent;
  color: var(--_muted);
  font: 600 0.875rem/1 var(--font-sans);
  cursor: pointer;
  transition:
    background-color var(--duration-fast),
    color var(--duration-fast);
}
.lp-key__opt:hover {
  color: var(--_ink);
}
.lp-key__opt[aria-checked='true'] {
  background: var(--lp-opt-on-bg, var(--_bg));
  color: var(--lp-opt-on-ink, var(--_ink));
  box-shadow: var(--shadow-landing-chip);
}
.lp-key__input {
  flex: 1;
  min-width: 0;
  height: var(--control-lg);
  padding: 0 var(--space-4);
  border: 0;
  outline: 0;
  background: none;
  color: var(--_ink);
  font: 400 0.9375rem/1 var(--font-mono);
}
.lp-key__input::placeholder {
  color: var(--_muted);
  opacity: 0.8;
}
.lp-key__go {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-2);
  height: var(--control-lg);
  padding: 0 var(--space-5);
  border: 0;
  border-radius: var(--_inner);
  background: var(--_go-bg);
  color: var(--_go-ink);
  font: 600 0.9375rem/1 var(--font-sans);
  cursor: pointer;
  transition: transform var(--duration-fast);
}
.lp-key__go:hover svg {
  transform: translateX(3px);
}
.lp-key__go svg {
  width: 18px;
  height: 18px;
  transition: transform var(--duration-base);
}
.lp-key__opt:focus-visible,
.lp-key__go:focus-visible,
.lp-key__demo:focus-visible {
  outline: 2px solid var(--lp-focus, var(--focus-ring));
  outline-offset: 2px;
}
.lp-key__hint {
  max-width: 660px;
  margin: var(--space-4) 0 0;
  color: var(--_note-strong);
  font: 400 0.875rem/1.25rem var(--font-sans);
}
.lp-key__hint b {
  font-weight: 600;
}
.lp-key__hint code {
  font: 500 0.875rem/1.25rem var(--font-mono);
}
.lp-key__note {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2) var(--space-5);
  margin: var(--space-4) var(--space-2) 0;
  color: var(--_note);
  font: 400 0.875rem/1.25rem var(--font-sans);
}
.lp-key__demo {
  padding: 0;
  border: 0;
  border-radius: var(--radius-xs);
  background: none;
  color: var(--_note-strong);
  font: 600 0.875rem/1.25rem var(--font-sans);
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
}
@media (max-width: 640px) {
  .lp-key__field {
    flex-wrap: wrap;
    row-gap: var(--space-2);
    border-radius: var(--radius-lg);
  }
  .lp-key__pick {
    flex: 1 1 100%;
  }
  .lp-key__opt {
    flex: 1;
  }
}
</style>
