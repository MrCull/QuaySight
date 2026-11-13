<script setup lang="ts">
import { computed } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { bananaPhotos, notAContainerWords } from '../domain/notAContainer'
import { focusNextStep } from './nextStepFocus'

// design-system/components/NotAContainer: every photo is something other than a container. The model only says
// "not a container", never what the photo shows, so nothing here names the subject; a banana or its skin, which
// the survey asks about on its own, turns the screen gold (the Easter egg).
const store = useInspectionStore()

const count = computed(() => store.notAContainer)
const bananas = computed(() => bananaPhotos(store.record, store.photos.length))
const words = computed(() => notAContainerWords(count.value, bananas.value))
const photos = computed(() => store.photos.slice(0, count.value))
const several = computed(() => count.value > 1)
const layout = computed(() => ({
  '--cols': String(Math.min(count.value, 3)),
  '--rest': String(Math.max(count.value - 1, 1)),
}))
const idLabel = computed(() => {
  const { owner, serial, check } = words.value.id
  return `${[...owner, ...serial].join(' ')}, check digit ${check}`
})

function respawn() {
  store.newInspection()
  void focusNextStep('photo')
}
</script>

<template>
  <section
    :class="['qs-nac', { 'qs-nac--banana': words.banana }]"
    :data-several="several ? '' : undefined"
    :style="layout"
    aria-labelledby="nac-title"
  >
    <h2 id="nac-title" class="qs-nac__title">
      Not a container:
      {{ several ? `none of the ${count} photos shows` : 'this photo does not show' }}
      a container
    </h2>
    <div class="qs-nac__photos">
      <figure v-for="(photo, i) in photos" :key="photo.url" class="qs-nac__photo">
        <img :src="photo.url" :alt="`Photo ${i + 1}, not a container`" />
        <span v-if="several" class="qs-nac__num" aria-hidden="true">{{ i + 1 }}</span>
        <span
          :class="['qs-nac__stamp', { 'qs-nac__stamp--banana': bananas[i] }]"
          :style="{ '--i': i }"
          aria-hidden="true"
          >{{ words.stamps[i] }}</span
        >
      </figure>
      <p v-if="words.tally" class="qs-nac__tally">{{ words.tally }}</p>
      <p v-if="words.taunt" class="qs-nac__taunt" :aria-label="words.taunt.plain">
        {{ words.taunt.mocking }}
      </p>
    </div>

    <div class="qs-nac__side">
      <div class="qs-nac__tile qs-rise" style="--i: 0">
        <div class="qs-nac__head">
          <span class="qs-nac__label">Container ID</span>
          <span class="qs-cert qs-cert--confident"
            ><i class="qs-glyph qs-glyph--confident" aria-hidden="true"></i>Confident</span
          >
        </div>
        <div class="qs-id" :aria-label="idLabel">
          <span class="qs-id__group" aria-hidden="true">
            <span v-for="(ch, k) in words.id.owner" :key="k" class="qs-id__ch">{{ ch }}</span>
          </span>
          <span class="qs-id__group" aria-hidden="true">
            <span v-for="(ch, k) in words.id.serial" :key="k" class="qs-id__ch">{{ ch }}</span>
          </span>
          <span class="qs-id__check" aria-hidden="true">{{ words.id.check }}</span>
        </div>
        <div class="qs-nac__tags">
          <span v-for="tag in words.tags" :key="tag" class="qs-nac__tag">{{ tag }}</span>
        </div>
      </div>

      <div class="qs-nac__tile qs-nac__ach qs-rise" style="--i: 1">
        <span v-if="words.combo" class="qs-nac__combo">{{ words.combo }}</span>
        <div class="qs-nac__achrow">
          <svg class="qs-nac__badge" viewBox="0 0 168 168" aria-hidden="true">
            <polygon class="qs-nac__badge-rim" points="84,6 152,45 152,123 84,162 16,123 16,45" />
            <polygon class="qs-nac__badge-ring" points="84,22 138,53 138,115 84,146 30,115 30,53" />
            <g v-if="words.banana" class="qs-nac__peel">
              <path d="M40 58c4 50 56 80 96 46-34 10-66-6-80-50Z" />
              <path class="qs-nac__peel-in" d="M50 66c10 30 40 46 70 40-28 0-54-14-66-42Z" />
              <path class="qs-nac__peel-stem" d="M38 60l-4-12 9-2 5 12Z" />
            </g>
            <template v-else>
              <rect class="qs-nac__badge-mark" x="54" y="62" width="60" height="44" rx="6" />
              <ellipse class="qs-nac__badge-eye" cx="84" cy="84" rx="12" ry="8" />
            </template>
          </svg>
          <div class="qs-nac__achtext">
            <span v-if="words.rarity" class="qs-nac__rarity">{{ words.rarity }}</span>
            <span v-else class="qs-nac__label">Achievement unlocked</span>
            <p class="qs-nac__achtitle">{{ words.achievement }}</p>
            <p class="qs-nac__caption">{{ words.achievementCaption }}</p>
          </div>
        </div>
        <div class="qs-nac__xphead">
          <span class="qs-nac__label qs-nac__level">{{ words.level }}</span>
          <span class="qs-nac__xpgain">+{{ words.xp }} XP</span>
        </div>
        <div
          class="qs-nac__xp"
          role="img"
          :aria-label="`${words.xp} XP earned`"
          :style="{ '--xp': `${words.xpPercent}%` }"
        >
          <i></i>
        </div>
      </div>

      <div class="qs-nac__next qs-rise" style="--i: 2">
        <span class="qs-nac__lock" aria-hidden="true">?</span>
        <span>
          <span class="qs-nac__nexttitle">{{ words.nextTitle }}</span>
          <span
            :class="words.next.mocking ? 'qs-nac__mock' : 'qs-nac__caption'"
            :aria-label="words.next.mocking ? words.next.plain : undefined"
            >{{ words.next.shown }}</span
          >
        </span>
        <span class="qs-nac__progress">0/1</span>
      </div>

      <button
        type="button"
        class="qs-btn qs-btn--primary qs-btn--lg qs-nac__respawn qs-rise"
        style="--i: 3"
        @click="respawn"
      >
        {{ words.respawn }}
      </button>
    </div>

    <p class="qs-nac__egg" aria-hidden="true">{{ words.egg }}</p>
  </section>
</template>
