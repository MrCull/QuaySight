import { describe, it, expect } from 'vitest'
import { coyuDetails } from '../../__tests__/liveDetails'
import { codeSaysButPhotoNotText, photoSaysButCodeNotText } from '../containerDetailWording'
import { readContainerDetails } from '../containerDetails'
import type { SharedAnswer } from '../questionSet'

// The wording of a check that disagrees with the decoded size/type code, run on the COYU 22G1 sample's
// own decoded code, and then through the reading that puts it on a check.

const decoded = coyuDetails().sizeCode.decoded!

const choice = (value: string): SharedAnswer => ({
  type: 'choice',
  value,
  probabilities: { [value]: 0.99 },
  confidence: 0.99,
})

describe('container detail conflict wording', () => {
  it('says the code names the equipment but the photo did not', () => {
    expect(codeSaysButPhotoNotText('reefer', '22R1')).toBe(
      'The size/type code 22R1 is a reefer code, but the photo was read as not a reefer.',
    )
    expect(codeSaysButPhotoNotText('flatRack', '22P1')).toBe(
      'The size/type code 22P1 is a flat rack or platform code, but the photo was read as not a flat rack or platform.',
    )
  })

  it('says the photo names the equipment but the recorded code decodes to something else', () => {
    expect(photoSaysButCodeNotText('tank', decoded.code, decoded.type.label)).toBe(
      `The photo was read as a tank, but the size/type code ${decoded.code} is ${decoded.type.label.toLowerCase()}.`,
    )
  })

  it('reaches the check when a Confident 22G1 code meets a photo read as a tank', () => {
    const details = readContainerDetails({
      size_type_code: choice('22G1'),
      equipment_tank: choice('yes'),
    })
    expect(details.equipment.tank.conflict).toBe(
      photoSaysButCodeNotText('tank', '22G1', details.sizeCode.decoded!.type.label),
    )
  })
})
