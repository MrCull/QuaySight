/**
 * Layers teleported to the page body (the loupe, the photo viewer) sit outside whatever element carries the
 * app's `qs-reduced-motion` class, so `.qs-reduced-motion .qs-…` cannot reach them. They mirror the class onto
 * themselves when it is set anywhere else on the page. The `prefers-reduced-motion` media query needs nothing.
 */
export function reducedMotionClassSet(): boolean {
  return document.querySelector('.qs-reduced-motion:not(.qs-loupe):not(.qs-viewer)') !== null
}
