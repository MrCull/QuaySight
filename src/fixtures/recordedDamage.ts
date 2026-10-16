import type { DamageAssessment } from '../domain/damage'

/**
 * Recorded side-damage assessment for the walking skeleton (ticket #8).
 *
 * Source: samples/side-dented-grey.jpg only. This is NOT a captured provider response: no provider
 * returned it. It was written by reading the photo, so the probability is unavailable and the
 * certainty and severity are the author's reading of how the dents look at this resolution.
 *
 * What the photo shows: a grey container's long side with a row of shallow dents or creases across
 * the lower middle of the panel. The rear-door end is only partly visible at the left edge, and a
 * "GOOSE NECK-THIS END" label sits on that end too, so the photo does not establish whether the
 * long side is the left or the right side. The rear, front and roof are not in the photo.
 */
export const recordedSideDamage: DamageAssessment = {
  source: 'recorded',
  photos: [{ photo: 'side-dented-grey.jpg', face: 'long-side' }],
  findings: [
    {
      id: 1,
      face: 'long-side',
      zone: { u0: 0.27, u1: 0.7, v0: 0.62, v1: 0.78 },
      component: 'panel',
      visibility: null,
      location: 'Approximate area on the lower middle of the long side',
      title: 'Dents in the side panel',
      description:
        'A row of shallow dents across the lower part of the side panel, in the middle of the visible length.',
      bestInterpretation: 'shallow dents in a horizontal row on the lower side panel.',
      uncertainty:
        'Depth cannot be judged from one photo, and light reflections on the corrugations could look like dents.',
      types: [{ code: 'DT', name: 'Dent', probability: null }],
      severity: 'minor',
      certainty: 'Likely',
      caveats: [
        'Only one long side is photographed. The rear doors, front end and roof are not seen.',
        'The photo does not establish which side of the container this is.',
        'Approximate area. Not a measured or certified location.',
        'Severity is an apparent visual judgement from one photo, not a repair verdict.',
      ],
    },
  ],
}
