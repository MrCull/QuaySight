/**
 * Google Analytics 4 (docs/adr/0002-google-analytics-for-the-poc.md). Off unless the build was given a
 * Measurement ID (the deploy workflow passes one on pushes to main only) and the page is on the
 * production domain, so dev, Playwright, PR previews and the default Azure address send nothing.
 *
 * Every event is one of a fixed set, and only that event's own fields are forwarded: never a key, a
 * photo, a container ID, a reading or anything typed in.
 */

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/** The production hosts. Anywhere else the tag never loads. */
export const ANALYTICS_HOSTS: readonly string[] = ['quay-sight.com', 'www.quay-sight.com']

type Mode = 'demo' | 'live'

export type AnalyticsEvent =
  | { name: 'demo_started' }
  | { name: 'provider_selected'; provider: 'luna' | 'openrouter' }
  | { name: 'inspection_started'; mode: Mode; photo_count: number }
  | { name: 'inspection_finished'; mode: Mode }
  | { name: 'spend_cap_hit'; mode: Mode; reason: 'requests' | 'spend' }

/** The fields each event may carry; anything else on the object is dropped. */
const FIELDS: { [E in AnalyticsEvent as E['name']]: readonly Exclude<keyof E, 'name'>[] } = {
  demo_started: [],
  provider_selected: ['provider'],
  inspection_started: ['mode', 'photo_count'],
  inspection_finished: ['mode'],
  spend_cap_hit: ['mode', 'reason'],
}

let enabled = false

/** Loads the Google tag when both gates pass. Returns whether analytics is on. */
export function initAnalytics(measurementId: string | undefined, hostname: string): boolean {
  if (enabled) return true
  if (!measurementId || !ANALYTICS_HOSTS.includes(hostname)) return false

  window.dataLayer = window.dataLayer ?? []
  // gtag.js reads `arguments` objects from the queue, not arrays.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', measurementId)

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  document.head.appendChild(script)

  enabled = true
  return true
}

/** Sends one event, or nothing while analytics is off. */
export function track(event: AnalyticsEvent): void {
  if (!enabled || !window.gtag) return
  const fields = FIELDS[event.name] as readonly string[] | undefined
  if (!fields) return
  const source = event as unknown as Record<string, unknown>
  const params: Record<string, unknown> = {}
  for (const field of fields) params[field] = source[field]
  window.gtag('event', event.name, params)
}

/** Tests only: forgets the tag, its queue and its script. */
export function resetAnalyticsForTests(): void {
  enabled = false
  delete window.dataLayer
  delete window.gtag
  document.querySelectorAll('script[src*="googletagmanager"]').forEach((s) => s.remove())
}
