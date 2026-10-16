# Live API findings: browser reach and OpenRouter Decisions (spec #16, ticket #22)

Checked: 16 October 2026, by `curl` against the live endpoints (preflights with `Origin` and
`Access-Control-Request-*` headers, then real requests). Real responses, with no key and no headers, are
kept in `src/fixtures/live/openrouter-probe.json`. The full OpenRouter OpenAPI document was read the same
day. Re-check before relying on any of this: all three providers can change it without notice.

## Which endpoints a browser can reach

| Endpoint | Preflight | Success response | Error response | Usable from the browser |
| --- | --- | --- | --- | --- |
| OpenAI `POST https://api.openai.com/v1/decisions` | allowed, `Access-Control-Allow-Origin: *` | `*` | **no** allow-origin (e.g. 401) | yes, but errors are unreadable |
| TypeSafe `POST https://api.typesafe.ai/v1/systemone` | **400**, no allow-origin | not reached | not reached | **no** |
| OpenRouter `POST https://openrouter.ai/api/alpha/decisions` | 204, `*` | `*` | `*` (401, 400 checked) | yes, errors readable |

- **OpenAI.** Because a refused call (wrong key, no credit, no model access) comes back without CORS
  headers, the browser reports it as `TypeError: Failed to fetch`, the same as being offline. The app
  therefore classifies a thrown fetch while online as *refused* (`src/domain/failedCall.ts`, ticket #18).
- **TypeSafe direct.** The browser never sends the request. This is why direct TypeSafe left the
  selector (docs/adr/0001).
- **OpenRouter.** Errors are readable, so each status gets its own message (`src/domain/openrouter.ts`).
  OpenRouter's System One endpoint (TypeSafe-SDK compatible) also answered the preflight with 204, but it
  rejects multipart bodies, so the TypeSafe multipart request cannot be reused by swapping the base URL.

## OpenRouter Decisions request

JSON only. Multipart is rejected.

```
POST https://openrouter.ai/api/alpha/decisions
Authorization: Bearer <OpenRouter key, sk-or-…>
Content-Type: application/json
HTTP-Referer: https://quay-sight.com      (optional attribution)
X-Title: Quay Sight                       (optional attribution)

{ "model": "~typesafe/jev-latest",
  "state": [ "<instructions text>",
             { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,…" } } ],
  "questions": {
    "<name>": { "type": "noul",   "instructions": "…", "criteria": { "true": "…", "false": "…" } },  // criteria optional
    "<name>": { "type": "choice", "instructions": "…", "criteria": { "APHU": null, "other": "Something else" } },  // map, required
    "<name>": { "type": "score",  "instructions": "…", "criteria": ["None", "Cosmetic", "Structural"] },  // list, required, at least 1
    "<name>": { "type": "box",    "instructions": "…" } } }
```

`state` may also be a plain string or an object; the array form is what carries an image part.

## OpenRouter Decisions response

```
{ "model": "typesafe/jev-1.14-20261014",            // the resolved, dated model that answered
  "answers": {
    "<noul>":   { "type": "noul", "noul": 0.96 },
    "<choice>": { "type": "choice", "choice": "APHU", "probabilities": { "APHU": 1, "CHSU": 0, "other": 0 }, "confidence": 1 },
    "<score>":  { "type": "score", "score": 1.34, "legend": { "0": "None", "1": "Cosmetic", "2": "Structural" },
                  "probabilities": { "0": 0.01, "1": 0.64, "2": 0.35 }, "confidence": 0.46 },
    "<box>":    { "type": "box", "box": { "top": 0.51, "bottom": 0.57, "left": 0.31, "right": 0.45 }, "confidence": 0.42 } },
  "usage": { "input_tokens": 1844, "output_tokens": 75, "cost": 0.000077448 },   // cost in USD
  "id": "gen-dec-…",
  "provider": "TypeSafe" }                            // or "OpenAI"
```

- Choice probabilities are a map from option to probability, the same as System One, so the app's Jev
  mapping is reused unchanged.
- Box edges are normalised to 0..1 of the image.

## Model ids (OpenRouter)

| Requested | Resolved on 16 Oct 2026 | Box question |
| --- | --- | --- |
| `~typesafe/jev-latest` (moving alias) | `typesafe/jev-1.14-20261014` | answered |
| `typesafe/jev-1.14` | `typesafe/jev-1.14-20261014` | answered |
| `typesafe/jev-1.13` | not recorded (the OpenAPI example shows `typesafe/jev-1.13-20260917`) | **400** `{"error":{"message":"HTTP 400: {\"detail\":{\"error_type\":\"api_usage_error\",\"message\":\"Invalid request.\"}}","code":400}}` |
| `openai/gpt-6-luna-decisions` | `openai/gpt-6-luna-decisions-20261006` | not asked (the app never sends Luna a box question) |

## Live smoke runs (16 Oct 2026)

| Route | Photo | Result |
| --- | --- | --- |
| OpenAI direct, `gpt-6-luna` | `rear-door-aphu-45g1.jpg` (1536 × 2048) | 200; fixture `src/fixtures/live/luna-smoke.json` |
| OpenRouter, `~typesafe/jev-latest` | `rear-door-chsu-22g1.jpg` (1312 × 984) | 200, resolved `typesafe/jev-1.14-20261014`, reported cost $0.000365; fixture `openrouter-jev-smoke.json` |
| OpenRouter, `typesafe/jev-1.13` | `rear-door-chsu-22g1.jpg` | 200 |
| OpenRouter, `openai/gpt-6-luna-decisions` | `rear-door-aphu-45g1.jpg` (1536 × 2048, full-size) | 200, resolved `openai/gpt-6-luna-decisions-20261006`, 5,570 input tokens, reported cost $0.000557; fixture `openrouter-luna-smoke.json` |

## Image limits (Jev)

- PNG or JPEG only.
- At most 1,568 px per side: a 1536 × 2048 photo (the bundled APHU sample) was rejected with
  "Invalid image dimensions"; a 600 × 900 photo was accepted. This matches TypeSafe's documented
  256–1,568 px per side (`docs/research/jev-guide-recheck.md`).

## Reported cost

- `usage.cost` is in USD. Jev: 1,844 input + 75 output tokens cost $0.000077448, and 1,814 + 37 cost
  $0.000076188. Both are exactly $0.042 per million input tokens with output free, matching TypeSafe's
  published $42 per billion tokens. Luna Decisions: 3,355 input tokens cost $0.0003355 ($0.10 per million).
- The app records `usage.cost` as a provider-reported cost and uses the rate table
  (`src/domain/rates.ts`, effective 2026-10-16) only when it is missing.

## Errors (OpenRouter)

Error bodies are `{ "error": { "message": "…", "code": <status> } }`. Seen live: 401 `"User not found."`
for a bad key; 400 for a box question on Jev 1.13 (above); 400 with a JSON list of schema issues in
`message` for a malformed body. The OpenAPI document also lists 402 (insufficient credits, "Add more using
https://openrouter.ai/credits"), 403, 404, 413, 429, 500, 502, 503, 524 and 529.

## Question format and ID wording (ticket #29, checked 16 Oct 2026)

Checked by `curl`-equivalent Node requests and the opt-in smoke test
`src/services/__tests__/coyu.live.spec.ts`, on `samples/rear-door-coyu-22g1.jpg` (1079 × 1080). Fixtures:
`src/fixtures/live/coyu-*.json` (no key, no headers).

**OpenAI Decisions answer shapes** (one question of each type):

```
{ "type": "predicate", "name": "…", "probability": 1.0 }
{ "type": "choice", "name": "…", "choice": "C", "probabilities": [{ "value": "C", "probability": 1.0 }, …], "confidence": 1.0 }
{ "type": "score", "name": "…", "score": 1.96,
  "probabilities": [{ "value": 0, "label": "unreadable", "probability": 0.01 }, …], "confidence": 0.94 }
```

- A `box` question is refused: 400 `Invalid value: 'box'. Supported values are: 'predicate', 'choice', and 'score'.`
- Choices without a `description` are accepted (`{ "value": "other" }`).
- `detail: "original"` on the image part made no difference to the answers on this 1079 px photo.

**OpenRouter** takes a choice criterion of `null` (`{ "other": null }`), and score criteria as plain
strings; its score answer carries `legend` and `probabilities` keyed by level index. The same Luna request
gives identical answers on OpenAI direct and through OpenRouter.

**ID wording.** Character questions describe the layout and name the character by its place in its group,
with no check-digit calculation. The digits are named from both ends ("the second digit of the six-digit
group, which is the fifth from its right-hand end"): naming them from the left only let Luna slip a place
along the repeated digits (`COYU2266130`, `COYU2268130`, depending on small wording changes).

| Route, photo as the app sends it (1079 px) | Reading |
| --- | --- |
| Jev latest via OpenRouter (resolved `typesafe/jev-1.14-20261014`) | `COYU2668130`, check digit valid, box `{top 0.10, bottom 0.14, left 0.61, right 0.79}` |
| GPT-6 Luna, OpenAI direct | `COYU2?68130`: the 2nd serial digit is a tie (6 0.44, 2 0.43), left unread; the re-check of it is also a tie |
| GPT-6 Luna Decisions via OpenRouter | the same as direct |

No variant of about twenty wordings tried read all eleven on Luna at 1079 px without misreading another
position; Luna's position answers on this photo are near coin tosses. One Lanczos upscale to Luna's
2,048 px, made outside the app, read `COYU2668130`. **Correction (re-checked 16 Oct 2026, ticket #31):**
that was one lucky resample, not a finding that upscaling reads all eleven. See "Enlarging the photo for
Luna" below: other upscales of the same photo misread, and the app does not enlarge photos for Luna.
The crop read (spec #27, D) is Jev's route to full detail.

## Luna on COYU: enlarging the photo, and the app's own path (ticket #31)

Checked: 16 October 2026, live, OpenAI direct (`gpt-6-luna`) unless stated otherwise. Luna's answers are
deterministic for a given image: the same bytes sent twice gave identical answers. Any change to the
pixels can flip the 3rd letter (`Y`/`U`) and several serial digits.

| Image sent (COYU, the same ID wording) | Reading | Wrong positions |
| --- | --- | --- |
| Original file bytes, 1079 × 1080 (what #29's smoke sends) | `COYU2?68130` (position 6 tied, left unread) | none |
| **The app's own path**: prepared by the store (browser canvas re-encode, JPEG q0.9, 1079 × 1080), OpenAI direct **and** OpenRouter Luna Decisions | `CO?U22?8130` | **6 read as `2`** |
| Browser canvas enlargement of the prepared photo to 2046 × 2048, JPEG q0.9, both routes | `CO?U2668830` | **9 read as `8`** (0.51, runner-up `1`) |
| Browser canvas enlargement of the original file to 2046 × 2048, JPEG q0.9 | `COUU266??30` | **3 read as `U`** (0.60, Likely) |
| PIL Lanczos of the original to 2046 × 2048, JPEG q95 | `COYU2668130` (Y at 0.39, 8 at 0.37) | none |
| PIL Lanczos of the original, JPEG q92 | `COYU2668130` (Y at 0.55, 8 at 0.52) | none |
| PIL Lanczos of the original, JPEG q90 | `CO?U2668130` | none |
| PIL Lanczos of the original, JPEG q98 | `COUU266?130` | **3 read as `U`** (0.74, Likely) |
| PIL bicubic of the original, JPEG q90 | `COUU2668130` | **3 read as `U`** (0.41) |
| PIL Lanczos of the app-prepared photo, JPEG q95 | `COUU2668130` | **3 read as `U`** (0.70, Likely) |
| PIL Lanczos of the app-prepared photo, JPEG q90 | `COUU266?130` | **3 read as `U`** (0.41) |

**Decision (16 Oct 2026, product owner):** the app does not enlarge photos for Luna. Enlarging mostly
turned an honest unread character into a misread, often a Likely one. A whole photo is never enlarged for
any model (`fitPhoto`). Only Jev's crop around the ID is scaled up (`largestWithin`, `cropRead.ts`).

**The app's real behaviour on COYU with Luna** is the second row: `CO?U22?8130` on both routes, position 6
misread as `2`. The Luna smoke in `src/services/__tests__/coyu.live.spec.ts` sends the original file's bytes
(first row). It does not exercise the app's preparation path, which re-encodes every photo. Sending the
original bytes would also send the file's EXIF to the provider, which the re-encode strips today. Whether
to change preparation is a separate decision.

**Spec #27's acceptance bar for Luna is not met, by decision.** The bar was that COYU 266813 0 reads
correctly on Jev latest and on Luna. Jev latest meets it. Luna through the app does not (`CO?U22?8130`),
and the product owner chose not to enlarge photos or send original bytes to close the gap. The Luna smoke
passes on original bytes, so a green Luna smoke is not evidence that the app reads COYU on Luna.

## Jev's crop read of COYU (ticket #31)

Checked: 16 October 2026, live, Jev latest through OpenRouter (resolved `typesafe/jev-1.14-20261014`). This
was a run through the store, as the app makes it: the photo was prepared and cropped by a real Chromium
canvas. Fixture: `src/fixtures/live/coyu-openrouter-jev.json` (`response` for the full photo, `crop` for
the crop read), recorded with no key and no headers.

- **Full photo:** read `COYU2668130`. Box `{top 0.10, bottom 0.15, left 0.61, right 0.79}`, confidence 0.76.
  Boxes drawn on other runs were `bottom 0.14`, confidence 0.75 to 0.77. The box is tight: it stops short of
  the `CO` and of the boxed check digit. A margin of 0.35 × the box's long side on every side brings them
  back in.
- **Crop:** 331 × 190 px at (590, 40), sent at 1568 × 900. Read `COYU2668130`, with probability 1.0 on
  every character except the 3rd serial digit (0.66) and the 4th (0.96). The two readings agreed on every
  character.
- **Cost:** about $0.00028 for the full-photo read and $0.00031 for the crop read (OpenRouter `usage.cost`).
