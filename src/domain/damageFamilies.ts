// The side and door damage sets as question families (spec #51, ticket #59). Pure. Each set is its own
// request (so a failure of one leaves the other), authored as data beside the other sets and read by its
// own mapper; the reading is folded in beside any other set's, and the face the survey detects chooses
// which one the record shows (damageSets.ts). Damage is exported from the record's damage assessment
// (damageExport.ts), so these add nothing of their own to the exports.
import { withDamageReading, type DamageSetReading } from './damageSets'
import { DOOR_DAMAGE_SET, readDoorDamage } from './doorDamage'
import type { QuestionFamily } from './questionRegistry'
import { SIDE_DAMAGE_SET, readSideDamage } from './sideDamage'

declare module './survey' {
  interface SurveyFindings {
    sideDamage: DamageSetReading
    doorDamage: DamageSetReading
  }
}

export const SIDE_DAMAGE_REQUEST = 'side-damage'
export const DOOR_DAMAGE_REQUEST = 'door-damage'

export const sideDamageFamily: QuestionFamily = {
  key: 'sideDamage',
  request: SIDE_DAMAGE_REQUEST,
  input: () => SIDE_DAMAGE_SET.input,
  questions: () => SIDE_DAMAGE_SET.questions,
  read: (answers) => readSideDamage(answers),
  apply: (record, reading, { passId }) => withDamageReading(record, { ...reading, passId }),
}

export const doorDamageFamily: QuestionFamily = {
  key: 'doorDamage',
  request: DOOR_DAMAGE_REQUEST,
  input: () => DOOR_DAMAGE_SET.input,
  questions: () => DOOR_DAMAGE_SET.questions,
  read: (answers) => readDoorDamage(answers),
  apply: (record, reading, { passId }) => withDamageReading(record, { ...reading, passId }),
}
