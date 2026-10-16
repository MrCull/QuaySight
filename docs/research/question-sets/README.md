# Question sets

Reference question sets supplied for spec #27. Each is in the OpenAI Decisions request shape
(`choice`, `predicate`, `score` with `levels`); `{{imageBase64}}` marks where the photo goes.
This is the app's one question format: `parseQuestionSet` in `src/domain/questionSet.ts` reads such a
file, and `toWireRequest` / `readAnswers` translate it for OpenAI or OpenRouter and read the answers back.

| File | Source | Used by |
| --- | --- | --- |
| `side-damage-v2.json` | Supplied by the product owner, 16 Oct 2026 | Long-side damage request (#33). Stored as data at `src/domain/questionSets/side-damage-v2.json` (`docs/` is not bundled); its "20-foot" wording is generalised to 20 ft or 40 ft. |
| `door-damage-v1.json` | Written for ticket #35 in the side set's shape and rubric | Door-end damage request (#35). Stored as data at `src/domain/questionSets/door-damage-v1.json`: 93 questions (two door leaves by top, middle and bottom thirds, locking bars, cams, hinges, gaskets, header, sill, corner posts, castings). Not yet checked live: no keys were available when it was written (`src/services/__tests__/doorDamage.live.spec.ts` is the opt-in check). |

Checked live on 16 Oct 2026 against `samples/side-dented-grey.jpg`: GPT-6 Luna found the dent in Z2B/Z3B
(DT ≈ 0.92), 31.5k input tokens, ≈ $0.003, 0.9 s; Jev latest via OpenRouter found the same zones (DT ≈ 0.63), $0.0007.
