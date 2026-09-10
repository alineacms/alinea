import {expect, test} from 'bun:test'
import {IDBFactory} from 'fake-indexeddb'
import {Entry} from '#/core/Entry.js'
import {IndexEvent, type IndexOp} from '#/core/db/IndexEvent.js'
import {Permission} from '#/core/Role.js'
import {
  config,
  entry,
  Page,
  replicaIdentity as identity
} from '#test/sqlite-browser/config.js'
import {entryIndexRow} from '../entry/Schema.js'
import {LiveReplica} from './LiveReplica.js'
import {ReplicaCache} from './ReplicaCache.js'
import {ReplicaSession} from './ReplicaSession.js'
import {
  WritableReplica,
  type WritableReplicaOptions
} from './WritableReplica.js'
import {QueryWorker} from './QueryWorker.js'

async function fixture(
  revision: string,
  title: string,
  viewId = identity.viewId
) {
  const binding = {...identity, viewId}
  const {versionId, ...indexed} = entryIndexRow(entry('a', title))
  return {
    bootstrap: {
      version: 1,
      identity: binding,
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
    },
    payload: {
      version: 1,
      identity: binding,
      revision,
      payloads: [{versionId, payloadId: revision, data: {title}}]
    }
  }
}

function payloadResponse(
  batch: Awaited<ReturnType<typeof fixture>>['payload']
) {
  const {payloads, ...header} = batch
  return new Response(
    [
      JSON.stringify(header),
      ...payloads.map(
        row =>
          `${JSON.stringify(row.versionId)}\t${JSON.stringify(row.payloadId)}\t${JSON.stringify(row.data)}\tnull`
      )
    ].join('\n') + '\n',
    {headers: {'content-type': 'application/x-alinea-payloads'}}
  )
}

for (const mode of [
  'live',
  'readonly-worker',
  'writable',
  'writable-worker'
] as const) {
  for (const failed of [false, true]) {
    test(`${mode} change notifications read after an older ${failed ? 'failed' : 'stale'} request and coalesce followups`, async () => {
      const first = await fixture('r1', 'One'),
        next = await fixture('r2', 'Two')
      const started = Promise.withResolvers<void>(),
        resume = Promise.withResolvers<void>()
      let calls = 0
      const options: WritableReplicaOptions = {
        config,
        expected: identity,
        url: 'https://example.com/api',
        indexedDB: new IDBFactory(),
        lock: (_name, run, signal) => {
          signal.throwIfAborted()
          return run()
        },
        async fetch() {
          const call = ++calls
          if (call === 2) {
            started.resolve()
            await resume.promise
            if (failed) throw new Error('Older request failed')
          }
          return Response.json(call > 2 ? next.bootstrap : first.bootstrap)
        }
      }
      const replica = mode.startsWith('writable')
        ? await WritableReplica.connect(options)
        : await LiveReplica.connect(options)
      const worker = mode.endsWith('worker')
        ? new QueryWorker(replica)
        : undefined
      const refresh = () =>
        worker
          ? worker.refresh()
          : replica instanceof LiveReplica
            ? replica.refreshAfterChange()
            : replica.refresh()
      try {
        const earlier = replica.refresh().catch(error => error as Error)
        await started.promise
        const notified = refresh(),
          coalesced = refresh()
        expect(calls).toBe(2)
        expect(replica.bootstrap.revision).toBe('r1')
        resume.resolve()
        if (failed) expect(await earlier).toBeInstanceOf(Error)
        else expect(await earlier).toBe(false)
        expect(await notified).toBe(true)
        expect(await coalesced).toBe(true)
        expect(calls).toBe(3)
        expect(replica.bootstrap.revision).toBe('r2')
        expect(await replica.find({select: Entry.title})).toEqual(['Two'])
      } finally {
        resume.resolve()
        await worker?.close()
        await replica.close()
      }
    })
  }
}

test('post-write refresh waits past an index request started before acceptance', async () => {
  const first = await fixture('r1', 'One')
  const next = await fixture('r2', 'Two')
  const started = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  let calls = 0
  const replica = await LiveReplica.connect({
    config,
    expected: identity,
    url: 'https://example.com/api',
    async fetch() {
      calls++
      if (calls === 2) {
        started.resolve()
        await resume.promise
      }
      return Response.json(calls > 2 ? next.bootstrap : first.bootstrap)
    }
  })
  try {
    const beforeWrite = replica.refresh()
    await started.promise
    const afterWrite = replica.refreshAfterChange()
    resume.resolve()
    expect(await beforeWrite).toBe(false)
    expect(await afterWrite).toBe(true)
    expect(calls).toBe(3)
    expect(replica.bootstrap.revision).toBe('r2')
  } finally {
    await replica.close()
  }
})

