// Offline only: provisional crop coverage and reading comparisons, never a provider request.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
const input = resolve(process.argv[2] ?? 'docs/research/evidence/jev-markings-2026-10-30')
const output = resolve(process.argv[3] ?? `${input}/review`)
const manifest = JSON.parse(await readFile(resolve(input, 'manifest.json'), 'utf8'))
const labels = JSON.parse(
  await readFile('docs/research/jev-marking-provisional-labels-2026-10-30.json', 'utf8'),
)
const runs = await Promise.all(
  manifest.runs.map(async (run) => JSON.parse(await readFile(resolve(input, run.file), 'utf8'))),
)
await mkdir(output, { recursive: true })
const rows = manifest.crops.map((crop) => {
  const label = labels.photos[crop.photo]
  const target = label?.[crop.kind]
  const photo = manifest.photos.find((photo) => photo.photo === crop.photo)
  const r = crop.region
  const box = r
    ? [
        r.x / photo.uprightOriginalSize.width,
        r.y / photo.uprightOriginalSize.height,
        (r.x + r.width) / photo.uprightOriginalSize.width,
        (r.y + r.height) / photo.uprightOriginalSize.height,
      ]
    : null
  const area = box ? (box[2] - box[0]) * (box[3] - box[1]) : null
  const overlap =
    target && box
      ? Math.max(0, Math.min(target[2], box[2]) - Math.max(target[0], box[0])) *
        Math.max(0, Math.min(target[3], box[3]) - Math.max(target[1], box[1]))
      : 0
  const targetArea = target ? (target[2] - target[0]) * (target[3] - target[1]) : null
  const coverage = targetArea ? overlap / targetArea : null
  const tolerantContainment =
    target && box
      ? box[0] <= target[0] + 0.005 &&
        box[1] <= target[1] + 0.005 &&
        box[2] >= target[2] - 0.005 &&
        box[3] >= target[3] - 0.005
      : null
  const rawBoxContainment =
    target && crop.box
      ? crop.box.left <= target[0] &&
        crop.box.top <= target[1] &&
        crop.box.right >= target[2] &&
        crop.box.bottom >= target[3]
      : null
  const exact =
    crop.kind === 'id' && label?.expectedId
      ? crop.reading?.value === label.expectedId
      : crop.kind === 'seal' && label?.expectedSeal
        ? crop.reading?.value === label.expectedSeal
        : crop.kind === 'iso' && label?.expectedIso
          ? Object.values(crop.reading ?? {}).some((answer) => answer.value === label.expectedIso)
          : crop.kind === 'weights' && label?.expectedKg
            ? ['maxGross', 'tare', 'payload'].every(
                (quantity, index) =>
                  crop.reading?.[quantity]?.metric?.value === label.expectedKg[index],
              )
            : null
  const number = crop.kind === 'seal' ? label.sealNumber : crop.kind === 'id' ? target : null
  const clippedEdges =
    box && number
      ? ['left', 'top', 'right', 'bottom'].filter((edge, index) =>
          index < 2 ? box[index] > number[index] : box[index] < number[index],
        )
      : null
  return {
    ...crop,
    actualBox: box,
    provisionalCoverage: coverage,
    completeContainment: coverage === null ? null : coverage >= 0.999999,
    tolerantContainment,
    rawBoxContainment,
    irrelevantAreaFractionOfCrop: target && area ? 1 - overlap / area : null,
    exactReading: exact,
    characterExtentClippedEdges: clippedEdges,
  }
})
const groups = []
for (const kind of ['id', 'iso', 'weights', 'seal', 'hazard', 'doorEnd'])
  for (const strategy of ['regions', 'native', 'padded', 'hybrid']) {
    const own = rows.filter((row) => row.kind === kind && row.strategy === strategy)
    const scored = own.filter((row) => row.provisionalCoverage !== null)
    const available = own.filter((row) => !row.unavailable)
    const reads = own.filter((row) => row.exactReading !== null)
    const irrelevant = scored.filter((row) => row.irrelevantAreaFractionOfCrop !== null)
    groups.push({
      kind,
      strategy,
      attempts: own.length,
      available: available.length,
      labelledTargets: scored.length,
      completeContainment: scored.filter((row) => row.completeContainment).length,
      containmentWithHalfPercentEdgeTolerance: scored.filter((row) => row.tolerantContainment)
        .length,
      rawBoxContainment: scored.filter((row) => row.rawBoxContainment).length,
      meanCoverage: scored.length
        ? scored.reduce((sum, row) => sum + row.provisionalCoverage, 0) / scored.length
        : null,
      meanAreaFraction: available.length
        ? available.reduce((sum, row) => sum + row.areaFraction, 0) / available.length
        : null,
      meanIrrelevantAreaFractionOfCrop: irrelevant.length
        ? irrelevant.reduce((sum, row) => sum + row.irrelevantAreaFractionOfCrop, 0) /
          irrelevant.length
        : null,
      exactReadings: reads.filter((row) => row.exactReading).length,
      scoredReadings: reads.length,
      validCheckDigits: own.filter((row) => row.reading?.checkDigit).length,
      clippedCharacterCrops: own.filter((row) => row.characterExtentClippedEdges?.length).length,
    })
  }
