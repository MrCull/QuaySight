# RunChip

The run chip names who answered a recorded sample. Demo mode has no `SettingsChip`, so once a sample runs the run chip stands in the top bar where the settings chip would be: the provider's monogram, the model's name and, in mono, the maker or route and the model id.

## Use
- `span.qs-runchip` in the top bar, after the brand and before the `CostIndicator`, with a `title` repeating its words for when the detail is cut short.
- Inside, in order: the provider's `.qs-mono` monogram (`aria-hidden`), `span.qs-runchip__name` and `small.qs-runchip__detail`.
- The words come from the provider catalogue, never rebuilt in a component: the name is the model as people say it (`labelsFor(…).model`, *GPT-6 Luna*, *Jev latest*), the detail is the maker or route (`labelsFor(…).route`, *OpenAI* for a direct model, *TypeSafe via OpenRouter* for one reached through OpenRouter), a middle dot, then the model id the recording names (*gpt-6-luna*, *~typesafe/jev-latest*).
- Shown only in demo mode, and only once a sample has run. A live run is named by the `SettingsChip`: changing provider or model blanks the screen, so the two never disagree.
- On phones (the top bar wraps at 960px and below) hide `.qs-runchip__detail`; only the monogram and the name show. A long detail ends in an ellipsis rather than scrolling sideways.

## Rules
- Not a control: no button, no hover, no focus. It opens nothing; in demo mode the `DemoBanner`'s **Connect a provider** is the way to a provider.
- Neutral ink only: `line` edge, `ink` name, `ink-muted` monogram and detail. Never certainty, severity or hazard colours, and never `brand`. Nothing is green.
- Never say *verified*, *live* or *connected* in it; it names a recording.
