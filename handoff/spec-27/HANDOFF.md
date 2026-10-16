# Handoff: implementing spec #27 (16 Oct 2026, ~17:30 UTC)

The previous orchestrating session was stopped by the user, and its three implementer agents were cut off by
a usage limit. Everything you need is on GitHub. Nothing depends on that session's container.

**Task:** implement spec #27, "Live inspections that read the whole container" (MrCull/QuaySight), using its tickets
#28–#38 on one integration branch. The previous session ran the repo's `implement-spec` skill
(`.claude/skills/implement-spec/SKILL.md`).

## Where things are

| What | Where |
| --- | --- |
| Spec and tickets | Issue #27; sub-issues #28–#38 (each has "Blocked by") |
| Integration branch | `claude/spec-27-live-inspections`, tip `bd9b57e` (contains #30, #28, #29) |
| Draft PR | #40 (integration → main), body has `Closes #27`…`#38` |
| Implementer brief (rules, gate command, key handling) | `handoff/spec-27/notes/BRIEF.md` (this branch) |
| Seams written by finished tickets | `notes/request-plan.md` (#28), `notes/question-format.md` (#29), `notes/ticket-30-setup-touches.md` (#30), `notes/crop-read.md` (#31, in progress) |
| Codebase exploration for #31–#38 | `notes/explore-details.md`, `notes/explore-damage.md`, `notes/explore-demo-ds.md` (written at `99ac2d3`, before the plan and format; check them against the integration tip) |
| Interrupted work (backup snapshots) | branches `wip/spec-27-ticket-31`, `wip/spec-27-ticket-32`, `wip/spec-27-ticket-33` |

`handoff/spec-27` is a scratch branch. Don't merge it.

## Ticket status

| Ticket | Status |
| --- | --- |
| #30 Setup touches | **Merged** into integration |
| #28 Request plan, Cancel, progress | **Merged** |
| #29 One question format, group-position IDs | **Merged**; the Luna COYU criterion is not met (see decisions) |
| #31 Jev crop read | **Nearly done, uncommitted.** Snapshot `wip/spec-27-ticket-31` (`f9bb99a`, a WIP commit on `bd9b57e`). Its agent said the crop read is done and live-verified, and was about to run the full gate. |
| #32 Container details | **In progress, 2 real commits** (`abb0609`, `63a1287`) on `bd9b57e` = `wip/spec-27-ticket-32`. It was writing an exports test for live details. |
| #33 Long-side damage | **In progress, uncommitted.** Snapshot `wip/spec-27-ticket-33` (`ad26b3c`, a WIP commit on `bd9b57e`). It was adding an export test block for live damage. |
| #34 Weights kg/lb, units toggle | Blocked by #32 |
| #35 Door-end set | Blocked by #33 |
| #36 What we found | Blocked by #32, #33, #34 |
| #37 Demo recordings, research note | Blocked by #31, #34, #35 |
| #38 Design-system parity | Blocked by #30, #36, #37 |

The WIP snapshots are full working trees committed as a single "WIP snapshot" commit. Before merging, finish each
ticket on a fresh branch from its snapshot. Then rewrite that WIP commit into proper commits (soft-reset onto `bd9b57e`,
or squash), so the integration history holds no "WIP snapshot" commit. Re-run each ticket's acceptance criteria and
`npm run check` yourself; none of these three passed the gate yet.

## Decisions made with the user (don't re-ask)

- **Luna and the COYU ID:** the full photo is **never enlarged** for Luna. The user first chose to upscale, then reversed
  that after live evidence: an upscaled photo gave confident misreads (`CO?U2668830`).
- **Live facts (16 Oct):** through the app's own path (canvas re-encode at q0.9), Luna reads COYU as `CO?U22?8130`, with
  position 6 misread as 2, on both routes. Luna's answers on this photo flip with tiny pixel changes. #29's Luna smoke
  sends the original file bytes, which gives `COYU2?68130` (never a misread). That smoke must be labelled as not covering
  the app path (the #31 agent was told to do this). Jev latest reads `COYU2668130`, and the crop read is about 1.0 per character.
  So the Luna half of the COYU acceptance bar is **not met, by decision**. Say so in the PR. The #31 agent records these
  findings in `docs/research/live-api-findings-2026-10-16.md`. Check they're there.
- **Original-bytes passthrough** in `preparePhoto` (skip the re-encode when no resize or rotation is needed): **not done**.
  It is luck-based and would send the original file's EXIF (possibly GPS) to the provider. It's open as a separate decision
  for the user; the orchestrator recommended leaving it out.
- **Ship mechanics:** merge to main deploys to quay-sight.com. Follow #26's PR shape (Summary, Evidence, Merge Danger,
  `Closes` lines). The repo's `pr` skill covers the body.

## How to continue

1. Read `AGENTS.md`, issue #27, `handoff/spec-27/notes/BRIEF.md` and `notes/request-plan.md` and `notes/question-format.md`.
2. Ask the user for dev keys (OpenAI, OpenRouter) if live smokes are needed. Store them outside the repo and never commit them.
3. Finish #31, #32 and #33 from their snapshots, one implementer each in its own worktree. Watch out:
   - all three edit the survey request (the ID request, A) and add a line to `src/plan/registry.ts`, so expect conflicts there;
   - #32 grows A into the survey; #33 adds the face question to A; #31 relies on A's `readings` and `box` fields.
   Merge each into the integration branch (`--ff-only` where possible, otherwise a merger agent), push, and update PR #40's "Merged so far".
4. Then the frontier: #34 (after #32), #35 (after #33), then #36, #37, #38.
5. When all are merged: run the `code-review` skill on the integration branch against `main`, fix the findings in
   one pass, fill PR #40's body (evidence, live smoke results, Merge Danger, the Luna caveat), and mark it ready.
6. Clean up worktrees and the `wip/spec-27-ticket-*` and `handoff/spec-27` branches.

**Local gate:** `PW_PORT=<unique> PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome xvfb-run -a npm run check`.
Give each worktree a unique port so Playwright doesn't reuse another worktree's dev server.

## Suggested skills

- `implement-spec`: the orchestration loop
- `tdd`: each implementer
- `code-review`: the final review on the integration branch
- `pr`: writing PR #40's final body
- `diagnosing-bugs`: if a live smoke or the gate fails unexpectedly
