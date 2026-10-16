# CostIndicator

The cost indicator is a small, always-visible pill showing this container's and the session's estimated API cost. It expands into a request-level ledger.

## Variants
- **Quiet** (`.qs-cost.qs-cost--quiet`), the one the app's top bar uses: a muted line in `body-sm`, the figures in mono `ink`, no pill and no mode dot, so the cost never competes with the photo. *This container None yet · Session $0.0187*; for a sample, *Saved result · no live API charge*. An incomplete total adds *Partial estimate* (`.qs-cost__partial`). The panel floats under it, right-aligned. It does not glow on arrival; the figure simply changes once the response is parsed.
- **Pill** (`.qs-cost` alone): the bordered pill below, with a mode dot, for places where the cost needs to stand out (a cost summary card, a printed export).

## States
- **Live**: a solid brand dot, then *This container $0.0042 · Session $0.0187*.
- **Sample**: a dashed dot, *Sample · Saved result · no charge*. A sample's recorded usage may appear in the ledger but is never added to live totals.
- **Partial**: a cost that can't be estimated shows *Partial estimate* or *Cost unavailable* in `cert-uncertain-fg`. Never `$0.00`.

## Consumer provides
A `button.qs-cost__toggle` with `aria-expanded` and `aria-controls`, plus `.qs-cost__panel` holding the totals (`.qs-cost__stat`) and a `.qs-cost__table` with one row per API call: sequence, purpose, provider · exact model/version, tokens, estimated cost, latency. Keep the footer note: estimates are not an invoice.

## Rules
- Place it in the top bar, right-aligned. It must never cover the photo or the findings.
- Money is set in `data-sm` mono with enough precision to mean something: `$0.0016`, not `$0.00`. Use four decimals below one cent.
- Expanding runs over `duration-base` and the panel sits on `surface-raised` with `shadow-raised`. On phones (480px and below) it opens as a bottom sheet over `scrim`; `bundle.css` does this for both variants.
- Count each request once, even though it feeds both the container and session totals.
