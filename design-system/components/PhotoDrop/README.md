# PhotoDrop

The photo drop is the start screen: drop or browse for photos of one container, or open a sample container if you don't have one.

## Parts
- `.qs-drop`: a `<label>` wrapping a hidden `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>`, the photo glyph, a `display` title ("Drop container photos here") and a meta line with the formats. Add `qs-drop--over` during drag-over.
- `.qs-samples`: the fallback for when there's no photo or no network. A heading, *No photo to hand? Try a sample container*, one sentence explaining what a sample is (a result saved from an earlier real inspection; works offline; no key; no charge), and a grid of `.qs-sample` tiles. Each tile has a thumbnail, a *Saved result* badge, a title naming what it shows ("Side with damage") and a one-line hint of what the audience will see.

## Copy
Say **sample container** and **saved result** in the entry point. The words *recorded* and *replay* only appear once a sample is open, in the `Notice` (*Recorded demonstration: [provider/model]*), because that's where the spec requires the label.

## Rules
- Ask for photos, never for classifications. No fields for ID, length, face or type.
- Once a photo is added, it becomes the hero (see `ResultsScreen`), and the drop target shrinks to an *Add photo* tile in the thumbnail strip.
- Keyboard: Enter or Space on the drop zone opens the file picker. Sample tiles are buttons.
