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
| `openai/gpt-6-luna-decisions` | `openai/gpt-6-luna-decisions-20261006` | not asked (ticket #23) |

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
