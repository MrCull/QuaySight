# Notice

A notice is an inline, non-blocking message: an optional suggestion, the recorded-sample label, or a system error. It is never a modal.

## Variants
- `qs-notice--suggestion`: photo glyph in `brand`, kicker *Optional*. For "A closer photo of … may help". Informational only; the result is already complete.
- `qs-notice--recorded`: dashed border, faint hatch, cassette glyph, kicker *Sample*. Shown above every result opened from a sample container. The title keeps the spec's wording, *Recorded demonstration: [provider/model]*, and the body explains it in plain words: a result saved from an earlier real inspection, replayed offline, with no key and no charge.
- `qs-notice--live`: no glyph, kicker *Live*. Shown above a live result. The title names who answered, by model, maker and route (*Live result: Jev latest (TypeSafe) via OpenRouter*); the body gives the exact version that answered (and, for a moving alias, the id that was requested) and says the cost is as the provider reported it, or an estimate where it reported none.
- `qs-notice--error`: `error-fg` border and octagon glyph on `error-bg`, `role="alert"`. Only for system failures (request failed, key rejected, unsupported model). Say what was kept and offer at most one deliberate retry.

## Consumer provides
A glyph, a one-sentence `.qs-notice__title`, an optional `.qs-notice__body`, and in the third column either a kicker or one small button.

## Don't
- Don't use the error style for low probabilities, uncertain readings or suspected damage.
- Never phrase a suggestion as a requirement ("Upload a closer photo to continue").
