<script setup lang="ts">
import heroPhoto from '../../samples/rear-door-aphu-45g1.jpg'
import CertaintyChip from './CertaintyChip.vue'
import type { CertaintyLabel } from '../domain/inspection'

// The first screen's opening panel: a container photograph (the photo leads), what an inspection reads from
// it, and the five certainty words every value carries. Words only: it shows no reading and claims no result.
const READS = [
  {
    glyph: 'tag',
    title: 'Container number',
    body: 'Reads the ID painted on the container and checks it against its check digit.',
  },
  {
    glyph: 'padlock',
    title: 'Door markings',
    body: 'Size and type, weights, seal number and hazard placards.',
  },
  {
    glyph: 'container',
    title: 'Possible damage',
    body: 'Dents, holes and wear, marked on a drawing of the container.',
  },
] as const

const WORDS: CertaintyLabel[] = ['Confident', 'Likely', 'Uncertain', "Can't tell", 'Not seen']
</script>

<template>
  <section class="rs-hero" aria-labelledby="hero-title">
    <img class="rs-hero__photo" :src="heroPhoto" alt="" />
    <div class="rs-hero__shade" aria-hidden="true"></div>
    <!-- Viewfinder corners: the photograph is what gets inspected. -->
    <div class="rs-hero__finder" aria-hidden="true"><i></i><i></i><i></i><i></i></div>

    <div class="rs-hero__copy">
      <p class="rs-hero__eyebrow qs-type-label">Container inspection from photographs</p>
      <h1 id="hero-title" class="rs-hero__title">
        Inspect a shipping container from photos.
        <span>Every result shows how certain it is.</span>
      </h1>
      <p class="rs-hero__lede qs-type-body">
        Upload one to five photos of a container. Quay Sight reads the container number and door
        markings, flags possible damage, and tells you how certain it is about each result. This is
        a demonstration, not a certified survey.
      </p>

      <ul class="rs-hero__reads">
        <li v-for="(read, i) in READS" :key="read.title" :style="{ '--i': i }">
          <span class="rs-hero__glyph"
            ><i :class="['qs-glyph', `qs-glyph--${read.glyph}`]" aria-hidden="true"></i
          ></span>
          <strong class="qs-type-body">{{ read.title }}</strong>
          <span class="qs-type-body-sm">{{ read.body }}</span>
        </li>
      </ul>

      <div class="rs-hero__words">
        <span class="qs-type-label">Each result is labelled with one of five certainty levels</span>
        <span class="rs-hero__chips">
          <CertaintyChip v-for="word in WORDS" :key="word" :level="word" />
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rs-hero {
  position: relative;
  display: grid;
  align-content: end;
  min-width: 0;
  overflow: hidden;
  isolation: isolate;
  background: var(--hero-ground);
  color: var(--on-hero);
}
.rs-hero__photo {
  position: absolute;
  inset: 0;
  z-index: -2;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 12% 40%;
  animation: rs-hero-settle calc(var(--duration-arrive) * 3) cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
/* The headline reads on any photo: deep at the foot and the reading edge, clear over the doors. */
.rs-hero__shade {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(
      0deg,
      var(--hero-ground) 0%,
      color-mix(in srgb, var(--hero-ground) 92%, transparent) 45%,
      color-mix(in srgb, var(--hero-ground) 72%, transparent) 80%,
      color-mix(in srgb, var(--hero-ground) 60%, transparent) 100%
    ),
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--hero-ground) 85%, transparent) 0%,
      color-mix(in srgb, var(--hero-ground) 55%, transparent) 70%,
      transparent 100%
    );
}
.rs-hero__finder {
  position: absolute;
  inset: var(--space-5);
  z-index: -1;
  pointer-events: none;
}
.rs-hero__finder i {
  position: absolute;
  width: var(--space-5);
  height: var(--space-5);
  border: 2px solid var(--on-hero);
  opacity: 0.7;
}
.rs-hero__finder i:nth-child(1) {
  top: 0;
  left: 0;
  border-right: 0;
  border-bottom: 0;
}
.rs-hero__finder i:nth-child(2) {
  top: 0;
  right: 0;
  border-left: 0;
  border-bottom: 0;
}
.rs-hero__finder i:nth-child(3) {
  bottom: 0;
  left: 0;
  border-right: 0;
  border-top: 0;
}
.rs-hero__finder i:nth-child(4) {
  bottom: 0;
  right: 0;
  border-left: 0;
  border-top: 0;
}
.rs-hero__copy {
  display: grid;
  gap: var(--space-5);
  max-width: calc(var(--space-8) * 11);
  padding: var(--space-8);
}
.rs-hero__copy > * {
  margin: 0;
  animation: qs-rise var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.rs-hero__copy > :nth-child(2) {
  animation-delay: 70ms;
}
.rs-hero__copy > :nth-child(3) {
  animation-delay: 140ms;
}
.rs-hero__copy > :nth-child(4) {
  animation-delay: 210ms;
}
.rs-hero__copy > :nth-child(5) {
  animation-delay: 280ms;
}
.rs-hero__eyebrow {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--on-hero-muted);
}
.rs-hero__eyebrow::before {
  content: '';
  width: var(--space-6);
  height: 2px;
  background: currentColor;
}
/* display-lg on a phone up to display-xl and a step beyond on a projected screen. */
.rs-hero__title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(2.5rem, 1.2rem + 3.6vw, 5rem);
  line-height: 0.96;
  letter-spacing: -0.01em;
  text-wrap: balance;
}
.rs-hero__title span {
  display: block;
  color: var(--on-hero-muted);
}
.rs-hero__lede {
  max-width: 56ch;
  color: var(--on-hero-muted);
}
.rs-hero__reads {
  list-style: none;
  padding: var(--space-5) 0 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-5);
  border-top: 1px solid color-mix(in srgb, var(--on-hero) 24%, transparent);
}
.rs-hero__reads li {
  display: grid;
  align-content: start;
  gap: var(--space-1);
}
.rs-hero__reads strong {
  font-weight: 600;
}
.rs-hero__reads li > span:last-child {
  color: var(--on-hero-muted);
}
.rs-hero__glyph {
  display: grid;
  place-items: center;
  width: var(--control-md);
  height: var(--control-md);
  margin-bottom: var(--space-2);
  border: 1px solid color-mix(in srgb, var(--on-hero) 36%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--on-hero) 10%, transparent);
}
.rs-hero__glyph .qs-glyph {
  width: var(--space-5);
  height: var(--space-5);
}
.rs-hero__words {
  display: grid;
  gap: var(--space-3);
  color: var(--on-hero-muted);
}
.rs-hero__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
@keyframes rs-hero-settle {
  from {
    transform: scale(1.06);
  }
  to {
    transform: none;
  }
}
/* Narrower than a laptop: the hero is a short banner over the setup card, with the words but not the list. */
@media (max-width: 1100px) {
  .rs-hero__copy {
    gap: var(--space-4);
    padding: var(--space-7) var(--space-5) var(--space-5);
  }
  .rs-hero__reads {
    display: none;
  }
  .rs-hero__finder {
    inset: var(--space-3);
  }
}
@media (max-width: 640px) {
  .rs-hero__copy {
    padding: var(--space-7) var(--space-4) var(--space-4);
  }
  .rs-hero__words {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .rs-hero__photo,
  .rs-hero__copy > * {
    animation: none;
  }
}
</style>
