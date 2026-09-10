import {expect, test} from 'bun:test'
import {WritableGraph} from '#/core/db/WritableGraph.js'
import {Policy} from '#/core/Role.js'
import type {GraphQuery, AnyQueryResult} from '#/core/Graph.js'
import {config} from '#test/sqlite-browser/config.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {ReplicaGraph} from './ReplicaGraph.js'

class Session extends WritableGraph {
  config = config
  events = new EventTarget()
  sha = 'ready'
  closed: Array<boolean> = []
  syncs = 0
  synced = Promise.withResolvers<void>()
  resolve<Query extends GraphQuery>(): Promise<AnyQueryResult<Query>> {
    return Promise.resolve([] as AnyQueryResult<Query>)
  }
  async mutate() {
    return {sha: this.sha}
  }
  async prepareUpload(): Promise<never> {
    throw new Error('Not used')
  }
  async sync() {
    this.syncs++
    this.synced.resolve()
    return this.sha
  }
  async compiledPolicy() {
    return Policy.ALLOW_ALL
  }
  subscribe() {
    return () => {}
  }
  async activities() {
    return []
  }
  async retryActivity() {}
  async discardActivity() {}
  async close(purge = false) {
    this.closed.push(purge)
  }
}

test('dashboard replica starts only after authentication and retires the previous principal', async () => {
  const first = new Session()
  const second = new Session()
  const principals: Array<string> = []
  const graph = new ReplicaGraph({
    config,
    pollInterval: 0,
    async connect(principal) {
      principals.push(principal)
      return principal === 'one' ? first : second
    }
  })
  expect(principals).toEqual([])
  expect(await graph.activities()).toEqual([])
  await expect(graph.find({})).rejects.toThrow('not authenticated')
  await Promise.all([
    graph.authenticate({sub: 'one'}),
    graph.authenticate({sub: 'one'})
  ])
  expect(principals).toEqual(['one'])
  expect(await graph.sha).toBe('ready')
  await graph.authenticate({sub: 'two'})
  expect(first.closed).toEqual([true])
  expect(principals).toEqual(['one', 'two'])
  await graph.close()
  expect(second.closed).toEqual([false])
  await expect(graph.authenticate({sub: 'two'})).rejects.toThrow('closed')
})

test('user replacement waits for a late startup to close before opening the next session', async () => {
  const late = new Session()
  const next = new Session()
  const started = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  const calls: Array<string> = []
  const graph = new ReplicaGraph({
    config,
    pollInterval: 0,
    async connect(principal) {
      calls.push(principal)
      if (principal === 'old') {
        started.resolve()
        await resume.promise
        return late
      }
      expect(late.closed).toEqual([true])
      return next
    }
  })
  const old = graph.authenticate({sub: 'old'}).catch(error => error)
  await started.promise
  const changed = graph.authenticate({sub: 'new'})
  expect(calls).toEqual(['old'])
  resume.resolve()
  await changed
  expect(await old).toBeInstanceOf(Error)
  expect(calls).toEqual(['old', 'new'])
  await graph.close(true)
})

test('ordinary shutdown drains startup without purging restored drafts or publishing readiness', async () => {
  const session = new Session()
  const started = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  const graph = new ReplicaGraph({
    config,
    pollInterval: 0,
    async connect() {
      started.resolve()
      await resume.promise
      return session
    }
  })
  let events = 0
  graph.events.addEventListener(IndexEvent.type, () => events++)
  const opening = graph.authenticate({sub: 'user'}).catch(error => error)
  await started.promise
  const closing = graph.close()
  resume.resolve()
  await closing
  expect(await opening).toBeInstanceOf(Error)
  expect(session.closed).toEqual([false])
  expect(events).toBe(0)
})

test('polling begins after authentication and old session events stop at disconnect', async () => {
  const session = new Session()
  const graph = new ReplicaGraph({
    config,
    pollInterval: 1,
    async connect() {
      return session
    }
  })
  const hashes: Array<string> = []
  graph.events.addEventListener(IndexEvent.type, event => {
    if (event instanceof IndexEvent && event.data.op === 'index')
      hashes.push(event.data.sha)
  })
  await graph.authenticate({sub: 'user'})
  await session.synced.promise
  await graph.disconnect(true)
  session.events.dispatchEvent(
    new IndexEvent({op: 'index', sha: 'late', ids: []})
  )
  expect(hashes).toEqual(['ready'])
  expect(session.syncs).toBe(1)
  expect(session.closed).toEqual([true])
  await graph.close()
})
