# PhotoDrop

The photo drop is the start screen: drop or browse for photos of one container, or open a sample container if you don't have one. An inspection takes up to 5 photos of one container (for example front, back, both sides and a seal close-up); a 6th is refused with a plain message that the limit is 5.

## Parts
- `.qs-drop`: a `<label>` wrapping a hidden `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>`, the photo glyph, a `display` title ("Drop container photos here") a meta line with the count and formats, and a `.qs-drop__cta` drawn as a large primary button (*Choose photos*, upload glyph). The whole zone is the control, so the CTA is a `span` with `aria-hidden="true"`, not a second button; it brightens with the zone on hover and drag-over. Add `qs-drop--over` during drag-over.
- Before any photo is in, the app sets a real container photo, dimmed well back with a `bg` gradient, behind the start screen and the `SetupCard`. It is decorative and gives the first screens colour before results arrive. The drop zone sits on a translucent `surface-sunken` over it.
- `.qs-samples`: the fallback for when there's no photo or no network. A heading, *No photo to hand? Try a sample container*, one sentence explaining what a sample is (a result saved from an earlier real inspection; works offline; no key; no charge), and a grid of `.qs-sample` tiles. Each tile has a thumbnail, a *Saved result* badge, a title naming what it shows ("Side with damage") and a one-line hint of what the audience will see.

## Demo mode
In demo mode (see `DemoBanner`) the drop zone and the file picker are not shown: a visitor's own photo would have no recorded result. The `.qs-samples` block is the whole start screen, titled *Choose a sample container*, and its explanation ends *Inspecting your own photos needs an API provider.* One tile per sample that has a recording shows the bundled photo itself (`img` inside `.qs-sample__img`, cropped to fill): today *Rear doors with markings* and *Clean grey rear doors* (*Damaged grey side* joins them once it is recorded). A tile's line describes the photo, not a result. Choosing a tile puts that photo on the stage, ready to inspect.

## Copy
Say **sample container** and **saved result** in the entry point. The words *recorded* and *replay* only appear once a sample is open, in the `Notice` (*Recorded demonstration: [provider/model]*), because that's where the spec requires the label.

## Rules
- Ask for photos, never for classifications. No fields for ID, length, face or type.
- Once a photo is added, it becomes the hero (see `ResultsScreen`), and the drop target shrinks to an *Add photo* tile in the thumbnail strip.
- Keyboard: Enter or Space on the drop zone opens the file picker. Sample tiles are buttons, grouped (`role="group"`) under the sample heading so the group is announced when focus enters it.
- Focus: after **Continue** on the `SetupCard` and after `NewInspection`, focus lands on the drop zone. In demo mode, after `NewInspection` it lands on the first sample tile, and choosing a sample starts the inspection at once, so a keyboard user can run a sample without a mouse.
