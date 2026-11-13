// Fourth round of mock-ups (v4-*.html). Not app code. Loaded after v2.js (the drawings).
// Shared here: the icon set, the inspection's content, and the tab switch. Layout is each page's own.
const ICONS = {
  length: 'M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3',
  height: 'M12 3v18M9 6l3-3 3 3M9 18l3 3 3-3',
  width: 'M4 6v12M20 6v12M7 12h10M9.5 9.5 7 12l2.5 2.5M14.5 9.5 17 12l-2.5 2.5',
  box: 'M3 7h18v10H3zM7.5 7v10M12 7v10M16.5 7v10',
  reefer: 'M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.6 4.6 12 7l2.4-2.4M9.6 19.4 12 17l2.4 2.4',
  tank: 'M3 6h18v12H3zM6.5 12a5.5 3.6 0 1 0 11 0a5.5 3.6 0 1 0-11 0',
  opentop: 'M3 9v9h18V9M3 9c3-3.2 6 3.2 9 0s6 3.2 9 0',
  flatrack: 'M2.5 17h19M2.5 19.5h19M4.5 17V7.5M19.5 17V7.5M4.5 10h2.5M19.5 10H17',
  highcube: 'M6 3.5h12v17H6zM12 16.5v-9M9 10.5l3-3 3 3',
  insulated: 'M3 6h18v12H3zM6 9h12v6H6z',
  bulk: 'M4 5h16l-5.5 8v6h-5v-6z',
  vents: 'M3 5h18v14H3zM7 9.5h10M7 12.5h10M7 15.5h10',
  seal: 'M8 3h8v6H8zM10.5 9v6h3V9M8 15h8v6H8z',
  placard: 'M12 3.5 21.5 20h-19zM12 10v5M12 17.6v.4',
  weight: 'M7 8h10l3 12H4zM9.5 8a2.5 2.5 0 1 1 5 0',
  tag: 'M3 3h8l10 10-8 8L3 11zM7.5 7.5v.01',
  tick: 'M5 12.5l4.5 4.5L19 7.5',
  cross: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  arrow: 'M4 12h16M14 6l6 6-6 6',
}
const ico = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`
const mark = (yes) => `<span class="mark mark--${yes ? 'yes' : 'no'}">${ico(yes ? 'tick' : 'cross')}</span>`

const DIMS = [['length', 'Length', '20 ft'], ['height', 'Height', '8 ft 6 in'], ['width', 'Width', '8 ft'], ['box', 'Type', 'General purpose']]
const KINDS = [['box', 'General purpose', true], ['reefer', 'Refrigerated', false], ['tank', 'Tank', false], ['opentop', 'Open top', false], ['flatrack', 'Flat rack', false], ['highcube', 'High cube', false]]
const FEATS = [['insulated', 'Insulated', false], ['bulk', 'Bulk', false], ['vents', 'Passive vents', true]]
const LEDGER = [
  [1, 'Container ID', 'JDLU 200690 2', 'Check digit valid', 'confident', 'Confident', 'id'],
  [2, 'Size and type', '22G1', '20 ft general purpose', 'confident', 'Confident', 'type'],
  [3, 'Max gross', '32,500 kg', '71,650 lb', 'confident', 'Confident', 'gross'],
  [4, 'Tare', '2,180 kg', '4,810 lb', 'confident', 'Confident', 'tare'],
  [5, 'Payload', '30,320 kg', '66,840 lb', 'likely', 'Likely', 'payload'],
  [6, 'Capacity', '33.2 m³', '1,172 cu ft', 'likely', 'Likely', 'cap'],
  [7, 'Seal', '0154620', 'Bolt seal, photo 5', 'confident', 'Confident', 'sealnum'],
  [8, 'Placards', 'Super heavy', 'No dangerous-goods placard', 'confident', 'Confident', 'placard'],
  [9, 'CSC plate', 'Not readable', 'Too small in these photos', 'unknown', "Can't tell", ''],
]
const MARKS4 = [['Super heavy', true, 'confident', 'Confident'], ['Fumigation notice', true, 'likely', 'Likely'], ['High container', false, 'unseen', 'Not seen'], ['Overwidth', false, 'unseen', 'Not seen'], ['Marine pollutant', false, 'unseen', 'Not seen'], ['Limited quantity', false, 'unseen', 'Not seen']]
const SHOTS = [['jdlu-200690-1-rear-doors', 'Doors'], ['jdlu-200690-2-corner-doors-left', 'Doors and right side'], ['jdlu-200690-3-corner-doors-right', 'Doors and left side'], ['jdlu-200690-4-long-side', 'Blank end'], ['seal-closeup-coyu-0154620', 'Seal']]

Object.assign(PARTS, {
  shots: () => SHOTS.map(([f, l], i) => `<li><img src="../../samples/${f}.jpg" alt=""><span><b>${i + 1}</b>${l}</span></li>`).join(''),
  marks: () => '<ul class="mk4">' + MARKS4.map(([k, seen, c, w]) => `<li class="${seen ? '' : 'is-off'}">${mark(seen)}<b>${k}</b>${cert(c, w)}</li>`).join('') + '</ul>',
})
function boot() {
  document.querySelectorAll('[data-ico]').forEach((e) => (e.innerHTML = ico(e.dataset.ico)))
  render()
  const show = (t) => {
    document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('is-on', b.dataset.tab === t))
    document.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== t))
  }
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)))
  if (document.querySelector('[data-tab]')) show(['damage', 'marks'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'chars')
}
