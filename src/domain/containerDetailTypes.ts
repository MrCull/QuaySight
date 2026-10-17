// The shapes, names and fixed tables of the container details (spec 4.3, 4.4; ticket #32; split out in
// ticket #54): what a reading looks like, the question names, the common size codes and the DG classes.
// containerDetails.ts re-exports all of it, so importers keep their path.
import type { CertaintyLabel } from './inspection'
import type { DecodedSizeCode } from './isoSizeCode'

/** Where a detail came from: printed on the container, decoded from the ISO code, or judged from the photo. */
export type DetailSource = 'printed' | 'decoded' | 'observed'

/**
 * read: a common code was read. other: a code is printed but is not one of the common codes.
 * unreadable: a code is printed but cannot be read. not-visible: no code in the photo. unclear: no
 * answer clear enough to say which.
 */
export type SizeCodeState = 'read' | 'other' | 'unreadable' | 'not-visible' | 'unclear'

export interface SizeCodeReading {
  state: SizeCodeState
  /** The printed code, only when read. */
  code: string | null
  certainty: CertaintyLabel
  source: 'printed'
  /** A plausible other common code ("Also possible"), or null. */
  alternative: string | null
  /** What the code decodes to; null when not read or not in the decoding table. */
  decoded: DecodedSizeCode | null
}

/** One yes/no/unknown check. answer null: can't tell. */
export interface CheckReading {
  answer: 'yes' | 'no' | null
  /** A marking answered no is Not seen: it is in no photo. */
  certainty: CertaintyLabel
  source: 'observed'
  /** Plain words when the check disagrees with the decoded size/type code, or null. */
  conflict: string | null
}

export const EQUIPMENT_CHECKS = ['reefer', 'openTop', 'tank', 'flatRack'] as const
export type EquipmentCheck = (typeof EQUIPMENT_CHECKS)[number]

export const MARKING_CHECKS = [
  'superHeavy',
  'highContainer',
  'overwidth',
  'fumigation',
  'marinePollutant',
] as const
export type MarkingCheck = (typeof MARKING_CHECKS)[number]

/** The DG placard as seen: its class and symbol only. Never a statement about the cargo. */
export interface DgPlacardReading {
  /** placard: one is visible. none: no placard visible. null: can't tell. */
  answer: 'placard' | 'none' | null
  /** The class number on the placard (1 to 9), when read. */
  dgClass: number | null
  /** The placard's symbol, from its class. */
  symbol: string | null
  certainty: CertaintyLabel
}

export interface ContainerDetailsReading {
  sizeCode: SizeCodeReading
  equipment: Record<EquipmentCheck, CheckReading>
  markings: Record<MarkingCheck, CheckReading>
  dgPlacard: DgPlacardReading
}

declare module './inspection' {
  interface InspectionRecord {
    /**
     * Container details read live by the survey (ticket #32). Absent when they were not asked: recorded
     * runs, and live runs whose survey did not answer. Absent means not assessed, never Not seen.
     */
    details?: ContainerDetailsReading
  }
}

/** Common ISO 6346 size/type codes offered as whole-code choices (spec 4.3). */
export const COMMON_SIZE_CODES = [
  '22G1',
  '22G0',
  '20G1',
  '20G0',
  '25G1',
  '22R1',
  '22R0',
  '22U1',
  '22U6',
  '22T6',
  '22T0',
  '22P1',
  '22P3',
  '22V1',
  '22B0',
  '22H0',
  '42G1',
  '42G0',
  '40G1',
  '45G1',
  '45G0',
  '42R1',
  '45R1',
  '45R0',
  '42U1',
  '45U1',
  '42P1',
  '42P3',
  '45P3',
  '42T6',
  'L5G1',
  'L2G1',
  'LEG1',
] as const

export const SIZE_CODE_OTHER = 'other'
export const SIZE_CODE_UNREADABLE = 'unreadable'
export const SIZE_CODE_NOT_VISIBLE = 'not_visible'

export const DETAIL_QUESTION_NAMES = {
  sizeCode: 'size_type_code',
  equipment: {
    reefer: 'equipment_reefer',
    openTop: 'equipment_open_top',
    tank: 'equipment_tank',
    flatRack: 'equipment_flat_rack',
  } satisfies Record<EquipmentCheck, string>,
  markings: {
    superHeavy: 'marking_super_heavy',
    highContainer: 'marking_high_container',
    overwidth: 'marking_overwidth',
    fumigation: 'marking_fumigation',
    marinePollutant: 'marking_marine_pollutant',
  } satisfies Record<MarkingCheck, string>,
  dgPlacard: 'dg_placard',
} as const

/** The DG classes and their placard symbols (UN Model Regulations). Symbol and class only. */
export const DG_CLASSES: Record<number, { name: string; symbol: string }> = {
  1: { name: 'explosives', symbol: 'Exploding bomb' },
  2: { name: 'gases', symbol: 'Gas cylinder, flame or skull and crossbones' },
  3: { name: 'flammable liquids', symbol: 'Flame' },
  4: { name: 'flammable solids', symbol: 'Flame' },
  5: { name: 'oxidisers and organic peroxides', symbol: 'Flame over circle' },
  6: { name: 'toxic and infectious substances', symbol: 'Skull and crossbones' },
  7: { name: 'radioactive material', symbol: 'Radiation trefoil' },
  8: { name: 'corrosives', symbol: 'Liquids eating into a hand and metal' },
  9: { name: 'miscellaneous dangerous goods', symbol: 'Seven vertical stripes' },
}

/** The DG class's plain name, e.g. "flammable liquids". */
export function dgClassName(dgClass: number): string | null {
  return DG_CLASSES[dgClass]?.name ?? null
}
