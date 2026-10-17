# Adding a question family

A question family is one reading (ID characters, details, weights, face, length, a damage set). It lives in one module and is listed once in `src/domain/questionRegistry.ts`. The survey and the damage requests take their questions from there; the Luna and Jev builders reach them through the shared adapter (`askDecisions`).

A family declares:

- `key`: its name in the findings.
- `questions(ask)`: prompt, choices, levels. `ask` carries the route's question set (`luna` or `jev`) and whether it takes box questions.
- `read(answers, ask)`: its answers by meaning, typed as `SurveyFindings[key]`.
- `apply(record, finding, { passId })`: what it adds to the `InspectionRecord`. Optional.
- `export(record)`: values, unresolved fields, conflicts and summary lines it adds to the exports. Optional.
- `request`: only if it is asked in a request of its own (the damage sets). Default: the survey.
- `instructions(ask)` or `input(ask)`: the text ahead of the photo. The first family of a request that gives one decides.

Steps:

1. In its own module, merge the finding type: `declare module './survey' { interface SurveyFindings { seal: SealReading | null } }`. Merge its record field the same way into `./inspection`.
2. Export `const sealFamily: QuestionFamily = { key: 'seal', questions, read, apply, export }`.
3. Add it to `FAMILIES` in `questionRegistry.ts`.

Limits on question count, choice count and duplicate names are checked on the whole assembled set when it is translated for the wire, so a new family cannot push a request over them unnoticed.

A spec can add a test-only family with `registerFamily(family)`, which returns its removal. See `src/domain/__tests__/questionRegistry.spec.ts`.
