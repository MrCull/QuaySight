# Reading the results

## The five certainty words

Certainty is a fixed vocabulary, shown as a colour **and** a label and icon. It is not a calibrated probability.

| Word | Meaning |
| --- | --- |
| **Confident** | Clearly visible, and everything checks out. |
| **Likely** | Probably right, but not certain. |
| **Uncertain** | Could be one of a few things; alternatives are shown. |
| **Can't tell** | In the photo, but not clear enough to say. |
| **Not seen** | Not in any photo, so nothing can be said about it. This never means "clear". |

A passing check digit does not lift a visually weak reading to Confident. Two photos that agree raise a reading one step. Two that disagree make it Uncertain.

Certainty, damage severity and hazard markings use three separate visual axes, and their colours are never mixed. Nothing in the interface is green.

## Where a value came from

Each reading wears a tag:

| Tag | Meaning |
| --- | --- |
| **Printed** | Read from text on the container |
| **Decoded from ISO** | Worked out from the ISO size/type code, with no model call |
| **Estimated from shape** | Length estimated from a side photo's proportions |
| **Calculated** | Done by the app, such as payload = maximum gross minus tare |
| **Model-selected** | A yes/no classification the model chose |

Maximum gross, tare and payload are **ratings and printed limits**, never the actual load.

## Container ID

- Shown with the check-digit result (`= Check digit valid`) and an owner-code note ("Not a common owner code" when it isn't on the list).
- If the model's reading doesn't pass the check digit, the app looks for a nearby candidate that does and shows the alternative as **Also possible**.
- Fewer than 6 of the 11 characters read means the tile says **ID not readable in this photo**, with no guess and no alternatives.
- The app never silently corrects a character to make the check digit pass.
- A valid check digit is supporting evidence, not proof.

## Seal and placards

The seal is read character by character, each with its own certainty. It has no check digit. **Not seen** means no seal is visible in any photo. It never means the door is sealed or secure.

Each placard lists its class (1 to 9) and UN number, with the marine pollutant and limited quantity marks. Duplicates across photos are merged. "No placard seen" never means non-hazardous cargo.

## Length and the size code

A confidently read ISO size code decides length. Otherwise the shape of a side photo does, capped at Confident for 20 and 40 ft and at Likely for 45 ft. If a Likely code and the shape disagree, the length is Uncertain and a warning is shown. The code `45G1` is a 40 ft High Cube, not a 45 ft container.

## Damage

- Findings use CEDEX damage types such as Dent (`DT`), Bend (`BT`), Bow (`BW`), Hole (`HO`), Crack (`CK`), Corrosion (`CO`) and Broken (`BR`).
- Each finding has a **severity** (Cosmetic, Minor, Moderate, Major), shown in the severity colour. A severity the model didn't rate shows as **Can't tell**.
- Locations use the CEDEX sections of the drawn length: 5 sections along a 20 ft side, 10 along a 40 or 45 ft side. For example, "Section 3 of 10 from the door end".
- For a side photo, the doors decide which side it is. Doors at photo-left mean the right side. If the doors don't settle it, the damage is drawn on the top view with a visible note that the side is assumed.
- Findings from a face the model couldn't identify are listed separately and not drawn.
- Findings on the same face, of the same type, in the same section across several photos are merged into one finding that lists every photo.
- A face that wasn't photographed shows **Not seen**, never "undamaged".

## Several photos

Readings merge across photos: the ID combines character by character, details and weights take the most certain reading, and damage and placards are de-duplicated. If two photos give two different valid IDs, the app says "These photos may be of different containers" and doesn't merge them. A photo with no container in it is dropped ("Photo N doesn't show a container") and gets no further requests. If no photo shows a container, a joke screen takes the place of the results: the photos stamped REJECTED, a "Wannabe QA" achievement and **Respawn with a real container**, which starts a new inspection. Photograph a banana skin to find out what happens.

## Exports

- **Export JSON**: the consolidated record with resolved values, provenance, certainty, the list of photos and faces, and every request's status and error.
- **Download raw response**: the provider's raw replies, including usage and model details, and the raw body of any reply that couldn't be read.
- **Download summary**: a readable summary labelled as a proof of concept and not certified.

Pass-level evidence (first reads, second looks, candidate lists) lives only in the exports. The screen shows the best value, its certainty and any plausible alternative.
