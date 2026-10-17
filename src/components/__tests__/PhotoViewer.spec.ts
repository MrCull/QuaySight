import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import PhotoPanel from '../PhotoPanel.vue'

/**
 * Ticket #93: the presenter clicks a container photo and sees the original fill the screen. Any click, the ×
 * or Esc closes it and focus goes back to the photo that opened it. With several photos, ←/→ step through
 * them and wrap at both ends.
 */
const photo = (name: string) => ({ name, orientation: 'landscape', url: `blob:${name}` }) as never

let wrapper: VueWrapper | null = null
function mountPanel() {
  wrapper = mount(PhotoPanel, { attachTo: document.body })
  return wrapper
}
const viewer = () => document.querySelector<HTMLElement>('[role="dialog"]')
const viewerImg = () => viewer()?.querySelector('img')

describe('PhotoViewer', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('opens the one photo full screen from its enlarge button, with no caption or arrows', async () => {
    useInspectionStore().setPhoto(photo('door.jpg'))
    const panel = mountPanel()
    expect(viewer()).toBeNull()

    await panel.get('button[aria-label="Enlarge photo"]').trigger('click')

    expect(viewer()).not.toBeNull()
    expect(viewerImg()?.getAttribute('src')).toBe('blob:door.jpg')
    expect(viewer()?.querySelector('.qs-viewer__cap')).toBeNull()
    expect(viewer()?.querySelectorAll('.qs-viewer__nav')).toHaveLength(0)
  })

  const press = async (key: string) => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    await wrapper!.vm.$nextTick()
  }
  const settle = () => new Promise((resolve) => setTimeout(resolve))

  it.each([
    [
      'a click on the photo',
      () => viewerImg()!.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    ],
    [
      'a click on the backdrop',
      () => viewer()!.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    ],
    [
      'the × button',
      () => viewer()!.querySelector<HTMLButtonElement>('button[aria-label="Close photo"]')!.click(),
    ],
    [
      'Esc',
      () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    ],
  ])('closes on %s and puts focus back on the photo that opened it', async (_how, close) => {
    useInspectionStore().setPhotos([photo('a.jpg'), photo('b.jpg'), photo('c.jpg')])
    const panel = mountPanel()
    const opener = panel.get('button[aria-label="Enlarge photo 2 of 3"]')
    await opener.trigger('click')
    expect(viewer()).not.toBeNull()

    close()
    await settle()

    expect(viewer()).toBeNull()
    expect(document.activeElement).toBe(opener.element)
  })

  it('names each grid photo for enlarging, by its place among the photos', () => {
    useInspectionStore().setPhotos([photo('a.jpg'), photo('b.jpg'), photo('c.jpg')])
    const panel = mountPanel()
    expect(panel.findAll('button.rs-photos__frame').map((b) => b.attributes('aria-label'))).toEqual(
      ['Enlarge photo 1 of 3', 'Enlarge photo 2 of 3', 'Enlarge photo 3 of 3'],
    )
  })

  it('steps through several photos with the arrows and keys, wrapping at both ends', async () => {
    useInspectionStore().setPhotos([photo('a.jpg'), photo('b.jpg'), photo('c.jpg')])
    const panel = mountPanel()
    await panel.get('button[aria-label="Enlarge photo 1 of 3"]').trigger('click')
    const caption = () => viewer()?.querySelector('.qs-viewer__cap')?.textContent?.trim()
    expect(caption()).toBe('Photo 1 of 3')

    await press('ArrowLeft')
    expect(viewerImg()?.getAttribute('src')).toBe('blob:c.jpg')
    expect(caption()).toBe('Photo 3 of 3')

    await press('ArrowRight')
    expect(viewerImg()?.getAttribute('src')).toBe('blob:a.jpg')

    viewer()!.querySelector<HTMLButtonElement>('button[aria-label="Previous photo"]')!.click()
    await settle()
    expect(caption()).toBe('Photo 3 of 3')
    viewer()!.querySelector<HTMLButtonElement>('button[aria-label="Next photo"]')!.click()
    await settle()
    expect(caption()).toBe('Photo 1 of 3')
    expect(viewer()).not.toBeNull()
  })

  it('names the face in the caption once the survey has named it', async () => {
    const store = useInspectionStore()
    store.setPhotos([photo('a.jpg'), photo('b.jpg')])
    store.record = {
      photos: [
        { side: 'unknown', face: { face: 'rear_doors', closeUpSubject: null } },
        { side: 'unknown', face: null },
      ],
    } as never
    const panel = mountPanel()
    await panel.get('button[aria-label="Enlarge photo 1 of 2"]').trigger('click')
    const chip = panel.find('[data-face-chip]').text()
    expect(viewer()?.querySelector('.qs-viewer__cap')?.textContent?.trim()).toBe(
      `Photo 1 of 2 · ${chip}`,
    )
  })

  it('opens while the inspection is still analysing', async () => {
    const store = useInspectionStore()
    store.setPhoto(photo('door.jpg'))
    store.status = 'running'
    const panel = mountPanel()
    await panel.get('button[aria-label="Enlarge photo"]').trigger('click')
    expect(viewer()).not.toBeNull()
  })

  it.each(['Enter', ' '])('opens from a focused photo on %j', async (key) => {
    useInspectionStore().setPhotos([photo('a.jpg'), photo('b.jpg')])
    const panel = mountPanel()
    const frame = panel.get('button[aria-label="Enlarge photo 2 of 2"]')
    ;(frame.element as HTMLElement).focus()
    await frame.trigger('keydown', { key })
    expect(viewer()).not.toBeNull()
    expect(viewerImg()?.getAttribute('src')).toBe('blob:b.jpg')
  })

  it('sits on the page body, outside the app', async () => {
    useInspectionStore().setPhoto(photo('door.jpg'))
    const panel = mountPanel()
    await panel.get('button[aria-label="Enlarge photo"]').trigger('click')
    expect(viewer()?.parentElement).toBe(document.body)
    expect(panel.element.contains(viewer())).toBe(false)
  })

  it('carries the reduced-motion class the app set elsewhere on the page', async () => {
    useInspectionStore().setPhoto(photo('door.jpg'))
    document.body.classList.add('qs-reduced-motion')
    try {
      const panel = mountPanel()
      await panel.get('button[aria-label="Enlarge photo"]').trigger('click')
      expect(viewer()?.classList.contains('qs-reduced-motion')).toBe(true)
    } finally {
      document.body.classList.remove('qs-reduced-motion')
    }
  })

  it('keeps Tab and Shift+Tab inside the viewer', async () => {
    useInspectionStore().setPhotos([photo('a.jpg'), photo('b.jpg')])
    const panel = mountPanel()
    await panel.get('button[aria-label="Enlarge photo 1 of 2"]').trigger('click')
    const buttons = [...viewer()!.querySelectorAll<HTMLButtonElement>('button')]
    const first = buttons[0]!
    const last = buttons[buttons.length - 1]!

    last.focus()
    last.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(first)

    first.focus()
    first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(last)

    viewer()!.focus()
    viewer()!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(last)
  })

  it('locks the page scroll while open and gives it back on close', async () => {
    useInspectionStore().setPhoto(photo('door.jpg'))
    document.body.style.overflow = 'auto'
    const panel = mountPanel()
    await panel.get('button[aria-label="Enlarge photo"]').trigger('click')
    expect(document.body.style.overflow).toBe('hidden')
    await press('Escape')
    await settle()
    expect(document.body.style.overflow).toBe('auto')
    document.body.style.overflow = ''
  })

  it('keeps its Esc from reaching other Esc handlers on the page', async () => {
    useInspectionStore().setPhoto(photo('door.jpg'))
    const other = vi.fn<(event: KeyboardEvent) => void>()
    document.addEventListener('keydown', other)
    try {
      const panel = mountPanel()
      await panel.get('button[aria-label="Enlarge photo"]').trigger('click')
      await press('Escape')
      await settle()
      expect(viewer()).toBeNull()
      expect(other).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', other)
    }
  })

  it('captions the photo it shows when the photos change while open', async () => {
    const store = useInspectionStore()
    store.setPhotos([photo('a.jpg'), photo('b.jpg'), photo('c.jpg')])
    const panel = mountPanel()
    await panel.get('button[aria-label="Enlarge photo 3 of 3"]').trigger('click')
    store.setPhotos([photo('d.jpg'), photo('e.jpg')])
    await settle()
    const src = viewerImg()?.getAttribute('src')
    const n = ['blob:d.jpg', 'blob:e.jpg'].indexOf(src!) + 1
    expect(n).toBeGreaterThan(0)
    expect(viewer()?.querySelector('.qs-viewer__cap')?.textContent?.trim()).toBe(`Photo ${n} of 2`)
  })
})
