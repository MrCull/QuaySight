<script setup lang="ts">
import { useInspectionStore } from '../stores/inspection'
import { demoSamples, type DemoSampleId } from '../domain/demoSamples'
import { focusNextStep } from './nextStepFocus'

// design-system/components/PhotoDrop (demo mode): the bundled samples take the place of the drop zone.
// There is no upload: a visitor's own photo would have no recorded result.
// The first tile takes focus after New inspection; choosing a sample starts the recorded inspection and moves focus to Cancel.
const store = useInspectionStore()
// The samples that have a recording; a photo with none yet is not offered.
const samples = demoSamples()

function choose(id: DemoSampleId) {
  store.chooseSample(id)
  void store.start()
  void focusNextStep('start')
}
</script>

<template>
  <div class="qs-samples rs-samples">
    <div class="qs-samples__head">
      <h1 id="samples-title" class="rs-samples__title qs-type-display-lg">
        Choose a sample container
      </h1>
      <span class="qs-samples__why"
        >Each sample opens a result recorded from that photo. It works offline, with no API key and
        no charge. Inspecting your own photos needs an API provider.</span
      >
    </div>
    <div class="qs-samples__grid" role="group" aria-labelledby="samples-title">
      <button
        v-for="(sample, index) in samples"
        :key="sample.id"
        type="button"
        class="qs-sample"
        :style="{ '--i': index }"
        :data-next-step="index === 0 ? 'photo' : undefined"
        @click="choose(sample.id)"
      >
        <span class="qs-sample__img">
          <img :src="sample.photo.url" alt="" />
          <span class="qs-sample__badge"
            ><i class="qs-glyph qs-glyph--recorded" aria-hidden="true"></i>Saved result</span
          >
          <span v-if="sample.photos.length > 1" class="qs-sample__badge rs-samples__count"
            ><i class="qs-glyph qs-glyph--photo" aria-hidden="true"></i
            >{{ sample.photos.length }} photos</span
          >
        </span>
        <span class="qs-sample__body">
          <span class="rs-samples__name qs-type-display-md">{{ sample.title }}</span>
          <small>{{ sample.hint }}</small>
          <span class="rs-samples__open qs-type-body-sm" aria-hidden="true"
            >Open saved result<i class="qs-glyph qs-glyph--chevron"></i
          ></span>
        </span>
      </button>
    </div>
  </div>
</template>
