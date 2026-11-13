// Shared by the second round of mock-ups (v2-*.html). Not app code.
// Two drawings, both coloured entirely from CSS custom properties so each direction themes them:
//   drawDoor: the door end drawn flat, with what was read painted on it and called out beside it.
//   drawIso:  the container in 3D (an end, a long side and the roof) with damage areas and numbered pins.
const NS = 'http://www.w3.org/2000/svg'
function mk(parent, name, attrs = {}, text) {
  const e = document.createElementNS(NS, name)
  for (const k in attrs) e.setAttribute(k, attrs[k])
  if (text != null) e.textContent = text
  parent.appendChild(e)
  return e
}

const READS = [
  { k: 'Container ID', v: 'JDLU 200690 2', s: 'Check digit valid', c: 'confident', w: 'Confident', a: [351, 59], side: 'r' },
  { k: 'Size and type', v: '22G1', s: '20 ft, standard height, general purpose', c: 'confident', w: 'Confident', a: [351, 82], side: 'r' },
  { k: 'Max gross', v: '32,500 kg', s: '71,650 lb', c: 'confident', w: 'Confident', a: [351, 141], side: 'r' },
  { k: 'Tare', v: '2,180 kg', s: '4,810 lb', c: 'confident', w: 'Confident', a: [351, 167], side: 'r' },
  { k: 'Payload', v: '30,320 kg', s: '66,840 lb', c: 'likely', w: 'Likely', a: [351, 193], side: 'r' },
  { k: 'Capacity', v: '33.2 m³', s: '1,172 cu ft', c: 'likely', w: 'Likely', a: [351, 219], side: 'r' },
  { k: 'Placards', v: 'Super heavy', s: 'No dangerous-goods placard', c: 'confident', w: 'Confident', a: [320, 312], side: 'r', hazard: true },
  { k: 'Seal', v: '0154620', s: 'Bolt seal, right door', c: 'confident', w: 'Confident', a: [253, 281], side: 'l' },
  { k: 'CSC plate', v: 'Not readable', s: 'Too small in these photos', c: 'unknown', w: "Can't tell", a: [86, 303], side: 'l' },
]

function certGlyph(g, cx, cy, c) {
  const r = 4.4
  const grp = mk(g, 'g', { class: 'cg cg--' + c })
  mk(grp, 'circle', { cx, cy, r, class: 'cg-ring' })
  if (c === 'confident') mk(grp, 'circle', { cx, cy, r, class: 'cg-fill' })
  if (c === 'likely') mk(grp, 'path', { d: `M${cx} ${cy}L${cx} ${cy - r}A${r} ${r} 0 1 1 ${cx - r} ${cy}Z`, class: 'cg-fill' })
  if (c === 'uncertain') mk(grp, 'path', { d: `M${cx} ${cy - r}A${r} ${r} 0 0 1 ${cx} ${cy + r}Z`, class: 'cg-fill' })
}

