// Third round of mock-ups (v3-*.html). Not app code. Loaded after v2.js, which supplies the two drawings.
// Every direction shows the same two screens built here; each direction's own stylesheet does the rest.
const PHOTOS = [['jdlu-200690-1-rear-doors', 'Doors'], ['jdlu-200690-2-corner-doors-left', 'Doors and right side'], ['jdlu-200690-3-corner-doors-right', 'Doors and left side'], ['jdlu-200690-4-long-side', 'Blank end'], ['seal-closeup-coyu-0154620', 'Seal close-up']]
const LEGEND = [['confident', 'Confident'], ['likely', 'Likely'], ['uncertain', 'Uncertain'], ['unknown', "Can't tell"], ['unseen', 'Not seen']]
const FLAGS = [['Refrigerated', 'No'], ['Tank', 'No'], ['Open top', 'No'], ['Flat rack', 'No'], ['High cube', 'No'], ['Insulated', 'No'], ['Bulk', 'No'], ['Passive vents', 'Yes']]
const MARKS = [['Super heavy', 'Seen on the right door', 'confident', 'Confident'], ['Fumigation notice', 'Seen on the left door', 'likely', 'Likely'], ['High container', 'Not seen in these photos', 'unseen', 'Not seen'], ['Overwidth', 'Not seen in these photos', 'unseen', 'Not seen'], ['Marine pollutant', 'Not seen in these photos', 'unseen', 'Not seen'], ['Limited quantity', 'Not seen in these photos', 'unseen', 'Not seen']]
const bar = (right) => `<header class="bar"><span class="brand"><i class="logo"></i>Quay Sight</span><span class="bar-mid">Container inspection</span><div class="bar-r">${right}</div></header>`
const foot = '<footer class="foot">Observations and estimates from photographs. Not a certified survey.</footer>'

function resultScreen() {
  return `<div class="app">
  ${bar('<span class="meta">Jev latest</span><span class="meta">This container <b>$0.0209</b></span><button class="btn">New inspection</button>')}
  <section class="photos"><ul class="st">${PHOTOS.map(([f, l], i) => `<li><img src="../../samples/${f}.jpg" alt=""><div><b>${i + 1}</b><span>${l}</span></div></li>`).join('')}</ul></section>
  <section class="sum">
    <div class="sum-id"><div class="sum-k"><span class="k">Container ID</span>${cert('confident', 'Confident')}<span class="chk">Check digit valid</span></div><h1 class="idx" data-part="id"></h1></div>
    <ul class="kf">
      <li><span class="k">Size and type</span><b>22G1</b><small>20 ft general purpose</small>${cert('confident', 'Confident')}</li>
      <li><span class="k">Seal</span><b>0154620</b><small>Bolt seal, right door</small>${cert('confident', 'Confident')}</li>
      <li><span class="k">Placards</span><b>Super heavy</b><small>No dangerous-goods placard</small>${cert('confident', 'Confident')}</li>
      <li><span class="k">Damage</span><b>6 findings</b><small>All cosmetic</small>${cert('likely', 'Likely')}</li>
    </ul>
  </section>
  <section class="read">
    <div class="read-h"><h2>Readings</h2><p>What was read from the door end, shown on a drawing of the doors.</p><div class="seg"><span class="is-on">Metric</span><span>Imperial</span></div></div>
    <div class="read-f"><svg data-door="both" role="img" aria-label="Drawing of the door end with the readings marked on it"></svg></div>
  </section>
  <section class="more">
    <nav class="tabs"><button data-tab="damage">Damage<i>6</i></button><button data-tab="chars">Characteristics</button><button data-tab="marks">Markings<i>2</i></button></nav>
    <div class="panel" data-panel="damage">
      <div class="views"><svg data-iso="door"></svg><svg data-iso="blank"></svg></div>
      <div class="finds"><div class="finds-h"><h3>6 findings, all cosmetic</h3>${cert('likely', 'Likely')}</div><div data-part="findings"></div><p class="note">Areas are approximate, on a drawing. The roof was not photographed.</p></div>
    </div>
    <div class="panel" data-panel="chars">
      <dl class="ch-dims"><div><dt class="k">Length</dt><dd>20 ft</dd></div><div><dt class="k">Height</dt><dd>8 ft 6 in</dd></div><div><dt class="k">Width</dt><dd>8 ft</dd></div><div><dt class="k">Type</dt><dd>General purpose</dd></div></dl>
      <ul class="ch-flags">${FLAGS.map(([k, v]) => `<li class="is-${v.toLowerCase()}"><b>${k}</b><span>${v}</span></li>`).join('')}</ul>
      <p class="note">Worked out from the size and type code <b>22G1</b>, which was read as ${cert('confident', 'Confident')}</p>
    </div>
    <div class="panel" data-panel="marks">
      <ul class="mk">${MARKS.map(([k, s, c, w]) => `<li class="${c === 'unseen' ? 'is-off' : ''}"><b>${k}</b><small>${s}</small>${cert(c, w)}</li>`).join('')}</ul>
    </div>
  </section>
  ${foot}</div>`
}

function setupScreen() {
  return `<div class="setup">
  ${bar('<span class="meta">How it works</span><span class="meta">Source on GitHub</span>')}
  <main class="su">
    <div class="su-hero">
      <span class="k">Container inspection from photographs</span>
      <h1>Read a shipping container from a few photos.</h1>
      <p class="su-lede">Add one to five photos. Quay Sight reads the container number, size, weights, seal and warning labels, marks any damage it can see, and tells you how sure it is of each one.</p>
      <ol class="su-steps"><li><b>1</b><span>Connect an AI model</span></li><li><b>2</b><span>Add your photos</span></li><li><b>3</b><span>Read the results</span></li></ol>
      <div class="su-fig"><svg data-door="${document.body.dataset.setupDoor || 'both'}" role="img" aria-label="Example result: a drawing of the doors with the readings marked on it"></svg></div>
      <div class="su-legend"><span class="k">Every result carries one of five labels</span><div>${LEGEND.map(([c, w]) => cert(c, w)).join('')}</div></div>
    </div>
    <form class="sf">
      <h2>Connect your AI model</h2>
      <p class="sf-intro">Quay Sight has no server of its own. Your photos go straight from this browser to the provider you choose, paid for with your own key.</p>
      <span class="k">Provider</span>
      <div class="sf-opts">
        <div class="sf-opt is-on"><i></i><div><b>OpenRouter</b><small>Model: Jev. Recommended.</small></div></div>
        <div class="sf-opt"><i></i><div><b>OpenAI</b><small>Model: GPT-6 Luna.</small></div></div>
      </div>
      <span class="k">OpenRouter API key</span>
      <div class="sf-key"><span>Paste your key (starts sk-or-)</span><em>Show</em></div>
      <p class="sf-help">Held in this tab's memory only. Never saved, and gone when you close the tab. <a>Where do I get a key?</a></p>
      <button class="sf-go" type="button">Continue to photos</button>
      <p class="sf-cost">About 2 cents a container. Never more than 50 cents.</p>
      <div class="sf-or"><span>No key yet?</span></div>
      <button class="sf-demo" type="button">Try the demo</button>
      <p class="sf-demo-note">Sample containers with saved results. No key, no charge.</p>
    </form>
  </main>
  ${foot}</div>`
}

document.getElementById('root').innerHTML = document.body.dataset.screen === 'setup' ? setupScreen() : resultScreen()
render()
function showTab(t) {
  document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('is-on', b.dataset.tab === t))
  document.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== t))
}
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)))
showTab(['chars', 'marks'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'damage')
