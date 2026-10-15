<script setup lang="ts">
import { computed } from 'vue'
import type { CertaintyLabel } from '../domain/inspection'

const props = defineProps<{ level: CertaintyLabel }>()

// Fixed words and everyday meanings from design-system/components/CertaintyChip/README.md.
const LEVELS: Record<CertaintyLabel, { cls: string; meaning: string }> = {
  Confident: { cls: 'confident', meaning: 'Clearly visible, and everything checks out.' },
  Likely: { cls: 'likely', meaning: 'Probably right, but not certain.' },
  Uncertain: {
    cls: 'uncertain',
    meaning: 'Could be one of a few things. The alternatives are shown.',
  },
  "Can't tell": { cls: 'unknown', meaning: 'In the photo, but not clear enough to say.' },
  'Not seen': { cls: 'unseen', meaning: 'Not in any photo, so nothing can be said about it.' },
}

const info = computed(() => LEVELS[props.level])
</script>

<template>
  <span
    :class="['qs-cert', `qs-cert--${info.cls}`]"
    :aria-label="`Certainty: ${level}, ${info.meaning}`"
  >
    <i :class="['qs-glyph', `qs-glyph--${info.cls}`]" aria-hidden="true"></i>{{ level }}
  </span>
</template>
