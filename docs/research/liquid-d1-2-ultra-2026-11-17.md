# Liquid d1.2-ultra through OpenRouter

Checked live on 17 November 2026: `liquid/d1.2-ultra` (resolved `liquid/d1.2-ultra-20261116`, served by Liquid) on OpenRouter's Decisions endpoint (`https://openrouter.ai/api/alpha/decisions`), with the app's own request plan on the nine regression photos. Sources: OpenRouter's [Decisions API](https://openrouter.ai/docs/guides/features/decisions.md) and [Multimodal Decisions](https://openrouter.ai/docs/guides/community/multimodal-decisions.md) guides, the Models API entry, and the probes below. Re-check before relying on a limit.

## What OpenRouter offers for this model

- **Input:** text and images (`architecture.input_modalities: ["text", "image"]`), output `decisions`. 65,536-token context.
- **Questions:** `noul` (yes/no with a probability), `choice` (multiple choice with a probability per option) and `score` (an ordered scale with a probability per level). Replies carry `confidence`, and `usage.cost` is the exact credit charged.
- **Price:** $0.042 per million input tokens, output free: the same as Jev. Image tokens are 1.5 per 32 × 32 px patch (a 2,048 × 1,536 photo with the survey is about 4,700 input tokens, a 1,024 × 768 one about 1,300). `usage.cost` is reported on every reply, so the ledger records a reported cost, with the rate table (`src/domain/rates.ts`) as the fallback.
- **Listed endpoints:** `/api/alpha/decisions` and `/api/alpha/extractions`. The Extractions endpoint is not used: its `state` is text only, with images in `assets`, and it returns named fields rather than the calibrated probabilities the app's certainty words come from.

## Limits (probed live)

| Limit | Result |
| - | - |
| Images per request | 8 (a ninth: 400 "accepts at most 8 images"). The app sends one. |
| Image size | At most 10,000 patches of 32 × 32 px in all (about 10.2 million px) and a 4.5 MB body. 16 × 12, 64 × 48, 1,024 × 768, 2,048 × 1,536 and 3,300 × 2,475 were answered; 4,000 × 3,000 got 422 "more than 10000 32x32-pixel patches". No minimum side. |
| Image type | JPEG and PNG (the app sends JPEG or PNG). |
| Media position | Top-level `state` items only. An image nested in `state`, or in a question's `instructions` or `criteria`, is a 400 (Jev reads those places; Liquid does not). The app never sends one. |
| Questions per request | **128** (the 129th: 422 "A request accepts at most 128 questions"). Jev and Luna take 200. |
| Options per choice | 255 (256: 422). The same as the others. |
| Box questions | **Not taken**: 400 "Liquid does not accept box questions". OpenRouter documents box for Jev 1.14 and Jev latest only. |

Liquid's own bounding boxes and direct text extraction are not reachable through the Decisions endpoint, so nothing in the integration uses them.

## What the app does differently for it

