# 0001. Reach Jev through OpenRouter, drop TypeSafe direct from the selector, add no relay

Date: 16 October 2026. Status: accepted. Spec #16, ticket #22.

## Context

Quay Sight calls providers straight from the browser with the presenter's own key, which lives only in
the tab's memory and goes only to its own provider's endpoint. Live checks on 16 October 2026
(`docs/research/live-api-findings-2026-10-16.md`) found:

- TypeSafe's System One endpoint answers the CORS preflight with 400 and no allow-origin header. A
  browser cannot call Jev directly at all.
- OpenRouter's Decisions endpoint (`https://openrouter.ai/api/alpha/decisions`) allows cross-origin calls
  and sends CORS headers on errors too. One `sk-or-` key reaches Jev latest, Jev 1.14 and Jev 1.13 (and
  GPT-6 Luna Decisions). The presenter's Jev key is an OpenRouter key.
- OpenRouter's System One endpoint rejects multipart bodies, so the TypeSafe multipart request cannot be
  reused by changing the base URL. Decisions takes one JSON body with the photo as a data-URL part.

## Decision

- **Add OpenRouter as a provider.** The catalogue (`src/domain/providers.ts`) lists OpenRouter with
  `~typesafe/jev-latest` (recommended, a moving target), `typesafe/jev-1.14` and `typesafe/jev-1.13`,
  route `openrouter`, wire format `openrouter-decisions`. OpenRouter with Jev latest is pre-selected on a
  first visit. A new adapter (`src/domain/openrouter.ts`, `src/services/openrouter.ts`) sends the existing
  Jev question set in OpenRouter's format and maps the answers with the existing Jev mapping. The box
  question goes only to models the catalogue declares box-capable (Jev latest and 1.14; 1.13 rejects it).
  `usage.cost` is recorded as a provider-reported cost; the rate table is the fallback.
- **Remove TypeSafe direct from the selector.** Its catalogue entry is gone; the provider id `jev` no
  longer exists, and a remembered `jev` selection is ignored. The adapter (`src/domain/jev.ts`,
  `src/services/jev.ts`) stays in the code base, with the caller now deciding the box question, so it can
  return if TypeSafe ever allows cross-origin calls.
- **Add no relay.** No server-side proxy or Azure Function is added. Every live call goes from the
  browser to the provider, so each key still goes only to its own provider's endpoint, and nothing we run
  ever sees a key or a photo.

## Consequences

- Jev runs are attributed by model, maker and route, e.g. "Jev 1.14 (TypeSafe) via OpenRouter", on the
  run label, ledger and exports, and record the dated model OpenRouter reports
  (e.g. `typesafe/jev-1.14-20261014`).
- OpenRouter becomes a third party in the data flow: the photo and key go to OpenRouter, which forwards
  the request to TypeSafe. The key-field hint says so.
- OpenRouter errors are readable, so they get specific messages (bad key, no credit, rate limited, photo
  rejected, provider unavailable, bad response). OpenAI's are not, which ticket #18 handles separately.
- If OpenRouter drops Decisions or CORS, Jev is unavailable in the browser until a relay is reconsidered.
  That would need a new ADR, because a relay changes where keys travel.
