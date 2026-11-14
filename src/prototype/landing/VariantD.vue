<script setup lang="ts">
// PROTOTYPE variant D, "Survey drawing": a drawing sheet. An isometric 20 ft container is drawn in line, with
// numbered callouts for the six things Quay Sight reads. Headline top left, key field bottom right, and a
// title block along the foot. No photographs; the drawing is generated below.
import ProtoKeyField from './ProtoKeyField.vue'

// Isometric projection of a 20 ft container (metres), doors at the near left, long side rising to the right.
const L = 6.058
const W = 2.438
const H = 2.591
const S = 92
const OX = 900
const OY = 300
type P3 = [number, number, number]
const pt = ([x, y, z]: P3): [number, number] => [
  OX + (y - x) * S * 0.866,
  OY + (x + y) * S * 0.5 - z * S,
]
const poly = (points: P3[]) =>
  points
    .map((p) =>
      pt(p)
        .map((n) => n.toFixed(1))
        .join(','),
    )
    .join(' ')
const line = (a: P3, b: P3) => {
  const [x1, y1] = pt(a)
  const [x2, y2] = pt(b)
  return { x1, y1, x2, y2 }
}
const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, n) => from + n * step)

const faces = {
  shadow: poly([
    [L + 0.22, 0, 0],
    [L + 0.22, W + 0.28, 0],
    [0, W + 0.28, 0],
    [0, W, 0],
    [L, W, 0],
    [L, 0, 0],
  ]),
  top: poly([
    [0, 0, H],
    [L, 0, H],
    [L, W, H],
    [0, W, H],
  ]),
  side: poly([
    [0, W, 0],
    [L, W, 0],
    [L, W, H],
    [0, W, H],
  ]),
  end: poly([
    [L, 0, 0],
    [L, W, 0],
    [L, W, H],
    [L, 0, H],
  ]),
  leafL: poly([
    [L, 0.1, 0.14],
    [L, W / 2 - 0.02, 0.14],
    [L, W / 2 - 0.02, H - 0.14],
    [L, 0.1, H - 0.14],
  ]),
  leafR: poly([
    [L, W / 2 + 0.02, 0.14],
    [L, W - 0.1, 0.14],
    [L, W - 0.1, H - 0.14],
    [L, W / 2 + 0.02, H - 0.14],
  ]),
}
const ribs = range(0.22, L - 0.2, 0.152).map((x) => line([x, W, 0.16], [x, W, H - 0.14]))
const roof = range(0.3, L - 0.2, 0.3).map((x) => line([x, 0.06, H], [x, W - 0.06, H]))
const rails = [line([0, W, 0.14], [L, W, 0.14]), line([0, W, H - 0.12], [L, W, H - 0.12])]
const rods = [0.36, 0.86, 1.58, 2.08].map((y) => line([L, y, 0.1], [L, y, H - 0.1]))
const handles = [
  line([L, 0.36, 1.0], [L, 0.74, 1.0]),
  line([L, 0.86, 0.86], [L, 0.5, 0.86]),
  line([L, 1.58, 0.86], [L, 1.94, 0.86]),
  line([L, 2.08, 1.0], [L, 1.7, 1.0]),
]
const castings = (
  [
    [
      [L, 0, 0],
      [L, 0.18, 0],
      [L, 0.18, 0.12],
      [L, 0, 0.12],
    ],
    [
      [L, W - 0.18, 0],
      [L, W, 0],
      [L, W, 0.12],
      [L, W - 0.18, 0.12],
    ],
    [
      [L, 0, H - 0.12],
      [L, 0.18, H - 0.12],
      [L, 0.18, H],
      [L, 0, H],
    ],
    [
      [L, W - 0.18, H - 0.12],
      [L, W, H - 0.12],
      [L, W, H],
      [L, W - 0.18, H],
    ],
    [
      [L, W, 0],
      [L - 0.18, W, 0],
      [L - 0.18, W, 0.12],
      [L, W, 0.12],
    ],
    [
      [L, W, H - 0.12],
      [L - 0.18, W, H - 0.12],
      [L - 0.18, W, H],
      [L, W, H],
    ],
    [
      [0, W, 0],
      [0.18, W, 0],
      [0.18, W, 0.12],
      [0, W, 0.12],
    ],
    [
      [0, W, H - 0.12],
      [0.18, W, H - 0.12],
      [0.18, W, H],
      [0, W, H],
    ],
  ] as P3[][]
).map(poly)

