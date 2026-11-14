// PROTOTYPE (throwaway): what the three dark pointer variants (DK1, DK2, DK3) share: the readings of the
// sample photo with the outlined areas measured on it, and the Night quay theme.
import { onBeforeUnmount, onMounted } from 'vue'
import type { CertaintyLabel } from '../../domain/inspection'
import { useSetupStore } from '../../stores/setup'
import { useTheme } from '../../composables/theme'

/** Left, top, width, height as fractions of samples/jdlu-200690-1-rear-doors.jpg (1080 by 1440). */
export type Box = [number, number, number, number]

export interface Pointer {
  key: string
  label: string
  value: string
  certainty: CertaintyLabel
  /** The outlined areas; the leader runs to the left edge of the first, at its middle. */
  boxes: { box: Box; caption?: string }[]
  plain?: boolean
}

const px = (x0: number, y0: number, x1: number, y1: number): Box => [
  x0 / 1080,
  y0 / 1440,
  (x1 - x0) / 1080,
  (y1 - y0) / 1440,
]

export const POINTERS: Pointer[] = [
  {
    key: 'id',
    label: 'Container ID',
    value: 'JDLU 200690 2',
    certainty: 'Confident',
    boxes: [
      { box: px(640, 368, 724, 419), caption: 'Owner' },
      { box: px(764, 387, 870, 443), caption: 'Serial' },
      { box: px(875, 408, 903, 448), caption: 'Check' },
    ],
  },
  {
    key: 'type',
    label: 'Size and type',
    value: '22G1',
    certainty: 'Confident',
    boxes: [{ box: px(756, 441, 829, 485) }],
  },
  {
    key: 'gross',
    label: 'Max gross',
    value: '32,500 kg',
    certainty: 'Confident',
    boxes: [{ box: px(612, 520, 840, 561) }],
  },
  {
    key: 'tare',
    label: 'Tare',
    value: '2,180 kg',
    certainty: 'Confident',
    boxes: [{ box: px(616, 566, 848, 610) }],
  },
  {
    key: 'payload',
    label: 'Payload',
    value: '30,320 kg',
    certainty: 'Confident',
    boxes: [{ box: px(614, 624, 844, 664) }],
  },
  {
    key: 'cube',
    label: 'Cubic capacity',
    value: '33.2 m³',
    certainty: 'Confident',
    boxes: [{ box: px(620, 674, 870, 714) }],
  },
  {
    key: 'marking',
    label: 'Marking',
    value: 'Super heavy',
    certainty: 'Likely',
    boxes: [{ box: px(803, 797, 889, 891) }],
    plain: true,
  },
]

/** Where a pointer's leader meets the paint: the left edge of its first box, at its middle. */
export const anchor = (p: Pointer) => {
  const [l, t, , h] = p.boxes[0]!.box
  return { x: l, y: t + h / 2 }
}
export const pct = (n: number) => `${(n * 100).toFixed(3)}%`
export const boxStyle = ([l, t, w, h]: Box) =>
  `left: ${pct(l)}; top: ${pct(t)}; width: ${pct(w)}; height: ${pct(h)}`
export const tone = (p: Pointer) => (p.certainty === 'Likely' ? 'likely' : 'confident')

/**
 * Night quay while the landing is on screen. It stays dark when the visitor goes on into the app, and goes
 * back to the earlier theme only when the prototype switcher swaps this variant for another.
 */
export function useNightQuay() {
  const theme = useTheme()
  const setup = useSetupStore()
  let before = theme.theme.value
  onMounted(() => {
    before = theme.theme.value
    theme.set('dark')
  })
  onBeforeUnmount(() => {
    if (setup.view === 'setup') theme.set(before)
  })
}
