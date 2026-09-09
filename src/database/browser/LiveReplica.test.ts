import {expect, test} from 'bun:test'
import {IDBFactory} from 'fake-indexeddb'
import {Entry} from '#/core/Entry.js'
import {Permission} from '#/core/Role.js'
import {base64} from '#/core/util/Encoding.js'
import {
  config,
  entry,
  Page,
  replicaIdentity as identity
} from '#test/sqlite-browser/config.js'
import {entryIndexRow} from '../entry/Schema.js'
import {createFrameKey, encryptFrame} from '../replica/Frame.js'
import {LiveReplica} from './LiveReplica.js'
import {ReplicaCache} from './ReplicaCache.js'
import {ReplicaSession} from './ReplicaSession.js'

async function fixture(
  revision: string,
  title: string,
  viewId = identity.viewId
) {
  const binding = {...identity, viewId}
  const {versionId, ...indexed} = entryIndexRow(entry('a', title))
  const key = createFrameKey()
  const frame = await encryptFrame(
    {...binding, versionId, payloadId: revision, kind: 'data'},
    new TextEncoder().encode(JSON.stringify({data: {title}})),
    key
  )
  return {
    bootstrap: {
      version: 1,
      identity: binding,
      revision,
      permissions: Permission.All,
      entries: [
        {
          entry: indexed,
          permissions: Permission.All,
          fields: {title: Permission.All},
          payloadId: revision
        }
      ]
    },
    payload: {
      version: 1,
      identity: binding,
      revision,
      frames: [
        {
          descriptor: {
            ...frame.descriptor,
            nonce: base64.stringify(frame.descriptor.nonce)
          },
          key: base64.stringify(key),
          ciphertext: base64.stringify(frame.ciphertext)
        }
      ]
    }
  }
}

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
      return Response.json(current.payload)
    }
  })
  const values: Array<unknown> = []
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
      return Response.json(
        new URL(url).searchParams.get('action') === 'replicaIndex'
          ? current.bootstrap
          : current.payload
      )
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
      return Response.json(
        new URL(url).searchParams.get('action') === 'replicaIndex'
          ? data.bootstrap
          : data.payload
      )
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
      return Response.json(current.payload)
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
      return Response.json(second.payload)
    }
  })
  try {
    await expect(old.find({select: Page.title})).rejects.toThrow()
    await old.close()
    expect(await next.find({select: Page.title})).toEqual(['Two'])
    const cache = await ReplicaCache.open(indexedDB, identity)
    expect((await cache.snapshot()).revision).toBe('r2')
    expect(
      await cache.getFrames([
        {
          versionId: second.payload.frames[0].descriptor.versionId,
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