// Text painted on a face: sheared to lie in its plane.
const onEnd = (y: number, z: number) => `matrix(0.866,0.5,0,1,${pt([L, y, z]).join(',')})`
const placard = poly([
  [0.9, W, 1.93],
  [1.08, W, 1.75],
  [0.9, W, 1.57],
  [0.72, W, 1.75],
])
const dent = pt([1.9, W, 0.72])

// Dimension lines, set off from the near bottom edges.
const dimLength = {
  ...line([L, W + 0.42, 0], [0, W + 0.42, 0]),
  a: line([L, W + 0.1, 0], [L, W + 0.55, 0]),
  b: line([0, W + 0.1, 0], [0, W + 0.55, 0]),
}
const dimWidth = {
  ...line([L + 0.42, 0, 0], [L + 0.42, W, 0]),
  a: line([L + 0.1, 0, 0], [L + 0.55, 0, 0]),
  b: line([L + 0.1, W, 0], [L + 0.55, W, 0]),
}
const along = (d: { x1: number; y1: number; x2: number; y2: number }, t = 0.5) => [
  d.x1 + (d.x2 - d.x1) * t,
  d.y1 + (d.y2 - d.y1) * t,
]

// Callouts: a dot on the feature, a straight leader, and the numbered label in the margin.
const CALLOUTS: {
  n: number
  title: string
  lines: string[]
  at: P3
  x: number
  y: number
  side: 'left' | 'right'
}[] = [
  {
    n: 1,
    title: 'Container ID',
    lines: ['Owner code, serial and check digit,', 'checked against ISO 6346'],
    at: [L, 1.27, 2.31],
    x: 40,
    y: 404,
    side: 'left',
  },
  {
    n: 2,
    title: 'Size and type',
    lines: ['22G1 reads as 20 ft, 8 ft 6 in high,', 'general purpose'],
    at: [L, 1.6, 2.1],
    x: 40,
    y: 474,
    side: 'left',
  },
  {
    n: 3,
    title: 'Weights',
    lines: ['Max gross, tare, payload and', 'cubic capacity, in kg or lb'],
    at: [L, 1.27, 1.57],
    x: 40,
    y: 544,
    side: 'left',
  },
  {
    n: 4,
    title: 'Seal',
    lines: ['Its number, when a close-up', 'photo shows it'],
    at: [L, 1.62, 0.92],
    x: 40,
    y: 614,
    side: 'left',
  },
  {
    n: 5,
    title: 'Placards',
    lines: ['DG placards and other', 'safety markings in view'],
    at: [0.9, W, 1.75],
    x: 1150,
    y: 236,
    side: 'right',
  },
  {
    n: 6,
    title: 'Damage',
    lines: ['Suspected dents, tears and', 'corrosion, each with a severity'],
    at: [1.9, W, 0.72],
    x: 1150,
    y: 318,
    side: 'right',
  },
]
const callouts = CALLOUTS.map((c) => {
  const [px, py] = pt(c.at)
  return { ...c, px, py, lx: c.side === 'left' ? c.x + 292 : c.x - 12, ly: c.y }
})

const BLOCK = [
  ['Drawing', 'Sample container JDLU 200690 2'],
  ['Scale', 'Not to scale'],
  ['Photos', '1 to 5 of one container'],
  ['Spend cap', '50 requests · $0.50'],
  ['Status', 'Not a certified survey'],
  ['Sheet', '1 of 1'],
]
</script>

