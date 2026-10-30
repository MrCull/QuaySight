#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { findSecretsInText } from './check-secrets.mjs'

const LABEL = 'ready-for-agent'
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/

export function prepareBatch(input) {
  const secrets = findSecretsInText(JSON.stringify(input), 'ticket batch')
  if (secrets.length) throw new Error('Ticket batch contains a key-shaped string; nothing was sent')
  if (!input || !/^[\w.-]+\/[\w.-]+$/.test(input.repo ?? '') || !SLUG.test(input.batch ?? '')) {
    throw new Error('Expected repo owner/name and a stable lowercase batch slug')
  }
  if (input.parent != null && (!Number.isSafeInteger(input.parent) || input.parent < 1)) {
    throw new Error('Parent must be a positive issue number')
  }
  if (!Array.isArray(input.tickets) || !input.tickets.length) throw new Error('Expected at least one ticket')
  const byKey = new Map()
  for (const ticket of input.tickets) {
    if (!SLUG.test(ticket.key ?? '') || byKey.has(ticket.key)) throw new Error('Ticket keys must be unique slugs')
    if (typeof ticket.title !== 'string' || !ticket.title.trim() || /[\r\n]/.test(ticket.title)) {
      throw new Error('Each ticket needs a single-line title')
    }
    if (typeof ticket.body !== 'string' || !ticket.body.trim()) throw new Error('Each ticket needs a Markdown body')
    if (ticket.body.includes('<!-- quay-sight-ticket:')) throw new Error('Ticket markers are managed by the publisher')
    if (ticket.blockedBy != null && (!Array.isArray(ticket.blockedBy) || ticket.blockedBy.some((key) => typeof key !== 'string'))) {
      throw new Error('blockedBy must be an array of ticket keys')
    }
    byKey.set(ticket.key, { ...ticket, blockedBy: [...new Set(ticket.blockedBy ?? [])] })
  }
  const ordered = []
  const visiting = new Set()
  const visited = new Set()
  function visit(key) {
    if (!byKey.has(key)) throw new Error('A blocker references an unknown ticket key')
    if (visiting.has(key)) throw new Error('Ticket dependencies contain a cycle')
    if (visited.has(key)) return
    visiting.add(key)
    const ticket = byKey.get(key)
    ticket.blockedBy.forEach(visit)
    visiting.delete(key)
    visited.add(key)
    const marker = `<!-- quay-sight-ticket:${input.batch}:${key} -->`
    const parent = input.parent ? `## Parent\n\nPart of ${input.repo}#${input.parent}\n\n` : ''
    ordered.push({ ...ticket, marker, body: `${parent}${ticket.body.trim()}\n\n${marker}\n` })
  }
  byKey.forEach((_, key) => visit(key))
  return { repo: input.repo, batch: input.batch, parent: input.parent ?? null, tickets: ordered }
}

