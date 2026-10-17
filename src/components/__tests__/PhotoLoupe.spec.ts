import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import PhotoPanel from '../PhotoPanel.vue'

/**
 * Ticket #94: resting the mouse on a container photo for 330ms shows a loupe beside the cursor with the spot
 * under it magnified. It hides straight away on leaving the photo or its letterbox bars, and carries over
 * to another photo reached within about 150ms.
 */
const photo = (name: string) => ({ name, orientation: 'landscape', url: `blob:${name}` }) as never

let wrapper: VueWrapper | null = null
const loupe = () => document.querySelector<HTMLElement>('.qs-loupe')
const frames = () => [...document.querySelectorAll<HTMLElement>('.rs-frame')]

/** jsdom has no layout: give each frame a 500 × 320 box at (100, 50) holding a 4000 × 2560 original. */
function layOut(frame: HTMLElement, natural = { width: 4000, height: 2560 }) {
  const img = frame.querySelector('img')!
  const box = {
    left: 100,
    top: 50,
    width: 500,
    height: 320,
    right: 600,
    bottom: 370,
    x: 100,
    y: 50,
  }
  img.getBoundingClientRect = () => ({ ...box, toJSON: () => box }) as DOMRect
  Object.defineProperty(img, 'naturalWidth', { value: natural.width, configurable: true })
  Object.defineProperty(img, 'naturalHeight', { value: natural.height, configurable: true })
}

function mountWith(...names: string[]) {
  const store = useInspectionStore()
  if (names.length === 1) store.setPhoto(photo(names[0]!))
  else store.setPhotos(names.map(photo))
  wrapper = mount(PhotoPanel, { attachTo: document.body })
  for (const frame of frames()) layOut(frame)
  return wrapper
}

async function pointer(
  target: HTMLElement,
  type: 'pointerenter' | 'pointermove' | 'pointerleave',
  at = { x: 350, y: 210 },
  pointerType = 'mouse',
) {
  target.dispatchEvent(
    new PointerEvent(type, { clientX: at.x, clientY: at.y, pointerType, bubbles: true }),
  )
  await wrapper!.vm.$nextTick()
}

async function wait(ms: number) {
  vi.advanceTimersByTime(ms)
  await wrapper!.vm.$nextTick()
}

describe('PhotoLoupe', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.useRealTimers()
  })

  it('appears after the pointer rests on the photo for 330ms, not sooner', async () => {
    mountWith('door.jpg')
    const [frame] = frames()
    await pointer(frame!, 'pointerenter')
    await pointer(frame!, 'pointermove')
    await wait(329)
    expect(loupe()).toBeNull()

    await wait(1)
    expect(loupe()).not.toBeNull()
  })

  it('shows the original photo, decoratively, with nothing drawn on it', async () => {
    mountWith('door.jpg')
    const [frame] = frames()
    await pointer(frame!, 'pointerenter')
    await wait(330)

    const shown = loupe()!
    expect(shown.getAttribute('aria-hidden')).toBe('true')
    expect(shown.style.backgroundImage).toContain('blob:door.jpg')
    expect(shown.children).toHaveLength(0)
  })

  it('follows the pointer straight away once shown', async () => {
    mountWith('door.jpg')
    const [frame] = frames()
    await pointer(frame!, 'pointerenter')
    await wait(330)
    const before = loupe()!.style.left

    await pointer(frame!, 'pointermove', { x: 200, y: 100 })
    expect(loupe()!.style.left).not.toBe(before)
    expect(loupe()!.style.left).toBe('224px')
  })

  it('hides straight away when the pointer leaves the photo', async () => {
    mountWith('door.jpg')
    const [frame] = frames()
    await pointer(frame!, 'pointerenter')
    await wait(330)

    await pointer(frame!, 'pointerleave', { x: 50, y: 210 })
    expect(loupe()).toBeNull()
  })

  it('hides straight away on the letterbox bars, and never shows over them', async () => {
    mountWith('door.jpg')
    const [frame] = frames()
    // A square original: drawn 320 × 320 in the middle of the 500 × 320 frame, bars 90 px wide.
    layOut(frame!, { width: 3200, height: 3200 })
    await pointer(frame!, 'pointerenter')
    await wait(330)
    expect(loupe()).not.toBeNull()

    await pointer(frame!, 'pointermove', { x: 130, y: 210 })
    expect(loupe()).toBeNull()
    await wait(1000)
    expect(loupe()).toBeNull()
  })

  it('carries over to another photo reached within 150ms, with no new delay', async () => {
    mountWith('front.jpg', 'side.jpg')
    const [first, second] = frames()
    await pointer(first!, 'pointerenter')
    await wait(330)
    await pointer(first!, 'pointerleave')
    expect(loupe()).toBeNull()

    await wait(120)
    await pointer(second!, 'pointerenter')
    expect(loupe()).not.toBeNull()
    expect(loupe()!.style.backgroundImage).toContain('blob:side.jpg')
  })

  it('waits the full 330ms again after a longer gap between photos', async () => {
    mountWith('front.jpg', 'side.jpg')
    const [first, second] = frames()
    await pointer(first!, 'pointerenter')
    await wait(330)
    await pointer(first!, 'pointerleave')

    await wait(200)
    await pointer(second!, 'pointerenter')
    expect(loupe()).toBeNull()
    await wait(329)
    expect(loupe()).toBeNull()
    await wait(1)
    expect(loupe()).not.toBeNull()
  })

  it('does not appear for a touch or pen pointer', async () => {
    mountWith('door.jpg')
    const [frame] = frames()
    await pointer(frame!, 'pointerenter', undefined, 'touch')
    await pointer(frame!, 'pointermove', undefined, 'touch')
    await wait(1000)
    expect(loupe()).toBeNull()
  })

  it('does not appear on a coarse-pointer device', async () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) =>
      ({ matches: query.includes('coarse'), media: query }) as MediaQueryList) as never
    try {
      mountWith('door.jpg')
      const [frame] = frames()
      await pointer(frame!, 'pointerenter')
      await wait(1000)
      expect(loupe()).toBeNull()
    } finally {
      window.matchMedia = original
    }
  })

  it('still opens the full-screen viewer on a click while it shows', async () => {
    mountWith('door.jpg')
    const [frame] = frames()
    await pointer(frame!, 'pointerenter')
    await wait(330)

    frame!.click()
    await wrapper!.vm.$nextTick()
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })
})