<template>
  <main class="ld">
    <div class="ld__sheet">
      <ol class="ld__ruler" aria-hidden="true">
        <li v-for="n in 8" :key="n">{{ n }}</li>
      </ol>

      <div class="ld__stage">
        <svg
          class="ld__drawing"
          viewBox="0 0 1392 730"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Line drawing of a 20 foot container with six numbered callouts: container ID, size and type, weights, seal, placards and damage"
        >
          <polygon class="ld__shadow" :points="faces.shadow" />
          <g class="ld__solid">
            <polygon class="ld__face ld__face--top" :points="faces.top" />
            <polygon class="ld__face ld__face--side" :points="faces.side" />
            <polygon class="ld__face ld__face--end" :points="faces.end" />
          </g>
          <g class="ld__fine">
            <line v-for="(r, n) in roof" :key="`t${n}`" v-bind="r" pathLength="1" />
            <line
              v-for="(r, n) in ribs"
              :key="`r${n}`"
              v-bind="r"
              pathLength="1"
              :style="`--i: ${n}`"
            />
          </g>
          <g class="ld__ink">
            <line v-for="(r, n) in rails" :key="`a${n}`" v-bind="r" pathLength="1" />
            <polygon :points="faces.leafL" pathLength="1" />
            <polygon :points="faces.leafR" pathLength="1" />
            <polygon
              v-for="(c, n) in castings"
              :key="`c${n}`"
              class="ld__casting"
              :points="c"
              pathLength="1"
            />
            <polygon :points="placard" pathLength="1" />
            <ellipse
              class="ld__dent"
              :cx="dent[0]"
              :cy="dent[1]"
              rx="34"
              ry="22"
              transform-origin="center"
              pathLength="1"
            />
          </g>
          <g class="ld__rods">
            <line v-for="(r, n) in rods" :key="`d${n}`" v-bind="r" pathLength="1" />
            <line v-for="(r, n) in handles" :key="`h${n}`" v-bind="r" pathLength="1" />
          </g>
          <g class="ld__paint">
            <text :transform="onEnd(1.33, 2.26)">
              JDLU 200690
              <tspan class="ld__check">2</tspan>
            </text>
            <text :transform="onEnd(1.66, 2.06)">22G1</text>
            <text class="ld__small" :transform="onEnd(1.33, 1.74)">MAX GROSS 32,500 KG</text>
            <text class="ld__small" :transform="onEnd(1.33, 1.62)">TARE 2,180 KG</text>
            <text class="ld__small" :transform="onEnd(1.33, 1.5)">PAYLOAD 30,320 KG</text>
            <text class="ld__small" :transform="onEnd(1.33, 1.38)">CU. CAP. 33.2 CU.M</text>
          </g>

          <g class="ld__dim">
            <line v-bind="line([L, W + 0.42, 0], [0, W + 0.42, 0])" />
            <line v-bind="dimLength.a" />
            <line v-bind="dimLength.b" />
            <line v-bind="line([L + 0.42, 0, 0], [L + 0.42, W, 0])" />
            <line v-bind="dimWidth.a" />
            <line v-bind="dimWidth.b" />
            <text :x="along(dimLength, 0.2)[0]! + 14" :y="along(dimLength, 0.2)[1]! + 22">
              6.06 m · 20 ft
            </text>
            <text :x="along(dimWidth)[0]! - 14" :y="along(dimWidth)[1]! + 22" text-anchor="end">
              2.44 m · 8 ft
            </text>
          </g>

          <g v-for="c in callouts" :key="c.n" class="ld__callout" :style="`--i: ${c.n}`">
            <line class="ld__leader" :x1="c.lx" :y1="c.ly" :x2="c.px" :y2="c.py" pathLength="1" />
            <circle class="ld__dot" :cx="c.px" :cy="c.py" r="4.5" />
            <g :transform="`translate(${c.x}, ${c.y})`">
              <circle class="ld__num" cx="14" cy="0" r="14" />
              <text class="ld__num-text" x="14" y="5" text-anchor="middle">{{ c.n }}</text>
              <text class="ld__label" x="40" y="-2">{{ c.title }}</text>
              <text
                v-for="(text, n) in c.lines"
                :key="text"
                class="ld__desc"
                x="40"
                :y="17 + n * 17"
              >
                {{ text }}
              </text>
            </g>
          </g>
        </svg>

        <header class="ld__head">
          <span class="ld__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</span>
          <h1 class="ld__title">Container inspection from photos.</h1>
          <p class="ld__sub">
            Six kinds of reading from one to five photographs, each with its certainty.
          </p>
        </header>

        <div class="ld__start">
          <p>Start an inspection</p>
          <ProtoKeyField />
        </div>
      </div>

      <dl class="ld__block">
        <div v-for="[label, value] in BLOCK" :key="label">
          <dt>{{ label }}</dt>
          <dd>{{ value }}</dd>
        </div>
      </dl>
    </div>
  </main>
