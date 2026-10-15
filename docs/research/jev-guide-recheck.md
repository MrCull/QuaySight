# Jev guide re-check against live TypeSafe documentation (issue #15, criterion 1)

Checked: 16 October 2026. Guide checked: `Jev_AI_Integration_Guide_for_Coding_Agents.md` (verified 25 September 2026).
Where the guide and the live docs differ, the live docs are followed.

## Live URLs checked

- https://docs.typesafe.ai/llms.txt (documentation index)
- https://docs.typesafe.ai/api (HTTP API reference)
- https://docs.typesafe.ai/models (model IDs, aliases, pricing)
- https://docs.typesafe.ai/images (experimental image input and opt-in)
- https://docs.typesafe.ai/primitives/box (experimental box question)
- https://docs.typesafe.ai/introduction/quickstart (key source and auth header)

Not checked in this pass: rate-limit figures, SDK package names and versions, OpenRouter pages.

## Endpoint and authentication

- Endpoint: `POST https://api.typesafe.ai/v1/systemone`. Matches the guide and spec.
- Auth: `Authorization: Bearer <TypeSafe API key>` and `Content-Type: application/json`. Matches the guide.
- Key source: a TypeSafe API key from the TypeSafe console (https://console.typesafe.ai/keys). The quickstart suggests the environment variable `TYPESAFE_API_KEY`. Key format is not documented. OpenRouter keys are not mentioned anywhere on these pages.
- The guide's OpenRouter endpoint (`https://openrouter.ai/api/alpha/decisions`, `typesafe/jev-1.13`) is not covered by these live TypeSafe pages. It is not used by this adapter.

## Request shape

- Top-level fields: `model` (required), `state` (required, string | object | array), `questions` (required map), and `assets` (optional, images, see below).
- Question types: `choice` (`criteria` required, up to 255 options), `score` (`criteria` required, 2 to 10 levels), `noul` (`criteria` optional), and `box` (experimental, no `criteria`, see below). Matches the guide except for `box`, which the guide does not mention.
- Limits: 32 MiB body, 64 nesting levels, finite numbers only, 64k tokens per request and 32k per question (262k with the long-context header).

## Images (experimental opt-in)

- Opt-in: header `TypeSafe-Danger-Zone-Images: true` on every request that contains an image or a box question. The guide does not mention images at all.
- Images go in a top-level `assets` map keyed by reference. The request refers to each reference from `state`, an `instructions` field or `criteria`. An unreferenced asset returns 400.
- Asset fields: `type` (optional, `"image"`), `data_base64` (standard base64, no `data:` prefix, no whitespace), `format` (`png`, `jpg` or `jpeg`, lowercase). Multipart with a `part` field is recommended by the docs and is the mechanism this adapter uses for images.
- Limits: PNG or JPEG only, still images only, 16 MiB per file, 280 to 1568 px per side, 78,400 to 2,458,624 total pixels. Out-of-range images are rejected, not resized. EXIF orientation is not applied, so photos should be rotated before upload.
- Any rejected image fails the whole request. No partial answers.

## Box (experimental)

- Request: `{ "type": "box", "instructions": "..." }` with no `criteria`. Requires an image in the request.
- Response: `answers[k] = { type: "box", box: { top, bottom, left, right }, confidence }`, fractions 0 to 1, origin top-left.
- Supported only by `jev-1.14.0` (and `jev-preview`, which points to 1.14.0). Not supported by `jev-1.13.0`. The spec says the box is never a proof of damage.

## Model IDs and resolution

- Pinned: `jev-1.14.0` (released 14 October 2026, image and box capable), `jev-1.13.0`.
- Aliases: `jev-latest` points to `jev-1.13.0`; `jev-preview` points to `jev-1.14.0`. The guide's `jev-latest` example is consistent with this, but the live docs now say the latest stable is 1.13.0 and the newest is 1.14.0 via `jev-preview`.
- The guide's `jev-1.13` (no `.0`) OpenRouter ID is not a TypeSafe direct ID. Live docs say versioned IDs are accepted directly in `model`.
- Resolution: the response `model` field gives the versioned ID that answered (for example `jev-1.13.0`). The adapter records both the requested ID and this resolved value.

## Usage and cost

- Live docs: `usage` has `input_tokens` and `output_tokens` only. Output is free. Pricing is $42 per Btok ($0.042 per Mtok) input, for both 1.13 and 1.14, documented without a date.
- Guide difference: the guide's example has `usage.cost`. The live docs do not document any cost field. The adapter reads `usage.cost` only if a response carries it; otherwise cost is `null` (unavailable, never zero). The ledger then estimates from tokens using the timestamped rate in `src/domain/rates.ts` (documented $0.042 per Mtok input, output free).
- Images count as input tokens and are included in `usage.input_tokens`.

## Errors

- Live: 400 (invalid request, rejected image, missing opt-in header, `max_tokens_exceeded`), 401, 413 (body or image size), 415, 422, 429, 529.
- Guide: lists 401, 422, 429, 529 only. Live docs add 400, 413 and 415. The SDKs retry 429 and 529 by default. This adapter makes no automatic retries: every call is chargeable and the ledger counts each one, so a retry is left to the presenter. 429 and 529 get a clear message.

## Response shape

- `{ model, answers: { key: answer }, usage: { input_tokens, output_tokens } }`.
- `choice`: `choice`, `probabilities`, `confidence`. `score`: `score`, `legend`, `probabilities`, `confidence`. `noul`: `noul` (0 to 1, no confidence). `box`: see above.
- Matches the guide's shape for these fields. The guide's `id` and `provider` fields are not documented on the live API page and are not used.

## Differences summary

1. Image input, the `assets` mechanism and the `TypeSafe-Danger-Zone-Images` opt-in are documented live but absent from the guide.
2. The `box` question type exists live (1.14 only) and is absent from the guide.
3. Live docs document no cost field; guide shows `usage.cost`. Cost is null.
4. Model aliases moved: `jev-latest` is 1.13.0; `jev-preview` is 1.14.0 (from 14 October 2026). The guide lists only 1.13.
5. Error set is broader live (400, 413, 415).
6. The guide's OpenRouter endpoint, model IDs and key type are not covered by TypeSafe's live docs.

## Key type check

- The supplied key has the `sk-or-` (OpenRouter) prefix, which is the OpenRouter key format.
- The live TypeSafe docs say the direct API uses a TypeSafe API key from the TypeSafe console, sent as a Bearer token to `api.typesafe.ai`. They do not say OpenRouter keys are accepted, and they do not show an `sk-or-` (OpenRouter) example.
- Result: the supplied key does not match the direct TypeSafe endpoint's documented key source, so it should not be used against `api.typesafe.ai`. If it is, expect a 401. No request was made with the key in this ticket. The lead runs the smoke test with `JEV_API_KEY` set to a TypeSafe console key.
