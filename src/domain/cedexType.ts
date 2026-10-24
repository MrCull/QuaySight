// A finding's CEDEX (ISO 9897) damage type: the best one, and whether it is reliable enough to name. Pure.
//
// The damage type says what kind of damage it is (DT Dent, HO Holed…), never how bad: severity is a separate
// judgement. A best type below PRESENT_MIN is not forced: the finding's type reads Uncertain, and every
// candidate is still listed with its probability.
import type { DamageFinding, DamageType } from './damage'
import { CEDEX_TYPES, PRESENT_MIN } from './damageReading'

export interface CedexTypeReading {
  /** The best type when it is reliable enough to name; null when it is not, or no type was rated. */
  best: DamageType | null
  /** The other rated types, most probable first. When best is null, every candidate. */
  others: DamageType[]
}

/** The plain description of a CEDEX damage-type code, or null for a code the sets do not ask about. */
export function cedexTypeDescription(code: string): string | null {
  return CEDEX_TYPES.find((t) => t.code === code)?.description ?? null
}

/**
 * The best damage type and the alternatives. A type with no recorded probability (a hand-written or older
 * recording) is taken as given, since there is nothing to weigh it against.
 */
export function cedexType(finding: Pick<DamageFinding, 'types'>): CedexTypeReading {
  const [top, ...rest] = finding.types
  if (!top) return { best: null, others: [] }
  const reliable = top.probability === null || top.probability >= PRESENT_MIN
  return reliable ? { best: top, others: rest } : { best: null, others: [...finding.types] }
}
