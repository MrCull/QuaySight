# Plan recordings

One JSON file per live run of the whole request plan, written by the opt-in recording spec
`src/services/__tests__/planRecording.live.spec.ts`: `<photo>-<route>.json`, for example
`rear-door-aphu-45g1-luna.json`. Each holds the raw response of every request that answered (no key, no
headers, no request body), in the order they landed, with each request's latency and cost.

Demo mode replays any file here for the sample whose photo it names (`src/domain/demoSamples.ts`), picking
it up with no code change. Never edit one by hand: a recording is what a model answered. To record, see
`docs/research/live-api-findings-2026-10-16.md (the last section)`.
