import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { liveDetailsRecord, coyuDetails } from '../../__tests__/liveDetails'
import { buildContainerIdReading } from '../../domain/containerId'
import type { PlannedRequestState } from '../../domain/runStages'
import KeyFacts from '../KeyFacts.vue'

// The tiles as a presenter sees them: words, certainty words, Reading… placeholders and the jump to a
// detail section. The words themselves are tested against the pure builder (domain/keyFacts).

const planned = (overrides: Partial<PlannedRequestState>): PlannedRequestState => ({
  id: 'read',
  stages: ['id'],
  state: 'answered',
  optional: false,
  startedAt: null,
  settledAt: null,
  ...overrides,
})

async function finishedRecord() {
  const base = await liveDetailsRecord()
  return {
    ...base,
    source: 'live' as const,
    containerId: buildContainerIdReading({ printed: 'COYU2668130', certainty: 'Confident' }),
    seal: {
      visible: true,
      characters: [
        { value: 'E', certainty: 'Confident' as const },
        { value: '7', certainty: 'Confident' as const },
      ],
      value: 'E7',
      certainty: 'Confident' as const,
    },
    damage: null,
  }
}

const tile = (wrapper: ReturnType<typeof mount>, id: string) => wrapper.get(`[data-tile="${id}"]`)

describe('KeyFacts', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('shows nothing before a run starts', () => {
    expect(mount(KeyFacts).find('.qs-keytiles').exists()).toBe(false)
  })

  it('shows Reading… in every tile as soon as the run starts, with a progress indicator', () => {
    const store = useInspectionStore()
    store.status = 'running'
    store.planned = [
      planned({ id: 'read', stages: ['id', 'details'], state: 'sent' }),
      planned({ id: 'side', stages: ['damage'], state: 'sent' }),
    ]
    const wrapper = mount(KeyFacts)

    for (const id of ['id', 'seal', 'damage']) {
      expect(tile(wrapper, id).text()).toContain('Reading…')
      expect(tile(wrapper, id).attributes('data-state')).toBe('reading')
    }
    expect(wrapper.find('[data-tile="placards"]').exists()).toBe(false)
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
  })

  it('fills in the ID and the seal when their stage lands, while damage is still reading', async () => {
    const store = useInspectionStore()
    store.status = 'running'
    store.planned = [
      planned({ id: 'read', stages: ['id', 'details'], state: 'answered' }),
      planned({ id: 'side', stages: ['damage'], state: 'sent' }),
    ]
    store.record = await finishedRecord()
    const wrapper = mount(KeyFacts)

    expect(tile(wrapper, 'id').text()).toContain('Confident')
    expect(tile(wrapper, 'id').text()).toContain('Check digit valid')
    expect(tile(wrapper, 'seal').text()).toContain('E7')
    expect(tile(wrapper, 'damage').text()).toContain('Reading…')
    // A tile that fills in during the run plays its own arrival.
    expect(tile(wrapper, 'id').classes()).toEqual(expect.arrayContaining(['qs-rise', 'qs-arrived']))
    expect(tile(wrapper, 'damage').classes()).not.toContain('qs-rise')
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('2')
  })

  it('shows the placards tile only for a result with a placard', async () => {
    const store = useInspectionStore()
    store.status = 'complete'
    const record = await finishedRecord()
    store.record = record
    expect(mount(KeyFacts).find('[data-tile="placards"]').exists()).toBe(false)

    store.record = {
      ...record,
      details: {
        ...coyuDetails(),
        dgPlacard: { answer: 'placard', dgClass: 3, symbol: 'Flame', certainty: 'Likely' },
      },
    }
    const wrapper = mount(KeyFacts)
    expect(tile(wrapper, 'placards').text()).toContain('Class 3, flammable liquids')
    expect(tile(wrapper, 'placards').text()).toContain('Likely')
  })

  it('says the ID is not readable in this photo when fewer than 6 characters were read', async () => {
    const store = useInspectionStore()
    store.status = 'complete'
    const record = await finishedRecord()
    store.record = {
      ...record,
      containerId: { ...record.containerId, value: 'CO?????????', checkDigitValid: false },
    }
    expect(tile(mount(KeyFacts), 'id').text()).toContain('ID not readable in this photo')
  })

  it('brings the matching detail section into view, focuses it and highlights it', async () => {
    const store = useInspectionStore()
    store.status = 'complete'
    store.record = await finishedRecord()
    const target = document.createElement('section')
    target.id = 'detail-seal'
    target.tabIndex = -1
    target.scrollIntoView = () => {}
    document.body.append(target)

    await tile(mount(KeyFacts, { attachTo: document.body }), 'seal').trigger('click')

    expect(document.activeElement).toBe(target)
    expect(target.classList.contains('qs-flash')).toBe(true)
  })

  it('also jumps from the keyboard', async () => {
    const store = useInspectionStore()
    store.status = 'complete'
    store.record = await finishedRecord()
    const target = document.createElement('section')
    target.id = 'detail-id'
    target.tabIndex = -1
    target.scrollIntoView = () => {}
    document.body.append(target)

    await tile(mount(KeyFacts, { attachTo: document.body }), 'id').trigger('keydown', {
      key: 'Enter',
    })

    expect(document.activeElement).toBe(target)
  })
})
