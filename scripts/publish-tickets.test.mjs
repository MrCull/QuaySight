// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { prepareBatch, publishBatch } from './publish-tickets.mjs'

const input = () => ({
  repo: 'MrCull/QuaySight', parent: 115, batch: 'test-batch',
  tickets: [
    { key: 'viewer', title: 'Show evidence', body: 'Open the source photograph.', blockedBy: ['evidence'] },
    { key: 'evidence', title: 'Retain evidence', body: 'Keep individual observations.' },
  ],
})

// A remote service that can accept a write and then lose its response.
function server() {
  const issues = []
  const children = []
  const blockers = new Map()
  const writes = []
  let loseResponse = null
  function write(operation, apply) {
    writes.push(operation)
    const result = apply()
    if (loseResponse === operation) {
      loseResponse = null
      throw new Error('Response lost after server accepted write')
    }
    return result
  }
  return {
    issues, children, writes, blockers,
    loseNextResponse: (operation) => { loseResponse = operation },
    listIssues: () => structuredClone(issues),
    createIssue: (body) => write('create', () => {
      const issue = { ...body, id: 1000 + issues.length, number: 200 + issues.length }
      issues.push(issue)
      return structuredClone(issue)
    }),
    getIssue: (number) => structuredClone(number === 115 ? { number } : issues.find((issue) => issue.number === number)),
    listChildren: () => structuredClone(children),
    addChild: (_, issue) => write('parent', () => children.push(structuredClone(issue))),
    listBlockers: (number) => structuredClone(blockers.get(number) ?? []),
    addBlocker: (number, issue) => write('blocker', () => {
      blockers.set(number, [...(blockers.get(number) ?? []), structuredClone(issue)])
    }),
    addLabel: (number) => write('label', () => {
      issues.find((issue) => issue.number === number).labels.push('ready-for-agent')
    }),
  }
}
const quiet = { log: () => {} }

describe('ticket publication through the GitHub service boundary', () => {
  it('publishes in dependency order, uses database IDs for edges, and verifies the result', () => {
    const remote = server()
    const result = publishBatch(input(), remote, quiet)
    expect(result.map(({ key }) => key)).toEqual(['evidence', 'viewer'])
    expect(remote.children.map(({ number }) => number)).toEqual([200, 201])
    expect(remote.blockers.get(201).map(({ id }) => id)).toEqual([1000])
    expect(remote.issues.every((issue) => issue.labels.includes('ready-for-agent'))).toBe(true)
    const writes = remote.writes.length
    publishBatch(input(), remote, { ...quiet, verifyOnly: true })
    publishBatch(input(), remote, quiet)
    expect(remote.writes).toHaveLength(writes)
  })

  for (const operation of ['create', 'parent', 'blocker']) {
    it(`recovers an accepted ${operation} write with a lost response without duplicating it`, () => {
      const remote = server()
      remote.loseNextResponse(operation)
      expect(() => publishBatch(input(), remote, quiet)).toThrow(/Response lost/)
      publishBatch(input(), remote, quiet)
      expect(remote.issues).toHaveLength(2)
      expect(remote.children).toHaveLength(2)
      expect(remote.blockers.get(201)).toHaveLength(1)
      expect(remote.writes.filter((entry) => entry === operation)).toHaveLength(operation === 'blocker' ? 1 : 2)
    })
  }

  it('repairs a missing label but does not overwrite an edited issue or duplicate a closed one', () => {
    const remote = server()
    publishBatch(input(), remote, quiet)
    remote.issues[0].labels = []
    remote.issues[0].state = 'closed'
    publishBatch(input(), remote, quiet)
    expect(remote.issues).toHaveLength(2)
    expect(remote.issues[0].labels).toEqual(['ready-for-agent'])
    remote.issues[1].body += '\nHuman edit'
    const writes = remote.writes.length
    expect(() => publishBatch(input(), remote, quiet)).toThrow(/differs/)
    expect(remote.writes).toHaveLength(writes)
  })

  it('stops on duplicate remote markers before mutating anything', () => {
    const remote = server()
    publishBatch(input(), remote, quiet)
    remote.issues.push({ ...remote.issues[0], number: 999, id: 9999 })
    const writes = remote.writes.length
    expect(() => publishBatch(input(), remote, quiet)).toThrow(/Multiple issues/)
    expect(remote.writes).toHaveLength(writes)
  })

  it('verification mode reports missing relationships without writing', () => {
    const remote = server()
    publishBatch(input(), remote, quiet)
    remote.children.pop()
    const writes = remote.writes.length
    expect(() => publishBatch(input(), remote, { ...quiet, verifyOnly: true })).toThrow(/not linked/)
    expect(remote.writes).toHaveLength(writes)
  })

  it('rejects a secret anywhere in the batch before accessing the service', () => {
    const batch = input()
    batch.tickets[0].body += ['sk', 'or', 'v1', 'A'.repeat(32)].join('-')
    let contacted = false
    expect(() => publishBatch(batch, { listIssues: () => { contacted = true } }, quiet)).toThrow(/key-shaped/)
    expect(contacted).toBe(false)
  })

  it('rejects cycles and missing blockers without service access', () => {
    const batch = input()
    batch.tickets[1].blockedBy = ['viewer']
    expect(() => prepareBatch(batch)).toThrow(/cycle/)
    batch.tickets[1].blockedBy = ['missing']
    expect(() => prepareBatch(batch)).toThrow(/unknown/)
  })

  it('preserves unexpected remote blockers and asks for review', () => {
    const remote = server()
    publishBatch(input(), remote, quiet)
    remote.blockers.set(200, [{ id: 9999, number: 999 }])
    expect(() => publishBatch(input(), remote, quiet)).toThrow(/unexpected blockers/)
    expect(remote.blockers.get(200)).toEqual([{ id: 9999, number: 999 }])
  })
})
