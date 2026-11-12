# How it works

## The path of an inspection

```
photos chosen
   │
   ▼
prepare photos ── fit each to the model's size limits, fix orientation
   │
   ▼
request plan ──── survey every photo, then only the follow-ups that photo needs
   │              (ID re-check, crop reads, weight check, one damage request per face)
   ▼
validate ──────── ISO 6346 check digit, owner-code list, ISO size-code decoding,
   │              gross − tare = payload, length from shape
   ▼
combine ───────── merge the per-photo readings into one record
   │
   ▼
present ───────── key-facts tiles, readings, damage schematic, cost, exports
```

## The "Decisions" question style

Both providers answer **multiple-choice questions** and return a probability for every option. The app builds each question with the options it wants, including `other` and `unreadable` where it matters. A question about the ID might be: "Which of these is the owner code?" over about 200 common BIC codes plus "none of these". The app then:

1. reads the probabilities, not only the top choice,
2. maps the answers to certainty words,
3. checks them against standards in code.

When an ID can't be a verbatim answer, the app builds candidate IDs from the letter and digit probabilities, discards those that fail the check digit, and ranks the rest. A candidate that wins is still a generated candidate, never presented as text that was observed.

## The request plan

The plan is a set of requests against the one selected model. Each request is defined in its own module under `src/plan/requests/`: survey, ID re-check, ID crop read, seal pick and zoom, weight check, and side and door damage. Independent requests start together. A dependent request starts when what it needs has answered. Each has its own abort signal, its own ledger line and its own progress stage.

The first request for each photo is the **survey**. It names the photo's face (doors, front end, left side, right side, can't tell, or not a container) and reads the ID, details, weights and seal. Later requests follow the survey's answer. A photo that has no weights gets no weight check. A photo that isn't a container gets nothing more.

The UI shows only three plain progress stages: **Reading the ID**, **Reading container details**, **Checking for damage**. It never mentions passes, refinement, candidates or retries.

## Follow-ups that stay invisible

Where the first reading is weak, the plan can run a focused second look: a crop of the ID area, an enlarged seal, a weight check. The app uses the same photo or a faithful crop, with the same model. It asks a narrower question over plausible candidates. At most one automatic follow-up runs per unresolved field. The screen shows only the outcome and its certainty.

## Spend caps

A container inspection is capped at **50 requests and $0.50**. The ledger checks the cap before every request. When it is reached, the remaining requests are blocked and the result is partial but usable. No prompt asks permission to continue. Cost is recorded from the provider's reported cost where it gives one, and otherwise estimated from a dated rate table for that provider and model. A missing cost is marked incomplete, never treated as zero.

## Demo mode

Demo mode replays a recorded plan for the chosen sample instead of calling a provider. It uses the same code to combine and present the results, so the screen is identical, apart from the "Recorded demonstration" notice and zero live charge. Recordings are in `src/fixtures/`.

## Privacy

- The key lives in memory only, in the Pinia store. It is never written to storage, and each key goes only to its own provider's endpoint.
- Photos go straight from the browser to the chosen provider. There is no relay or backend. OpenRouter forwards the photo, not the key, to the model's maker.
- In demo mode, nothing leaves the machine.
