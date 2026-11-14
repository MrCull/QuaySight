// PROTOTYPE (throwaway): the landing's behaviour, shared by every variant so only the look differs.
// Mirrors src/components/LandingScreen.vue; fold the winning variant back into that file.
import { computed, ref, watch } from 'vue'
import { useInspectionStore } from '../../stores/inspection'
import { useSetupStore } from '../../stores/setup'
import { getProvider, providers } from '../../domain/providers'
import { keyFormatWarning } from '../../domain/keyGate'
import { focusNextStep } from '../../components/nextStepFocus'

export function useLandingForm(focusKey: () => void) {
  const store = useInspectionStore()
  const setup = useSetupStore()

  const copy = computed(() => getProvider(store.provider).keyField)
  const keyWarning = computed(() => keyFormatWarning(store.provider, store.apiKey))

  const needsKey = ref(false)
  watch(
    () => setup.canContinue,
    (ready) => {
      if (ready) needsKey.value = false
    },
  )

  function start() {
    if (setup.continueToInspection()) {
      void focusNextStep('photo')
      return
    }
    needsKey.value = true
    focusKey()
  }

  function onPickKey(event: KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const index = providers.findIndex((p) => p.id === store.provider)
    const next = providers[(index + step + providers.length) % providers.length]!
    setup.chooseProvider(next.id)
    const group = event.currentTarget as HTMLElement
    group.querySelector<HTMLElement>(`[data-provider="${next.id}"]`)?.focus()
  }

  return { store, setup, providers, copy, keyWarning, needsKey, start, onPickKey }
}