function gh(args, input) {
  let output
  try {
    output = execFileSync('gh', args, {
      encoding: 'utf8',
      input: input === undefined ? undefined : JSON.stringify(input),
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    // Do not echo a response or command body: either might contain sensitive content.
    throw new Error('GitHub operation failed. If this was a write, it may have succeeded; rerun the same batch to reconcile. Check host authentication if needed.')
  }
  try {
    return output.trim() ? JSON.parse(output) : null
  } catch {
    throw new Error('GitHub returned an unreadable response; reconcile the same batch before retrying writes')
  }
}

export function github(repo) {
  const endpoint = `repos/${repo}/issues`
  const pages = (path) => gh(['api', '--paginate', '--slurp', path]).flat()
  const post = (path, body) => gh(['api', '--method', 'POST', path, '--input', '-'], body)
  return {
    listIssues: () => pages(`${endpoint}?state=all&per_page=100`).filter((issue) => !issue.pull_request),
    createIssue: (body) => post(endpoint, body),
    getIssue: (number) => gh(['api', `${endpoint}/${number}`]),
    listChildren: (number) => pages(`${endpoint}/${number}/sub_issues?per_page=100`),
    addChild: (parent, issue) => post(`${endpoint}/${parent}/sub_issues`, { sub_issue_id: issue.id }),
    listBlockers: (number) => pages(`${endpoint}/${number}/dependencies/blocked_by?per_page=100`),
    addBlocker: (number, blocker) => post(`${endpoint}/${number}/dependencies/blocked_by`, { issue_id: blocker.id }),
    addLabel: (number) => post(`${endpoint}/${number}/labels`, { labels: [LABEL] }),
  }
}

function normaliseBody(body) {
  return (body ?? '').replace(/\r\n/g, '\n').trim()
}

function matchIssue(issues, ticket) {
  const matches = issues.filter((issue) => normaliseBody(issue.body).split('\n').includes(ticket.marker))
  if (matches.length > 1) throw new Error(`Multiple issues match ticket ${ticket.key}; resolve duplicates before publishing`)
  const issue = matches[0]
  if (issue && (issue.title !== ticket.title || normaliseBody(issue.body) !== normaliseBody(ticket.body))) {
    throw new Error(`Published ticket ${ticket.key} differs from this batch; review the existing issue rather than creating a duplicate`)
  }
  return issue
}

function hasLabel(issue) {
  return issue.labels?.some((label) => (typeof label === 'string' ? label : label.name) === LABEL)
}

export function publishBatch(input, remote, { verifyOnly = false, log = console.log } = {}) {
  // Validation, including the entire batch's secret scan, precedes every network call.
  const batch = prepareBatch(input)
  const issues = remote.listIssues()
  const results = new Map()
  // Detect changed bodies and duplicate markers across the whole batch before any mutation.
  for (const ticket of batch.tickets) results.set(ticket.key, matchIssue(issues, ticket))
  if (batch.parent) remote.getIssue(batch.parent)
  const children = batch.parent ? remote.listChildren(batch.parent) : []
  for (const ticket of batch.tickets) {
    let issue = results.get(ticket.key)
    if (!issue) {
      if (verifyOnly) throw new Error(`Ticket ${ticket.key} has not been published`)
      issue = remote.createIssue({ title: ticket.title, body: ticket.body, labels: [LABEL] })
      if (!issue?.id || !issue.number) throw new Error('Issue creation response lacked identity; rerun to reconcile before creating anything else')
      results.set(ticket.key, issue)
    }
    if (!hasLabel(issue)) {
      if (verifyOnly) throw new Error(`Ticket ${ticket.key} lacks ${LABEL}`)
      remote.addLabel(issue.number)
    }
    if (batch.parent && !children.some((child) => child.id === issue.id)) {
      if (verifyOnly) throw new Error(`Ticket ${ticket.key} is not linked to the parent`)
      remote.addChild(batch.parent, issue)
      children.push(issue)
    }
    const blockers = remote.listBlockers(issue.number)
    const expected = ticket.blockedBy.map((key) => results.get(key))
    if (blockers.some((blocker) => !expected.some((other) => other?.id === blocker.id))) {
      throw new Error(`Ticket ${ticket.key} has unexpected blockers; review them before continuing`)
    }
    for (const blocker of expected) {
      if (!blockers.some((other) => other.id === blocker.id)) {
        if (verifyOnly) throw new Error(`Ticket ${ticket.key} is missing a blocking link`)
        remote.addBlocker(issue.number, blocker)
      }
    }
    // Verify server state rather than trusting local checkpoints or successful write responses.
    const current = remote.getIssue(issue.number)
    if (!matchIssue([current], ticket) || !hasLabel(current)) throw new Error(`Ticket ${ticket.key} failed content/label verification`)
    if (batch.parent && !remote.listChildren(batch.parent).some((child) => child.id === issue.id)) {
      throw new Error(`Ticket ${ticket.key} failed parent verification`)
    }
    const actual = remote.listBlockers(issue.number).map((blocker) => blocker.id).sort()
    const wanted = expected.map((blocker) => blocker.id).sort()
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) throw new Error(`Ticket ${ticket.key} failed dependency verification`)
    log(`${ticket.key}: https://github.com/${batch.repo}/issues/${issue.number} (verified)`)
  }
  return batch.tickets.map((ticket) => ({ key: ticket.key, number: results.get(ticket.key).number }))
}

export function main(args) {
  if (args.includes('--help') || !args.length) {
    console.log('Usage: node scripts/publish-tickets.mjs <batch.json> [--publish | --verify]\nDefault: validate and preview without network access. See docs/agents/ticket-publisher.md.')
    return 0
  }
  if (args.length > 2 || args[0].startsWith('--') || (args[1] && !['--publish', '--verify'].includes(args[1]))) {
    throw new Error('Expected a batch JSON file followed by --publish or --verify')
  }
  const text = readFileSync(args[0], 'utf8').replace(/^\uFEFF/, '')
  if (findSecretsInText(text, 'ticket batch').length) throw new Error('Ticket batch contains a key-shaped string; nothing was sent')
  let input
  try {
    input = JSON.parse(text)
  } catch {
    throw new Error('Ticket batch is not valid JSON')
  }
  const batch = prepareBatch(input)
  if (!args[1]) {
    console.log(`Preview: ${batch.repo}, batch ${batch.batch}, parent ${batch.parent ?? 'none'}`)
    for (const ticket of batch.tickets) {
      console.log(`${ticket.key}: ${ticket.title}\n  Blocked by: ${ticket.blockedBy.join(', ') || 'none'}\n${ticket.body}`)
    }
    return 0
  }
  publishBatch(input, github(batch.repo), { verifyOnly: args[1] === '--verify' })
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    console.error(`publish-tickets: ${error.message}`)
    process.exitCode = 1
  }
}
