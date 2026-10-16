# Spec #27 implementer brief

Repo: /home/user/QuaySight (GitHub MrCull/QuaySight). Integration branch: `claude/spec-27-live-inspections`.

Read first: `AGENTS.md`, spec issue #27, your ticket issue (GitHub MCP tools `mcp__github__issue_read`;
the `gh` CLI is not available — load MCP tools with ToolSearch). `design-system/README.md` before any UI.
Shared notes from other agents live beside this file (`handoff/spec-27/notes/*.md` on branch `handoff/spec-27`); read any that look relevant and
add a short note of your own if you learn something later tickets need (seams you created, how to add a request, etc.).

## Rules

- Work in your own worktree on your own branch. Before starting, confirm your branch is based on
  `claude/spec-27-live-inspections` (`git merge-base --is-ancestor claude/spec-27-live-inspections HEAD`); if not, `git reset --hard claude/spec-27-live-inspections`.
- Run `pnpm install --frozen-lockfile` in your worktree if `node_modules` is missing.
- Build with the `tdd` skill (Skill tool, `tdd`).
- Commit on your branch with clear messages, ending with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YL2yzDcSL5fdJPvfkgRTYK
  ```
  Never put a model name anywhere else in commits or code.
- Before reporting done: merge the integration branch tip into your branch (`git merge claude/spec-27-live-inspections`), resolve conflicts, and get `npm run check` green.
  Do not push; do not touch the integration branch itself. The orchestrator merges you.
- Hotspots (`src/App.vue`, `src/styles/results.css`, `src/domain/inspection.ts`, `src/stores/inspection.ts`) are edited by #28's request-plan prefactor; other tickets should add requests through the plan seam from their own domain modules and keep hotspot edits minimal.

## Running the gate locally

Playwright needs the pre-installed Chromium and a virtual display, and a unique port so it doesn't reuse another worktree's dev server:
`PW_PORT=<unique 5xxx> PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome xvfb-run -a npm run check`

## Live API keys

Ask the user for dev keys; never commit them. Put them in a private file OUTSIDE the repo (chmod 600) defining
`OPENAI_API_KEY` and `OPENROUTER_API_KEY`, and load them only at run time, e.g.
`set -a; . <that file>; set +a; npx vitest run src/services/__tests__/<x>.live.spec.ts`.
NEVER print, echo, log, commit or copy a key: not in fixtures, notes, test files, screenshots, commit messages or
reports. Fixtures are recorded with no key or headers. Run `npm run check:secrets` before committing anything recorded live.

## Report back (keep it short)

Branch name, commit range, `npm run check` result, which acceptance criteria are met, anything not done and why,
and any seam later tickets must know about (also written to a note here).
