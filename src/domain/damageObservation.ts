import type { DamageFinding, DamageObservation } from './damage'

/** Keep the photo-relative classification independently of the combined card's judgement. */
export function observeDamage(
  finding: DamageFinding,
  face: string,
  photo: DamageObservation['photo'],
  passId: string | null,
): DamageFinding {
  const zone = finding.zone
  return {
    ...finding,
    observations: [
      {
        id: `${photo?.index !== undefined ? `photo-${photo.index}:` : ''}${face}:${finding.component}:${zone ? [zone.u0, zone.u1, zone.v0, zone.v1].join(':') : finding.location}`,
        findingId: finding.id,
        photo,
        passId,
        evidence: { ...finding },
      },
    ],
  }
}
