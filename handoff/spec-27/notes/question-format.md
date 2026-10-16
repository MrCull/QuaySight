# Question format: author a set once, get typed answers back on both wire formats (#29)

Branch: `worktree-agent-a3538793f2d3de5bd`. Code: `src/domain/questionSet.ts` (format, limits,
translation, answers), `src/domain/questionSetAsk.ts` (adapter for #28's `askDecisions`),
`src/domain/idQuestions.ts` (ID character questions). Tests showing every step:
`src/domain/__tests__/questionSet.spec.ts` (pure), `src/stores/__tests__/questionSetRequest.spec.ts`
(a test-only plan request, end to end through the store, on both routes).

## 1. Author the set (OpenAI Decisions shape)

In code:

```ts
import { questionSet } from '../domain/questionSet'
const SET = questionSet('Text sent ahead of the photo.', [
  { type: 'predicate', name: 'door_end', instructions: '…' },
  { type: 'choice', name: 'quality', instructions: '…', choices: [{ value: 'good', description: '…' }, { value: 'poor' }] },
  { type: 'score', name: 'Z1T_severity', instructions: '…', levels: [{ label: 'none', description: '…' }, …] },  // lowest first
  { type: 'box', name: 'id_box', instructions: '…' },   // OpenRouter/TypeSafe only; OpenAI refuses box (400)
])
```

From a JSON file in the product owner's shape (e.g. `docs/research/question-sets/side-damage-v2.json`):
`parseQuestionSet(json)` → `SharedQuestionSet`. It keeps `input` messages as written, including
`detail` on the image part; any `model` in the file is ignored. Vite can `import set from '…json'`
(already done for fixtures). Unknown question types, duplicate names, empty choices/levels throw
`QuestionSetError`. The image part's `image_url` is a placeholder: every image part gets the real photo.

## 2. Send it as a plan request (#28) — `questionSetAsk` fits `askDecisions` directly

```ts
send: (ctx) => askDecisions(ctx, questionSetAsk(SET, (reply, route) => mapMyAnswer(reply.answers)))
```

- `build` translates for `route.entry.wireFormat` and throws `QuestionSetError` **before anything is
  sent** if the set breaks that route's limits (the request then fails; the rest of the run lands).
- `map` reads the reply by meaning with the route's own bad-response wording (LunaError /
  OpenRouterError). `reply` is `AnswersReading`: `{ answers, resolvedModel, usage, reportedCostUsd }`;
  `askDecisions` already records model/usage/cost for the ledger itself.
- A set is built per request, so a set that depends on a prerequisite (crop read, weight re-read) can
  be built inside `send` from `ctx.answer(...)`.

Without the plan: `toWireRequest(wire, set, { model, imageDataUrl })` and
`readAnswers(wire, raw, set, requestedModel)`, wire = `'openai-decisions' | 'openrouter-decisions'`.
TypeSafe direct (System One) takes `toOpenRouterQuestions(set.questions)`.

## 3. Typed answers (`SharedAnswer`, keyed by question name)

| Asked | OpenAI reply | OpenRouter reply | You get |
| --- | --- | --- | --- |
| predicate | `probability` | noul `noul` | `{ type: 'predicate', probability }` |
| choice | `choice`, probabilities list | `choice`, probabilities map | `{ type: 'choice', value, probabilities: Record<value, p>, confidence }` |
| score | `score`, probabilities list by level index | `score`, probabilities map by index | `{ type: 'score', level, label, score, probabilities: number[], confidence }` (level = most probable; label as authored) |
| box | refused | `box` edges 0..1 | `{ type: 'box', box: { top, bottom, left, right }, confidence }` |

A question with no usable answer is **absent** (unread — never fill it in): unanswered, a value not
offered, a level out of range, a box outside the photo or with crossed edges.

## 4. Translation rules (OpenRouter)

predicate → `noul`; choice → `criteria` map value → description (`null` when none, accepted live);
score levels → ordered `criteria` array of `"label: description"` (or `label`); box → `box`; text parts
joined into one string ahead of the photo; image part → `{type:'image_url', image_url:{url}}`, `detail`
dropped. OpenAI keeps the authored request as is (box refused).

## 5. Limits (`REQUEST_LIMITS`)

200 questions per request and 255 choices per question on both wire formats (OpenAI checked live;
OpenRouter forwards Luna to OpenAI; TypeSafe documents 255). `splitQuestionSet(set, wire)` splits a long
set into ≤200-question sets with the same input (send each as its own request). A choice over 255 is
refused, not split (splitting changes its meaning; the manifest check splits its own entries).
The side set (132) fits in one request.

## 6. ID questions

`lunaIdQuestionSet(positions?)` and `jevIdQuestionSet({ image, box })`. Answer names stay
`id_char_01..11`; `readIdCharacters(answers, positions?)` gives the per-character readings. Each
question states the layout and the character's place in its group; digits are named from both ends
("the second digit of the six-digit group, which is the fifth from its right-hand end"). No check-digit
calculation is sent; the app validates it. A crop read (D) can reuse `jevIdQuestionSet` unchanged.

## Live finding to know (16 Oct 2026, COYU photo, see docs/research/live-api-findings-2026-10-16.md)

Jev latest reads `COYU2668130` on the full 1079 px photo. GPT-6 Luna (both routes, identical answers)
reads `COYU2?68130`: the second serial digit is a 0.44/0.43 tie, left unread, re-check also a tie, so the
manifest check is offered. Never a misread. Upscaled to 2,048 px Luna reads all eleven with clear margins;
the app never enlarges a full photo (spec #16), so a crop read for Luna would be the way to get there.
Fixtures: `src/fixtures/live/coyu-*.json`; store replay: `src/stores/__tests__/coyuRecorded.spec.ts`.
