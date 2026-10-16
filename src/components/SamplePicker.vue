<script setup lang="ts">
import { useInspectionStore } from '../stores/inspection'
import { DEMO_SAMPLES } from '../domain/demoSamples'

// design-system/components/PhotoDrop (demo mode): the three bundled samples take the place of the drop zone.
// There is no upload: a visitor's own photo would have no recorded result.
const store = useInspectionStore()
</script>

<template>
  <div class="qs-samples rs-samples">
    <div class="qs-samples__head">
      <span class="qs-samples__title">Choose a sample container</span>
      <span class="qs-samples__why"
        >Each sample opens a result recorded from that photo. It works offline, with no API key and
        no charge. Inspecting your own photos needs an API provider.</span
      >
    </div>
    <div class="qs-samples__grid">
      <button
        v-for="sample in DEMO_SAMPLES"
        :key="sample.id"
        type="button"
        class="qs-sample"
        @click="store.chooseSample(sample.id)"
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
