// The common BIC owner codes (spec 4.1): the list the whole-prefix question offers the model. Plain data.
//
// Source and date: compiled on 16 Oct 2026 from the public BIC owner-code register (bic-code.org) as the
// author knew it, covering the big shipping lines and the leasing and container-owning companies. It was not
// re-checked against the live register, so treat it as a working list: a code missing here costs one
// letter-by-letter reading, not a wrong answer ("none of these" is always offered). Every code is three
// owner letters and the equipment-category letter U.

const SHIPPING_LINES = `
MSCU MEDU MSMU MSNU MSDU MSWU MAEU MRKU MSKU MWCU MCAU MCRU MRSU MMAU CMAU CGMU CMNU ANNU APHU APZU APLU
HLXU HLCU HLBU HAMU COSU CBHU CCLU CSNU CSLU CSQU CSVU OOLU OOCU OCLU EGHU EGSU EISU EMCU EITU ONEU NYKU
MOLU KKTU KKFU KKLU ZIMU ZCSU YMLU YMMU YMGU HDMU HMMU HASU PONU SUDU SEJU
`

const LESSORS_AND_OWNERS = `
TCNU TGHU CAXU TRHU SEGU FCIU BMOU TEMU CAIU GESU TCKU TLLU TEXU TTNU TCLU TRLU TDRU TIFU TOLU TGBU CRXU
CRSU CXDU CXRU DFSU DRYU FSCU GATU GLDU GVCU GVTU HJCU HJMU HJSU INKU IPXU KMTU KOCU LNXU MOTU NCLU PCIU
PILU SCZU SEAU SMLU SNBU SPNU SZLU TAMU TCEU TPHU UACU UESU UETU WHLU WFHU WSDU XINU BEAU BHCU BSIU BXRU
CHIU CLHU CLPU CMBU CNCU CPSU CRLU CTIU DAYU DVRU FANU FBLU GAOU IEAU TCBU TCHU TCIU TCMU TCOU TCQU TCTU
TCVU TCWU TGCU TGRU TGTU TIIU TLNU TMMU TNTU TRIU TRKU TRTU TSEU TSSU TTLU TWCU TXGU TXTU BLJU BMKU BPCU
BSPU BTLU CASU CATU CBBU CBWU CCUU CDEU CGTU CHVU CIPU CLOU CMCU CPIU CRTU CSOU CTCU CTTU DCLU DFOU DPCU
ECMU FBIU KWKU MLCU NSLU CEOU CNIU CZLU DTPU GCNU HPLU KHLU MCDU PCTU SBLU SIKU SNKU TBBU TIBU UXXU VSTU WCIU
`

function codesOf(block: string): string[] {
  return block.split(/\s+/).filter(Boolean)
}

/** The owner codes the whole-prefix question offers, without repeats, in the order above. */
export const OWNER_CODES: readonly string[] = [
  ...new Set([...codesOf(SHIPPING_LINES), ...codesOf(LESSORS_AND_OWNERS)]),
]
