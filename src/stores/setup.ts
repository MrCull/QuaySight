import { defineStore } from 'pinia'
import type { ProviderId } from '../domain/inspection'
import { canContinue } from '../domain/keyGate'
import {
  readRememberedSelection,
  rememberSelection,
  REMEMBERED_SELECTION_KEY,
} from '../domain/rememberedSelection'
import { useInspectionStore } from './inspection'

/** Which top-level screen shows: the setup card, or the inspection screen once the presenter continues. */
export type AppView = 'setup' | 'inspection'

/** Browser storage, or null where it is blocked (private windows, previews). Never holds a key. */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/**
 * The setup gate, the settings drawer and the remembered provider and model (spec #16).
 * Kept apart from the inspection store: it reads and sets the selection there, and a provider or
 * model change runs that store's New inspection. Keys stay in the inspection store's memory only.
 */
export const useSetupStore = defineStore('setup', {
  state: () => ({
    view: 'setup' as AppView,
    drawerOpen: false,
  }),
  getters: {
    /** Continue on the setup card: a key for the selected provider and a model it offers. */
    canContinue(): boolean {
      const inspection = useInspectionStore()
      return canContinue({
        provider: inspection.provider,
        model: inspection.model,
        apiKey: inspection.apiKey,
      })
    },
  },
  actions: {
    /** Applies the remembered provider and model, if the catalogue still offers them. */
    restore() {
      let text: string | null = null
      try {
        text = storage()?.getItem(REMEMBERED_SELECTION_KEY) ?? null
      } catch {
        text = null
      }
      const remembered = readRememberedSelection(text)
      if (!remembered) return
      const inspection = useInspectionStore()
      inspection.setProvider(remembered.provider)
      inspection.setModel(remembered.model)
    },
    /** Leaves the setup card for the inspection screen. Returns whether it did. */
    continueToInspection(): boolean {
      if (!this.canContinue) return false
      this.view = 'inspection'
      return true
    },
    /** Enters demo mode: no key, the bundled samples only, recorded results. */
    enterDemo() {
      useInspectionStore().enterDemo()
      this.view = 'inspection'
    },
    /** Connect a provider, from the demo banner: leaves demo mode for the setup card. */
    connectProvider() {
      useInspectionStore().leaveDemo()
      this.drawerOpen = false
      this.view = 'setup'
    },
    /** A new provider blanks the screen (New inspection), then takes that provider's recommended model. */
    chooseProvider(provider: ProviderId) {
      const inspection = useInspectionStore()
      if (inspection.provider === provider) return
      inspection.newInspection()
      inspection.setProvider(provider)
      this.remember()
    },
    /** A new model blanks the screen (New inspection). The same model again changes nothing. */
    chooseModel(model: string) {
      const inspection = useInspectionStore()
      if (inspection.model === model) return
      inspection.newInspection()
      inspection.setModel(model)
      this.remember()
    },
    openDrawer() {
      this.drawerOpen = true
    },
    /**
     * Closing the drawer (its close button, Esc, a click outside, or Enter in the key field) saves the key:
     * photos waiting for one start now if the gate is open. With no key they keep waiting.
     */
    closeDrawer() {
      this.drawerOpen = false
      useInspectionStore().startIfAwaitingKey()
    },
    /** Writes the provider and model only. The key is never passed here. */
    remember() {
      const inspection = useInspectionStore()
      try {
        storage()?.setItem(
          REMEMBERED_SELECTION_KEY,
          rememberSelection({ provider: inspection.provider, model: inspection.model }),
        )
      } catch {
        // Storage blocked: the selection simply isn't remembered.
      }
    },
  },
})