1. **Catalogue** (`src/domain/providers.ts`): `liquid/d1.2-ultra`, maker Liquid, under OpenRouter beside Jev, labelled "d1.2-ultra (Liquid) via OpenRouter · pinned". Not recommended, so the default stays Jev latest. `box: false`, `maxQuestions: 128`, photos up to 2,048 px on the long side as sent (never enlarged, except the ID crop, as for Jev), which is at most 4,096 patches and well under 4.5 MB.
2. **Question limit** (`maxQuestions`, `questionSetLimits.ts`): a set over the model's own limit is refused before anything is sent, as for the wire format's.
3. **The long-side damage set is asked in two requests.** It has 132 questions. The plan sends the first 128, and when that has settled the last 4 (rails, corner posts, casting), with the same photo and instructions (`src/plan/requests/sideDamage.ts`: `side-damage-a`, `side-damage-b`; the registry's `side-damage` is for models that take it whole). Their answers are folded into the one damage reading, so the record never shows half a check. If one request fails, the other's answers stand and the failed questions stay unread (never "no damage"); the run is partial and says so. Each request is its own ledger line, raw response and request count.
4. **The ID questions name a digit's place from the left only** (`PlaceWording` in `src/domain/idQuestions.ts`, question set `liquid`). Jev's and Luna's wording also gives the place from the right ("the third digit, which is the fourth from its right-hand end"). Liquid often took that digit for its neighbour. Measured with 3 runs on each of the four door photos (12 runs, 44 characters each):

   | Wording | Whole photo: exact IDs, wrong characters | Zoomed ID crop: exact IDs, wrong characters |
   | - | - | - |
   | Jev's (left and right) | 0/12, 37 | 0/12, 25 |
   | Left only (used) | 4/12, 13 | **12/12, 0** |
   | "Digit number N, leftmost is 1" | 2/12, 13 | 12/12, 0 |
   | "Skip the first N digits, read the next" | 0/12, 18 | 12/12, 0 |

   The crop read is the one the app weighs against the whole-photo read (as for Jev), so it decides the ID. The rest of the ID set (unreadable option, legibility, whole number visible, owner code) is Jev's, and its answers are read by the same mappers.
5. **Everything else is as for Jev**: the survey (ID, details, weights, face), numbered regions, ID crop, seal zoom and search, ISO search, weight check, door set and door-end crop, the manifest check, and the same certainty, check-digit and owner-code handling. The Luna-only ID re-check does not run (it is Luna's).

## Live runs (whole request plan, nine photos)

The recordings are `src/fixtures/live/plan/*-liquid.json`. Jev latest and GPT-6 Luna were recorded again the same day, to a scratch directory so the demo's recordings did not change, for the figures below. Scores are `npm run score` fields (hit / miss / unread against `src/regression/expected.json`).

| | Original fields (of 48) | All fields (of 84) | Requests per photo | Cost per photo | Mean request | Median request |
| - | - | - | - | - | - | - |
| Liquid d1.2-ultra | 40 | 72 | 12.8 | $0.0047 | 1,468 ms | 730 ms |
| Jev latest | 36 | 69 | 13.0 | $0.0070 | 288 ms | 254 ms |
| GPT-6 Luna | 38 | 64 | 11.3 | $0.0144 | 801 ms | 666 ms |

- **Accuracy.** Liquid read all four container IDs exactly (COYU 266813 0, CHSU 205183 1, APHU 658684 7, JDLU 200690 2), with the size codes, faces and damage presence as the other two read them. Its misses in this run: the weights panel's tare and payload on COYU (the same two fields on the COYU door-and-seal inspection, where it also missed the seal that Jev read in this run), the JDLU maximum gross and payload, the APHU length, and on the grey side the ID certainty and close-ups (that photo has no ID: every model misses it). The scores move between runs: the same photos scored 42 of 48 for Jev in October and 36 in this run. Treat a difference of a few fields as noise.
- **Manifest check.** Live, on the CHSU door photo: with CHSU 205183 1 on a three-entry manifest the model chose it; with the manifest lacking it, "not listed". The check is one request on any OpenRouter model, as before.
- **Latency.** Liquid is the slowest per request (about 5 times Jev's mean, 2 times Luna's). The slow ones are the large sets: the survey 2.9 s, the door set 3.6 s, the first side request 4.5 s (Jev 0.5 s, 0.4 s, 0.4 s). Requests run in parallel where they can, but the side set's two requests run one after the other.
- **Cost.** Liquid is cheaper per photo than Jev ($0.0047 against $0.0070) and about a third of Luna's. A full run on one photo is under half a cent; the $0.50 cap is not close.
- **Request count.** One more request for each photo that shows a long side (the second half of the side set). Jev's own note puts a five-photo inspection at 46 requests against the cap of 50; with long sides on several photos Liquid could reach the cap. The cap then blocks the remaining requests and the result is partial, as before.

## Certainty and the one wrong ID

The first Liquid run, with Jev's wording, read the COYU door photo as **COZU2688130, Confident**: wrong in two places whose errors cancel in the check digit. The digit it misread (the third of the group, 8 for 6) was a near coin-flip (0.52 against 0.47 on the crop); the candidate ranking (`idCandidates.ts`) then preferred a near-match owner prefix (COZU) that passed the check digit over the runner-up digit. The wording change fixed this photo (the crop read 12 of 12 exact), and the regression test (`idCertaintyRecordings.spec.ts`) holds Liquid to reading every regression ID exactly. The underlying weakness remains for any model: a check digit can pass by coincidence, and Liquid's probabilities for a wrong digit were sometimes 0.65 to 0.94 on the whole photo, so its "Confident" is only as good as its crop read. The ID is shown with its check-digit result and certainty as for the other models; a presenter should read it against the photo.

## Differences and limitations

- No box questions: Liquid never gets `container_box`, so the ID's close-up frames the area the numbered regions found, as for Jev 1.13.
- 128 questions a request: the side damage set is two requests; a new question family over 128 questions for Liquid needs the same treatment (the limit is checked before sending).
- Slower than the other two; the first result takes about as long as the survey (about 3 s) and the whole plan about 7 to 20 s.
- Answers vary between identical calls (a probability moved from 0.52 to 0.84 on one digit between two calls). Do not read a single run as a measurement.
- OpenRouter's Decisions endpoint is an alpha API (`/api/alpha/`), as for Jev; the model's listing, limits and the wording that works for it may change. Re-run `src/services/__tests__/liquid.live.spec.ts` and `planRecording.live.spec.ts` (`-t 'Liquid'`) after any change.

## Re-checking

```bash
OPENROUTER_API_KEY='<key>' npx vitest run src/services/__tests__/liquid.live.spec.ts
OPENROUTER_API_KEY='<key>' PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx vitest run src/services/__tests__/planRecording.live.spec.ts -t 'Liquid'
npm run score
```
