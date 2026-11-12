// Shared by the three direction mock-ups. Not app code.
// Draws the container unfolded flat: door end, right side, blank end, left side.
// layout 'strip' puts the four faces in one row; 'stack' puts two rows (door end + right side, blank end + left side).
// Colours come from CSS custom properties (--sk-*), so each direction themes the same drawing.
function drawNet(svg, { layout = 'strip', findings = [], selected = 1 } = {}) {
  const NS = 'http://www.w3.org/2000/svg'
  const EW = 98, SW = 242, H = 104, GAP = 16, TOP = 20, LBL = 22
  const el = (name, attrs, parent = svg, text) => {
    const e = document.createElementNS(NS, name)
    for (const k in attrs) e.setAttribute(k, attrs[k])
    if (text != null) e.textContent = text
    parent.appendChild(e)
    return e
  }
  const row2 = TOP + H + LBL + 26
  const faces = layout === 'strip'
    ? { door: [0, TOP, EW], right: [EW + GAP, TOP, SW], blank: [EW + SW + GAP * 2, TOP, EW], left: [EW * 2 + SW + GAP * 3, TOP, SW] }
    : { door: [0, TOP, EW], right: [EW + GAP, TOP, SW], blank: [0, row2, EW], left: [EW + GAP, row2, SW] }
  const W = layout === 'strip' ? EW * 2 + SW * 2 + GAP * 3 : EW + SW + GAP
  const VH = layout === 'strip' ? TOP + H + LBL : row2 + H + LBL
  svg.setAttribute('viewBox', `-2 0 ${W + 4} ${VH}`)
  const names = { door: 'Door end', right: 'Right side', blank: 'Blank end', left: 'Left side' }

  for (const id in faces) {
    const [x, y, w] = faces[id]
    const g = el('g', { class: 'sk-face sk-face--' + id })
    el('text', { x, y: y - 7, class: 'sk-name' }, g, names[id])
    el('rect', { x, y, width: w, height: H, rx: 2, class: 'sk-panel' }, g)
    if (id === 'door') {
      // Two door leaves, four lock rods with cam keepers and handles, hinges down each edge.
      el('line', { x1: x + w / 2, y1: y + 5, x2: x + w / 2, y2: y + H - 5, class: 'sk-seam' }, g)
      for (const t of [0.17, 0.36, 0.64, 0.83]) {
        const rx = x + w * t
        el('line', { x1: rx, y1: y + 4, x2: rx, y2: y + H - 4, class: 'sk-rod' }, g)
        el('rect', { x: rx - 2.5, y: y + 3, width: 5, height: 4, rx: 1, class: 'sk-cam' }, g)
        el('rect', { x: rx - 2.5, y: y + H - 7, width: 5, height: 4, rx: 1, class: 'sk-cam' }, g)
        const hx = t < 0.5 ? rx : rx - 13
        el('rect', { x: hx, y: y + H * 0.6, width: 13, height: 3, rx: 1.5, class: 'sk-cam' }, g)
      }
      for (const t of [0.14, 0.38, 0.62, 0.86]) {
        el('rect', { x: x + 1.5, y: y + H * t - 3, width: 4, height: 6, rx: 1, class: 'sk-hinge' }, g)
        el('rect', { x: x + w - 5.5, y: y + H * t - 3, width: 4, height: 6, rx: 1, class: 'sk-hinge' }, g)
      }
    } else {
      // Corrugation: alternating light and dark ribs.
      const step = 5.5
      for (let rx = x + 7; rx < x + w - 6; rx += step) el('line', { x1: rx, y1: y + 6, x2: rx, y2: y + H - 6, class: 'sk-rib' }, g)
    }
    // Top and bottom rails, corner castings.
    el('rect', { x, y, width: w, height: 4, class: 'sk-rail' }, g)
    el('rect', { x, y: y + H - 4, width: w, height: 4, class: 'sk-rail' }, g)
    for (const [cx, cy] of [[x, y], [x + w - 7, y], [x, y + H - 6], [x + w - 7, y + H - 6]]) el('rect', { x: cx, y: cy, width: 7, height: 6, rx: 1, class: 'sk-corner' }, g)
    el('rect', { x, y, width: w, height: H, rx: 2, class: 'sk-outline' }, g)
    if (id === 'right' || id === 'left') {
      // Five sections a side, numbered from the door end.
      for (let i = 1; i < 5; i++) el('line', { x1: x + (w * i) / 5, y1: y + 4, x2: x + (w * i) / 5, y2: y + H - 4, class: 'sk-section' }, g)
      for (let i = 0; i < 5; i++) el('text', { x: x + (w * (i + 0.5)) / 5, y: y + H + 13, class: 'sk-num' }, g, String(id === 'right' ? i + 1 : 5 - i))
    }
  }
  // Zones first, then pins on top.
  for (const f of findings) {
    const [x, y, w] = faces[f.face]
    const [a, b, c, d] = f.rect
    el('rect', { x: x + w * a + 1.5, y: y + H * b + 1.5, width: w * (c - a) - 3, height: H * (d - b) - 3, rx: 2, class: 'sk-zone' + (f.n === selected ? ' is-on' : '') })
  }
  for (const f of findings) {
    const [x, y, w] = faces[f.face]
    const [a, b, c, d] = f.rect
    const g = el('g', { class: 'sk-pin' + (f.n === selected ? ' is-on' : '') })
    el('circle', { cx: x + (w * (a + c)) / 2, cy: y + (H * (b + d)) / 2, r: 8.5 }, g)
    el('text', { x: x + (w * (a + c)) / 2, y: y + (H * (b + d)) / 2 + 3.4 }, g, String(f.n))
  }
}

// The six hand-placed findings used by every direction (same as the earlier mock-up).
const FINDINGS = [
  { n: 1, face: 'door', rect: [0, 0.33, 0.5, 0.66] },
  { n: 5, face: 'door', rect: [0, 0.66, 0.5, 1] },
  { n: 3, face: 'right', rect: [0.4, 0.5, 0.6, 1] },
  { n: 4, face: 'left', rect: [0.6, 0, 0.8, 0.5] },
  { n: 2, face: 'left', rect: [0.6, 0.5, 0.8, 1] },
  { n: 6, face: 'left', rect: [0.8, 0, 1, 0.5] },
]
document.querySelectorAll('svg[data-net]').forEach((s) => drawNet(s, { layout: matchMedia('(max-width: 900px)').matches ? 'stack' : s.dataset.net, findings: FINDINGS }))
