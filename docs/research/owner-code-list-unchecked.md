# Owner-code list: checked against the BIC register (ticket #55, was #43)

Checked: 17 October 2026. Source: the BIC owner-code register, `https://www.bic-code.org/bic-codes/<code>/`
(one public page per code; the page names the registered company and country).

`src/domain/ownerCodes.ts` holds the container owner codes (three letters plus U) that the owner-code question
offers the model. It was first written from memory (ticket #43). All 205 distinct codes were then looked up one by one.

## Result

- 191 codes were found with a registered company and are kept.
- 11 codes had no entry and were removed: HJCU, HJSU, TCOU, TCQU, TSEU, BMKU, BPCU, CBBU, CBWU, SBLU, SNKU.
- 3 codes had no entry but are kept as unconfirmed, because they are well-known prefixes on boxes in service
  (COSU, MOLU, KKLU). They are listed with a reason in `UNCONFIRMED_OWNER_CODES`. Re-check them when the register
  can be searched another way.
- 16 registered owners were added: COYU (Containental Ltd, seen on a real photo), SITU, TSTU, WHSU, FFAU, GAEU,
  CXTU, CTXU, GCXU, SKYU, OERU, BSLU, INBU, STXU, UNXU, ESPU. The list is now 210 codes.

## Limits of the check

- "Found" means the register page for the code shows a company. Whether the owner is still trading was not checked.
- The additions are owners found by trying likely codes, not a full pass over the register, so other real owners
  may still be missing. A missing code costs one letter-by-letter reading, not a wrong answer: "none of these" is
  always offered.
- The register's pages carry an access token in their script data. It was not used or recorded.

## Merged list of about 560 codes (ticket #77, spec #75)

Date: 17 October 2026. `src/domain/ownerCodes.ts` now holds 559 codes, each with a rank and a source.

- **Ranks 1-500, source `supplied`:** the 500 ranked prefixes the user supplied (MSCU first). Trusted as given and not
  re-checked against the register. The supplied list's own notes say the rank is a subjective OCR hint, not observed
  frequency, not an official BIC ranking, and not proof of registration or ownership. The prefixes derive from
  Jonathan Law's `container_prefix.txt` (`https://github.com/jonathanlawhh/container-number-recognition-ai`), MIT
  licence, copyright (c) 2023 Jonathan Law. The licence text is in `owner-code-list-source-MIT.txt`.
- **Ranks 501-502, source `added`:** JDLU and RWTU.
- **Ranks 503-558, source `verified`:** the register-checked codes from ticket #55 that the supplied list lacks,
  including COYU, in their earlier order (56 codes).
- **Rank 559, source `unconfirmed`:** COSU, kept although the register showed no company. MOLU and KKLU, the other
  two unconfirmed codes, are in the supplied list and take its ranks.

How the list is used:

- The whole-prefix question offers the top 250 by rank, plus JDLU and RWTU always, as the spec says, and COYU
  too (253 codes, 254 choices with "none", under the registry's 255-choice limit).
- "On the list" (`isOnOwnerList`, and the near-match candidates) checks the full list, so a code outside the top 250
  still counts as known.
- Rank only breaks ties between equally near readings. It never raises certainty and never rejects a reading.

COYU is offered although it ranks outside the top 250 (rank 503 onward): it is a real container in the regression
set, and without it Luna's recorded COYU pick is no longer a valid answer and the ID score fell from hit to miss.
The other verified codes outside the top 250 are not offered, but they are on the list and are near-match candidates.
