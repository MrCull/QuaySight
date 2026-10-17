<script setup lang="ts">
import { computed } from 'vue'
import { BUILD_COMMIT, BUILD_TIME } from '../buildInfo'

const props = withDefaults(defineProps<{ commit?: string | null; builtAt?: string }>(), {
  commit: BUILD_COMMIT,
  builtAt: BUILD_TIME,
})

const COMMIT_URL = 'https://github.com/MrCull/QuaySight/commit/'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const short = computed(() => props.commit?.slice(0, 7) ?? null)

/** "17 Oct 2026 10:49 UTC", whatever the viewer's zone. */
const when = computed(() => {
  const d = new Date(props.builtAt)
  if (Number.isNaN(d.getTime())) return null
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${hh}:${mm} UTC`
})
</script>

<template>
  <p class="qs-buildstamp">
    <template v-if="short"
      >Build <a :href="COMMIT_URL + commit" target="_blank" rel="noopener">{{ short }}</a
      ><template v-if="when"> · {{ when }}</template></template
    >
    <template v-else>dev build</template>
  </p>
</template>

<style scoped>
.qs-buildstamp {
  margin: 0;
  padding: var(--space-4);
  text-align: center;
  color: var(--ink-muted);
  font: 400 13px/18px var(--font-sans);
  opacity: 0.8;
}
.qs-buildstamp a {
  color: inherit;
  text-decoration: underline;
}
</style>
