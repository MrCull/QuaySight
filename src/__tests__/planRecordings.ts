// Test support: plan recordings (src/plan/recording.ts) built from hand-written replies, for specs about
// demo mode and replay. They stand in for a recorded live run so a spec can show what the plumbing does
// with one; they are test data, never shipped, and never shown as a recording of a model.
import { afterEach, beforeEach } from 'vitest'
import { idResultState } from '../domain/certainty'
import type { ContainerIdReading } from '../domain/inspection'
import { registerDemoRecording } from '../domain/demoSamples'
import { PLAN_RECORDING_FORMAT, type PlanRecording } from '../plan/recording'
import { dentedSideReply, openAiShape } from './planReplies'
import { openAiSurveyReply, openRouterSurveyReply, type SurveyChoice } from './surveyReplies'

export const LUNA = { provider: 'luna', model: 'gpt-6-luna' } as const
export const JEV = { provider: 'openrouter', model: '~typesafe/jev-latest' } as const

const entry = (request: string, response: unknown) => ({
  request,
  response,
  latencyMs: 900,
  costUsd: null,
})

/** A full-plan recording on the side photo, as Luna answered it: no readable ID, a dent in Z2B. */
export function dentedSideRecording(): PlanRecording {
  const details: Record<string, SurveyChoice> = { photo_face: [['long_side', 0.95]] }
  return {
    format: PLAN_RECORDING_FORMAT,
    recordedAt: '2026-10-17T09:00:00.000Z',
    photo: 'samples/side-dented-grey.jpg',
    ...LUNA,
    entries: [
      entry('read', openAiSurveyReply('???????????', { details })),
      entry('side-damage', openAiShape(dentedSideReply())),
    ],
  }
}

/** A full-plan recording on the CHSU photo, as Jev answered it: the ID read cleanly, the face read. */
export function fullChsuRecording(): PlanRecording {
  return {
    format: PLAN_RECORDING_FORMAT,
    recordedAt: '2026-10-17T10:00:00.000Z',
    photo: 'samples/rear-door-chsu-22g1.jpg',
    ...JEV,
    entries: [
      entry(
        'read',
        openRouterSurveyReply('CHSU2051831', {
          box: true,
          details: {
            size_type_code: [['22G1', 0.95]],
            photo_face: [['rear_doors', 0.96]],
          },
        }),
      ),
    ],
  }
}

/** A full-plan recording on the APHU photo, as Luna answered it: the ID read cleanly (APHU 658684 7). */
export function cleanAphuRecording(): PlanRecording {
  return {
    format: PLAN_RECORDING_FORMAT,
    recordedAt: '2026-10-17T11:00:00.000Z',
    photo: 'samples/rear-door-aphu-45g1.jpg',
    ...LUNA,
    entries: [
      entry(
        'read',
        openAiSurveyReply('APHU6586847', {
          details: { size_type_code: [['45G1', 0.96]], photo_face: [['rear_doors', 0.97]] },
        }),
      ),
    ],
  }
}

/**
 * For a spec that chooses demo samples: makes these test recordings available to demo mode for each test,
 * and removes them after. The shipped recordings are real and few; a spec about the mechanics of demo mode
 * (a manifest check, New inspection) brings the recording it needs.
 */
export function withTestRecordings(...make: (() => PlanRecording)[]): void {
  let removals: (() => void)[] = []
  beforeEach(() => {
    removals = make.map((build) => registerDemoRecording(build()))
  })
  afterEach(() => removals.forEach((remove) => remove()))
}

/** The damaged-side sample (no shipped recording yet) and the clean APHU rear doors. */
export const withSideSampleRecording = () => withTestRecordings(dentedSideRecording)
export const withAllSampleRecordings = () =>
  withTestRecordings(dentedSideRecording, cleanAphuRecording)

/** The record read nothing of the container ID: no reading, or one with no character read. */
export function readNothingOfId(
  record: { containerId: ContainerIdReading | null } | null,
): boolean {
  return !record?.containerId || idResultState(record.containerId) === 'insufficient'
}
