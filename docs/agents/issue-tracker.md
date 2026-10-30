# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Authentication in a sandbox

If `gh` reports HTTP 401 or an invalid token despite a recent successful login, retry one read-only
repository request outside the sandbox using the normal escalation mechanism. Sandbox credential
visibility can differ from the host session. If the host request succeeds, use that context for the
remaining GitHub operations. Ask the user to authenticate again only if the host request also fails.
Keep tokens out of diagnostic output; use `gh auth status`, never print the token or credential file.

## Conventions

- **Create an issue**: write multiline Markdown to a UTF-8 temporary file and use `gh issue create --title "..." --body-file <file>`.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

For an approved ticket breakdown, use the [ticket publisher](ticket-publisher.md). It previews and
secret-scans the complete batch, reconciles existing GitHub issues on restart, and verifies labels,
sub-issue relationships and blocking links. Store disposable inputs under the system temporary
directory or ignored `.scratch/`; keep durable specifications in `docs/`.

## Approval handoffs between skills

Carry approved decisions forward through grilling, spec and ticket workflows. A directive to take
the next step can confirm the grilling outcome. Recheck only new or materially changed testing
seams; a new ticket breakdown still needs its own approval unless that exact breakdown and graph
were already accepted. Publication remains within the user's authorised scope.

The installed plugin's three approval steps have a narrow local patch in
`scripts/skill-approval-updates.json`. Plugin updates may replace cache edits. To preview reapplying
it, run `scripts/update-skill-approvals.ps1 -SkillRoot <installed-plugin-skills-directory>`; add
`-Apply` after reviewing the preview. The updater checks the original wording, backs up originals to
the system temporary directory and skips already patched files. It stops if an upstream update
changed the relevant wording, so the patch must be reviewed rather than applied blindly.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
