import { reducedMotionClassSet } from './reducedMotion'

/** How long the highlight stays on a detail section the presenter jumped to. */
const HIGHLIGHT_MS = 1800

function prefersReducedMotion(): boolean {
  return (
    reducedMotionClassSet() ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  )
}

/**
 * Brings a detail section into view, moves focus to it and highlights it for a moment
 * (`.qs-flash`, design-system KeyFactTile). Under reduced motion it jumps without scrolling
 * animation and the highlight is a still outline. Returns false when the section is not on screen.
 */
export function jumpToDetail(elementId: string): boolean {
  const target = document.getElementById(elementId)
  if (!target) return false
  target.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  target.focus({ preventScroll: true })
  target.classList.remove('qs-flash')
  // Restart the animation when the same section is chosen twice.
  void target.offsetWidth
  target.classList.add('qs-flash')
  window.setTimeout(() => target.classList.remove('qs-flash'), HIGHLIGHT_MS)
  return true
}
