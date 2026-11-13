// The not-a-container screen: shown when every photo of an inspection is something other than a container.
// Pure. The model can only say a photo is not a container, never what it is, so nothing here names the subject.
// The screen is a joke on purpose (design-system/components/NotAContainer); its words live here so they are tested.
import type { InspectionRecord } from './inspection'

/** The made-up container ID the screen registers the uploader as. Owner TROL, serial 000006, check digit 7. */
export const TROLL_ID = { owner: 'TROL', serial: '000006', check: '7' } as const

/**
 * How many photos the screen is for: every photo of the result is not a container. 0 when any photo shows
 * a container, a face is still unknown, or there is no result. One photo reads its own face; several read
 * the per-photo summaries, where a photo that is not a container is marked dropped.
 */
export function notAContainerCount(record: InspectionRecord | null, photoCount: number): number {
  if (!record || photoCount < 1) return 0
  if (photoCount === 1) return record.photoFace?.face === 'not-container' ? 1 : 0
  const photos = record.photos ?? []
  return photos.length === photoCount && photos.every((p) => p.dropped) ? photoCount : 0
}

const STAMPS = ['REJECTED', 'REJECTED', 'ALSO NO', 'STILL NO', 'NOPE'] as const
const TIMES: Record<number, string> = {
  2: 'twice',
  3: 'three times',
  4: 'four times',
  5: 'five times',
}

/** The banana-skin line in mocking case. Each line also has a plain version for screen readers. */
const BANANA_ONE = 'What are you going to do next, a banana skin?'
const BANANA_SEVERAL = 'Five photos of banana skins?'
const BANANA_MAX = 'Six photos of banana skins? The limit is five.'

/** "Hello there" -> "hElLo ThErE": letters alternate case, starting lower; other characters are kept and skipped. */
export function mockingCase(text: string): string {
  let upper = false
  return [...text]
    .map((ch) => {
      if (ch.toLowerCase() === ch.toUpperCase()) return ch
      const out = upper ? ch.toUpperCase() : ch.toLowerCase()
      upper = !upper
      return out
    })
    .join('')
}

export interface NotAContainerWords {
  /** One stamp per photo, in photo order. */
  stamps: string[]
  /** The tally under several photos; null for one photo. */
  tally: string | null
  registered: string
  achievement: string
  achievementCaption: string
  /** The sticker on the achievement card for several photos; null for one. */
  combo: string | null
  level: string
  xp: number
  /** How full the XP bar is, 0 to 100. */
  xpPercent: number
  banana: string
  bananaMocking: string
}

/** The screen's words for `count` photos (1 to 5). */
export function notAContainerWords(count: number): NotAContainerWords {
  const n = Math.max(1, Math.min(5, Math.round(count)))
  const several = n > 1
  const banana = !several ? BANANA_ONE : n < 5 ? BANANA_SEVERAL : BANANA_MAX
  return {
    stamps: STAMPS.slice(0, n).map((s, i) => (several || i === 0 ? s : 'REJECTED')),
    tally: several ? `${n} photos · 0 containers · ${n} rejections` : null,
    registered: several ? `Registered: ${TIMES[n]}` : 'Registered: just now',
    achievement: several ? `Wannabe QA x${n}` : 'Wannabe QA',
    achievementCaption: several
      ? "One wasn't enough. You brought friends."
      : 'Uploaded a non-container. Felt clever.',
    combo: several ? `COMBO x${n}` : null,
    level: several ? 'Level 1 · Committed to the bit' : 'Level 1 · Edge case enjoyer',
    xp: n,
    xpPercent: n * 5,
    banana,
    bananaMocking: mockingCase(banana),
  }
}
