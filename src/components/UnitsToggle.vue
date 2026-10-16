<script setup lang="ts">
import type { Units } from '../domain/unitPreference'

// Metric / Imperial (design-system UnitsToggle): a display setting, nothing more.
defineProps<{ modelValue: Units }>()
const emit = defineEmits<{ 'update:modelValue': [units: Units] }>()

const OPTIONS: { value: Units; label: string }[] = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
]
</script>

<template>
  <div class="qs-seg" role="group" aria-label="Units">
    <button
      v-for="option in OPTIONS"
      :key="option.value"
      type="button"
      class="qs-seg__opt"
      :aria-pressed="modelValue === option.value"
      @click="emit('update:modelValue', option.value)"
    >
      <i class="qs-glyph qs-glyph--check" aria-hidden="true"></i>{{ option.label }}
    </button>
  </div>
</template>
