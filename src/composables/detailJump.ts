import { nextTick, ref } from 'vue'
import { prefersReducedMotion } from './reducedMotion'

/** How long the highlight stays on a detail section the presenter jumped to. */
const HIGHLIGHT_MS = 1800

/** The ids of the detail sections a key-facts tile leads to, one place for the tiles and the sections. */
export const DETAIL_IDS = {
  id: 'detail-id',
  seal: 'detail-seal',
  damage: 'detail-damage',
  markings: 'detail-markings',
} as const

/** The tabs under the readings (design-system Tabs), in the order they show. */
export type DetailTab = 'characteristics' | 'damage' | 'markings'

/** The tab the presenter is on. A jump to a section in another tab's panel opens that tab. */
export const detailTab = ref<DetailTab>('characteristics')

/**
 * Brings a detail section into view, moves focus to it and highlights it for a moment
 * (`.qs-flash`, design-system KeyFactTile). A section in a tab panel (`data-detail-tab`) has its tab
 * opened first. Under reduced motion it jumps without scrolling animation and the highlight is a
 * still outline. Returns false when the section is not on screen.
 */
export function jumpToDetail(elementId: string): boolean {
  const target = document.getElementById(elementId)
  if (!target) return false
  const tab = target.closest<HTMLElement>('[data-detail-tab]')?.dataset.detailTab as
    | DetailTab
    | undefined
  if (tab && tab !== detailTab.value) {
    detailTab.value = tab
    // The panel is shown on the next render; nothing can scroll to it before then.
    void nextTick(() => reveal(target))
  } else {
    reveal(target)
  }
  return true
}

function reveal(target: HTMLElement) {
  target.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  target.focus({ preventScroll: true })
  target.classList.remove('qs-flash')
  // Restart the animation when the same section is chosen twice.
  void target.offsetWidth
  target.classList.add('qs-flash')
  window.setTimeout(() => target.classList.remove('qs-flash'), HIGHLIGHT_MS)
}
