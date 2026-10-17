// The manifest check (spec 3.2) as one Decisions request on a run's route: the pasted entries as choice
// questions, each with "not listed", read back as the manifest reading. Pure.
import { manifestMappingOf } from './luna'
import { manifestQuestionSet, type ManifestQuestion } from './manifest'
import { questionSetAsk } from './questionSetAsk'

export function manifestAsk(questions: ManifestQuestion[]) {
  return questionSetAsk(manifestQuestionSet(questions), (reply) =>
    manifestMappingOf(reply, questions),
  )
}
