import {expect, test} from 'bun:test'
import {expose, wrap} from 'comlink'
import {Entry} from '#/core/Entry.js'
import {config, entry, Page} from '#test/sqlite-browser/config.js'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {EntryRuntime, type LoadedPayload} from '../runtime/EntryRuntime.js'
import {QueryWorker} from './QueryWorker.js'
import {WorkerGraph} from './WorkerGraph.js'

function client(runtime: EntryRuntime) {
  const {port1, port2} = new MessageChannel()
  expose(new QueryWorker(runtime), port1)
  const graph = new WorkerGraph(config, wrap<QueryWorker>(port2))
  return {
    graph,
    async close() {
      await graph.close()
      port1.close()
      port2.close()
    }
  }
}

test('separate query ports preserve Graph scope and close subscriptions independently', async () => {
  const db = await wasmDatabase()
  await EntryRuntime.createSchema(db, 'empty')
  const runtime = new EntryRuntime(config, db)
  const a = client(runtime)
  const b = client(runtime)
  try {
    await runtime.apply({
      fromRevision: 'empty',
      toRevision: 'r1',
      entries: [
        {entry: entry('a'), payloadId: 'a', data: {title: 'Field title'}}
      ]
    })
    expect(await a.graph.find({type: Page, select: Page.title})).toEqual([
      'Field title'
    ])
    const first = Promise.withResolvers<unknown>()
    let deliveries = 0
    const stop = await a.graph.subscribe(
      {select: Entry.title},
      {
        next(value) {
          deliveries++
          first.resolve(value)
        },
        error(error) {
          first.reject(error)
        }
      }
    )
    expect(await first.promise).toEqual(['a'])
    await a.graph.close()
    await runtime.apply({
      fromRevision: 'r1',
      toRevision: 'r2',
      entries: [{entry: entry('a', 'Updated'), payloadId: 'a'}]
    })
    expect(await b.graph.find({select: Entry.title})).toEqual(['Updated'])
    expect(deliveries).toBe(1)
    await stop()
    await expect(a.graph.find({select: Entry.id})).rejects.toThrow('closed')
    await expect(
      a.graph.subscribe({}, {next() {}, error() {}})
    ).rejects.toThrow('closed')
  } finally {
    await a.close()
    await b.close()
    db.close()
  }
})

test('closing a worker graph rejects a pending hydration query without waiting for its payload', async () => {
  const db = await wasmDatabase()
  await EntryRuntime.createSchema(db, 'empty')
  const loading = Promise.withResolvers<void>()
  const payload = Promise.withResolvers<Array<LoadedPayload>>()
  const runtime = new EntryRuntime(config, db, {
    load() {
      loading.resolve()
      return payload.promise
    }
  })
  const connection = client(runtime)
  try {
    await runtime.apply({
      fromRevision: 'empty',
      toRevision: 'r1',
      entries: [{entry: entry('a'), payloadId: 'a'}]
    })
    const query = connection.graph.find({select: Page.title})
    const outcome = query.then(
      () => undefined,
      error => error
    )
    await loading.promise
    await connection.graph.close()
    expect(await outcome).toMatchObject({message: 'Worker graph is closed'})
  } finally {
    // An invalid response completes the abandoned runtime read without writes.
    payload.resolve([])
    await connection.close()
    await runtime.getRevision()
    db.close()
  }
})

test('owned query ports await cleanup and forward logout purge before release', async () => {
  const db = await wasmDatabase()
  await EntryRuntime.createSchema(db, 'empty')
  const started = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  const purges: Array<boolean> = []
  const runtime = Object.assign(new EntryRuntime(config, db), {
    async close(purge = false) {
      purges.push(purge)
      started.resolve()
      await resume.promise
      await db.close()
    }
  })
  const {port1, port2} = new MessageChannel()
  expose(new QueryWorker(runtime, {owned: true}), port1)
  const graph = new WorkerGraph(config, wrap<QueryWorker>(port2))
  try {
    const closing = graph.close(true)
    await started.promise
    let complete = false
    const repeated = graph.close().then(() => {
      complete = true
    })
    await Promise.resolve()
    expect(complete).toBe(false)
    await expect(graph.refresh()).rejects.toThrow('closed')
    await expect(graph.bootstrap()).rejects.toThrow('closed')
    resume.resolve()
    await closing
    await repeated
    expect(purges).toEqual([true])
  } finally {
    resume.resolve()
    await graph.close()
    port1.close()
    port2.close()
  }
})
