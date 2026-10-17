# Zoomed ID read vs whole-photo read: the paired comparison (ticket #84, spec #75 story 28)

Checked: 17 October 2026 (2026-10-17), on the recordings in the repo. Re-record before relying on any number here.

## What was compared

The same recordings scored with and without the zoomed second read of the ID (the crop read of ticket #84), so the only
difference is the zoom. `npm run score`; "original" is the original field set (48 cells per model), "all" adds the
later fields (84 per model).

| Model | Original, whole photo only | Original, with zoom | All, whole photo only | All, with zoom |
| --- | --- | --- | --- | --- |
| GPT-6 Luna | 30/48 | 31/48 | 50/84 | 50/84 |
| Jev latest | 39/48 | 39/48 | 69/84 | 71/84 |

## What the zoom did

- It fixed the container ID of the chsu photo for Luna.
- It cost Luna the chsu `alternatives` field.
- An overruling zoom (one whose read replaces the whole-photo read) broke COYU 266813 0 for Luna: the digits were
  read wrongly in the crop. Luna therefore uses the zoom fill-only: it may fill positions the whole-photo read left
  unread, and never overrules a character the whole photo read.

## Owner prefixes offered

The whole-prefix question offers COYU as well as JDLU and RWTU, beyond the spec's two additions (`OFFERED_OWNER_CODES` in
`src/domain/ownerCodes.ts`). Reason: without COYU the recorded Luna COYU pick was no longer a valid choice, so that
reading was lost and the score dropped.

## Still open

- Luna's seal, weights and ID certainty are not improved by this work.
- The chsu `alternatives` cost for Luna is not restored.
