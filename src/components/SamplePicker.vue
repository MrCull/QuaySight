<script setup lang="ts">
import { useInspectionStore } from '../stores/inspection'
import { DEMO_SAMPLES, type DemoSampleId } from '../domain/demoSamples'
import { focusNextStep } from './nextStepFocus'

// design-system/components/PhotoDrop (demo mode): the three bundled samples take the place of the drop zone.
// There is no upload: a visitor's own photo would have no recorded result.
// The first tile takes focus after New inspection; choosing a sample moves focus to Start.
const store = useInspectionStore()

function choose(id: DemoSampleId) {
  store.chooseSample(id)
  void focusNextStep('start')
}
</script>

<template>
  <div class="qs-samples rs-samples">
    <div class="qs-samples__head">
      <span id="samples-title" class="qs-samples__title">Choose a sample container</span>
      <span class="qs-samples__why"
        >Each sample opens a result recorded from that photo. It works offline, with no API key and
        no charge. Inspecting your own photos needs an API provider.</span
      >
    </div>
    <div class="qs-samples__grid" role="group" aria-labelledby="samples-title">
      <button
        v-for="(sample, index) in DEMO_SAMPLES"
        :key="sample.id"
        type="button"
        class="qs-sample"
        :data-next-step="index === 0 ? 'photo' : undefined"
        @click="choose(sample.id)"
      >
        <span class="qs-sample__img">
          <img :src="sample.photo.url" alt="" />
          <span class="qs-sample__badge"
            ><i class="qs-glyph qs-glyph--recorded" aria-hidden="true"></i>Saved result</span
          >
        </span>
        <span class="qs-sample__body">
          <strong>{{ sample.title }}</strong>
          <small>{{ sample.hint }}</small>
        </span>
      </button>
    </div>
  </div>
</template>
