import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useSetupStore } from '../../stores/setup'
import App from '../../App.vue'
import BuildStamp from '../BuildStamp.vue'

describe('Build stamp', () => {
  it('reads "Build <short commit> · <date> <time> UTC" with the commit linked to GitHub', () => {
    const wrapper = mount(BuildStamp, {
      props: {
        commit: '0e5cdc7a1b2c3d4e5f60718293a4b5c6d7e8f901',
        builtAt: '2026-10-17T10:49:31Z',
      },
    })
    expect(wrapper.text()).toBe('Build 0e5cdc7 · 17 Oct 2026 10:49 UTC')
    const link = wrapper.get('a')
    expect(link.text()).toBe('0e5cdc7')
    expect(link.attributes('href')).toBe(
      'https://github.com/MrCull/QuaySight/commit/0e5cdc7a1b2c3d4e5f60718293a4b5c6d7e8f901',
    )
  })

  it('reads "dev build" with no link when no commit is known', () => {
    const wrapper = mount(BuildStamp, { props: { commit: null, builtAt: '2026-10-17T10:49:31Z' } })
    expect(wrapper.text()).toBe('dev build')
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('shows the time in UTC whatever the local zone', () => {
    const wrapper = mount(BuildStamp, {
      props: { commit: 'abcdef1234567', builtAt: '2026-01-05T23:07:00+02:00' },
    })
    expect(wrapper.text()).toBe('Build abcdef1 · 5 Jan 2026 21:07 UTC')
  })

  describe('on every screen', () => {
    beforeEach(() => setActivePinia(createPinia()))
    const stamp = /^(Build [0-9a-f]{7} · \d{1,2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2} UTC|dev build)$/

    it('is in the footer of the setup screen', () => {
      const wrapper = mount(App)
      expect(wrapper.find('.qs-setupcard').exists()).toBe(true)
      expect(wrapper.get('footer .rs-buildstamp').text()).toMatch(stamp)
    })

    it('is in the footer of the inspection screen', () => {
      useSetupStore().view = 'inspection'
      const wrapper = mount(App)
      expect(wrapper.find('#stage').exists()).toBe(true)
      expect(wrapper.get('footer .rs-buildstamp').text()).toMatch(stamp)
    })
  })
})
