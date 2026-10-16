<script setup lang="ts">
import { ANALYSING_STAGES } from '../domain/analysingStages'
</script>

<template>
  <div class="rs-stagecard">
    <div class="rs-stagecard__k">Analysing</div>
    <ol class="qs-stages" aria-live="polite">
      <li
        v-for="(stage, index) in ANALYSING_STAGES"
        :key="stage"
        :class="['qs-stage', index === 0 ? 'qs-stage--active' : '']"
      >
        <span class="qs-stage__dot"></span>
        <span class="qs-stage__title">{{ stage }}</span>
        <span class="qs-stage__time"></span>
      </li>
    </ol>
  </div>
</template>
