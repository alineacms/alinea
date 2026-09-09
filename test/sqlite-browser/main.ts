import {wrap, releaseProxy} from 'comlink'
import {Entry} from '#/core/Entry.js'
import {WorkerGraph} from '#/database/browser/WorkerGraph.js'
import {config, entry, Page} from './config.js'
import type {api} from './worker.js'

function check(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    )
}

export async function run() {
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
      check(await reopened.loads(), ['a'])
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