test('closing the live replica prevents a late reference response from escaping', async () => {
  const current = await fixture('r1', 'One')
  const started = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  const replica = await LiveReplica.connect({
    config,
    expected: identity,
    url: 'https://example.com/api',
    async fetch(url) {
      if (new URL(url).searchParams.get('action') === 'replicaIndex')
        return Response.json(current.bootstrap)
      started.resolve()
      await resume.promise
      return Response.json({
        identity,
        revision: 'r1',
        total: 0,
        references: [],
        scan: {scanned: 1, total: 1, complete: true}
      })
    }
  })
  const result = replica.referencesTo({targetId: 'a'}).catch(error => error)
  await started.promise
  await replica.close()
  resume.resolve()
  expect(await result).toBeInstanceOf(Error)
})

test('live queries keep the old result until the whole subscribed replacement is ready', async () => {
  let current = await fixture('r1', 'One')
  const next = await fixture('r2', 'Two')
  const started = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  let indexCalls = 0
  const replica = await LiveReplica.connect({
    config,
    expected: identity,
    url: 'https://example.com/api',
    async fetch(url) {
      if (new URL(url).searchParams.get('action') === 'replicaIndex') {
        indexCalls++
        return Response.json(current.bootstrap)
      }
      if (current === next) {
        started.resolve()
        await resume.promise
      }
      return payloadResponse(current.payload)
    }
  })
  const values: Array<unknown> = []
  const indexEvents: Array<IndexOp> = []
  replica.events.addEventListener(IndexEvent.type, event => {
    if (event instanceof IndexEvent) {
      indexEvents.push(event.data)
      if (event.data.op === 'index') expect(values.at(-1)).toEqual(['Two'])
    }
  })
  const first = Promise.withResolvers<void>()
  const stop = replica.subscribe(
    {select: Page.title},
    {
      next(value) {
        values.push(value)
        first.resolve()
      },
      error(error) {
        throw error
      }
    }
  )
  try {
    await first.promise
    current = next
    const refreshing = replica.refresh()
    expect(replica.refresh()).toBe(refreshing)
    await started.promise
    expect(indexEvents).toEqual([])
    expect(values).toEqual([['One']])
    expect(replica.bootstrap.revision).toBe('r1')
    expect(await replica.find({select: Page.title})).toEqual(['One'])
    const late: Array<unknown> = []
    const lateReady = Promise.withResolvers<void>()
    const stopLate = replica.subscribe(
      {select: Entry.title},
      {
        next(value) {
          late.push(value)
          lateReady.resolve()
        },
        error(error) {
          throw error
        }
      }
    )
    await lateReady.promise
    resume.resolve()
    expect(await refreshing).toBe(true)
    expect(indexEvents).toEqual([{op: 'index', sha: 'r2', ids: ['a']}])
    expect(values).toEqual([['One'], ['Two']])
    expect(late).toEqual([['One'], ['Two']])
    expect(replica.bootstrap.revision).toBe('r2')
    expect(await replica.find({select: Page.title})).toEqual(['Two'])
    expect(await replica.refresh()).toBe(false)
    expect(indexCalls).toBe(3)
    expect(values).toHaveLength(2)
    stopLate()
  } finally {
    resume.resolve()
    stop()
    await replica.close()
  }
})

test('index events report only changed/deleted IDs and invalidate same-SHA policy replacements', async () => {
  let current = await fixture('r1', 'One')
  const extra = (id: string) => {
    const {versionId: _, ...indexed} = entryIndexRow(entry(id))
    return {...current.bootstrap.entries[0], entry: indexed, payloadId: id}
  }
  current.bootstrap.entries.push(extra('stable'), extra('deleted'))
  const replica = await LiveReplica.connect({
    config,
    expected: {
      project: identity.project,
      namespace: identity.namespace,
      principal: identity.principal
    },
    url: 'https://cms.test/api',
    async fetch() {
      return Response.json(current.bootstrap)
    }
  })
  const events: Array<IndexOp> = []
  replica.events.addEventListener(IndexEvent.type, event => {
    if (event instanceof IndexEvent) events.push(event.data)
  })
  try {
    const stable = current.bootstrap.entries[1]
    current = await fixture('r2', 'Two')
    current.bootstrap.entries.push(stable)
    await replica.refresh()
    expect(events).toEqual([{op: 'index', sha: 'r2', ids: ['a', 'deleted']}])
    expect(await replica.refresh()).toBe(false)
    expect(events).toHaveLength(1)
    current.bootstrap.identity.viewId = 'new-policy'
    await replica.refresh()
    expect(events[1].op).toBe('invalidate')
    expect(events[2]).toEqual({op: 'index', sha: 'r2', ids: ['a', 'stable']})
  } finally {
    await replica.close()
  }
})

