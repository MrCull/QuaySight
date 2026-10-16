<script setup lang="ts">
import { computed } from 'vue'
import type { Severity } from '../../domain/damage'

// Apparent visual severity: magenta bars on a four-step scale (cosmetic lightest), a separate axis from
// certainty (design-system SeverityBadge). Null is a component the photo gives no severity rating for.
const props = defineProps<{ severity: Severity | null; code?: string }>()

const LABEL: Record<Severity | 'unrated', string> = {
  cosmetic: 'Cosmetic',
  minor: 'Minor',
  moderate: 'Moderate',
  major: 'Major',
  unrated: 'Not rated',
}
const level = computed(() => props.severity ?? 'unrated')
const label = computed(() => LABEL[level.value])
const ariaLabel = computed(() =>
  props.severity
    ? `Apparent visual severity: ${label.value.toLowerCase()}`
    : 'Visual severity not rated',
)
</script>

<template>
  <span :class="['qs-sev', `qs-sev--${level}`]" :aria-label="ariaLabel">
    <span class="qs-sev__bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    <span v-if="code" class="qs-sev__code">{{ code }}</span>
    {{ label }}
  </span>
</template>
