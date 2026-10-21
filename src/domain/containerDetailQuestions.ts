// The survey's container-detail questions, in the shared format (spec 4.3, 4.4; ticket #32; split out in
// ticket #54). Pure: the question wording and nothing that reads an answer.
import type { ChoiceQuestion, SharedQuestion } from './questionSet'
import {
  COMMON_SIZE_CODES,
  DETAIL_QUESTION_NAMES,
  DG_CLASSES,
  EQUIPMENT_CHECKS,
  MARKING_CHECKS,
  SIZE_CODE_NOT_VISIBLE,
  SIZE_CODE_OTHER,
  SIZE_CODE_UNREADABLE,
  type EquipmentCheck,
  type MarkingCheck,
} from './containerDetailTypes'

const YES_NO_UNKNOWN = (yes: string, no: string): ChoiceQuestion['choices'] => [
  { value: 'yes', description: yes },
  { value: 'no', description: no },
  { value: 'unknown', description: 'This photo does not show enough to say' },
]

const EQUIPMENT_INSTRUCTIONS: Record<EquipmentCheck, [question: string, yes: string, no: string]> =
  {
    reefer: [
      'Is this a refrigerated (reefer) container, with a refrigeration unit or machinery panel built into one end?',
      'A reefer container',
      'Not a reefer container',
    ],
    openTop: [
      'Is this an open-top container, with no solid steel roof, closed by a removable tarpaulin over roof bows?',
      'An open-top container',
      'Not an open-top container',
    ],
    tank: [
      'Is this a tank container: a cylindrical tank held inside a steel frame?',
      'A tank container',
      'Not a tank container',
    ],
    flatRack: [
      'Is this a flat rack or platform: a floor with end walls or corner posts, but no side walls and no roof?',
      'A flat rack or platform',
      'Not a flat rack or platform',
    ],
  }

const MARKING_INSTRUCTIONS: Record<MarkingCheck, [question: string, yes: string, no: string]> = {
  superHeavy: [
    'Is a SUPER HEAVY marking visible on the container?',
    'A SUPER HEAVY marking is visible',
    'No SUPER HEAVY marking is visible',
  ],
  highContainer: [
    'Is the high-container caution visible: yellow and black diagonal stripes along the top edge or at the top corners, or a sign warning that the container is taller than usual? This is a height warning, not a width warning.',
    'High-container caution stripes or signage are visible',
    'No high-container caution is visible',
  ],
  overwidth: [
    'Is an overwidth marking visible, warning that the container is wider than standard? Do not count the high-container caution stripes: they warn about height, not width.',
    'An overwidth marking is visible',
    'No overwidth marking is visible',
  ],
  fumigation: [
    'Is a fumigation warning sign visible, saying the container is or was under fumigation?',
    'A fumigation warning sign is visible',
    'No fumigation warning sign is visible',
  ],
  marinePollutant: [
    'Is the marine pollutant mark visible: a triangle showing a dead fish and a dead tree?',
    'The marine pollutant mark is visible',
    'No marine pollutant mark is visible',
  ],
}

/** The survey's container-detail questions, in the shared format (11 questions). */
export function containerDetailQuestions(): SharedQuestion[] {
  const names = DETAIL_QUESTION_NAMES
  const sizeCode: ChoiceQuestion = {
    type: 'choice',
    name: names.sizeCode,
    instructions:
      'The ISO size/type code is printed on the container as four characters, usually below or beside the container number (for example 22G1 or 45G1). Which code is printed? Read it exactly as printed; do not work it out from the container size.',
    choices: [
      ...COMMON_SIZE_CODES.map((code) => ({ value: code, description: `Code ${code}` })),
      {
        value: SIZE_CODE_OTHER,
        description: 'A size/type code is printed, but it is none of the codes listed',
      },
      {
        value: SIZE_CODE_UNREADABLE,
        description: 'A size/type code is printed, but it cannot be read clearly',
      },
      { value: SIZE_CODE_NOT_VISIBLE, description: 'No size/type code is visible in this photo' },
    ],
  }
  const check = (name: string, [question, yes, no]: [string, string, string]): ChoiceQuestion => ({
    type: 'choice',
    name,
    instructions: question,
    choices: YES_NO_UNKNOWN(yes, no),
  })
  const dgPlacard: ChoiceQuestion = {
    type: 'choice',
    name: names.dgPlacard,
    instructions:
      'Is a dangerous-goods (DG) placard visible on the container: a diamond-shaped label with a symbol and a class number at its bottom corner? A faded, scraped or partly removed label, or only the outline or residue left where one was, is not a placard. If one is visible, which class does it show?',
    choices: [
      { value: 'none', description: 'No dangerous-goods placard is visible' },
      ...Object.entries(DG_CLASSES).map(([n, c]) => ({
        value: `class_${n}`,
        description: `A class ${n} placard (${c.name}): ${c.symbol.toLowerCase()}`,
      })),
      {
        value: 'unreadable',
        description: 'A dangerous-goods placard is visible, but its class cannot be read',
      },
    ],
  }
  return [
    sizeCode,
    ...EQUIPMENT_CHECKS.map((c) => check(names.equipment[c], EQUIPMENT_INSTRUCTIONS[c])),
    ...MARKING_CHECKS.map((c) => check(names.markings[c], MARKING_INSTRUCTIONS[c])),
    dgPlacard,
  ]
}
