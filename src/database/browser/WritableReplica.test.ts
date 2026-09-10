import {expect, test} from 'bun:test'
import {IDBFactory} from 'fake-indexeddb'
import pLimit from 'p-limit'
import {expose, wrap} from 'comlink'
import {Entry} from '#/core/Entry.js'
import {Permission} from '#/core/Role.js'
import {mutationContextHeader, transactionIdHeader} from '#/core/Connection.js'
import {decodeMutationContext} from '#/core/db/MutationContext.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {Operation} from '#/core/db/Operation.js'
import {IndexEvent, type IndexOp} from '#/core/db/IndexEvent.js'
import {ActivityEvent, type Activity} from '#/core/db/ActivityEvent.js'
import {
  config,
  entry,
  Page,
  replicaIdentity as identity
} from '#test/sqlite-browser/config.js'
import {entryIndexRow} from '../entry/Schema.js'
import {
  WritableReplica,
  type WritableReplicaOptions
} from './WritableReplica.js'
import {QueryWorker} from './QueryWorker.js'
import {WorkerGraph} from './WorkerGraph.js'
import {ReplicaGraph} from '#/dashboard/boot/ReplicaGraph.js'

async function fixture() {
  let revision = 'base'
  let title = 'Before'
  let writes = 0
  let submissions = 0
  let indexFailure = false
  let loseResponse = false
  const contexts: Array<ReturnType<typeof decodeMutationContext>> = []
  const receipts = new Map<string, string>()
  const serial = pLimit(1)
  const options: WritableReplicaOptions = {
    config,
    expected: identity,
    url: 'https://cms.test/api',
    indexedDB: new IDBFactory(),
    lock: (_name, run, signal) =>
      serial(() => {
        signal.throwIfAborted()
        return run()
      }),
    async fetch(url, init) {
      const action = new URL(url).searchParams.get('action')
      if (action === 'replicaReferences')
        return Response.json({
          identity,
          revision,
          references: [],
          total: 0,
          scan: {scanned: 1, total: 1, complete: true}
        })
      if (action === 'mutate') {
        submissions++
        const headers = new Headers(init.headers)
        const id = headers.get(transactionIdHeader)!
        const expected = decodeMutationContext(
          headers.get(mutationContextHeader)
        )
        contexts.push(expected)
        if (!receipts.has(id)) {
          if (expected?.baseRevision !== revision)
            return Response.json({error: 'Stale base'}, {status: 409})
          writes++
          title = 'After'
          revision = 'accepted'
          receipts.set(id, revision)
        }
        if (loseResponse) {
          loseResponse = false
          throw new Error('Lost response')
        }
        return Response.json({sha: receipts.get(id)})
      }
      const {versionId, ...indexed} = entryIndexRow(entry('a', title))
      if (action === 'replicaIndex') {
        if (indexFailure) throw new Error('Index offline')
        return Response.json({
          version: 1,
          identity,
          revision,
          permissions: Permission.All,
          scopePolicy: {root: Permission.All, entries: []},
          entries: [
            {
              entry: indexed,
              permissions: Permission.All,
              payloadId: revision
            }
          ]
        })
      }
      if (action === 'replicaPayloads') {
        return new Response(
          [
            JSON.stringify({version: 1, identity, revision}),
            `${JSON.stringify(versionId)}\t${JSON.stringify(revision)}\t${JSON.stringify({title})}\tnull`
          ].join('\n') + '\n',
          {headers: {'content-type': 'application/x-alinea-payloads'}}
        )
      }
      throw new Error(`Unexpected action ${action}`)
    }
  }
  return {
    options,
    contexts,
    get writes() {
      return writes
    },
    get submissions() {
      return submissions
    },
    offline(value: boolean) {
      indexFailure = value
    },
    loseResponse() {
      loseResponse = true
    },
    advance() {
      revision = 'external'
    }
  }
}

const mutations: Array<Mutation> = [
  {
    op: 'update',
    id: 'a',
    locale: null,
    status: 'published',
    set: {title: 'After'}
  }
]

test('writable SQL Graph waits for ready live results and retains compiled permissions', async () => {
  const source = await fixture()
  const graph = await WritableReplica.connect(source.options)
  const values: Array<unknown> = []
  const initial = Promise.withResolvers<void>()
  const stop = graph.subscribe(
    {select: Page.title},
    {
      next(value) {
        values.push(value)
        initial.resolve()
      },
      error(error) {
        throw error
      }
    }
  )
  try {
    await initial.promise
    const context = graph.mutationContext()
    const result = await graph.mutate(mutations, context)
    expect(result.sha).toBe('accepted')
    expect(values).toEqual([['Before'], ['After']])
    expect(await graph.find({select: Page.title})).toEqual(['After'])
    expect(await graph.pendingMutations()).toEqual([])
    expect(source.contexts).toEqual([context])
    expect(await graph.compiledPolicy()).toBeDefined()
  } finally {
    stop()
    await graph.close(true)
  }
})

test('writable Graph recovers a lost response after restart without another authority write', async () => {
  const source = await fixture()
  const graph = await WritableReplica.connect(source.options)
  source.loseResponse()
  await expect(graph.mutate(mutations)).rejects.toThrow('Lost response')
  expect(await graph.pendingMutations()).toHaveLength(1)
  await graph.close()
  const reopened = await WritableReplica.connect(source.options)
  expect(source.submissions).toBe(1)
  expect((await reopened.activities())[0].status).toBe('blocked')
  await expect(reopened.mutate(mutations)).rejects.toThrow('pending edits')
  expect(source.submissions).toBe(1)
  await reopened.retryActivity()
  expect(source.submissions).toBe(2)
  expect(source.writes).toBe(1)
  expect((await reopened.activities())[0].status).toBe('succeeded')
  expect(source.contexts[0]).toEqual(source.contexts[1])
  expect(await reopened.find({select: Entry.title})).toEqual(['After'])
  await reopened.close(true)
})

