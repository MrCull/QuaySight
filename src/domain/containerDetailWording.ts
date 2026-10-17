// The plain words of a check that disagrees with the decoded size/type code (ticket #32; split out in
// ticket #54). Pure: the facts in, the sentence out, so the wording can change and be tested on its own.
import type { EquipmentCheck } from './containerDetailTypes'

const CHECK_NAME: Record<EquipmentCheck, string> = {
  reefer: 'a reefer',
  openTop: 'an open top',
  tank: 'a tank',
  flatRack: 'a flat rack or platform',
}

/** The code names the equipment, but the photo was read as not that equipment. */
export const codeSaysButPhotoNotText = (check: EquipmentCheck, code: string) =>
  `The size/type code ${code} is ${CHECK_NAME[check]} code, but the photo was read as not ${CHECK_NAME[check]}.`

/** The photo was read as the equipment, but the code decodes to something else. */
export const photoSaysButCodeNotText = (check: EquipmentCheck, code: string, typeLabel: string) =>
  `The photo was read as ${CHECK_NAME[check]}, but the size/type code ${code} is ${typeLabel.toLowerCase()}.`
