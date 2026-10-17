import { combinePhotoRuns } from '../domain/combinePhotos'
import type { InspectionRecord, ProviderId } from '../domain/inspection'
import type { PlanRecording } from '../plan/recording'
import { replayRecording } from '../plan/replay'
import type { Expected } from './score'

/**
 * Replays a whole expected inspection (1 to 4 photos) as the record the app would show: each photo's
 * recording on the route is replayed on its own, then the photos are combined as a live run combines them.
 * A single photo is that photo's own record. Nothing is sent.
 */
export function replayInspection(
  entry: Expected,
  recordings: readonly PlanRecording[],
  route: ProviderId,
): InspectionRecord {
  const runs = entry.photos.map((p, i) => {
    const recording = recordings.find((r) => r.photo === p.photo && r.provider === route)
    if (!recording) throw new Error(`No ${route} recording of ${p.photo}.`)
    return {
      index: i + 1,
      name: p.photo,
      record: replayRecording(recording, { id: `${entry.id}-${i + 1}`, photo: null }),
    }
  })
  return runs.length === 1 ? runs[0]!.record : combinePhotoRuns(runs, { id: entry.id })
}
