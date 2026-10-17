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
