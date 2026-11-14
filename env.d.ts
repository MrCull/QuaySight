/// <reference types="vite/client" />

// Injected by vite.config.ts at build time.
declare const __BUILD_COMMIT__: string
declare const __BUILD_TIME__: string

interface ImportMetaEnv {
  /** GA4 Measurement ID. The deploy workflow sets it on pushes to main only (docs/adr/0002-*). */
  readonly VITE_GA_MEASUREMENT_ID?: string
}
