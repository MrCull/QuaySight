# Tabs

The detail under the `ReadingsLedger`, one panel at a time: **Characteristics** (the Container details card), **Damage** (the damage view) and **Markings** (the Markings card), in that order.

- A tab shows once its part has arrived. Damage is left out after a failed damage request.
- Each inspection opens on Characteristics.
- The Damage tab carries the number of findings in mono. It is a count, not a status: never colour it by severity.
- Every panel stays in the page and only the selected one shows, so a `KeyFactTile` can still lead to a section: a jump to a section in another panel opens its tab first. A panel names its tab with `data-detail-tab`.
- Keyboard: Left, Right, Home and End move along the tabs and open the one they land on. Only the selected tab is in the tab order.
- The underline is `brand` as an action colour. Never use a certainty, severity or hazard colour on a tab.

## Markup

```html
<div class="qs-tabs">
  <div class="qs-tabs__list" role="tablist" aria-label="Inspection detail">
    <button type="button" role="tab" class="qs-tabs__tab" id="detail-tab-characteristics" aria-selected="true" aria-controls="detail-panel-characteristics">Characteristics</button>
    <button type="button" role="tab" class="qs-tabs__tab" id="detail-tab-damage" aria-selected="false" aria-controls="detail-panel-damage" tabindex="-1">Damage <span class="qs-tabs__count">9</span></button>
    <button type="button" role="tab" class="qs-tabs__tab" id="detail-tab-markings" aria-selected="false" aria-controls="detail-panel-markings" tabindex="-1">Markings</button>
  </div>
  <div class="qs-tabs__panel" role="tabpanel" id="detail-panel-characteristics" aria-labelledby="detail-tab-characteristics" data-detail-tab="characteristics">…</div>
</div>
```
