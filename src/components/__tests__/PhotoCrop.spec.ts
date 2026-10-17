import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotoCrop from '../PhotoCrop.vue'

// jsdom does not decode images: the photo's size is given to the element, then it "loads".
async function loaded(wrapper: ReturnType<typeof mount>, width: number, height: number) {
  const img = wrapper.get('img').element as HTMLImageElement
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true })
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true })
  await wrapper.get('img').trigger('load')
}

const box = { left: 0.4, right: 0.6, top: 0.45, bottom: 0.55, confidence: 0.9 }

describe('PhotoCrop', () => {
  it('shows the padded region of the photo, enlarged, with its caption', async () => {
    const wrapper = mount(PhotoCrop, {
      props: { src: 'blob:photo', box, caption: 'Where we read the ID', label: 'The container ID' },
    })
    await loaded(wrapper, 2000, 1000)

    // The 2000 x 1000 photo, region x 600..1400, y 250..750 (worked in enlargedCrop.spec.ts).
    expect(wrapper.get('figcaption').text()).toBe('Where we read the ID')
    const frame = wrapper.get('.rs-crop__frame')
    expect(frame.attributes('style')).toContain('aspect-ratio: 800 / 500')
    const style = wrapper.get('img').attributes('style')
    expect(style).toContain('width: 250%') // 2000 / 800
    expect(style).toContain('left: -75%') // 600 / 800
    expect(style).toContain('top: -50%') // 250 / 500
    expect(wrapper.get('img').attributes('alt')).toBe('The container ID, enlarged')
  })

  it('shows nothing, not even a caption, when there is no box', async () => {
    const wrapper = mount(PhotoCrop, {
      props: { src: 'blob:photo', box: null, caption: 'Where we read the ID', label: 'ID' },
    })
    expect(wrapper.find('figure').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('shows nothing for a box the model was unsure of', async () => {
    const wrapper = mount(PhotoCrop, {
      props: { src: 'blob:photo', box: { ...box, confidence: 0.2 }, caption: 'c', label: 'ID' },
    })
    expect(wrapper.find('figure').exists()).toBe(false)
  })

  it('shows nothing when the photo cannot be loaded', async () => {
    const wrapper = mount(PhotoCrop, {
      props: { src: 'blob:photo', box, caption: 'Where we read the ID', label: 'ID' },
    })
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('figure').exists()).toBe(false)
  })

  it('names the source photo in the caption', async () => {
    const wrapper = mount(PhotoCrop, {
      props: {
        src: 'blob:photo',
        box,
        caption: 'Where we read the ID',
        label: 'ID',
        photoNumber: 2,
      },
    })
    expect(wrapper.get('figcaption').text()).toBe('Where we read the ID · Photo 2')
  })

  it('shows the full photo with the area outlined when tapped, and the close-up again on a second tap', async () => {
    const wrapper = mount(PhotoCrop, {
      props: {
        src: 'blob:photo',
        box,
        caption: 'Where we read the ID',
        label: 'ID',
        photoNumber: 1,
      },
    })
    await loaded(wrapper, 2000, 1000)
    expect(wrapper.find('.rs-crop__full').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true')
    const rect = wrapper.get('.rs-crop__full rect')
    expect(rect.attributes('x')).toBe('400')
    expect(rect.attributes('width')).toBe('200')
    expect(rect.attributes('y')).toBe('450')
    expect(rect.attributes('height')).toBe('100')
    expect(wrapper.get('.rs-crop__whole').attributes('src')).toBe('blob:photo')
    expect(wrapper.get('.rs-crop__frame').attributes('style')).toContain('display: none')
    await wrapper.get('button').trigger('click')
    expect(wrapper.find('.rs-crop__full').exists()).toBe(false)
  })
})