test('accepted refresh failure keeps the edit durable and retries without HTTP submission', async () => {
  const source = await fixture()
  const graph = await WritableReplica.connect(source.options)
  source.offline(true)
  await expect(graph.mutate(mutations)).rejects.toThrow('Index offline')
  expect((await graph.pendingMutations())[0].acceptedSha).toBe('accepted')
  source.offline(false)
  await graph.retryMutations()
  expect(source.submissions).toBe(1)
  expect(graph.bootstrap.revision).toBe('accepted')
  await graph.close(true)
})

test('captured structural context is not silently replaced by a newer browser revision', async () => {
  const source = await fixture()
  const graph = await WritableReplica.connect(source.options)
  const authored = graph.mutationContext()
  source.advance()
  await graph.refresh()
  await expect(graph.mutate(mutations, authored)).rejects.toThrow('Stale base')
  expect(source.contexts[0]).toEqual(authored)
  expect(source.writes).toBe(0)
  await graph.close(true)
})

test('Graph commit captures context before asynchronous operation preparation', async () => {
  const source = await fixture()
  const graph = await WritableReplica.connect(source.options)
  const operation = new Operation(async () => {
    source.advance()
    await graph.refresh()
    return mutations
  })
  await expect(graph.commit(operation)).rejects.toThrow('Stale base')
  expect(source.contexts[0]?.baseRevision).toBe('base')
  expect(source.writes).toBe(0)
  await graph.close(true)
})

test('owned query worker exposes writable recovery and purges pending drafts on logout', async () => {
  const source = await fixture()
  const worker = await QueryWorker.connectWritable(source.options)
  source.loseResponse()
  await expect(
    worker.mutate(mutations, worker.mutationContext())
  ).rejects.toThrow('Lost response')
  expect(await worker.pendingMutations()).toHaveLength(1)
  await worker.close(true)
  await expect(worker.retryMutations()).rejects.toThrow('closed')
  const reopened = await WritableReplica.connect(source.options)
  expect(await reopened.pendingMutations()).toEqual([])
  await reopened.close(true)
})

test('authenticated dashboard ownership gates real SQLite startup and purges pending edits on logout', async () => {
  const source = await fixture()
  let opens = 0
  const graph = new ReplicaGraph({
    config,
    pollInterval: 0,
    connect(principal, signal) {
      opens++
      return WritableReplica.connect({
        ...source.options,
        expected: {...identity, principal},
        signal
      })
    }
  })
  expect(opens).toBe(0)
  await graph.authenticate({sub: identity.principal})
  expect(await graph.find({select: Page.title})).toEqual(['Before'])
  source.loseResponse()
  await expect(graph.mutate(mutations)).rejects.toThrow('Lost response')
  expect((await graph.activities())[0].status).toBe('failed')
  await graph.disconnect(true)
  await expect(graph.find({})).rejects.toThrow('not authenticated')
  await graph.authenticate({sub: identity.principal})
  expect(await graph.activities()).toEqual([])
  expect(await graph.find({select: Page.title})).toEqual(['After'])
  expect(source.writes).toBe(1)
  await graph.close(true)
})

test('public writable Graph operations retain query scope across the worker port', async () => {
  const source = await fixture()
  const worker = await QueryWorker.connectWritable(source.options)
  const {port1, port2} = new MessageChannel()
  expose(worker, port1)
  const graph = new WorkerGraph(config, wrap<QueryWorker>(port2))
  const events: Array<IndexOp> = []
  const activities: Array<Array<Activity>> = []
  const finished = Promise.withResolvers<void>()
  graph.events.addEventListener(ActivityEvent.type, event => {
    if (event instanceof ActivityEvent) {
      activities.push(event.activities)
      if (event.activities[0]?.status === 'succeeded') finished.resolve()
    }
  })
  const initial = Promise.withResolvers<void>()
  const updated = Promise.withResolvers<void>()
  graph.events.addEventListener(IndexEvent.type, event => {
    if (!(event instanceof IndexEvent)) return
    events.push(event.data)
    if (event.data.op === 'index') {
      if (event.data.sha === 'base') initial.resolve()
      if (event.data.sha === 'accepted') updated.resolve()
    }
  })
  try {
    await graph.listenIndex()
    await graph.listenActivity()
    await initial.promise
    expect(events).toEqual([{op: 'index', sha: 'base', ids: ['a']}])
    const context = await graph.mutationContext()
    expect(context.baseRevision).toBe('base')
    const result = await graph.update({
      id: 'a',
      type: Page,
      set: {title: 'After'}
    })
    expect(result.title).toBe('After')
    await updated.promise
    await finished.promise
    expect(activities.map(items => items[0].status)).toEqual([
      'pending',
      'running',
      'succeeded'
    ])
    expect(JSON.stringify(activities)).not.toContain('After')
    expect((await graph.activities())[0].status).toBe('succeeded')
    expect(events.at(-1)).toEqual({op: 'index', sha: 'accepted', ids: ['a']})
    expect(await graph.sha).toBe('accepted')
    expect(await graph.find({type: Page, select: Page.title})).toEqual([
      'After'
    ])
    expect(await graph.pendingMutations()).toEqual([])
    expect(source.writes).toBe(1)
    expect(await graph.referencesTo({targetId: 'a'})).toEqual({
      references: [],
      total: 0,
      scan: {scanned: 1, total: 1, complete: true}
    })
  } finally {
    await graph.close(true)
    port1.close()
    port2.close()
  }
  await expect(graph.mutate(mutations)).rejects.toThrow('closed')
})
