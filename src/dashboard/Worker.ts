import type {CMS} from 'alinea/core/CMS'
import {Client} from 'alinea/core/Client'
import type {GraphQuery} from 'alinea/core/Graph'
import {getScope} from 'alinea/core/Scope'
import {trigger} from 'alinea/core/Trigger'
import {EntryDB} from 'alinea/core/db/EntryDB'
import {IndexEvent} from 'alinea/core/db/IndexEvent'
import type {Mutation} from 'alinea/core/db/Mutation'
import {IndexedDBSource} from 'alinea/core/source/IndexedDBSource'
import * as Comlink from 'comlink'
import type {ComponentType} from 'react'

export interface ConfigExports {
  cms: CMS
  views: Record<string, ComponentType>
}

export interface DBWorker {
  sync(): Promise<string>
  mutate(mutations: Array<Mutation>): Promise<string>
  resolve(stringifiedQuery: string): Promise<unknown>
  load(handlerUrl: string, revision: string): Promise<void>
}

export async function loadWorker(
  loadConfig: (revision: string) => Promise<{cms: CMS}>
) {
  const source = new IndexedDBSource(globalThis.indexedDB, 'alinea')
  let port: MessagePort
  let local: EntryDB | undefined
  let nextLocal = trigger<EntryDB>()
  let lastWrite: Promise<string> | undefined
  let defer: Function | undefined
  const dbWorker: DBWorker = {
    async sync() {
      const db = await (local ?? nextLocal)
      return db.syncWithRemote()
    },
    async mutate(mutations: Array<Mutation>): Promise<string> {
      return (lastWrite = Promise.resolve(lastWrite).then(async () => {
        const db = await (local ?? nextLocal)
        return db.mutate(mutations)
      }))
    },
    async resolve(raw: string): Promise<unknown> {
      const db = await (local ?? nextLocal)
      const scope = getScope(db.config)
      const query = scope.parse(raw) as GraphQuery
      return db.resolve(query)
    },
    async load(handlerUrl: string, revision: string) {
      const {cms} = await loadConfig(revision)
      const client = new Client({config: cms.config, url: handlerUrl})
      const db = new EntryDB(cms.config, source, async () => client)
      await db.syncWithRemote()
      try {
        if (defer) defer()
        nextLocal.resolve(db)
        local = db
        db.index.addEventListener(IndexEvent.INDEX, listen)
        db.index.addEventListener(IndexEvent.ENTRY, listen)
        defer = () => {
          db.index.removeEventListener(IndexEvent.INDEX, listen)
          db.index.removeEventListener(IndexEvent.ENTRY, listen)
        }
        port.postMessage('test')
        function listen(event: Event) {
          port.postMessage({
            type: event.type,
            subject: (event as IndexEvent).subject
          })
        }
      } catch (error) {
        nextLocal.reject(new Error('Failed to load database'))
      } finally {
        nextLocal = trigger<EntryDB>()
      }
    }
  }

  globalThis.onconnect = event => {
    port = event.ports[0]
    Comlink.expose(dbWorker, port)
  }
}
