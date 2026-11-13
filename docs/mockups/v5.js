// Fifth round of mock-ups (v5-*.html). Not app code. Loaded after v2.js (drawings) and v4.js (icons, content, tabs).
// Shared here: the pieces of content every variation shows. Layout is each page's own.
const R5 = Object.fromEntries(LEDGER.map((r) => [r[1], r]))
const reading = (k) => { const [, , v, s, c, w] = R5[k]; return `<li><span class="k">${k}</span><b class="v">${v}</b><small>${s}</small>${cert(c, w)}</li>` }
const finding = ([n, t, w, c, cw]) => `<li class="fl-i"><span class="fl-n">${n}</span><div class="fl-t"><b>${t}</b><small>${w}</small></div>${cert(c, cw)}</li>`

// Side and end elevation with the three dimensions, for the Characteristics tab.
const profile = () => {
  const ribs = Array.from({ length: 29 }, (_, i) => `<path d="M${71 + i * 11} 36v128"/>`).join('')
  const cast = (x, y) => `<rect x="${x}" y="${y}" width="9" height="7"/>`
  return `<svg class="profile" viewBox="0 0 580 222" role="img" aria-label="Side and end of the container with its length, height and width">
    <g class="pf-rib">${ribs}</g>
    <g class="pf-line"><rect x="60" y="30" width="330" height="140" rx="2"/><rect x="430" y="30" width="132" height="140" rx="2"/><path d="M496 36v128M455 36v128M476 36v128M516 36v128M537 36v128"/></g>
    <g class="pf-cast">${[60, 381, 430, 553].map((x) => cast(x, 30) + cast(x, 163)).join('')}</g>
    <g class="pf-dim"><path d="M60 192h330M60 186v12M390 186v12M430 192h132M430 186v12M562 186v12M34 30v140M28 30h12M28 170h12"/></g>
    <text x="225" y="214" text-anchor="middle">20 ft</text><text x="496" y="214" text-anchor="middle">8 ft</text><text transform="translate(20 100) rotate(-90)" text-anchor="middle">8 ft 6 in</text>
  </svg>`
}

Object.assign(PARTS, {
  shots: () => SHOTS.map(([f, l]) => `<li><img src="../../samples/${f}.jpg" alt="${l}"></li>`).join(''),
  idtext: () => 'JDLU 200690 <em>2</em>',
  weights: () => ['Max gross', 'Tare', 'Payload', 'Capacity'].map(reading).join(''),
  stats: () => DIMS.map(([i, k, v]) => `<li><span class="stat-i">${ico(i)}</span><span class="k">${k}</span><b>${v}</b></li>`).join(''),
  checks: () => [...KINDS.slice(1), ...FEATS].map(([i, k, y]) => `<li class="${y ? 'is-yes' : ''}">${ico(i)}<b>${k}</b>${mark(y)}</li>`).join(''),
  speclist: () => DIMS.map(([i, k, v]) => `<li>${ico(i)}<b>${k}</b><span>${v}</span></li>`).join('') + PARTS.checks(),
  profile,
  tabs: () => '<button data-tab="chars">Characteristics</button><button data-tab="damage">Damage<i>6</i></button><button data-tab="marks">Markings<i>2</i></button>',
  bar: () => '<span class="brand"><i class="logo"></i>Quay Sight</span><div class="bar-r"><span>This container <b>$0.0209</b></span><button class="btn">New inspection</button></div>',
  field: () => '<div class="pick"><span class="is-on">OpenRouter</span><span>OpenAI</span></div><input placeholder="API key" aria-label="API key"><button class="go">Start<span data-ico="arrow"></span></button>',
  note: () => '<span>Your key stays in this tab.</span><a>Try the demo</a>',
  foot: () => 'Observations and estimates from photographs. Not a certified survey.',
})

function boot5() {
  document.querySelectorAll('[data-find]').forEach((e) => {
    const ns = e.dataset.find.split(',').map(Number)
    e.innerHTML = '<ol class="fl">' + ns.map((n) => finding(FIND.find((f) => f[0] === n))).join('') + '</ol>'
  })
  render()
  boot()
}
