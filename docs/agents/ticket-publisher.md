# Publish an approved ticket batch

Use `npm run tickets -- <batch.json>` to validate and preview an approved breakdown without network
access. Review the displayed titles, bodies and blocking edges. Then publish with
`npm run tickets -- <batch.json> --publish`. Use `--verify` instead for a read-only server check.
These commands do not grant publication approval: carry forward the user's approval from the session.

Store the input in the system temporary directory or ignored `.scratch/`. A batch uses this shape:

```json
{
  "repo": "MrCull/QuaySight",
  "parent": 115,
  "batch": "jev-box-localisation",
  "tickets": [
    {
      "key": "baseline",
      "title": "Establish the localisation baseline",
      "body": "## What to build\n\nRecord baseline results.\n\n## Acceptance criteria\n\n- [ ] Report costs and failures.",
      "blockedBy": []
    },
    {
      "key": "overlays",
      "title": "Show accepted damage locations",
      "body": "## What to build\n\nDisplay source-photo evidence.\n\n## Acceptance criteria\n\n- [ ] Preserve unlocated findings.",
      "blockedBy": ["baseline"]
    }
  ]
}
```

`parent` is optional. `batch` and ticket `key` are stable lowercase slugs. Bodies contain the ticket's
actual deliverable and acceptance criteria; the tool adds the parent reference and a hidden identity
marker. Blocking edges are native GitHub dependencies. Titles and bodies are secret-scanned before
any network access. Every issue receives `ready-for-agent`; the parent body and status are untouched.

The tool orders tickets by dependencies and rejects duplicate keys, unknown blockers and cycles.
It reads all repository issues, including closed ones, to reconcile its identity markers. It checks
content, labels, parent membership and blockers against server state, then adds missing links and
labels. A changed published body or unexpected blocker stops the run for review; it does not overwrite
someone's edits. Duplicate markers also stop publication.

After a timeout or interrupted write, rerun the **same input with the same batch and keys**. The server
may have accepted the write even if the response was lost. Server reconciliation recovers it without
relying on a local checkpoint. Run one publisher per batch at a time; GitHub provides no atomic
idempotency key for issue creation, so concurrent publishers can still race.

The tool requires GitHub's sub-issue/dependency APIs. If the repository cannot use them, it stops;
use the documented manual fallback after reviewing what already exists. For sandbox authentication
failures, follow [issue-tracker.md](issue-tracker.md#authentication-in-a-sandbox).

The eight tickets already published for spec #115 predate these identity markers. Do not republish
them through this tool: new batches are resumable only after their markers have been introduced.
