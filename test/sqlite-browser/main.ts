import {wrap, releaseProxy} from 'comlink'
import {Entry} from '#/core/Entry.js'
import {WorkerGraph} from '#/database/browser/WorkerGraph.js'
import {
  createFrameKey,
  encryptFrame,
  decryptFrame
} from '#/database/replica/Frame.js'
import {config, entry, Page} from './config.js'
import type {api} from './worker.js'
import type {api as ownedApi} from './owned-worker.js'
import {ReplicaCache} from '#/database/browser/ReplicaCache.js'

export async function runOwned() {
  const worker = new Worker(new URL('./owned-worker.js', import.meta.url), {
    type: 'module'
  })
  const remote = wrap<typeof ownedApi>(worker)
  let graph: WorkerGraph | undefined
  try {
    graph = new WorkerGraph(config, await remote.queries())
    const bootstrap = await graph.bootstrap()
    const policy = await graph.compiledPolicy()
    check(policy.canRead({id: 'a'}), true)
    check(policy.canRead({id: 'hidden'}), false)
    check(policy.canCreate({type: 'Page'}), true)
    check(await graph.find({select: Entry.id}), ['a', 'b'])
    check(await graph.find({id: 'a', select: Page.title}), ['Payload a'])
    const values: Array<unknown> = []
    const initial = Promise.withResolvers<void>()
    const changed = Promise.withResolvers<void>()
    const stop = await graph.subscribe(
      {select: Entry.title},
      {
        next(value) {
          values.push(value)
          if (values.length === 1) initial.resolve()
          else changed.resolve()
        },
        error(error) {
          initial.reject(error)
          changed.reject(error)
        }
      }
    )
    await initial.promise
    const advance = await fetch('/advance', {
      method: 'POST',
      headers: {authorization: 'Bearer fixture'}
    })
    check(advance.status, 204)
    check(await graph.refresh(), true)
    await changed.promise
    check(values, [
      ['a', 'b'],
      ['Updated a', 'b']
    ])
    check(await graph.find({id: 'a', select: Page.title}), ['Payload a'])
    check((await graph.bootstrap()).revision, 'r2')
    await stop()
    await graph.close(true)
    const cache = await ReplicaCache.open(indexedDB, bootstrap.identity)
    check(await cache.snapshot(), {revision: undefined, entries: []})
    cache.close()
    return {deliveries: values.length, closed: true}
  } finally {
    await graph?.close()
    remote[releaseProxy]()
    worker.terminate()
  }
}

function check(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    )
}

export async function run() {
  const frameIdentity = {
    project: 'test',
    namespace: 'main',
    epoch: 'epoch',
    schemaId: 'schema',
    configId: 'config',
    releaseId: 'release',
    versionId: 'a',
    payloadId: 'payload',
    kind: 'data' as const
  }
  const key = createFrameKey()
  const bytes = new TextEncoder().encode('Encrypted browser payload')
  const encrypted = await encryptFrame(frameIdentity, bytes, key)
  const decoded = await decryptFrame(
    frameIdentity,
    encrypted.descriptor,
    encrypted.ciphertext,
    key
  )
  check(new TextDecoder().decode(decoded), 'Encrypted browser payload')
  encrypted.ciphertext[0] ^= 1
  let rejected = false
  try {
    await decryptFrame(
      frameIdentity,
      encrypted.descriptor,
      encrypted.ciphertext,
      key
    )
  } catch {
    rejected = true
  }
  check(rejected, true)
  const worker = new Worker(new URL('./worker.js', import.meta.url), {
    type: 'module'
  })
  const remote = wrap<typeof api>(worker)
  let running = true
  function terminate() {
    if (!running) return
    running = false
    remote[releaseProxy]()
    worker.terminate()
  }
  worker.addEventListener('error', event =>
    console.error('Worker failed:', event.message)
  )
  try {
    const graph = new WorkerGraph(config, await remote.queries())
    await remote.install({
      fromRevision: 'empty',
      toRevision: 'r1',
      entries: [
        {entry: entry('a'), payloadId: 'a'},
        {entry: entry('b'), payloadId: 'b'}
      ]
    })
    check(await graph.find({type: Page, select: Entry.id, take: 1}), ['a'])
    check(await remote.loads(), [])
    check(await graph.find({type: Page, select: Page.title, take: 1}), [
      'Payload a'
    ])
    check(await remote.loads(), ['a'])
    check(await graph.find({type: Page, select: Page.title, take: 1}), [
      'Payload a'
    ])
    check(await remote.loads(), ['a'])

    const initial = Promise.withResolvers<unknown>()
    const changed = Promise.withResolvers<unknown>()
    let deliveries = 0
    const stop = await graph.subscribe(
      {id: 'a', select: Entry.title},
      {
        next(value) {
          if (++deliveries === 1) initial.resolve(value)
          else changed.resolve(value)
        },
        error(error) {
          initial.reject(error)
          changed.reject(error)
        }
      }
    )
    check(await initial.promise, ['a'])
    await remote.install({
      fromRevision: 'r1',
      toRevision: 'r2',
      entries: [{entry: entry('a', 'Edited'), payloadId: 'a'}]
    })
    check(await changed.promise, ['Edited'])
    await stop()
    await stop()
    await remote.install({
      fromRevision: 'r2',
      toRevision: 'r3',
      entries: [{entry: entry('a', 'Unsubscribed'), payloadId: 'a'}]
    })
    check(await graph.find({id: 'a', select: Entry.title}), ['Unsubscribed'])
    check(deliveries, 2)
    const error = Promise.withResolvers<unknown>()
    const stopError = await graph.subscribe(
      {id: 'missing', get: true, select: Entry.id},
      {
        next() {
          error.reject(new Error('Missing-entry get unexpectedly succeeded'))
        },
        error(value) {
          error.resolve(value)
        }
      }
    )
    const failure = await error.promise
    if (!(failure instanceof Error))
      throw new Error('Worker error did not survive serialization')
    await stopError()
    await graph.close()
    let closed = false
    try {
      await graph.find({select: Entry.id})
    } catch {
      closed = true
    }
    check(closed, true)
    const loads = await remote.loads()
    terminate()
    const reloaded = new Worker(new URL('./worker.js', import.meta.url), {
      type: 'module'
    })
    const reopened = wrap<typeof api>(reloaded)
    try {
      const restored = new WorkerGraph(config, await reopened.queries())
      check(await restored.find({id: 'a', select: Entry.title}), [
        'Unsubscribed'
      ])
      check(await reopened.loads(), [])
      check(await restored.find({id: 'a', select: Page.title}), ['Payload a'])
      check(await reopened.loads(), [])
      await restored.close()
    } finally {
      reopened[releaseProxy]()
      reloaded.terminate()
    }
    return {loads, deliveries, closed}
  } finally {
    terminate()
  }
}
