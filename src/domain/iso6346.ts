// ISO 6346 check digit (spec 4.2). Calculated independently of any provider answer.

// Letter values: A=10, skipping multiples of 11 (B=12 ... K=21, L=23 ... U=32 ...).
const LETTER_VALUES: Record<string, number> = (() => {
  const values: Record<string, number> = {}
  let value = 10
  for (let i = 0; i < 26; i++) {
    while (value % 11 === 0) value++
    values[String.fromCharCode(65 + i)] = value
    value++
  }
  return values
})()

const WEIGHTS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]

/** Calculates the check digit for the first ten characters (owner code, category, serial). */
export function calculateCheckDigit(tenChars: string): number {
  if (!/^[A-Z]{4}\d{6}$/.test(tenChars)) {
    throw new Error('ISO 6346 check digit needs four letters followed by six digits')
  }
  const sum = [...tenChars].reduce((total, ch, i) => {
    const value = /\d/.test(ch) ? Number(ch) : (LETTER_VALUES[ch] ?? 0)
    return total + value * (WEIGHTS[i] ?? 0)
  }, 0)
  const remainder = sum % 11
  return remainder === 10 ? 0 : remainder
}

/** True when the printed check digit equals the calculated one. Accepts an 11-character ID. */
export function checkDigitMatches(id: string): boolean {
  const normalised = id.replace(/\s+/g, '').toUpperCase()
  if (normalised.length !== 11) return false
  const printed = Number(normalised[10])
  return calculateCheckDigit(normalised.slice(0, 10)) === printed
}
