# Fast and cheap runs

Measured on the spec #27 session: about $124 and 10 hours. Most of the cost was agents re-reading a
large context on every call (cache reads); most of the time was test runs, commit hooks and screenshots.

## Tests are off for now

`npm run check` (the CI gate and the default for agents) runs lint, the token ratchet, type-check and
the build. Unit and e2e tests run only on request: `npm run check:tests`, or `npm run check:all` for the old
full gate. CI runs them when the repository variable `RUN_TESTS` is `true`. Pre-commit runs the secret scan
and type-check only.

To switch tests back on: set `RUN_TESTS=true`, add `npx vitest run --run` back to `.githooks/pre-commit`
(or use `npx vitest related --run <staged files>`), and fold `check:tests` into `check`.

## Rules for implementer agents

- Run `npm run check` once per ticket, after the final merge of the integration branch. While working,
  run the one spec you are changing (`npx vitest run <file>`).
- Screenshots: `npm run screenshots` takes 4-6 minutes. Run it once per ticket. Each image you read stays
  in context for every later call, so read only the states your change touches, and prefer an
  assertion (overflow, opacity, focus ring) to looking.
- The screenshots runner uses `PW_CHROMIUM_PATH`, else `/opt/pw-browsers/chromium` when present, and exits non-zero naming a browser problem if no screenshot was written.
- Report once, then stop. Leave no background job running after the report.
- Code points only at committed files (`docs/`, source). Scratch notes are deleted after the run.
- Check that the keys a ticket's live criteria need are present before starting it. If they are missing, build
  the opt-in spec, say the criterion is unverified, and move on.
- Playwright runs one worker under `CI=1`. In a container with spare cores set `PW_WORKERS=4`.
