import { combineSealReads } from '../../domain/sealZoom'
import { readSizeCode } from '../../domain/containerDetails'
import { containerDetailQuestions } from '../../domain/containerDetailQuestions'
import { DETAIL_QUESTION_NAMES, type SizeCodeReading } from '../../domain/containerDetailTypes'
import type { IdBox } from '../../domain/cropRead'
import { questionSet } from '../../domain/questionSet'
import { questionSetAsk, type QuestionSetAsk } from '../../domain/questionSetAsk'
import { readSeal, sealQuestions, type SealReading } from '../../domain/sealFamily'
import {
  bands,
  cut,
  grown,
  isoFits,
  narrowed,
  ROUNDS,
  sealFits,
  SIDES,
  type Side,
} from '../../domain/tileSearch'
import { askDecisions } from '../../services/askDecisions'
import { cropForRead } from '../../services/scalePhoto'
import type { PlanRequest, PlanView } from '../requestPlan'
import { doorDamage } from './doorDamage'
import { doorEndCrop } from './doorEndCrop'
import { idCropRead, ZOOM_MARGIN } from './idCropRead'
import { idRecheck } from './idRecheck'
import { regions } from './regions'
import { sealPick } from './sealPick'
import { sealZoom } from './sealZoom'
import { sideDamage } from './sideDamage'
import { survey } from './survey'
import { weightCheck } from './weightCheck'

// Finding the seal number and the ISO code by reading parts of the photo (src/domain/tileSearch.ts).
// Each part is one request. The seal search runs only on a photo the survey calls a close-up of the seal;
// the ISO search only on a door-end photo that read the code, starting round the ID's found area, where
// the code is painted. Both are refinements of the close-ups alone: they start once every other request
// for the photo has settled, so they never take the request cap from a reading, and a failure or the cap
// leaves the close-up as it was.

const WHOLE: IdBox = { left: 0, top: 0, right: 1, bottom: 1, confidence: 1 }

const SEAL_ASK = questionSetAsk(
  questionSet(
    'This is part of a photo of a freight container seal. Read the number on the seal, character by character. If no seal number is visible in this part, say so; if a character cannot be read, answer unreadable rather than guessing.',
    sealQuestions({ box: false }),
  ),
  ({ answers }) => readSeal(answers, { box: false }),
)

const ISO_ASK = questionSetAsk(
  questionSet(
    'This is part of a photo of a freight container. Answer only from what is visible in this part.',
    containerDetailQuestions().filter((q) => q.name === DETAIL_QUESTION_NAMES.sizeCode),
  ),
  ({ answers }) => readSizeCode(answers[DETAIL_QUESTION_NAMES.sizeCode]),
)

/** One subject's search: where it starts, what counts as the whole reading, and how a part is read. */
interface Search<R> {
  name: 'seal' | 'iso'
  purpose: string
  ask: QuestionSetAsk<R | null>
  /** The reading the whole photo gave, or null when this photo is not searched. */
  target(plan: PlanView): string | null
  /** The area the first round of cuts starts from, before any part is read (null: bands first). */
  start(plan: PlanView): IdBox | null
  fits(reading: R | null | undefined, target: string): boolean
}

const SEAL: Search<SealReading> = {
  name: 'seal',
  purpose: 'Finding the seal number',
  ask: SEAL_ASK,
  target(plan) {
    const face = plan.answer(survey)?.findings.face
    if (face?.face !== 'close-up' || face.closeUpSubject !== 'seal') return null
    const read = combineSealReads(
      plan.answer(survey)?.findings.seal,
      plan.answer(sealZoom)?.seal ?? null,
    )
    return read?.visible && read.value && !read.value.includes('?') ? read.value : null
  },
  start: () => null,
  fits: sealFits,
}

