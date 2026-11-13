// Whether this container is a tank container: a cylindrical tank held in a steel frame, with no doors.
// Pure. The drawings show a tank end instead of doors, and the seal is not looked for on doors.
import type { CertaintyLabel, InspectionRecord } from './inspection'

const SURE: readonly CertaintyLabel[] = ['Confident', 'Likely']

/**
 * A tank when a Likely-or-better size/type code decodes to a tank (22T6), or the tank check says yes at
 * Likely or better. A doubtful reading keeps the ordinary box with doors.
 */
export function isTankContainer(record: InspectionRecord | null | undefined): boolean {
  if (!record) return false
  const size = record.sizeCode
  if (size && SURE.includes(size.certainty)) return size.type.equipment === 'tank'
  const check = record.details?.equipment.tank
  return check?.answer === 'yes' && SURE.includes(check.certainty)
}
