import {expect, test} from 'bun:test'
import {expose, proxy, wrap} from 'comlink'
import {Client} from '#/core/Client.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {QueryWorker} from '#/database/browser/QueryWorker.js'
import {config, replicaIdentity} from '#test/sqlite-browser/config.js'
import type {ReplicaWorkerHost} from './ReplicaWorkerHost.js'
import {OwnedWorkerGraph} from './ConnectReplicaWorker.js'

class Script extends EventTarget {
  terminated = false
  terminate() {
    this.terminated = true
  }
}

function fixture() {
  const query = Promise.withResolvers<unknown>()
  const started = Promise.withResolvers<void>()
  const closed = Promise.withResolvers<void>()
  const script = new Script()
  const {port1, port2} = new MessageChannel()
  const host = new MessageChannel()
  let hostCalls = 0
  let purges = 0
  expose(
    {
      resolve() {
        started.resolve()
        return query.promise
      },
      subscribe() {
        return proxy(async () => {})
      },
      close() {
        return closed.promise
      }
    },
    port1
  )
  expose(
    {
      close() {
        hostCalls++
      }
    },
    host.port1
  )
  const graph = new OwnedWorkerGraph(
    {
      config,
      local: true,
      revision: 'config',
      views: {},
      handlerUrl: 'https://cms.test/api',
      replica: replicaIdentity,
      client: new Client({config, url: 'https://cms.test/api'})
    },
    wrap<QueryWorker>(port2),
    wrap<ReplicaWorkerHost>(host.port2),
    script as unknown as Worker,
    async () => {
      purges++
    },
    20
  )
  return {
    graph,
    script,
    query,
    started,
    closed,
    get purges() {
      return purges
    },
    get hostCalls() {
      return hostCalls
    },
    dispose() {
      query.resolve([])
      closed.resolve()
      port1.close()
      port2.close()
      host.port1.close()
      host.port2.close()
    }
  }
}

test('worker crash rejects in-flight Graph calls, invalidates live queries and permits local logout cleanup', async () => {
  const f = fixture()
  try {
    const errors: Array<unknown> = []
    const invalidated: Array<unknown> = []
    f.graph.events.addEventListener(IndexEvent.type, event => {
      if (event instanceof IndexEvent) invalidated.push(event.data)
    })
    const stop = await f.graph.subscribe(
      {},
      {
        next() {},
        error(error) {
          errors.push(error)
        }
      }
    )
    const pending = f.graph.find({}).catch(error => error)
    await f.started.promise
    f.script.dispatchEvent(new ErrorEvent('error', {message: 'Worker crashed'}))
    expect(await pending).toMatchObject({message: 'Worker crashed'})
    expect(errors).toMatchObject([{message: 'Worker crashed'}])
    expect(invalidated).toMatchObject([
      {op: 'invalidate', error: {message: 'Worker crashed'}}
    ])
    expect(f.script.terminated).toBe(true)
    await expect(f.graph.find({})).rejects.toThrow('Worker crashed')
    await stop()
    await f.graph.close(true)
    expect(f.purges).toBe(1)
    expect(f.hostCalls).toBe(0)
  } finally {
    f.dispose()
  }
})

test('unresponsive worker shutdown is bounded and still performs logout purge', async () => {
  const f = fixture()
  try {
    await expect(f.graph.close(true)).rejects.toThrow('cleanup timed out')
    expect(f.script.terminated).toBe(true)
    expect(f.purges).toBe(1)
    await expect(f.graph.find({})).rejects.toThrow('cleanup timed out')
  } finally {
    f.dispose()
  }
})

test('ordinary worker shutdown retains drafts', async () => {
  const f = fixture()
  try {
    f.closed.resolve()
    await f.graph.close()
    expect(f.hostCalls).toBe(1)
    expect(f.purges).toBe(0)
    expect(f.script.terminated).toBe(true)
  } finally {
    f.dispose()
  }
})
