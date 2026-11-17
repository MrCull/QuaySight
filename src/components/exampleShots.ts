// The start screen's decoration: five bundled photos fanned over the drop zone, naming the kinds of shot that
// help an inspection. Four are one container (JDLU 200690 2); the seal close-up is from another.
import leftCorner from '../../samples/jdlu-200690-2-corner-doors-left.jpg'
import longSide from '../../samples/jdlu-200690-4-long-side.jpg'
import rearDoors from '../../samples/jdlu-200690-1-rear-doors.jpg'
import rightCorner from '../../samples/jdlu-200690-3-corner-doors-right.jpg'
import seal from '../../samples/seal-closeup-coyu-0154620.jpg'

export interface ExampleShot {
  label: string
  url: string
  /** Where the 3:4 crop sits on a photo of another shape (CSS object-position). */
  focus?: string
}

/** In fan order, left to right; the rear doors sit in the middle, on top. */
export const EXAMPLE_SHOTS: ExampleShot[] = [
  { label: 'Left corner', url: leftCorner },
  { label: 'Long side', url: longSide },
  { label: 'Rear doors', url: rearDoors },
  { label: 'Right corner', url: rightCorner },
  { label: 'Seal', url: seal, focus: '50% 18%' },
]
