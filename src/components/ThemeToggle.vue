<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '../composables/theme'

// Dark / light (design-system ThemeToggle): a display setting, nothing more. The glyph shows the theme a press
// switches to; the name says it in words.
const { theme, toggle } = useTheme()
const label = computed(() =>
  theme.value === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
)
</script>

<template>
  <button
    type="button"
    class="qs-btn qs-btn--secondary qs-btn--sm qs-btn--icon qs-themetoggle"
    :aria-label="label"
    :title="label"
    @click="toggle"
  >
    <i
      :class="['qs-glyph', theme === 'dark' ? 'qs-glyph--sun' : 'qs-glyph--moon']"
      aria-hidden="true"
    ></i>
  </button>
</template>