const ISO: Search<SizeCodeReading> = {
  name: 'iso',
  purpose: 'Finding the ISO code',
  ask: ISO_ASK,
  target(plan) {
    const found = plan.answer(survey)?.findings
    if (found?.face?.face !== 'rear-doors') return null
    const code = found.details?.sizeCode
    return code?.state === 'read' && code.code && isoFits(code, code.code) ? code.code : null
  },
  start(plan) {
    const id = plan.answer(regions)?.id?.box
    return id ? grown({ ...id, confidence: 1 }, ZOOM_MARGIN) : null
  },
  fits: isoFits,
}

/** The requests that run before a search: the photo's own reads, damage and checks. */
const BEFORE: PlanRequest[] = [
  idRecheck,
  idCropRead,
  sealZoom,
  sealPick,
  sideDamage,
  doorDamage,
  doorEndCrop,
  weightCheck,
]

type Part = PlanRequest<unknown> & { round: number; index: number }

/** The search's requests: the seal's three bands (round 0), then four cuts a round. */
function partsOf<R>(search: Search<R>): Part[] {
  const parts: Part[] = []
  const rounds: Part[][] = []
  const first = search.name === 'seal' ? 0 : 1
  for (let round = first; round <= ROUNDS; round++) {
    const count = round === 0 ? 3 : SIDES.length
    const previous = rounds[rounds.length - 1] ?? []
    const these: Part[] = []
    for (let index = 0; index < count; index++) {
      const part: Part = {
        id: `${search.name}-part-${round}-${index + 1}`,
        purpose: search.purpose,
        stages: ['details'],
        round,
        index,
        after: search.name === 'seal' ? [survey] : [survey, regions],
        settledAfter: previous.length > 0 ? previous : BEFORE,
        optional: true,
        needed: (plan) => boxOf(plan, round, index) !== null,
        async send(ctx) {
          const box = boxOf(ctx, round, index)
          if (!box) throw new Error(`No part to read for ${search.name}.`)
          const { photo } = await cropForRead(
            ctx.photo,
            ctx.original,
            box,
            ctx.route.entry.photoLimits,
            0,
          )
          return askDecisions({ ...ctx, photo }, search.ask)
        },
        replay: (raw, plan) => search.ask.map(raw, plan.route),
        apply(record, _outcome, plan) {
          const area = areaAfter(plan, ROUNDS)
          if (!area) return record
          return { ...record, tileSearch: { ...record.tileSearch, [search.name]: area } }
        },
      }
      these.push(part)
    }
    rounds.push(these)
    parts.push(...these)
  }

  const fitsIn = (plan: PlanView, part: Part, target: string) =>
    search.fits(plan.answer(part) as R | undefined, target)

  /** The area the search has reached after `round` (0: the starting band or area), or null. */
  function areaAfter(plan: PlanView, round: number): IdBox | null {
    const target = search.target(plan)
    if (!target) return null
    let area: IdBox | null
    if (first === 0) {
      const band = rounds[0]!.find((p) => fitsIn(plan, p, target))
      area = band ? bands(WHOLE)[band.index]! : null
    } else {
      area = search.start(plan)
    }
    for (let r = 1; r <= round && area; r++) {
      const these = rounds[r - first]!
      const kept: Partial<Record<Side, boolean>> = {}
      these.forEach((p) => (kept[SIDES[p.index]!] = fitsIn(plan, p, target)))
      area = narrowed(area, kept)
    }
    return area
  }

  /** The part a request reads: a band, or the area so far with one side cut back. */
  function boxOf(plan: PlanView, round: number, index: number): IdBox | null {
    const target = search.target(plan)
    if (!target) return null
    if (round === 0) return bands(WHOLE)[index]!
    const area = round === first ? search.start(plan) : areaAfter(plan, round - 1)
    return area ? cut(area, SIDES[index]!) : null
  }

  return parts
}

/** Every request of both searches, in the order they are registered. */
export const tileSearchRequests: readonly PlanRequest[] = [...partsOf(SEAL), ...partsOf(ISO)]