test('policy changes invalidate old results before replacement and logout purges every touched view', async () => {
  let current = await fixture('r1', 'One')
  const restricted = await fixture('r1', 'One', 'restricted')
  restricted.bootstrap.entries = []
  const indexedDB = new IDBFactory()
  const events: Array<unknown> = []
  const first = Promise.withResolvers<void>()
  const replica = await LiveReplica.connect({
    config,
    expected: {
      project: identity.project,
      namespace: identity.namespace,
      principal: identity.principal
    },
    indexedDB,
    url: 'https://example.com/api',
    async fetch(url) {
      return new URL(url).searchParams.get('action') === 'replicaIndex'
        ? Response.json(current.bootstrap)
        : payloadResponse(current.payload)
    }
  })
  replica.subscribe(
    {select: Page.title},
    {
      next(value) {
        events.push(value)
        first.resolve()
      },
      error() {
        events.push('invalidated')
      }
    }
  )
  await first.promise
  current = restricted
  await replica.refresh()
  expect(events).toEqual([['One'], 'invalidated', []])
  expect(await replica.find({select: Entry.id})).toEqual([])
  await replica.close()
  await replica.close(true)
  for (const viewId of [identity.viewId, 'restricted']) {
    const cache = await ReplicaCache.open(indexedDB, {...identity, viewId})
    expect(await cache.snapshot()).toEqual({revision: undefined, entries: []})
    cache.close()
  }
})

test('offline refresh preserves the ready generation but rejected authentication removes it', async () => {
  const data = await fixture('r1', 'One')
  let failure = ''
  const replica = await LiveReplica.connect({
    config,
    expected: identity,
    url: 'https://example.com/api',
    async fetch(url) {
      if (failure === 'offline') throw new Error('offline')
      if (failure === 'auth') return new Response(null, {status: 401})
      return new URL(url).searchParams.get('action') === 'replicaIndex'
        ? Response.json(data.bootstrap)
        : payloadResponse(data.payload)
    }
  })
  try {
    failure = 'offline'
    await expect(replica.refresh()).rejects.toThrow('offline')
    expect(await replica.find({select: Entry.title})).toEqual(['One'])
    failure = 'auth'
    await expect(replica.refresh()).rejects.toThrow('bootstrap request failed')
    await expect(replica.find({select: Entry.title})).rejects.toThrow(
      'not ready'
    )
    failure = ''
    expect(await replica.refresh()).toBe(true)
    expect(await replica.find({select: Entry.title})).toEqual(['One'])
  } finally {
    await replica.close()
  }
})

test('close while a replacement hydrates prevents late publication and notifications', async () => {
  let current = await fixture('r1', 'One')
  const replacement = await fixture('r2', 'Two')
  const started = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  const replica = await LiveReplica.connect({
    config,
    expected: identity,
    url: 'https://example.com/api',
    async fetch(url) {
      if (new URL(url).searchParams.get('action') === 'replicaIndex')
        return Response.json(current.bootstrap)
      if (current === replacement) {
        started.resolve()
        await resume.promise
      }
      return payloadResponse(current.payload)
    }
  })
  const first = Promise.withResolvers<void>()
  const values: Array<unknown> = []
  replica.subscribe(
    {select: Page.title},
    {
      next(value) {
        values.push(value)
        first.resolve()
      },
      error(error) {
        values.push(error)
      }
    }
  )
  await first.promise
  current = replacement
  const refreshing = replica.refresh()
  await started.promise
  const closing = replica.close()
  resume.resolve()
  await expect(refreshing).rejects.toThrow()
  await closing
  expect(values).toEqual([['One']])
  await expect(replica.refresh()).rejects.toThrow('closed')
})

test('a stale old session cannot purge the newer generation sharing its cache identity', async () => {
  const first = await fixture('r1', 'One')
  const second = await fixture('r2', 'Two')
  const indexedDB = new IDBFactory()
  const options = {
    config,
    expected: identity,
    indexedDB,
    url: 'https://example.com/api'
  }
  const old = await ReplicaSession.open({
    ...options,
    bootstrap: first.bootstrap,
    async fetch() {
      return new Response(null, {status: 409})
    }
  })
  const next = await ReplicaSession.open({
    ...options,
    bootstrap: second.bootstrap,
    async fetch() {
      return payloadResponse(second.payload)
    }
  })
  try {
    await expect(old.find({select: Page.title})).rejects.toThrow()
    await old.close()
    expect(await next.find({select: Page.title})).toEqual(['Two'])
    await next.close()
    const cache = await ReplicaCache.open(indexedDB, identity)
    expect((await cache.snapshot()).revision).toBe('r2')
    expect(
      await cache.getPayloads([
        {
          versionId: second.payload.payloads[0].versionId,
          payloadId: 'r2'
        }
      ])
    ).toHaveLength(1)
    cache.close()
  } finally {
    await old.close()
    await next.close(true)
  }
})
