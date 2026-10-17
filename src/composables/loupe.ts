/**
 * The hover loupe's timing (ticket #94, design-system/components/Loupe). One controller serves every photo on
 * the stage, so the loupe can carry over from one photo to the next. Mouse only: touch and pen pointers, and
 * coarse-pointer devices, never see it.
 */
import { onBeforeUnmount, ref } from 'vue'
import { loupeLens, placeLoupe, type Lens } from '../domain/loupe'

/** The pointer rests this long on a photo before the loupe appears. */
export const LOUPE_DELAY_MS = 330
/** Reaching another photo within this long after leaving one keeps the loupe showing. */
export const LOUPE_CARRY_MS = 150
/** The loupe's side; matches `.qs-loupe` in the design system (`--space-8` × 3.5). */
export const LOUPE_SIZE = 224
/** The gap between the pointer and the loupe; matches `--space-5`. */
export const LOUPE_GAP = 24

export interface LoupeView {
  url: string
  lens: Lens
  left: number
  top: number
}

const coarsePointer = () =>
  window.matchMedia?.('(pointer: coarse)')?.matches === true ||
  window.matchMedia?.('(hover: none)')?.matches === true

export function useLoupe() {
  /** What the loupe shows; null while it is hidden. */
  const view = ref<LoupeView | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null
  /** When a showing loupe last left a photo, for the carry-over. */
  let hiddenAt: number | null = null
  /** The latest view under the pointer, shown when the delay runs out. */
  let pending: LoupeView | null = null

  function cancel() {
    if (timer !== null) clearTimeout(timer)
    timer = null
    pending = null
  }

  function hide() {
    if (view.value) hiddenAt = Date.now()
    view.value = null
    cancel()
  }

  function measure(event: PointerEvent, url: string): LoupeView | null {
    const img = (event.currentTarget as HTMLElement | null)?.querySelector('img')
    if (!img) return null
    const lens = loupeLens(
      { x: event.clientX, y: event.clientY },
      img.getBoundingClientRect(),
      { width: img.naturalWidth, height: img.naturalHeight },
      LOUPE_SIZE,
    )
    if (!lens) return null
    const place = placeLoupe({ x: event.clientX, y: event.clientY }, LOUPE_SIZE, LOUPE_GAP, {
      width: window.innerWidth,
      height: window.innerHeight,
    })
    return { url, lens, ...place }
  }

  /** The pointer entered or moved over a photo. */
  function track(event: PointerEvent, url: string) {
    if (event.pointerType !== 'mouse' || coarsePointer()) return
    const next = measure(event, url)
    if (!next) return hide() // the letterbox bars count as off the photo
    if (view.value) {
      view.value = next
      return
    }
    if (hiddenAt !== null && Date.now() - hiddenAt <= LOUPE_CARRY_MS) {
      cancel()
      view.value = next
      return
    }
    pending = next
    timer ??= setTimeout(() => {
      timer = null
      view.value = pending
      pending = null
    }, LOUPE_DELAY_MS)
  }

  /** The pointer left a photo, or pressed it to open the viewer. */
  function leave() {
    hide()
  }

  onBeforeUnmount(cancel)
  return { view, track, leave }
}
