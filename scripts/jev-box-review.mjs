// Offline research figure: draw every returned rectangle, including absent-target failures.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const input = resolve(process.argv[2] ?? 'docs/research/evidence/jev-box-baseline-2026-10-30')
const output = resolve(process.argv[3] ?? '.scratch/jev-box-review')
const manifest = JSON.parse(await readFile(resolve(input, 'manifest.json'), 'utf8'))
await mkdir(output, { recursive: true })
const runs = await Promise.all(
  manifest.runs.map(async ({ file }) => JSON.parse(await readFile(resolve(input, file), 'utf8'))),
)
const finite = (value) => typeof value === 'number' && Number.isFinite(value)
const rows = runs.map((run) => {
  const box = run.response?.answers?.target_box
  const edges = box?.box
  const geometryValid =
    edges &&
    ['top', 'bottom', 'left', 'right'].every(
      (key) => finite(edges[key]) && edges[key] >= 0 && edges[key] <= 1,
    ) &&
    edges.top < edges.bottom &&
    edges.left < edges.right
  return {
    id: run.id,
    photo: run.photo,
    variant: run.variant,
    repeat: run.repeat,
    status: run.status,
    presence: run.response?.answers?.target_present?.noul ?? null,
    confidence: box?.confidence ?? null,
    geometryValid: Boolean(geometryValid),
    edges: edges ?? null,
    latencyMs: run.latencyMs,
    reportedCostUsd: run.reportedCostUsd,
    requestedModel: run.requestedModel,
    resolvedModel: run.resolvedModel,
    usage: run.usage,
  }
})
const costs = rows.map((row) => row.reportedCostUsd).filter(finite)
const summary = {
  mode: manifest.mode,
  completedRequests: rows.length,
  successfulRequests: rows.filter((row) => row.status === 200).length,
  knownReportedCostUsd: costs.reduce((sum, cost) => sum + cost, 0),
  missingReportedCostCount: rows.length - costs.length,
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
    const own = rows.filter((row) => row.photo === photo.photo)
    const bytes = await readFile(resolve(input, photo.preparedFile))
    const dataUrl = await page.evaluate(
      async ({ base64, rows }) => {
        const image = new Image()
        image.src = `data:image/jpeg;base64,${base64}`
        await image.decode()
        const width = 400
        const height = 440
        const canvas = document.createElement('canvas')
        canvas.width = width * 3
        canvas.height = height * Math.ceil(rows.length / 3)
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        for (const [index, row] of rows.entries()) {
          const x = (index % 3) * width
          const y = Math.floor(index / 3) * height
          const scale = Math.min((width - 8) / image.width, (height - 60) / image.height)
          const w = image.width * scale
          const h = image.height * scale
          ctx.drawImage(image, x, y + 50, w, h)
          ctx.fillStyle = 'black'
          ctx.font = '14px monospace'
          ctx.fillText(`${row.variant} #${row.repeat}`, x + 4, y + 18)
          ctx.fillText(`presence=${row.presence} box=${row.confidence}`, x + 4, y + 38)
          if (row.geometryValid) {
            ctx.strokeStyle = 'red'
            ctx.lineWidth = 2
            ctx.strokeRect(
              x + row.edges.left * w,
              y + 50 + row.edges.top * h,
              (row.edges.right - row.edges.left) * w,
              (row.edges.bottom - row.edges.top) * h,
            )
          }
        }
        return canvas.toDataURL('image/png')
      },
      { base64: bytes.toString('base64'), rows: own },
    )
    await writeFile(
      resolve(output, `${photo.preparedFile}.png`),
      Buffer.from(dataUrl.split(',')[1], 'base64'),
    )
  }
} finally {
  await browser.close()
}
console.log(
  JSON.stringify({
    output,
    completedRequests: summary.completedRequests,
    knownReportedCostUsd: summary.knownReportedCostUsd,
    missingReportedCostCount: summary.missingReportedCostCount,
  }),
)
