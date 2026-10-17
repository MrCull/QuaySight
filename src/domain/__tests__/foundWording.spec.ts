import { describe, it, expect } from 'vitest'
import { recordedInspection } from '../../__tests__/recordedInspection'
import { buildWhatWeFound } from '../whatWeFound'
import * as words from '../foundWording'

// Each wording function of "What we found", run on facts from the recorded Luna sample, and then the
// sample's whole summary to show the sentences arrive in it.

const sample = () => recordedInspection('luna', { delayMs: 0 })

describe('what we found, wording', () => {
  it('words the container ID from the recorded reading', async () => {
    const reading = (await sample()).containerId!
    const grouped = words.groupedId(reading.value)
    expect(grouped).toMatch(/^[A-Z]{4} \d{6} \d$/)
    expect(words.idStatementText(grouped, reading.certainty)).toBe(
      `The container ID reads ${grouped} (${reading.certainty}).`,
    )
    expect(words.groupedId('aphu6586?47')).toBe('APHU 6586·4 7')
    expect(words.idUncertainText("Can't tell", 'APHU 65868· 7', true, ['APHU 658680 7'])).toBe(
      "The container ID: Can't tell. Best reading: APHU 65868· 7. Some positions were not read, marked ·. Also possible: APHU 658680 7.",
    )
    expect(words.checkDigitMismatchText(3, 7)).toBe(
      'The printed check digit (3) does not match the one calculated from the other ten characters (7).',
    )
  })

  it('words the size code from the recorded decode', async () => {
    const size = (await sample()).sizeCode!
    expect(words.decodedCodeStatementText(size.code, size.summary, size.certainty)).toBe(
      `The size and type code is ${size.code}: ${size.summary} (${size.certainty}).`,
    )
    expect(words.decodedCodeWeakText('Uncertain', size.code, size.summary, '22G0')).toBe(
      `The size and type code is Uncertain. Best reading: ${size.code}, ${size.summary}. Also possible: 22G0.`,
    )
    expect(words.otherCodeText('Likely')).toContain('not one of the common codes (Likely)')
    expect(words.undecodedCodeStatementText('ZZZ9', 'Likely')).toBe(
      'The size and type code reads ZZZ9, which this app does not decode (Likely).',
    )
  })

  it('words the recorded weights in each unit', async () => {
    const weights = (await sample()).weights!
    const tare = weights.tare!
    expect(words.weightText(tare, 'metric')).toBe(`${tare.valueKg.toLocaleString('en-GB')} kg`)
    expect(words.weightText(tare, 'imperial')).toMatch(/ lb$/)
    expect(words.weightSentence('Tare', tare, 'metric', undefined, false)).toBe(
      `Tare ${words.weightText(tare, 'metric')} (${tare.certainty}).`,
    )
    expect(words.weightSentence('Payload', tare, 'metric', words.PAYLOAD_NOTE, true)).toContain(
      ', the most it may carry, calculated (',
    )
    expect(words.weightNotCalculatedText('Payload')).toBe(
      'Payload: not calculated, it needs maximum gross and tare.',
    )
  })

  it('words markings and the DG placard', () => {
    expect(words.markingsSeenText([{ check: 'superHeavy', certainty: 'Likely' }])).toBe(
      'Seen: SUPER HEAVY marking (Likely).',
    )
    expect(words.markingsUnknownText(['overwidth', 'fumigation'])).toBe(
      "Could not tell whether these markings are present (Can't tell): overwidth, fumigation.",
    )
    expect(words.dgPlacardSeenText(3, 'flammable liquids', 'Likely')).toBe(
      'A DG placard, class 3 (flammable liquids), is visible (Likely).',
    )
    expect(words.dgPlacardSeenText(null, null, 'Uncertain')).toBe(
      'A DG placard is visible, but its class cannot be read (Uncertain).',
    )
  })

  it('words damage from the recorded faces', () => {
    expect(words.facesText([])).toBe('photo')
    expect(words.facesText(['rear', 'left', 'roof'])).toBe('door end, left side and roof')
    expect(words.findingsText(5, ['a', 'b', 'c'], 3, 'door end')).toBe(
      '5 suspected findings on the door end: a; b; c; and 2 more.',
    )
    expect(words.findingText('Dent', null, 'Likely')).toBe("Dent, can't tell (Likely)")
    expect(words.noDamageText('roof')).toBe('No suspected damage on the roof.')
  })

  it('words gaps and the headline', () => {
    expect(words.gapText('Still arriving', ['the container ID', 'damage'])).toBe(
      'Still arriving: the container ID and damage.',
    )
    expect(words.headlineIdAndType('APHU 658684 7', '20 ft general purpose')).toBe(
      'APHU 658684 7: 20 ft general purpose',
    )
  })

  it('delivers the recorded sample headline from those pieces', async () => {
    const record = await sample()
    const found = buildWhatWeFound(record)
    const id = words.groupedId(record.containerId!.value)
    expect([
      words.HEADLINE_UNCERTAIN,
      words.headlineIdAndType(id, record.sizeCode!.summary),
    ]).toContain(found.headline)
  })
})
