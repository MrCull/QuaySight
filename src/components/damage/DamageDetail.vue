<script setup lang="ts">
import { computed } from 'vue'
import { CEDEX_BASIS_WORDS, type CedexLocation } from '../../domain/cedexLocation'
import { cedexType, cedexTypeDescription } from '../../domain/cedexType'
import type { DamageFinding } from '../../domain/damage'
import CertaintyChip from '../CertaintyChip.vue'
import SeverityBadge from './SeverityBadge.vue'

// The selected finding, expanded beside the drawing (design-system FindingCard, detail panel): what it is,
// its CEDEX location and damage type, severity and certainty kept apart, the interpretation and caveats.
const props = defineProps<{
  finding: DamageFinding | null
  location: CedexLocation | null
  /** Where the open finding sits among all of them (0-based), for the previous and next arrows. */
  position?: { index: number; total: number } | null
}>()
const emit = defineEmits<{ previous: []; next: [] }>()

const type = computed(() => (props.finding ? cedexType(props.finding) : null))

function percent(p: number): string {
  return `${Math.round(p * 100)}%`
}

function uncertaintyClass(f: DamageFinding): string {
  return f.certainty === 'Likely'
    ? 'qs-finding__n--likely'
    : f.certainty === 'Uncertain'
      ? 'qs-finding__n--uncertain'
      : ''
}
</script>

<template>
  <article
    :class="['qs-finding-detail', { 'qs-finding-detail--selected': finding }]"
    :aria-label="finding ? `Finding ${finding.id} details` : 'Finding details'"
    :data-finding-detail="finding?.id"
  >
    <p v-if="!finding" class="qs-finding-detail__empty">
      Select a numbered marker on the drawing, or a finding below, to see its details here.
    </p>
    <template v-else>
      <nav v-if="position" class="qs-finding-detail__nav" aria-label="Step through findings">
        <button
          type="button"
          class="qs-finding-detail__step qs-finding-detail__step--prev"
          aria-label="Previous finding"
          :disabled="position.index === 0"
          @click="emit('previous')"
        >
          <i class="qs-glyph qs-glyph--chevron" aria-hidden="true"></i>
        </button>
        <span class="qs-finding-detail__count" aria-live="polite"
          >Finding {{ finding.id }} of {{ position.total }}</span
        >
        <button
          type="button"
          class="qs-finding-detail__step qs-finding-detail__step--next"
          aria-label="Next finding"
          :disabled="position.index === position.total - 1"
          @click="emit('next')"
        >
          <i class="qs-glyph qs-glyph--chevron" aria-hidden="true"></i>
        </button>
      </nav>
      <div class="qs-finding-detail__head">
        <span
          :class="[
            'qs-finding__n',
            `qs-finding__n--${finding.severity ?? 'unrated'}`,
            uncertaintyClass(finding),
          ]"
          >{{ finding.id }}</span
        >
        <span>
          <span class="qs-finding__title">{{ finding.title }}</span>
          <br />
          <span class="qs-finding__loc">{{ finding.location }}</span>
        </span>
        <span class="qs-finding__tags">
          <SeverityBadge :severity="finding.severity" />
          <CertaintyChip :level="finding.certainty" />
        </span>
      </div>

      <p class="qs-finding-detail__desc">{{ finding.description }}</p>

      <section class="qs-finding-detail__section" data-detail="cedex-location">
        <h4>CEDEX location</h4>
        <template v-if="location?.code">
          <span class="qs-finding-detail__value">
            <span class="qs-cedex-code">{{ location.code }}</span>
            <span class="qs-finding-detail__basis">{{ CEDEX_BASIS_WORDS[location.basis] }}</span>
          </span>
          <p>{{ location.parts.join(' · ') }}</p>
        </template>
        <template v-else>
          <span class="qs-finding-detail__value">
            <span class="qs-cedex-code qs-cedex-code--none">No code</span>
            <span class="qs-finding-detail__basis">{{ CEDEX_BASIS_WORDS.unknown }}</span>
          </span>
          <p v-if="location && location.parts.length > 0">{{ location.parts.join(' · ') }}</p>
        </template>
        <p v-if="location?.reason">{{ location.reason }}</p>
        <p><strong>Described position:</strong> {{ finding.location }}</p>
      </section>

      <section class="qs-finding-detail__section" data-detail="cedex-type">
        <h4>CEDEX damage type</h4>
        <template v-if="type?.best">
          <span class="qs-finding-detail__value">
            <span class="qs-type-code">{{ type.best.code }}</span>
            {{ type.best.name }}
            <span class="qs-finding-detail__basis">Best match</span>
          </span>
          <p v-if="cedexTypeDescription(type.best.code)">
            {{ cedexTypeDescription(type.best.code) }}
          </p>
          <span v-if="type.best.probability === null" class="damage-unavailable"
            >Probability unavailable</span
          >
          <span
            v-else
            class="qs-prob qs-prob--top damage-type__prob"
            :aria-label="`${type.best.code} probability ${type.best.probability.toFixed(2)}`"
          >
            <span class="qs-prob__bar"
              ><i :style="{ '--p': percent(type.best.probability) }"></i
            ></span>
            <span>{{ type.best.probability.toFixed(2) }}</span>
          </span>
        </template>
        <template v-else-if="finding.types.length > 0">
          <span class="qs-finding-detail__value">
            <span class="qs-type-code qs-type-code--none">Uncertain</span>
          </span>
          <p>No damage type is probable enough to name. The candidates are below.</p>
        </template>
        <p v-else>No damage type was rated for this finding.</p>

        <div v-if="type && type.others.length > 0" class="qs-finding-detail__others">
          <strong>{{ type.best ? 'Other possible types' : 'Candidate types' }}</strong>
          <span
            v-for="t in type.others"
            :key="t.code"
            class="damage-type"
            :aria-label="`${t.code} ${t.name}`"
          >
            <span class="damage-type__name">{{ t.code }} {{ t.name }}</span>
            <span v-if="t.probability === null" class="damage-unavailable"
              >Probability unavailable</span
            >
            <span v-else class="qs-prob damage-type__prob">
              <span class="qs-prob__bar"><i :style="{ '--p': percent(t.probability) }"></i></span>
              <span>{{ t.probability.toFixed(2) }}</span>
            </span>
          </span>
        </div>
        <p class="damage-note">
          The damage type says what kind of damage it is, not how serious: severity is judged
          separately.
        </p>
      </section>

      <section class="qs-finding-detail__section" data-detail="interpretation">
        <h4>Interpretation</h4>
        <p v-if="finding.photos && finding.photos.length > 0">
          <strong>Seen in:</strong> {{ finding.photos.length === 1 ? 'photo' : 'photos' }}
          {{ finding.photos.join(', ') }}
        </p>
        <p><strong>Best interpretation:</strong> {{ finding.bestInterpretation }}</p>
        <p><strong>What remains uncertain:</strong> {{ finding.uncertainty }}</p>
        <ul class="qs-finding-detail__caveats damage-caveats">
          <li v-for="c in finding.caveats" :key="c">{{ c }}</li>
        </ul>
      </section>
    </template>
  </article>
</template>
