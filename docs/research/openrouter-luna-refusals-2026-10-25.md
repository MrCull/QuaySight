# GPT-6 Luna refusals through OpenRouter

Checked: 25 October 2026, live, with the app's own question sets, on `samples/seal-closeup-coyu-0154620.jpg`
paired with `samples/jdlu-200690-1-rear-doors.jpg`. Re-check before relying on any of this.

## What happens

Luna sometimes refuses individual questions about a photo, most often on a close-up that shows no
container ID or no container face (the seal close-up: ID characters, damage zones, rails, corner castings).

- **OpenAI direct** (`gpt-6-luna`) answers 200 and marks only those questions refused, e.g.
  `{"type":"refusal","name":"id_char_01"}`, with every other answer in the same reply. The app reads a
  refused question as not read. The two-photo run completed: 11 requests, all 200.
- **OpenRouter** (`openai/gpt-6-luna-decisions`) fails the whole request instead:
  `502 {"error":{"message":"OpenAI refused to answer question \"id_char_01\"","code":502}}`. OpenRouter's
  Decisions answer schema (OpenAPI document, read the same day) has only `noul`, `choice`, `score` and
  `box` answers: there is no refusal type to pass through, and no request option changes this. Every
  other answer in that request is lost, and the requests that depend on it (the closer ID look, the seal
  read) are never sent.

## One refused question at a time

The 502 names only the first refused question. Re-sending a refused damage-set request (121 questions)
with each named question removed took 12 calls: 11 refusals, one at a time
(`Z1B_BT`, `Z2T_DT`, `Z2T_CO`, `Z2B_DT`, `Z2B_BT`, `Z3B_BT`, `Z4B_CO`, `Z5T_BW`, `Z5B_CO`,
`bottom_rail_bent`, `corner_casting_damage`) before a 200 with the remaining 110 answers ($0.003).
Which questions are refused is not stable between runs. Dropping refused questions and re-asking is
therefore not a practical recovery: it can take a dozen or more calls for one request, against a cap of
50 per inspection. Whether OpenRouter charges for the 502s was not established (the key's usage moved by
about what the successful calls cost).

## What the app does

GPT-6 Luna Decisions is no longer offered through OpenRouter (`src/domain/providers.ts`): Luna is offered
through OpenAI direct only, where a refused question costs only that question. OpenRouter offers the Jev
models.

`openRouterFailure` (`src/domain/openrouter.ts`) reads this 502 as `question-refused`, and
`describeFailure` gives it the cause `declined`: "The model would not answer about this photo." Before
this it was classed as any other 5xx and shown as "OpenRouter is busy or rate-limited", which a retry
never fixes. Jev through OpenRouter was not seen to refuse questions; the reading is kept in case any
OpenRouter model does.
