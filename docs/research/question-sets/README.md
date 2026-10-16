# Question sets

Reference question sets supplied for spec #27. Each is in the OpenAI Decisions request shape
(`choice`, `predicate`, `score` with `levels`); `{{imageBase64}}` marks where the photo goes.

| File | Source | Used by |
| --- | --- | --- |
| `side-damage-v2.json` | Supplied by the product owner, 16 Oct 2026 | Long-side damage request (#33). Its "20-foot" wording is to be generalised. |

Checked live on 16 Oct 2026 against `samples/side-dented-grey.jpg`: GPT-6 Luna found the dent in Z2B/Z3B
(DT ≈ 0.92), 31.5k input tokens, ≈ $0.003, 0.9 s; Jev latest via OpenRouter found the same zones (DT ≈ 0.63), $0.0007.