const accounting = (kinds, strategy) => {
  const own = runs.filter((run) => kinds.includes(run.kind) && (!strategy || run.strategy === strategy))
  const latency = own
    .map((run) => run.latencyMs)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  return {
    requests: own.length,
    successes: own.filter((run) => run.status === 200).length,
    knownReportedCostUsd: own.reduce((sum, run) => sum + (run.reportedCostUsd ?? 0), 0),
    missingCost: own.filter((run) => run.reportedCostUsd === null).length,
    inputTokens: own.reduce(
      (sum, run) => sum + (run.usage?.input_tokens ?? run.usage?.prompt_tokens ?? 0),
      0,
    ),
    outputTokens: own.reduce(
      (sum, run) => sum + (run.usage?.output_tokens ?? run.usage?.completion_tokens ?? 0),
      0,
    ),
    summedLatencyMs: latency.reduce((a, b) => a + b, 0),
    medianLatencyMs: latency.length ? latency[Math.floor(latency.length / 2)] : null,
    minLatencyMs: latency[0] ?? null,
    maxLatencyMs: latency.at(-1) ?? null,
  }
}
const summary = {
  mode: manifest.mode,
  labelProvenance: labels.provenance,
  accounting: {
    all: accounting(['regions', 'native', 'id', 'iso', 'weights', 'seal']),
    regions: accounting(['regions']),
    native: accounting(['native']),
    reads: accounting(['id', 'iso', 'weights', 'seal']),
  },
  strategyReadAccounting: Object.fromEntries(['regions', 'native', 'padded', 'hybrid'].map(strategy => [strategy, accounting(['id', 'iso', 'weights', 'seal'], strategy)])),
  resolvedModels: [...new Set(runs.map((run) => run.resolvedModel))],
  groups,
  rows,
}
await writeFile(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
})
try {
  const page = await browser.newPage()
  for (const photo of manifest.photos) {
    const data = await readFile(resolve(input, photo.preparedFile))
    const own = rows.filter((row) => row.photo === photo.photo && row.repeat === 1)
    const result = await page.evaluate(
      async ({ base64, rows, labels }) => {
        const img = new Image()
        img.src = `data:image/jpeg;base64,${base64}`
        await img.decode()
        const cellWidth = 300,
          cellHeight = 360
        const canvas = document.createElement('canvas')
        canvas.width = cellWidth * 4
        canvas.height = cellHeight * 6
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i],
            x = (i % 4) * cellWidth,
            y = Math.floor(i / 4) * cellHeight
          const scale = Math.min(290 / img.width, 300 / img.height),
            w = img.width * scale,
            h = img.height * scale
          ctx.drawImage(img, x, y + 55, w, h)
          ctx.fillStyle = 'black'
          ctx.font = '12px monospace'
          ctx.fillText(`${row.kind} ${row.strategy}`, x + 3, y + 15)
          ctx.fillText(
            row.unavailable
              ? 'unavailable'
              : `coverage ${row.provisionalCoverage?.toFixed(3) ?? 'unlabelled'} exact ${row.exactReading}`,
            x + 3,
            y + 32,
          )
          for (const [box, color] of [
            [labels[row.kind], 'blue'],
            [row.actualBox, 'red'],
          ])
            if (box) {
              ctx.strokeStyle = color
              ctx.lineWidth = 2
              ctx.strokeRect(
                x + box[0] * w,
                y + 55 + box[1] * h,
                (box[2] - box[0]) * w,
                (box[3] - box[1]) * h,
              )
            }
        }
        return canvas.toDataURL('image/png')
      },
      { base64: data.toString('base64'), rows: own, labels: labels.photos[photo.photo] },
    )
    await writeFile(
      resolve(output, `${photo.photo}.png`),
      Buffer.from(result.split(',')[1], 'base64'),
    )
  }
} finally {
  await browser.close()
}
console.log(JSON.stringify({ output, accounting: summary.accounting, groups }))
