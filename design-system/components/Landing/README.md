# Landing

The first screen. It replaces the `SetupCard` as what a first visit shows.

- Five sample photos run across the top and fade into the page. They are decoration: empty `alt`, hidden from assistive technology. On a phone only three show.
- The brand sits in a pill over the first photo. There is no top bar on this screen, so there is no theme toggle here; the remembered theme still applies.
- One line: *Container inspection from photos.*
- One field: the provider choice (a radio group, one option per catalogue provider), the key (`type="password"`, mono), and **Start**. Each provider's recommended model is used; the `SettingsChip` on the inspection screen changes it.
- Under the field: *Your key stays in this tab.* and **Try the demo** (demo mode, no key).
- **Start** never looks switched off. Without a key it carries `aria-disabled`, moves focus to the key field and shows *Paste your API key to start.* A key with the wrong prefix shows the key-format advice in the same place and can still start.

## Markup

```html
<main class="qs-landing">
  <div class="qs-landing__top">
    <ul class="qs-landing__photos" aria-hidden="true"><li><img src="…" alt=""></li>…</ul>
    <span class="qs-landing__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</span>
  </div>
  <h1 class="qs-landing__title">Container inspection from photos.</h1>
  <form class="qs-landing__field">
    <div class="qs-landing__pick" role="radiogroup" aria-label="AI provider">
      <button type="button" role="radio" class="qs-landing__opt" aria-checked="true">OpenRouter</button>
      <button type="button" role="radio" class="qs-landing__opt" aria-checked="false" tabindex="-1">OpenAI</button>
    </div>
    <input class="qs-landing__key" type="password" placeholder="API key" aria-label="OpenRouter API key">
    <button type="button" class="qs-landing__go">Start <svg>…</svg></button>
  </form>
  <p class="qs-landing__hint" role="status">Paste your API key to start.</p>
  <p class="qs-landing__note"><span>Your key stays in this tab.</span><button type="button" class="qs-landing__demo">Try the demo</button></p>
</main>
```

## Tokens

The landing has its own ground and ink: `landing-bg`, `landing-surface`, `landing-ink`, `landing-ink-muted`, `landing-on-ink`, `shadow-landing`, `shadow-landing-chip`, and the `font-hero` family (Bricolage Grotesque) for the headline and the brand. Use them nowhere else, and never as a status.
