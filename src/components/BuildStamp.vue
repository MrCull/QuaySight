<script setup lang="ts">
import { computed } from 'vue'
import { BUILD_COMMIT, BUILD_TIME } from '../buildInfo'

const props = withDefaults(defineProps<{ commit?: string | null; builtAt?: string }>(), {
  commit: BUILD_COMMIT,
  builtAt: BUILD_TIME,
})

const COMMIT_URL = 'https://github.com/MrCull/QuaySight/commit/'

const short = computed(() => props.commit?.slice(0, 7) ?? null)

/** "17 Oct 2026 10:49 UTC", whatever the viewer's zone. */
const when = computed(() => {
  const d = new Date(props.builtAt)
  if (Number.isNaN(d.getTime())) return null
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  )
  return `${parts.day} ${parts.month} ${parts.year} ${parts.hour}:${parts.minute} UTC`
})
</script>

<template>
  <p class="rs-buildstamp qs-type-caption">
    <template v-if="short"
      >Build <a :href="COMMIT_URL + commit" target="_blank" rel="noopener">{{ short }}</a
      ><template v-if="when"> · {{ when }}</template></template
    >
    <template v-else>dev build</template>
  </p>
</template>

<style scoped>
.rs-buildstamp {
  margin: 0;
  padding: var(--space-4);
  text-align: center;
  color: var(--ink-muted);
}
.rs-buildstamp a {
  color: inherit;
  text-decoration: underline;
}
</style>