function drawDoor(svg, { mode = 'both' } = {}) {
  const DW = 400, DH = 424
  const ox = mode === 'both' ? 286 : 10, oy = 26
  const VW = mode === 'both' ? 1010 : mode === 'right' ? 668 : 420
  svg.setAttribute('viewBox', `0 0 ${VW} 478`)
  const g = mk(svg, 'g', { transform: `translate(${ox} ${oy})`, class: 'dr' })
  const R = (x, y, w, h, cls, rx = 0) => mk(g, 'rect', { x, y, width: w, height: h, rx, class: cls + ' sh' })

  const did = 'dr' + Math.random().toString(36).slice(2, 7)
  const defs = mk(svg, 'defs')
  const blur = mk(defs, 'filter', { id: did + 'b', x: '-10%', y: '-200%', width: '120%', height: '500%' })
  mk(blur, 'feGaussianBlur', { stdDeviation: 9 })
  const sheen = mk(defs, 'linearGradient', { id: did + 's', x1: 0, y1: 0, x2: 0.25, y2: 1 })
  mk(sheen, 'stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.14 })
  mk(sheen, 'stop', { offset: 0.45, 'stop-color': '#fff', 'stop-opacity': 0 })
  mk(sheen, 'stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0.2 })
  mk(g, 'ellipse', { cx: DW / 2, cy: DH + 6, rx: DW / 2 + 6, ry: 9, class: 'dr-shadow', filter: `url(#${did}b)` })
  R(0, 0, DW, DH, 'dr-frame', 3)
  // Two leaves, each pressed with five horizontal corrugations.
  for (const lx of [16, 201]) {
    R(lx, 18, 183, 386, 'dr-panel')
    for (let i = 0; i < 5; i++) {
      const y = 40 + i * 74
      R(lx + 8, y, 167, 46, 'dr-recess', 2)
      mk(g, 'rect', { x: lx + 8, y, width: 167, height: 2.5, class: 'dr-shade' })
      mk(g, 'rect', { x: lx + 8, y: y + 44, width: 167, height: 2, class: 'dr-lite' })
    }
  }
  mk(g, 'rect', { x: 199, y: 18, width: 2, height: 386, class: 'dr-shade' })
  mk(g, 'rect', { x: 0, y: 0, width: DW, height: DH, rx: 3, fill: `url(#${did}s)`, class: 'dr-sheen' })
  // Corner castings.
  for (const [x, y] of [[0, 0], [DW - 26, 0], [0, DH - 22], [DW - 26, DH - 22]]) {
    R(x, y, 26, 22, 'dr-cast', 2)
    mk(g, 'ellipse', { cx: x + 13, cy: y + 11, rx: 6, ry: 4, class: 'dr-hole' })
  }
  // Hinges.
  for (const y of [58, 150, 262, 352]) { R(7, y, 13, 18, 'dr-steel2', 2); R(DW - 20, y, 13, 18, 'dr-steel2', 2) }
  // Painted markings on the right leaf.
  const T = (x, y, size, text, extra = {}) => mk(g, 'text', { x, y, 'font-size': size, class: 'dr-paint', ...extra }, text)
  T(241, 64, 16, 'JDLU 200690', { textLength: 86, lengthAdjust: 'spacingAndGlyphs' })
  mk(g, 'rect', { x: 331.5, y: 50.5, width: 13.5, height: 17, class: 'dr-paintbox' })
  T(338.2, 64, 16, '2', { 'text-anchor': 'middle' })
  T(345, 87, 15, '22G1', { 'text-anchor': 'end', textLength: 33, lengthAdjust: 'spacingAndGlyphs' })
  const decal = [['MAX GROSS', '32,500 KG', '71,650 LB'], ['TARE', '2,180 KG', '4,810 LB'], ['PAYLOAD', '30,320 KG', '66,840 LB'], ['CU. CAP.', '33.2 CU.M', '1,172 CU.FT']]
  decal.forEach(([l, a, b], i) => {
    const y = 143 + i * 26
    T(241, y, 7.5, l)
    T(345, y, 7.5, a, { 'text-anchor': 'end' })
    T(345, y + 9.5, 7.5, b, { 'text-anchor': 'end' })
  })
  // Lock rods: keepers top and bottom, guides, handle with its catch.
  for (const [x, dir] of [[48, 1], [168, -1], [232, 1], [352, -1]]) {
    R(x - 2.8, 8, 5.6, 408, 'dr-rod', 2)
    mk(g, 'rect', { x: x - 2.8, y: 8, width: 1.6, height: 408, class: 'dr-rodlite' })
    R(x - 8, 4, 16, 14, 'dr-steel2', 2); R(x - 8, 406, 16, 14, 'dr-steel2', 2)
    R(x - 6.5, 96, 13, 9, 'dr-steel2', 1.5); R(x - 6.5, 330, 13, 9, 'dr-steel2', 1.5)
    R(dir > 0 ? x : x - 44, 262, 44, 5, 'dr-rod', 2.5)
    R(x - 6.5, 256, 13, 17, 'dr-steel2', 2)
    R(dir > 0 ? x + 36 : x - 46, 257, 10, 15, 'dr-steel2', 2)
  }
  // Bolt seal on the right door's inner handle.
  R(253.5, 270, 9, 7, 'dr-seal', 1.5); R(256.6, 277, 2.8, 7, 'dr-seal'); R(253.5, 284, 9, 6, 'dr-seal', 1.5)
  // Placard (super heavy) and CSC plate.
  mk(g, 'path', { d: 'M302 295 L320 327 H284 Z', class: 'dr-placard' })
  mk(g, 'path', { d: 'M302 306 V317 M302 321 v0.6', class: 'dr-placardmark' })
  R(86, 286, 48, 35, 'dr-plate', 2)
  for (let i = 0; i < 4; i++) mk(g, 'rect', { x: 91, y: 292 + i * 7, width: i % 2 ? 26 : 38, height: 2, class: 'dr-plateline' })

  if (mode === 'none') return
  // Call-outs. Channels are ordered so no two leaders cross.
  const items = READS.filter((r) => mode === 'both' || r.k !== 'CSC plate').map((r) => (mode === 'right' ? { ...r, side: 'r' } : r))
  for (const side of ['r', 'l']) {
    const list = items.filter((r) => r.side === side).sort((p, q) => p.a[1] - q.a[1])
    const gap = mode === 'right' ? 53 : 60
    list.forEach((r, i) => {
      const dirn = side === 'r' ? 1 : -1
      const lx = side === 'r' ? DW + 74 : -74
      const ly = side === 'r' ? 30 + i * gap : 262 + i * 76
      const ex = side === 'r' ? DW + 16 + (list.length - 1 - i) * 6 : -16 - i * 8
      const c = mk(g, 'g', { class: 'co' + (r.hazard ? ' co--hazard' : '') })
      mk(c, 'path', { d: `M${r.a[0]} ${r.a[1]}H${ex}V${ly - 3.5}H${lx - dirn * 9}`, class: 'ld' })
      mk(c, 'circle', { cx: r.a[0], cy: r.a[1], r: 2.6, class: 'ld-dot' })
      certGlyph(c, lx, ly - 3.5, r.c)
      const anchor = side === 'r' ? 'start' : 'end'
      const tx = lx + dirn * 12
      const head = mk(c, 'text', { x: tx, y: ly, 'text-anchor': anchor, class: 'co-k' })
      mk(head, 'tspan', {}, r.k)
      mk(head, 'tspan', { class: 'co-c co-c--' + r.c, dx: 8 }, r.w)
      mk(c, 'text', { x: tx, y: ly + 21, 'text-anchor': anchor, class: 'co-v' }, r.v)
      if (mode === 'both') mk(c, 'text', { x: tx, y: ly + 36, 'text-anchor': anchor, class: 'co-s' }, r.s)
    })
  }
}

// view 'door': door end and right side. view 'blank': blank end and left side.
// Findings: { n, face: 'end' | 'side', rect: [u0, v0, u1, v1] } in face coordinates, v measured up from the floor.
function drawIso(svg, { view = 'door', findings = [], selected = 1, roofSeen = false } = {}) {
  const O = [164, 262], S = [308, -60], E = [-124, -50], H = [0, -152]
  const add = (p, q, t = 1) => [p[0] + q[0] * t, p[1] + q[1] * t]
  const P = { side: (u, v) => add(add(O, S, u), H, v), end: (u, v) => add(add(O, E, u), H, v), roof: (u, v) => add(add(add(O, H), S, u), E, v) }
  const quad = (f, u0, v0, u1, v1) => [P[f](u0, v0), P[f](u1, v0), P[f](u1, v1), P[f](u0, v1)].map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')
  const Q = (f, u0, v0, u1, v1, cls) => mk(svg, 'polygon', { points: quad(f, u0, v0, u1, v1), class: cls })
  const L = (f, u0, v0, u1, v1, cls) => { const a = P[f](u0, v0), b = P[f](u1, v1); return mk(svg, 'line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls }) }
  svg.setAttribute('viewBox', '22 -4 478 318')
  const uid = 'iso' + Math.random().toString(36).slice(2, 7)
  const defs = mk(svg, 'defs')
  const blur = mk(defs, 'filter', { id: uid + 'b', x: '-20%', y: '-60%', width: '140%', height: '220%' })
  mk(blur, 'feGaussianBlur', { stdDeviation: 7 })
  const sheen = mk(defs, 'linearGradient', { id: uid + 's', x1: 0, y1: 0, x2: 1, y2: 0 })
  mk(sheen, 'stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.13 })
  mk(sheen, 'stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0.16 })
  const hatch = mk(defs, 'pattern', { id: uid + 'h', width: 9, height: 9, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(35)' })
  mk(hatch, 'line', { x1: 0, y1: 0, x2: 0, y2: 9, class: 'iso-hatch' })

  // Ground shadow.
  const sh = [add(O, [-6, 8]), add(add(O, S), [26, 12]), add(add(add(O, S), E, 0.5), [40, 6]), add(add(O, E), [-10, 16])]
  mk(svg, 'polygon', { points: sh.map((p) => p.join(',')).join(' '), class: 'iso-shadow', filter: `url(#${uid}b)` })

  // Roof.
  Q('roof', 0, 0, 1, 1, 'iso-top sh')
  if (roofSeen) for (let i = 1; i < 24; i++) L('roof', i / 24, 0.04, i / 24, 0.96, 'iso-toprib')
  if (!roofSeen) mk(svg, 'polygon', { points: quad('roof', 0.012, 0.05, 0.988, 0.95), fill: `url(#${uid}h)` })
  // Long side: corrugation, rails, posts, fork pockets.
  Q('side', 0, 0, 1, 1, 'iso-side sh')
  const N = 46
  for (let i = 1; i < N - 1; i++) Q('side', (i + 0.5) / N, 0.06, (i + 1) / N, 0.945, 'iso-rib')
  mk(svg, 'polygon', { points: quad('side', 0, 0, 1, 1), fill: `url(#${uid}s)` })
  Q('side', 0, 0.945, 1, 1, 'iso-frame'); Q('side', 0, 0, 1, 0.06, 'iso-frame')
  Q('side', 0, 0, 0.02, 1, 'iso-frame'); Q('side', 0.98, 0, 1, 1, 'iso-frame')
  Q('side', 0.36, 0.008, 0.415, 0.05, 'iso-dark'); Q('side', 0.585, 0.008, 0.64, 0.05, 'iso-dark')
  for (let i = 1; i < 5; i++) L('side', i / 5, 0.06, i / 5, 0.945, 'iso-section')
  // End.
  Q('end', 0, 0, 1, 1, 'iso-end sh')
  if (view === 'door') {
    for (const [a, b] of [[0.08, 0.49], [0.51, 0.92]]) for (let i = 0; i < 5; i++) Q('end', a + 0.02, 0.1 + i * 0.172, b - 0.02, 0.2 + i * 0.172, 'iso-endrecess')
    L('end', 0.5, 0.05, 0.5, 0.95, 'iso-seam')
    for (const u of [0.2, 0.38, 0.62, 0.8]) {
      L('end', u, 0.025, u, 0.975, 'iso-rod')
      L('end', u, 0.4, u + (u < 0.5 ? (u < 0.3 ? 0.1 : -0.1) : u < 0.7 ? 0.1 : -0.1), 0.4, 'iso-handle')
    }
  } else {
    for (let i = 1; i < 15; i++) Q('end', (i + 0.5) / 16, 0.06, (i + 1) / 16, 0.945, 'iso-endrib')
  }
  Q('end', 0, 0.945, 1, 1, 'iso-frame2'); Q('end', 0, 0, 1, 0.055, 'iso-frame2')
  Q('end', 0, 0, 0.07, 1, 'iso-frame2'); Q('end', 0.93, 0, 1, 1, 'iso-frame2')
  // Corner castings.
  for (const v of [0, 0.925]) {
    Q('side', 0, v, 0.03, v + 0.075, 'iso-cast'); Q('side', 0.97, v, 1, v + 0.075, 'iso-cast')
    Q('end', 0, v, 0.1, v + 0.075, 'iso-cast'); Q('end', 0.9, v, 1, v + 0.075, 'iso-cast')
  }
  // Crisp silhouette edges.
  for (const f of ['roof', 'side', 'end']) mk(svg, 'polygon', { points: quad(f, 0, 0, 1, 1), class: 'iso-edge' })

  // Labels.
  const rev = view === 'blank'
  for (let i = 0; i < 5; i++) { const p = P.side((i + 0.5) / 5, 0); mk(svg, 'text', { x: p[0], y: p[1] + 15, class: 'iso-num' }, String(rev ? 5 - i : i + 1)) }
  const pe = P.end(0.5, 0), ps = P.side(1, 0), pr = P.roof(0.5, 0.5)
  mk(svg, 'text', { x: pe[0] - 4, y: pe[1] + 24, class: 'iso-name', 'text-anchor': 'middle' }, view === 'door' ? 'Door end' : 'Blank end')
  mk(svg, 'text', { x: ps[0], y: ps[1] + 37, class: 'iso-name', 'text-anchor': 'end' }, view === 'door' ? 'Right side' : 'Left side')
  if (!roofSeen) mk(svg, 'text', { x: pr[0], y: pr[1] + 3, class: 'iso-roofnote', 'text-anchor': 'middle', transform: `rotate(-10.9 ${pr[0]} ${pr[1]})` }, 'Roof not seen')

  // Damage areas, then pins.
  for (const f of findings) mk(svg, 'polygon', { points: quad(f.face, ...f.rect), class: 'iso-zone' + (f.n === selected ? ' is-on' : '') })
  for (const f of findings) {
    const [a, b, c, d] = f.rect, p = P[f.face]((a + c) / 2, (b + d) / 2)
    const pin = mk(svg, 'g', { class: 'iso-pin' + (f.n === selected ? ' is-on' : '') })
    if (f.n === selected) mk(pin, 'circle', { cx: p[0], cy: p[1], r: 15, class: 'iso-halo' })
    mk(pin, 'circle', { cx: p[0], cy: p[1], r: 9.5 })
    mk(pin, 'text', { x: p[0], y: p[1] + 3.6 }, String(f.n))
  }
}

const ISO_FINDINGS = {
  door: [{ n: 1, face: 'end', rect: [0.5, 0.36, 0.92, 0.66] }, { n: 5, face: 'end', rect: [0.5, 0.06, 0.92, 0.34] }, { n: 3, face: 'side', rect: [0.4, 0.06, 0.6, 0.5] }],
  blank: [{ n: 4, face: 'side', rect: [0.6, 0.5, 0.8, 0.945] }, { n: 2, face: 'side', rect: [0.6, 0.06, 0.8, 0.5] }, { n: 6, face: 'side', rect: [0.8, 0.5, 0.98, 0.945] }],
}

// Shared pieces of page content, so every direction shows exactly the same inspection.
const cert = (c, w) => `<span class="cert cert--${c}"><i></i>${w}</span>`
const sev = '<span class="sev"><i><b></b><b></b><b></b><b></b></i>Cosmetic</span>'
const FIND = [
  [1, 'Surface wear on the door panel', 'Door end · left leaf, middle third', 'likely', 'Likely'],
  [5, 'Surface wear on the door panel', 'Door end · left leaf, bottom third', 'likely', 'Likely'],
  [3, 'Surface wear on the side sheet', 'Right side · section 3, lower half', 'uncertain', 'Uncertain'],
  [4, 'Surface wear on the side sheet', 'Left side · section 2, upper half', 'likely', 'Likely'],
  [2, 'Surface wear on the side sheet', 'Left side · section 2, lower half', 'likely', 'Likely'],
  [6, 'Surface wear on the side sheet', 'Left side · section 1, upper half', 'uncertain', 'Uncertain'],
]
const PARTS = {
  findings: () => '<ol class="fl">' + FIND.map(([n, t, w, c, cw], i) => `<li class="fl-i${i ? '' : ' is-on'}"><span class="fl-n">${n}</span><div class="fl-t"><b>${t}</b><small>${w}</small></div>${sev}${cert(c, cw)}${i ? '' : "<p>Cosmetic wear across the middle of the left door. Depth and extent can't be judged from photographs.</p>"}</li>`).join('') + '</ol>',
  details: () => '<dl class="dl">' + [['Length', '20 ft'], ['Height', '8 ft 6 in'], ['Width', '8 ft'], ['Type', 'General purpose'], ['Refrigerated', 'No'], ['Open top', 'No']].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('') + '</dl><p class="note">Worked out from the size and type code 22G1.</p>',
  markings: () => `<ul class="ml"><li><b>Super heavy</b>${cert('confident', 'Confident')}</li><li><b>Fumigation notice</b>${cert('likely', 'Likely')}</li><li class="is-off"><b>4 other markings</b>${cert('unseen', 'Not seen')}</li></ul><p class="note">High container, overwidth, marine pollutant and limited quantity were looked for.</p>`,
  photos: () => '<ul class="ph">' + [['jdlu-200690-1-rear-doors', 'Doors'], ['jdlu-200690-2-corner-doors-left', 'Right side'], ['jdlu-200690-3-corner-doors-right', 'Left side'], ['jdlu-200690-4-long-side', 'Blank end'], ['seal-closeup-coyu-0154620', 'Seal']].map(([f, l]) => `<li><img src="../../samples/${f}.jpg" alt=""><span>${l}</span></li>`).join('') + '</ul>',
  id: () => '<span>JDLU</span><span>200690</span><em>2</em>',
}
function render() {
  document.querySelectorAll('[data-part]').forEach((e) => (e.innerHTML = PARTS[e.dataset.part]()))
  document.querySelectorAll('svg[data-door]').forEach((s) => drawDoor(s, { mode: s.dataset.door }))
  document.querySelectorAll('svg[data-iso]').forEach((s) => drawIso(s, { view: s.dataset.iso, findings: ISO_FINDINGS[s.dataset.iso] }))
}
render()
