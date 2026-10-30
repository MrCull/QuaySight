// Research only: matched region/native/padded/hybrid crops. Keys never enter Chromium.
import { readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const live = args.includes('--live')
const key = live
  ? args.includes('--key-stdin')
    ? readFileSync(0, 'utf8').trim()
    : process.env.OPENROUTER_API_KEY?.trim()
  : ''
if (live && !key) throw new Error('Live mode needs transient OPENROUTER_API_KEY or --key-stdin')
const repeats = Number(option('--repeats', '3'))
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 10) throw new Error('Use 1..10 repeats')
const output = resolve(root, option('--output', `.scratch/markings-${Date.now()}`))
const model = 'typesafe/jev-1.14'
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const scrub = (value) =>
  key ? JSON.parse(JSON.stringify(value).split(key).join('[REDACTED]')) : value
const save = (file, value) =>
  writeFile(resolve(output, file), JSON.stringify(scrub(value), null, 2) + '\n', { flag: 'wx' })
const photos = [
  'rear-door-coyu-22g1.jpg',
  'rear-door-chsu-22g1.jpg',
  'rear-door-aphu-45g1.jpg',
  'jdlu-200690-1-rear-doors.jpg',
  'jdlu-200690-2-corner-doors-left.jpg',
  'jdlu-200690-3-corner-doors-right.jpg',
  'seal-closeup-coyu-0154620.jpg',
]
const descriptions = {
  id: 'the complete printed container identification: all four owner letters, six serial digits and the boxed check digit',
  iso: 'the complete four-character printed ISO size/type code',
  weights:
    'the complete printed weights panel including maximum gross, tare and payload figures and units',
  seal: 'the complete tamper-evident seal device and its printed number',
  hazard:
    'the first actual diamond-shaped dangerous-goods placard, counting from top left; exclude residue or removed labels',
  doorEnd:
    'the complete container door end from corner post to corner post, including both door leaves',
}
const manifest = {
  schemaVersion: 1,
  mode: live ? 'live' : 'dry-run',
  recordedAt: new Date().toISOString(),
  model,
  repeats,
  endpoint: 'https://openrouter.ai/api/alpha/decisions',
  photos: [],
  runs: [],
  crops: [],
  policy:
    'regions: app margin .25; native: margin 0; padded: .35; hybrid: union of region and native then .25. Hybrid is research-only. All crops use app min-side fitting and original upright pixels.',
}
const server = await createServer({
  root,
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 },
})
let browser
try {
  await mkdir(output, { recursive: true })
  await save('manifest.json', manifest)
  await server.listen()
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
  })
  const page = await browser.newPage()
  await page.goto(server.resolvedUrls.local[0])
  // Use the production public image, question translation and reading boundaries.
  const bridge = (payload) =>
    page.evaluate(
      async (payload) => {
        const q = await import('/src/domain/questionSet.ts')
        const r = await import('/src/domain/regionMarks.ts')
        const ids = await import('/src/domain/idQuestions.ts')
        const weights = await import('/src/domain/weightQuestions.ts')
        const seal = await import('/src/domain/sealFamily.ts')
        const details = await import('/src/domain/containerDetailQuestions.ts')
        const limits = (await import('/src/domain/providers.ts')).findModel(
          'openrouter',
          payload.model,
        ).photoLimits
        const scale = await import('/src/services/scalePhoto.ts')
        const blob = async (url) => (await fetch(url)).blob()
        const url = (b) =>
          new Promise((done) => {
            const reader = new FileReader()
            reader.onload = () => done(reader.result)
            reader.readAsDataURL(b)
          })
        const setFor = (kind) =>
          kind === 'regions'
            ? r.regionsQuestionSet()
            : kind === 'id'
              ? ids.jevIdQuestionSet({ image: 'the photo', box: false, owner: false })
              : q.questionSet(
                  'Read only the visible printed markings in this photograph. Never infer hidden characters.',
                  kind === 'weights'
                    ? weights.weightQuestions(['maxGross', 'tare', 'payload'], { box: false })
                    : kind === 'seal'
                      ? seal.sealQuestions({ box: false })
                      : [details.containerDetailQuestions()[0]],
                )
        if (payload.op === 'prepare') {
          const original = await blob(payload.dataUrl)
          const decoded = await (await import('/src/services/imageCodec.ts')).decodePhoto(original)
          const size = { width: decoded.width, height: decoded.height }
          decoded.close()
          const prepared = await (
            await import('/src/services/preparePhoto.ts')
          ).preparePhoto(original, limits, payload.model)
          const sent = await (await import('/src/services/imageCodec.ts')).decodePhoto(prepared)
          const sentSize = { width: sent.width, height: sent.height }
          sent.close()
          return {
            size,
            sentSize,
            dataUrl: await url(prepared),
            markedUrl: await url(await scale.markPhoto(prepared)),
          }
        }
        if (payload.op === 'request')
          return q.toWireRequest('openrouter-decisions', setFor(payload.kind), {
            model: payload.model,
            imageDataUrl: payload.dataUrl,
          })
        if (payload.op === 'read') {
          const answers = q.readAnswers(
            'openrouter-decisions',
            payload.raw,
            setFor(payload.kind),
            payload.model,
          ).answers
          if (payload.kind === 'regions') return r.readRegions(answers)
          if (payload.kind === 'id') {
            const value = ids
              .readIdCharacters(answers)
              .map((c) => c.value ?? '?')
              .join('')
            return {
              value,
              checkDigit: (await import('/src/domain/iso6346.ts')).checkDigitMatches(value),
            }
          }
          if (payload.kind === 'weights')
            return weights.readWeights(answers, ['maxGross', 'tare', 'payload'])
          if (payload.kind === 'seal') return seal.readSeal(answers, { box: false })
          return answers
        }
        const cropped = await scale.cropForRead(
          await blob(payload.prepared),
          await blob(payload.original),
          { ...payload.box, confidence: 1 },
          limits,
          payload.margin,
        )
        return { dataUrl: await url(cropped.photo), region: cropped.region }
      },
      { ...payload, model },
    )
  const checkpoint = () =>
    writeFile(resolve(output, 'manifest.json'), JSON.stringify(scrub(manifest), null, 2) + '\n')
  const call = async (id, request, metadata) => {
    let response = null,
      status = null,
      failure = null
    const started = performance.now()
    if (live) {
      try {
        const reply = await fetch(manifest.endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(120000),
        })
        status = reply.status
        const body = await reply.text()
        try {
          response = JSON.parse(body)
        } catch {
          response = { unparsedBody: body }
        }
      } catch {
        failure = 'Transport failed or timed out; no retry, billing unknown'
      }
    }
    const recordedRequest = {
      ...request,
      state: request.state.map((part) =>
        typeof part === 'string' ? part : { imageFile: metadata.imageFile },
      ),
    }
    const run = {
      id,
      ...metadata,
      request: recordedRequest,
      status,
      failure,
      latencyMs: live ? Math.round(performance.now() - started) : null,
      requestedModel: model,
      resolvedModel: response?.model ?? null,
      usage: response?.usage ?? null,
      reportedCostUsd: response?.usage?.cost ?? null,
      response,
    }
    await save(`${id}.json`, run)
    manifest.runs.push({
      id,
      file: `${id}.json`,
      status,
      latencyMs: run.latencyMs,
      reportedCostUsd: run.reportedCostUsd,
    })
    await checkpoint()
    console.log(JSON.stringify({ id, status, reportedCostUsd: run.reportedCostUsd }))
    if (failure || (status !== null && status !== 200))
      throw new Error('Stopped after failed live request; inspect saved credential-free evidence')
    return response
  }
  for (const photo of photos) {
    const bytes = await readFile(resolve(root, 'samples', photo))
    const original = `data:image/jpeg;base64,${bytes.toString('base64')}`
    const prepared = await bridge({ op: 'prepare', dataUrl: original })
    const stem = photo.replace('.jpg', '')
    const writeImage = async (file, dataUrl) => {
      const data = Buffer.from(dataUrl.split(',')[1], 'base64')
      await writeFile(resolve(output, file), data, { flag: 'wx' })
      return sha(data)
    }
    const preparedFile = `${stem}-prepared.jpg`,
      markedFile = `${stem}-marked.jpg`
    const preparedSha256 = await writeImage(preparedFile, prepared.dataUrl)
    await writeImage(markedFile, prepared.markedUrl)
    manifest.photos.push({
      photo,
      sourceSha256: sha(bytes),
      preparedSha256,
      preparedFile,
      markedFile,
      uprightOriginalSize: prepared.size,
      sentSize: prepared.sentSize,
      transform: {
        crop: null,
        scaleX: prepared.sentSize.width / prepared.size.width,
        scaleY: prepared.sentSize.height / prepared.size.height,
      },
    })
    for (let repeat = 1; repeat <= repeats; repeat++) {
      const prefix = `${stem}-${repeat}`
      const regionRequest = await bridge({
        op: 'request',
        kind: 'regions',
        dataUrl: prepared.markedUrl,
      })
      const regionRaw = await call(`${prefix}-regions`, regionRequest, {
        photo,
        repeat,
        kind: 'regions',
        imageFile: markedFile,
      })
      const regions = live ? await bridge({ op: 'read', kind: 'regions', raw: regionRaw }) : {}
      const questions = Object.fromEntries(
        Object.entries(descriptions).flatMap(([kind, description]) => [
          [`${kind}_present`, { type: 'noul', instructions: `Is ${description} visible?` }],
          [
            `${kind}_box`,
            { type: 'box', instructions: `Locate ${description}. Include its entire extent.` },
          ],
        ]),
      )
      const nativeRaw = await call(
        `${prefix}-native`,
        {
          model,
          state: [
            'Inspect only visible freight container markings. Presence and geometry are separate.',
            { type: 'image_url', image_url: { url: prepared.dataUrl } },
          ],
          questions,
        },
        { photo, repeat, kind: 'native', imageFile: preparedFile },
      )
      if (!live) {
        // Exercise every browser branch without money or fabricated live evidence.
        const dryChecks = []
        for (const kind of ['regions', 'id', 'iso', 'weights', 'seal']) {
          const request = await bridge({ op: 'request', kind, dataUrl: prepared.dataUrl })
          const answers = Object.fromEntries(
            Object.entries(request.questions).map(([name, question]) => {
              if (question.type === 'noul') return [name, { type: 'noul', noul: 1 }]
              if (question.type === 'score') return [name, { type: 'score', score: 4 }]
              const choice = name.startsWith('id_char_')
                ? 'COYU2668130'[Number(name.slice(-2)) - 1]
                : name.endsWith('_mark')
                  ? '4'
                  : Object.keys(question.criteria)[0]
              return [name, { type: 'choice', choice, probabilities: { [choice]: 1 } }]
            }),
          )
          const reading = await bridge({
            op: 'read',
            kind,
            raw: { model: 'synthetic-dry-only', answers },
          })
          if (kind === 'id' && (reading.value !== 'COYU2668130' || !reading.checkDigit))
            throw new Error('Synthetic ID bridge failed')
          dryChecks.push({ kind, reading })
        }
        for (const margin of [0, 0.25, 0.35]) {
          const crop = await bridge({
            op: 'crop',
            original,
            prepared: prepared.dataUrl,
            box: { top: 0.1, bottom: 0.2, left: 0.55, right: 0.85 },
            margin,
          })
          if (!(crop.region.width > 0 && crop.region.outWidth > 0))
            throw new Error('Synthetic crop bridge failed')
          dryChecks.push({ margin, region: crop.region })
        }
        await save(`${prefix}-synthetic-dry-checks.json`, dryChecks)
        continue
      }
      for (const kind of Object.keys(descriptions)) {
        const raw = nativeRaw.answers?.[`${kind}_box`]
        const b = raw?.box
        const valid =
          b &&
          ['top', 'bottom', 'left', 'right'].every(
            (edge) => Number.isFinite(b[edge]) && b[edge] >= 0 && b[edge] <= 1,
          ) &&
          b.top < b.bottom &&
          b.left < b.right
        const native =
          valid && raw.confidence >= 0.5 && nativeRaw.answers?.[`${kind}_present`]?.noul >= 0.5
            ? b
            : null
        const region =
          kind === 'hazard'
            ? regions.hazards?.[0]?.box
            : kind === 'doorEnd'
              ? regions.doorEnd
              : regions[kind]?.box
        const union =
          region && native
            ? {
                top: Math.min(region.top, native.top),
                bottom: Math.max(region.bottom, native.bottom),
                left: Math.min(region.left, native.left),
                right: Math.max(region.right, native.right),
              }
            : (region ?? native)
        for (const [strategy, box, margin] of [
          ['regions', region, 0.25],
          ['native', native, 0],
          ['padded', native, 0.35],
          ['hybrid', union, 0.25],
        ]) {
          const id = `${prefix}-${kind}-${strategy}`
          if (!box) {
            manifest.crops.push({ id, photo, repeat, kind, strategy, unavailable: true })
            await checkpoint()
            continue
          }
          let crop
          try {
            crop = await bridge({ op: 'crop', original, prepared: prepared.dataUrl, box, margin })
          } catch {
            manifest.crops.push({
              id,
              photo,
              repeat,
              kind,
              strategy,
              box,
              margin,
              unavailable: true,
              failure: 'Image crop/preparation rejected geometry; no read request sent',
            })
            await checkpoint()
            continue
          }
          const imageFile = `${id}.jpg`
          const imageSha256 = await writeImage(imageFile, crop.dataUrl)
          const row = {
            id,
            photo,
            repeat,
            kind,
            strategy,
            box,
            margin,
            region: crop.region,
            imageFile,
            imageSha256,
            areaFraction:
              (crop.region.width * crop.region.height) /
              (prepared.size.width * prepared.size.height),
          }
          manifest.crops.push(row)
          await checkpoint()
          if (['hazard', 'doorEnd'].includes(kind)) continue
          const request = await bridge({ op: 'request', kind, dataUrl: crop.dataUrl })
          const response = await call(id, request, { photo, repeat, kind, strategy, imageFile })
          row.reading = await bridge({ op: 'read', kind, raw: response })
          await checkpoint()
        }
      }
    }
  }
  console.log(JSON.stringify({ output, requests: manifest.runs.length, mode: manifest.mode }))
} finally {
  await browser?.close()
  await server.close()
}
