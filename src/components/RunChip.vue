<script setup lang="ts">
import { computed } from 'vue'
import { getProvider, labelsFor } from '../domain/providers'
import type { ProviderId } from '../domain/inspection'

/**
 * design-system/components/RunChip: who answered a recorded sample, in the demo top bar where the
 * settings chip would be. Every word comes from the catalogue's labels.
 */
const props = defineProps<{ provider: ProviderId; model: string }>()

const monogram = computed(() => getProvider(props.provider).monogram)
const labels = computed(() => labelsFor(props.provider, props.model))
const detail = computed(() => `${labels.value.route} · ${props.model}`)
</script>

<template>
  <span class="qs-runchip" :title="`${labels.model} · ${detail}`">
    <span class="qs-mono" aria-hidden="true">{{ monogram }}</span>
    <span class="qs-runchip__name">{{ labels.model }}</span>
    <small class="qs-runchip__detail">{{ detail }}</small>
  </span>
</template>