</template>

<style scoped>
.ld {
  --rule: color-mix(in srgb, var(--landing-ink) 82%, transparent);
  --grid: color-mix(in srgb, var(--schem-grid) 16%, transparent);
  flex: 1;
  display: flex;
  padding: var(--space-5) var(--space-5) 0;
  background: var(--landing-bg);
  color: var(--landing-ink);
}
.ld__sheet {
  flex: 1;
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-width: 0;
  border: 1.5px solid var(--rule);
  background:
    linear-gradient(var(--grid) 1px, transparent 1px) 0 0 / 24px 24px,
    linear-gradient(90deg, var(--grid) 1px, transparent 1px) 0 0 / 24px 24px,
    var(--landing-surface);
}
.ld__ruler {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  margin: 0;
  padding: 0;
  border-bottom: 1px solid var(--rule);
  list-style: none;
  background: var(--landing-surface);
}
.ld__ruler li {
  border-left: 1px solid var(--rule);
  color: var(--landing-ink-muted);
  font: 500 0.6875rem/1.25rem var(--font-mono);
  text-align: center;
}
.ld__ruler li:first-child {
  border-left: 0;
}
.ld__stage {
  position: relative;
  min-height: 620px;
}
.ld__drawing {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* The drawing */
.ld__shadow {
  fill: var(--schem-shadow);
  opacity: 0.5;
}
.ld__face {
  stroke: var(--schem-stroke);
  stroke-width: 1.6;
  stroke-linejoin: round;
  animation: ld-fade 900ms ease-out 200ms both;
}
.ld__face--top {
  fill: var(--schem-top);
}
.ld__face--side {
  fill: var(--schem-side);
}
.ld__face--end {
  fill: var(--schem-end);
}
.ld__fine line {
  stroke: var(--schem-rail);
  stroke-width: 1;
  stroke-dasharray: 1;
  animation: ld-draw 700ms ease-out both;
  animation-delay: calc(500ms + var(--i, 0) * 14ms);
}
.ld__ink > * {
  fill: none;
  stroke: var(--schem-stroke);
  stroke-width: 1.3;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  animation: ld-draw 900ms ease-out 700ms both;
}
.ld__ink .ld__casting {
  fill: var(--schem-rail);
}
.ld__ink .ld__dent {
  stroke-dasharray: 0.04 0.03;
  transform: skewY(-30deg);
  transform-box: fill-box;
}
.ld__rods line {
  stroke: var(--schem-detail);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-dasharray: 1;
  animation: ld-draw 900ms ease-out 900ms both;
}
.ld__paint text {
  fill: var(--schem-detail);
  font: 600 0.875rem/1 var(--font-display);
  letter-spacing: 0.04em;
  animation: ld-fade 600ms ease-out 1300ms both;
}
.ld__paint .ld__small {
  font-size: 0.4375rem;
  letter-spacing: 0.06em;
}
.ld__dim line {
  stroke: var(--landing-ink-muted);
  stroke-width: 1;
}
.ld__dim text {
  fill: var(--landing-ink-muted);
  font: 500 0.75rem/1 var(--font-mono);
}

/* Callouts */
.ld__callout {
  animation: ld-fade 500ms ease-out both;
  animation-delay: calc(1300ms + var(--i) * 120ms);
}
.ld__leader {
  stroke: var(--landing-ink);
  stroke-width: 1;
  stroke-dasharray: 1;
  animation: ld-draw 500ms ease-out both;
  animation-delay: calc(1300ms + var(--i) * 120ms);
}
.ld__dot {
  fill: var(--landing-ink);
  stroke: var(--landing-surface);
  stroke-width: 2;
}
.ld__num {
  fill: var(--landing-ink);
}
.ld__num-text {
  fill: var(--landing-on-ink);
  font: 600 0.875rem/1 var(--font-mono);
}
.ld__label {
  fill: var(--landing-ink);
  font: 600 1rem/1 var(--font-sans);
}
.ld__desc {
  fill: var(--landing-ink-muted);
  font: 400 0.8125rem/1 var(--font-sans);
}

/* Headline, top left of the sheet */
.ld__head {
  position: absolute;
  left: var(--space-7);
  top: var(--space-6);
  width: min(600px, 44%);
}
.ld__brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font: 700 1.25rem/1 var(--font-hero);
  letter-spacing: -0.02em;
}
.ld__brand .qs-logo {
  width: 26px;
  height: 26px;
  color: inherit;
}
.ld__title {
  margin: var(--space-5) 0 var(--space-3);
  font: 700 clamp(2.5rem, 4.2vw, 4.75rem)/0.96 var(--font-hero);
  letter-spacing: -0.045em;
  text-wrap: balance;
}
.ld__sub {
  max-width: 26rem;
  margin: 0;
  color: var(--landing-ink-muted);
  font: 400 1rem/1.5rem var(--font-sans);
}

