// The not-a-container screen: shown when every photo of an inspection is something other than a container.
// Pure. The model only says a photo is not a container, never what it is, so nothing here names the subject,
// with one exception: the survey asks whether a photo shows a banana or its skin (photoFace.ts, BANANA_QUESTION),
// and a banana among the photos turns the screen into its Easter egg.
// The screen is a joke on purpose (design-system/components/NotAContainer); its words live here so they are tested.
import type { InspectionRecord } from './inspection'

/** The made-up container ID the screen registers the uploader as: owner, serial and check digit. */
export interface TrollId {
  owner: string
  serial: string
  check: string
}

export const TROLL_ID: TrollId = { owner: 'TROL', serial: '000006', check: '7' }
export const BANANA_ID: TrollId = { owner: 'PEEL', serial: '000006', check: '7' }

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

/** For each photo, whether the survey saw a banana or its skin in it. Empty when there is no result. */
export function bananaPhotos(record: InspectionRecord | null, photoCount: number): boolean[] {
  if (!record || photoCount < 1) return []
  if (photoCount === 1) return [record.photoFace?.banana === true]
  return (record.photos ?? []).map((p) => p.face?.banana === true)
}

const STAMPS = ['REJECTED', 'REJECTED', 'ALSO NO', 'STILL NO', 'NOPE'] as const
const BANANA_STAMP = 'A-PEEL DENIED'
const TIMES: Record<number, string> = {
  2: 'twice',
  3: 'three times',
  4: 'four times',
  5: 'five times',
}

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
  /** True when a banana or its skin was seen: the gold Easter-egg version of the screen. */
  banana: boolean
  /** One stamp per photo, in photo order. */
  stamps: string[]
  /** The line in mocking case under the photos (the banana version only); null otherwise. */
  taunt: { plain: string; mocking: string } | null
  /** The tally under several photos; null for one photo. */
  tally: string | null
  id: TrollId
  tags: string[]
  /** The rarity pill on the achievement (the banana version only); null otherwise. */
  rarity: string | null
  achievement: string
  achievementCaption: string
  /** The sticker on the achievement card for several photos; null for one. */
  combo: string | null
  level: string
  xp: number
  /** How full the XP bar is, 0 to 100. */
  xpPercent: number
  nextTitle: string
  /** The line under Next up: plain, and the words shown (in mocking case where `mocking`). */
  next: { plain: string; shown: string; mocking: boolean }
  respawn: string
  egg: string
}

/**
 * The screen's words for `count` photos (1 to 5). `banana`: one flag per photo, true where the survey saw a
 * banana or its skin; any banana gives the Easter-egg version.
 */
export function notAContainerWords(
  count: number,
  banana: readonly boolean[] = [],
): NotAContainerWords {
  const n = Math.max(1, Math.min(5, Math.round(count)))
  const several = n > 1
  const combo = several ? `COMBO x${n}` : null
  const tally = several ? `${n} photos · 0 containers · ${n} rejections` : null

  if (banana.slice(0, n).some(Boolean)) {
    const taunt = 'Okay, you actually did it'
    const next = 'The final boss. Nobody has beaten it.'
    return {
      banana: true,
      stamps: STAMPS.slice(0, n).map((s, i) => (banana[i] ? BANANA_STAMP : s)),
      taunt: { plain: taunt, mocking: mockingCase(taunt.replace(',', '')) },
      tally,
      id: BANANA_ID,
      tags: [`Owner: ${BANANA_ID.owner}`, 'Potassium: high', 'Slip risk: Confident'],
      rarity: 'Legendary',
      achievement: 'Banana skin',
      achievementCaption: 'We dared you. You did it. We regret everything.',
      combo,
      level: 'Level 2 · Banana pro',
      xp: 10,
      xpPercent: 100,
      nextTitle: 'Next up: An actual container',
      next: { plain: next, shown: next, mocking: false },
      respawn: 'Slip back to a real container',
      egg: 'this screen is bananas. no containers were harmed.',
    }
  }

  const line = !several ? BANANA_ONE : n < 5 ? BANANA_SEVERAL : BANANA_MAX
  return {
    banana: false,
    stamps: STAMPS.slice(0, n).map((s, i) => (several || i === 0 ? s : 'REJECTED')),
    taunt: null,
    tally,
    id: TROLL_ID,
    tags: [
      `Owner: ${TROLL_ID.owner}`,
      several ? `Registered: ${TIMES[n]}` : 'Registered: just now',
      '6-7',
    ],
    rarity: null,
    achievement: several ? `Wannabe QA x${n}` : 'Wannabe QA',
    achievementCaption: several
      ? "One wasn't enough. You brought friends."
      : 'Uploaded a non-container. Felt clever.',
    combo,
    level: several ? 'Level 1 · Committed to the bit' : 'Level 1 · Edge case enjoyer',
    xp: n,
    xpPercent: n * 5,
    nextTitle: 'Next up: Banana skin',
    next: { plain: line, shown: mockingCase(line), mocking: true },
    respawn: 'Respawn with a real container',
    egg: '↑ ↑ ↓ ↓ ← → ← → B A also does nothing',
  }
}
