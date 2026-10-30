# Research notes

Index of research notes on live provider facts. Each note states its own check date; re-check before relying on a fact.

- `jev-box-baseline-2026-10-30.md`: current Box/image contract, damage/marking audit, historical replay scores and reusable full-photo presence-plus-box experiment method for ticket #116. Checked 30 October 2026; distinguishes live evidence from provisional review and synthetic checks.

- `jev-guide-recheck.md`: re-check of the TypeSafe Jev integration guide against the live TypeSafe docs (endpoint, auth, request and response shape, images, box questions, model aliases, usage and cost, errors). Checked 16 October 2026; the guide itself was verified 25 September 2026.
- `live-api-findings-2026-10-16.md`: which provider endpoints a browser can reach (OpenAI sends CORS headers on success only, TypeSafe refuses the preflight, OpenRouter allows both), and OpenRouter's Decisions request and response shape, model ids, Jev image limits, reported cost and error bodies. Checked live 16 October 2026. Its last section (ticket #37) collects the question-design findings, provider limits, cost and accuracy recorded so far for spec #27, and lists what still needs a live recording.
- `owner-code-list-unchecked.md`: the owner-code list in `src/domain/ownerCodes.ts` checked against the BIC register on 17 October 2026 (11 codes removed, 3 kept as unconfirmed, 16 added including COYU).
- `numbered-regions-vs-whole-photo.md`: the paired score comparison of the zoomed ID read against the whole-photo read (Luna and Jev, same recordings), why Luna's zoom is fill-only, and why COYU is always offered in the whole-prefix question. Checked 17 October 2026.
- `openrouter-luna-refusals-2026-10-25.md`: why GPT-6 Luna through OpenRouter loses a whole request when Luna refuses one question (OpenAI direct marks just that question refused; OpenRouter answers 502 and names one refused question per call), why Luna is now offered direct only, and how the app reports such a 502. Checked live 25 October 2026.
