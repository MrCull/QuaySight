import { nextTick } from 'vue'

/**
 * Where focus lands after a step (spec #27 ticket #30):
 * - `photo`: the photo drop zone, or in demo mode the first sample tile that stands in for it.
 *   After Continue on the setup card and after New inspection.
 * - `start`: the New inspection / Cancel button. After choosing a demo sample.
 *
 * The element that owns a step marks itself with `data-next-step="<step>"`. Only the action a
 * presenter took moves focus: a provider or model change in the settings drawer resets the screen
 * through the same store action but leaves focus in the drawer, so the store never moves focus.
 */
export type NextStep = 'photo' | 'start'

/** Moves focus to the step's element once the screen has re-rendered. Nothing when it isn't shown. */
export async function focusNextStep(step: NextStep): Promise<void> {
  await nextTick()
  document.querySelector<HTMLElement>(`[data-next-step="${step}"]`)?.focus()
}
