// Drawing the numbered regions on a photo (ticket #84). Kept apart from the codec so the live specs'
// browser codec can run this same function in the page without importing the module they replace.

/** What is drawn over a photo to mark regions, as fractions (0..1) of the photo. */
export interface PhotoOverlay {
  lines: { x1: number; y1: number; x2: number; y2: number }[]
  /** A number drawn centred at (x, y). `alt`: in the second colour. */
  labels: { text: string; x: number; y: number; alt: boolean }[]
}

/**
 * Draws the overlay: grid lines in white over black so they show on light and dark containers, and each
 * number on a dark (or, for `alt`, yellow) badge with a light edge.
 */
export function drawOverlay(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlay: PhotoOverlay,
): void {
  const unit = Math.min(width, height)
  // Plain named colours with their opacity set on the canvas: these are the pixels the model sees, not UI colours.
  const stroke = (lineWidth: number, style: string, alpha: number) => {
    context.globalAlpha = alpha
    context.lineWidth = lineWidth
    context.strokeStyle = style
    for (const l of overlay.lines) {
      context.beginPath()
      context.moveTo(l.x1 * width, l.y1 * height)
      context.lineTo(l.x2 * width, l.y2 * height)
      context.stroke()
    }
  }
  stroke(Math.max(3, unit / 250), 'black', 0.85)
  stroke(Math.max(1, unit / 600), 'white', 0.95)
  context.globalAlpha = 1

  const size = Math.max(12, Math.round(unit / 40))
  context.font = `bold ${size}px sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (const label of overlay.labels) {
    const x = label.x * width
    const y = label.y * height
    const w = context.measureText(label.text).width + size * 0.7
    const h = size * 1.3
    context.fillStyle = label.alt ? 'gold' : 'black'
    context.strokeStyle = label.alt ? 'black' : 'white'
    context.lineWidth = Math.max(1.5, size / 12)
    context.beginPath()
    context.roundRect(x - w / 2, y - h / 2, w, h, h / 4)
    context.globalAlpha = label.alt ? 1 : 0.7
    context.fill()
    context.globalAlpha = 1
    context.stroke()
    context.fillStyle = label.alt ? 'black' : 'white'
    context.fillText(label.text, x, y + size * 0.04)
  }
}
