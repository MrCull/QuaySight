# Plan recordings

One JSON file per live run of the whole request plan, written by the opt-in recording spec
`src/services/__tests__/planRecording.live.spec.ts`: `<photo>-<route>.json`, for example
`rear-door-aphu-45g1-luna.json`. Each holds the raw response of every request that answered (no key, no
headers, no request body), in the order they landed, with each request's latency and cost.

Demo mode replays any file here for the sample whose photo it names (`src/domain/demoSamples.ts`), picking
it up with no code change.

## Regression set: re-record and score

The four single-photo samples (COYU, CHSU and APHU doors, the grey 40 ft side) and the presenter's two
several-photo inspections (COYU 266813 0: door photo plus seal close-up; JDLU 200690 2: four photos) are the
regression set. Their true values, read from the photos, are hand-written in `src/regression/expected.json`.
Each photo has its own recording per model; an inspection's cost is the sum of its photos' recordings.
Demo mode plays both several-photo inspections (`src/domain/demoSamples.ts`).

- An expected entry is a whole inspection of 1 to 4 photos (`photos`, in order, each with its faces and
  whether it is a close-up), with the container's expected values, seal, ID certainty, whether alternatives
  may be shown, whether the "different containers" warning is expected, and which photo each close-up
  comes from. Each photo is replayed from its own recording, then the photos are combined as the app does.
- Score: `npm run score` replays every recording here (free, nothing is sent) and prints, per model, a
  hit / miss / unread table by sample and field (ID, size code, max gross, tare, payload, face, length,
  damage present). Run it before and after a change to a prompt or a mapping and compare.
- Re-record (chargeable, about $0.005 a run, 8 runs): with `OPENAI_API_KEY` and `OPENROUTER_API_KEY` in the
  environment, `npx vitest run src/services/__tests__/planRecording.live.spec.ts`. Then `npm run check:secrets`
  and commit the changed files. Re-recording changes the scores: say so in the commit.

Never edit one by hand: a recording is what a model answered. To record, see
`docs/research/live-api-findings-2026-10-16.md (the last section)`.
