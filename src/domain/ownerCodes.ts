// The common BIC owner codes (spec 4.1): the list the whole-prefix question offers the model. Plain data.
//
// Source: the BIC owner-code register, https://www.bic-code.org/bic-codes/<code>/ (one page per code).
// Checked 17 Oct 2026 (ticket #55): every code below was looked up there; a code counts as found when the page
// shows a registered company. Eleven codes the register had no entry for were removed (HJCU HJSU TCOU TCQU TSEU
// BMKU BPCU CBBU CBWU SBLU SNKU). COYU and other registered owners seen missing were added (see the last line of
// the lessor block). The three codes in UNCONFIRMED_OWNER_CODES were also not found, but are kept. See
// docs/research/owner-code-list-unchecked.md. A code missing here costs one letter-by-letter reading, not a
// wrong answer ("none of these" is always offered). Every code is three owner letters and the equipment-category
// letter U.

/** Codes kept although the register's page for them showed no company on 17 Oct 2026, with why they are kept. */
export const UNCONFIRMED_OWNER_CODES: Readonly<Record<string, string>> = {
  COSU: 'COSCO Shipping Lines prefix seen on many boxes in service; the register page for it showed no company.',
  MOLU: 'Mitsui O.S.K. Lines prefix seen on boxes in service; the register page for it showed no company.',
  KKLU: 'Kawasaki Kisen (K Line) prefix seen on boxes in service; the register page for it showed no company.',
}

const SHIPPING_LINES = `
MSCU MEDU MSMU MSNU MSDU MSWU MAEU MRKU MSKU MWCU MCAU MCRU MRSU MMAU CMAU CGMU CMNU ANNU APHU APZU APLU
HLXU HLCU HLBU HAMU COSU CBHU CCLU CSNU CSLU CSQU CSVU OOLU OOCU OCLU EGHU EGSU EISU EMCU EITU ONEU NYKU
MOLU KKTU KKFU KKLU ZIMU ZCSU YMLU YMMU YMGU HDMU HMMU HASU PONU SUDU SEJU SITU TSTU WHSU
`

const LESSORS_AND_OWNERS = `
TCNU TGHU CAXU TRHU SEGU FCIU BMOU TEMU CAIU GESU TCKU TLLU TEXU TTNU TCLU TRLU TDRU TIFU TOLU TGBU CRXU
CRSU CXDU CXRU DFSU DRYU FSCU GATU GLDU GVCU GVTU HJMU INKU IPXU KMTU KOCU LNXU MOTU NCLU PCIU
PILU SCZU SEAU SMLU SNBU SPNU SZLU TAMU TCEU TPHU UACU UESU UETU WHLU WFHU WSDU XINU BEAU BHCU BSIU BXRU
CHIU CLHU CLPU CMBU CNCU CPSU CRLU CTIU DAYU DVRU FANU FBLU GAOU IEAU TCBU TCHU TCIU TCMU TCTU
TCVU TCWU TGCU TGRU TGTU TIIU TLNU TMMU TNTU TRIU TRKU TRTU TSSU TTLU TWCU TXGU TXTU BLJU
BSPU BTLU CASU CATU CCUU CDEU CGTU CHVU CIPU CLOU CMCU CPIU CRTU CSOU CTCU CTTU DCLU DFOU DPCU
ECMU FBIU KWKU MLCU NSLU CEOU CNIU CZLU DTPU GCNU HPLU KHLU MCDU PCTU SIKU TBBU TIBU UXXU VSTU WCIU
COYU FFAU GAEU CXTU CTXU GCXU SKYU OERU BSLU INBU STXU UNXU ESPU
`

function codesOf(block: string): string[] {
  return block.split(/\s+/).filter(Boolean)
}

/** The owner codes the whole-prefix question offers, without repeats, in the order above. */
export const OWNER_CODES: readonly string[] = [
  ...new Set([...codesOf(SHIPPING_LINES), ...codesOf(LESSORS_AND_OWNERS)]),
]
