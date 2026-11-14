# 0002. Google Analytics on the production domain, for the PoC

Date: 14 November 2026. Status: accepted. Amends spec §11.5.

## Context

Spec §11.5 says to *avoid third-party scripts/analytics that could observe runtime credentials or
uploaded photographs*. Google's tag (`gtag.js`) runs in the page, so in principle it can see the key
field and the photos. For the PoC we want to know how many people visit, how many only try the demo,
which provider they pick and whether inspections finish or hit the spend cap.

## Decision

- **Add Google Analytics 4 directly** (`gtag.js` with a `G-` Measurement ID) in
  `src/services/analytics.ts`. Don't go through Google Tag Manager: a Tag Manager container lets anyone
  with access to it change scripts on the live site with no code change or review, which is the
  §11.5 risk at its widest.
- **Production only.** The tag loads only when both of these are true:
  - the build has `VITE_GA_MEASUREMENT_ID`. The Azure deploy workflow passes it on pushes to `main`
    only, from a GitHub repository variable;
  - the page is on `quay-sight.com` or `www.quay-sight.com`.

  Dev servers, Playwright, PR previews and the default `azurestaticapps.net` address send nothing.
- **A fixed set of events, each with only its own fields.** The service forwards only the fields listed
  for each event:

  | Event | Fields | Fired from |
  | --- | --- | --- |
  | `demo_started` | none | `setup.enterDemo()` |
  | `provider_selected` | `provider` (`luna` / `openrouter`) | `setup.chooseProvider()` |
  | `inspection_started` | `mode` (`demo` / `live`), `photo_count`, and `provider` on live runs | `inspection.start()` / `startLive()` |
  | `inspection_finished` | `mode` | the same runs, when they end with a result on screen (partial included) |
  | `spend_cap_hit` | `mode` (always `live`), `reason` (`requests` / `spend`) | `ledger.run()`, once per inspection |

  Page views come from the tag's default `config` call. `provider_selected` fires only when the visitor
  changes provider, so a visitor who keeps the default sends none. The `provider` on live
  `inspection_started` is the count to use for "which provider runs inspections". Failed and abandoned
  runs send `inspection_started` with no `inspection_finished`.
- **Never sent:** keys, photos or file names, container IDs or any reading, model answers, error
  text, or anything typed in. The GA web stream also has Enhanced Measurement's *form interactions*
  switched off, so the tag doesn't report activity on the key field.
- **No consent banner for the PoC.** Google signals stays off and data retention is 2 months.

## Consequences

- Google's script runs on the production page, and the key and photos are in the same page. This is a
  deliberate, PoC-only relaxation of §11.5. The "never sent" list above holds because our code never
  passes those values to GA, not because GA can't see them.
- **Before real users:** add a consent banner (Google Consent Mode v2, default denied) for UK/EU
  visitors, and a Content-Security-Policy (`staticwebapp.config.json`) that allows only Google
  Analytics, the provider endpoints and Google Fonts.
- Changing the Measurement ID is a repository-variable change; no code change is needed.
