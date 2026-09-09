import {expose, proxy} from 'comlink'
import {wasmDatabase} from '#/database/driver/WasmDatabase.js'
import {EntryRuntime, type EntryDelta} from '#/database/runtime/EntryRuntime.js'
import {QueryWorker} from '#/database/browser/QueryWorker.js'
import {config} from './config.js'

const loads: Array<string> = []
const ready = (async () => {
  const db = await wasmDatabase()
  await EntryRuntime.createSchema(db, 'empty')
  const runtime = new EntryRuntime(config, db, {
    async load(requests) {
      return requests.map(request => {
        loads.push(request.payloadId)
        return {...request, data: {title: `Payload ${request.payloadId}`}}
      })
    }
  })
  const queries = new QueryWorker(runtime)
  return {runtime, queries}
})()
export const api = {
  async queries() {
    return proxy((await ready).queries)
  },
  async install(delta: EntryDelta) {
    return (await ready).runtime.apply(delta)
  },
  loads() {
    return loads.slice()
  }
}
expose(api)
