# Notice

A notice is an inline, non-blocking message: an optional suggestion, the recorded-sample label, or a system error. It is never a modal.

## Variants
- `qs-notice--suggestion`: photo glyph in `brand`, kicker *Optional*. For "A closer photo of … may help". Informational only; the result is already complete.
- `qs-notice--recorded`: dashed border, faint hatch, cassette glyph, kicker *Sample*. Shown above every result opened from a sample container. The title keeps the spec's wording, *Recorded demonstration: [provider/model]*, and the body explains it in plain words: a result saved from an earlier real inspection, replayed offline, with no key and no charge.
- `qs-notice--partial`: dashed `line-strong` border, cross glyph. Shown when some of the photos are left out of the result. It is not an error. Two uses:
  - A photo that adds nothing: the title names the photo (*Photo 2 doesn't show a container*), the body says *Nothing from it is used.*, no kicker.
  - Photos of different containers: the title says so, the body says nothing from them is combined and to start a new inspection for each container, kicker *Check*.

  Cancel has no notice: it clears straight back to the empty picker.
- `qs-notice--error`: `error-fg` border and octagon glyph on `error-bg`, `role="alert"`. Only for system failures (request failed, key rejected, unsupported model). Say what was kept and offer at most one deliberate retry.
  - A part no photo gave: the title names the part (*The container ID could not be read.*), the body gives the cause and *Everything else found is shown.*
  - A photo whose request failed while another photo still gave the part: the title names the photo (*Photo 1 could not be read in full.*), the body gives the cause and *Everything else found is shown.* The part itself is not called failed.

## Consumer provides
A glyph, a one-sentence `.qs-notice__title`, an optional `.qs-notice__body`, and in the third column either a kicker or one small button.

## Don't
- Don't use the error style for low probabilities, uncertain readings or suspected damage.
- Never phrase a suggestion as a requirement ("Upload a closer photo to continue").
