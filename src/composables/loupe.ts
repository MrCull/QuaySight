/**
 * The hover loupe's timing (ticket #94, design-system/components/Loupe). One controller serves every photo on
 * the stage, so the loupe can carry over from one photo to the next. Mouse only: touch and pen pointers, and
 * coarse-pointer devices, never see it.
 */
import { onBeforeUnmount, ref, type Ref } from 'vue'
import { loupeLens, placeLoupe, type Lens } from '../domain/loupe'

/** The pointer rests this long on a photo before the loupe appears. */
export const LOUPE_DELAY_MS = 330
/** Reaching another photo within this long after leaving one keeps the loupe showing. */
export const LOUPE_CARRY_MS = 150

export interface LoupeView {
  url: string
  lens: Lens
  left: number
  top: number
}

export interface LoupeController {
  /** What the loupe shows; null while it is hidden. */
  view: Ref<LoupeView | null>
  /** The pointer entered or moved over a photo. */
  track(event: PointerEvent, url: string): void
  /** Hides the loupe and drops any pending appearance: the pointer left or pressed a photo, or it was opened. */
  hide(): void
}

/** The loupe's side and its gap from the pointer, as `.qs-loupe` renders them in the design system. */
interface LoupeMetrics {
  size: number
  gap: number
}

/**
 * Reads the size and gap off a hidden `.qs-loupe`, so the geometry follows the tokens. Without layout (jsdom)
 * nothing measures, so the design system's values at the time of writing stand in: `--space-8` × 3.5 and
 * `--space-5`.
 */
function measureMetrics(): LoupeMetrics {
  const probe = document.createElement('div')
  probe.className = 'qs-loupe'
  probe.style.visibility = 'hidden'
  probe.style.animation = 'none'
  document.body.appendChild(probe)
  try {
    const size = probe.getBoundingClientRect().width
    const gap = parseFloat(getComputedStyle(probe).getPropertyValue('--qs-loupe-gap'))
    return { size: size > 0 ? size : 224, gap: Number.isFinite(gap) ? gap : 24 }
  } finally {
    probe.remove()
  }
}

const coarsePointer = () =>
  window.matchMedia?.('(pointer: coarse)')?.matches === true ||
  window.matchMedia?.('(hover: none)')?.matches === true

export function useLoupe(): LoupeController {
  const view = ref<LoupeView | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null
  /** When a showing loupe last left a photo, and which photo, for the carry-over. */
  let hiddenAt: number | null = null
  let hiddenFrom: string | null = null
  /** The latest view under the pointer, shown when the delay runs out. */
  let pending: LoupeView | null = null
  let metrics: LoupeMetrics | null = null

  function cancel() {
    if (timer !== null) clearTimeout(timer)
    timer = null
    pending = null
  }

  function hide() {
    if (view.value) {
      hiddenAt = Date.now()
      hiddenFrom = view.value.url
    }
    view.value = null
    cancel()
  }

  function measure(event: PointerEvent, url: string): LoupeView | null {
    const img = (event.currentTarget as HTMLElement | null)?.querySelector('img')
    if (!img) return null
    metrics ??= measureMetrics()
    const { size, gap } = metrics
    const lens = loupeLens(
      { x: event.clientX, y: event.clientY },
      img.getBoundingClientRect(),
      { width: img.naturalWidth, height: img.naturalHeight },
      size,
    )
    if (!lens) return null
    const place = placeLoupe({ x: event.clientX, y: event.clientY }, size, gap, {
      width: window.innerWidth,
      height: window.innerHeight,
    })
    return { url, lens, ...place }
  }

  function track(event: PointerEvent, url: string) {
    if (event.pointerType !== 'mouse' || coarsePointer()) return
    const next = measure(event, url)
    if (!next) return hide() // the letterbox bars count as off the photo
    if (view.value) {
      view.value = next
      return
    }
    // Carries over only to another photo; coming back to the same one waits the full delay again.
    if (hiddenAt !== null && hiddenFrom !== url && Date.now() - hiddenAt <= LOUPE_CARRY_MS) {
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

  onBeforeUnmount(cancel)
  return { view, track, hide }
}