/* Key field, bottom right */
.ld__start {
  --lp-align: start;
  --lp-field-width: 100%;
  --lp-field-radius: var(--radius-md);
  --lp-field-inner-radius: var(--radius-sm);
  --lp-field-shadow: 0 0 0 1.5px var(--rule), var(--shadow-landing);
  position: absolute;
  right: var(--space-6);
  bottom: var(--space-5);
  width: min(460px, 34%);
}
.ld__start > p {
  margin: 0 0 var(--space-2);
  font: 600 0.75rem/1.25rem var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* Title block */
.ld__block {
  display: grid;
  grid-template-columns: 2fr 1fr 1.6fr 1.4fr 1.6fr 0.7fr;
  margin: 0;
  border-top: 1.5px solid var(--rule);
  background: var(--landing-surface);
}
.ld__block div {
  padding: var(--space-2) var(--space-4) var(--space-3);
  border-left: 1px solid var(--rule);
}
.ld__block div:first-child {
  border-left: 0;
}
.ld__block dt {
  color: var(--landing-ink-muted);
  font: 600 0.6875rem/1.25rem var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ld__block dd {
  margin: 0;
  font: 500 0.875rem/1.25rem var(--font-mono);
}

@keyframes ld-draw {
  from {
    stroke-dashoffset: 1;
  }
}
@keyframes ld-fade {
  from {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ld * {
    animation: none !important;
  }
}
@media (max-width: 1100px) {
  .ld__stage {
    display: grid;
    gap: var(--space-5);
    padding: var(--space-5);
  }
  .ld__drawing,
  .ld__head,
  .ld__start {
    position: static;
    width: 100%;
  }
  .ld__drawing {
    order: 2;
    height: auto;
  }
  .ld__start {
    order: 3;
  }
  .ld__block {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
