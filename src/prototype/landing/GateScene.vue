<script setup lang="ts">
// PROTOTYPE (throwaway): the gate photograph as a layered scene. The picture covers its box; `behind` sits
// between the sky and a cut-out of everything that is not sky (so type can stand behind the container and
// the gantry), and the default slot sits on top. Everything inside is placed in percentages of the picture,
// and `cqw` inside the slots is a hundredth of the picture's width.
import gate from './assets/gate.jpg'
import front from './assets/gate-front.webp'

withDefaults(defineProps<{ fx?: number; fy?: number; night?: boolean }>(), {
  fx: 0.5,
  fy: 0,
  night: false,
})
</script>

<template>
  <div :class="['gs', { 'gs--night': night }]" :style="`--fx: ${fx}; --fy: ${fy}`">
    <div class="gs__canvas">
      <img class="gs__sky" :src="gate" alt="" />
      <div class="gs__behind"><slot name="behind" /></div>
      <img class="gs__front" :src="front" alt="" />
      <div class="gs__over"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.gs {
  position: relative;
  overflow: hidden;
  container-type: size;
}
.gs__canvas {
  --w: max(100cqw, calc(100cqh * 0.85746));
  position: absolute;
  left: calc((100cqw - var(--w)) * var(--fx));
  top: calc((100cqh - var(--w) / 0.85746) * var(--fy));
  width: var(--w);
  aspect-ratio: 1161 / 1354;
  container-type: inline-size;
}
.gs__sky,
.gs__front,
.gs__behind,
.gs__over {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.gs__sky,
.gs__front {
  display: block;
  user-select: none;
  pointer-events: none;
}

/* Night quay: the sky gives way to dusk and the scene is graded down, leaving the lamps bright. */
.gs--night .gs__sky {
  opacity: 0;
}
.gs--night .gs__canvas {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--brand) 16%, var(--landing-bg)) 0%,
    color-mix(in srgb, var(--brand) 34%, var(--landing-bg)) 30%,
    color-mix(in srgb, var(--brand) 12%, var(--landing-bg)) 62%
  );
}
.gs--night .gs__front {
  filter: brightness(0.5) contrast(1.12) saturate(0.82);
}
</style>
