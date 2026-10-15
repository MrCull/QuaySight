<script setup lang="ts">
import { computed } from 'vue'
import type { Severity } from '../../domain/damage'

// Apparent visual severity: magenta bars, a separate axis from certainty (design-system SeverityBadge).
const props = defineProps<{ severity: Severity; code?: string }>()

const LABEL: Record<Severity, string> = { minor: 'Minor', moderate: 'Moderate', major: 'Major' }
const label = computed(() => LABEL[props.severity])
</script>

<template>
  <span
    :class="['qs-sev', `qs-sev--${severity}`]"
    :aria-label="`Apparent visual severity: ${label.toLowerCase()}`"
  >
    <span class="qs-sev__bars" aria-hidden="true"><i></i><i></i><i></i></span>
    <span v-if="code" class="qs-sev__code">{{ code }}</span>
    {{ label }}
  </span>
</template>
