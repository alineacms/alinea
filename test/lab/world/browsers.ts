/**
 * Editors' browsers. Each runs the dashboard's shared worker (one per
 * dashboard build, shared by its tabs) on its own IndexedDB. A tab talks to
 * it over Comlink through `WorkerDB`, as the dashboard does.
 */
import {Entry} from '#/core/Entry.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {ActivityEvent, type Activity} from '#/dashboard/boot/ActivityEvent.js'
import type {DashboardWorker} from '#/dashboard/boot/DashboardWorker.js'
import {SyncEvent} from '#/dashboard/boot/SyncEvent.js'
import {WorkerDB} from '#/dashboard/boot/WorkerDB.js'
import {versionedCacheName} from '#/database/Version.js'
import type {LocalConnection} from '#/core/Connection.js'
import {indexedDBSnapshotStore} from '@alinea/sqlite-wasm/snapshots'
import * as Comlink from 'comlink'
import {type ConfigVersion, labConfig} from '../shared/schema.js'
import {bus} from './bus.js'
import {deployments} from './deployments.js'
import {network} from './network.js'

export interface TabEntry {
  id: string
  title: string
  status: string
}

export interface Tab {
  id: number
  label: string
  build: string
  configVersion: ConfigVersion
  port: MessagePort
  worker: DashboardWorker
  graph: WorkerDB
  sha?: string
  entries: Array<TabEntry>
  activities: Array<Activity>
  progress?: {loaded: number; total: number}
  ready: boolean
  error?: string
}

let nextTab = 1

export class Browser {
  id: string
  user: string
  node: string
  tabs: Array<Tab> = []
  /** Bumped when the browser quits: the next tab starts a new worker. */
  generation = 1
  #names = new Map<string, string>()

  constructor(id: string, user: string) {
    this.id = id
    this.user = user
    this.node = `browser-${id}`
  }

  realmId(build: string) {
    return `${this.node}-${build}-g${this.generation}`
  }

  /** Open a tab of the dashboard the active deployment serves. */
  async openTab(): Promise<Tab> {
    const deployment = deployments.active
    if (!deployment) throw new Error('Nothing is deployed')
    const configVersion = deployment.configVersion
    // A deploy that leaves the dashboard unchanged keeps its shared worker
    const build = `dashboard-v${configVersion}`
    const realmId = this.realmId(build)
    let name = this.#names.get(realmId)
    let shared: SharedWorker
    const create = (name: string) =>
      new SharedWorker(new URL('../workers/dashboard.ts', import.meta.url), {
        type: 'module',
        name
      })
    if (name) {
      shared = create(name)
    } else {
      bus.log({
        node: this.node,
        kind: 'worker',
        text: `start shared worker for ${build}`
      })
      network.spawn(
        {
          id: realmId,
          kind: 'dashboard',
          env: {NODE_ENV: 'production'},
          data: {browser: this.node, user: this.user, build, configVersion}
        },
        this.node,
        workerName => {
          name = workerName
          return (shared = create(workerName))
        }
      )
      this.#names.set(realmId, name!)
    }
    const port = shared!.port
    const worker = Comlink.wrap<DashboardWorker>(
      port
    ) as unknown as DashboardWorker
    const events = listen(port)
    const config = labConfig(configVersion)
    const graph = new WorkerDB(config, worker, {} as LocalConnection, events)
    const label = `tab ${nextTab}`
    const tab: Tab = {
      id: nextTab++,
      label,
      build,
      configVersion,
      port,
      worker,
      graph,
      entries: [],
      activities: [],
      ready: false
    }
    this.tabs.push(tab)
    bus.log({
      node: this.node,
      part: label,
      kind: 'tab',
      text: `${label} opened (${build})`
    })
    events.addEventListener(IndexEvent.type, event => {
      const {data} = event as IndexEvent
      if (data.op !== 'index') return
      bus.log({
        node: this.node,
        part: label,
        kind: 'index',
        text: `${label} notified: worker db at ${data.sha.slice(0, 7)}, ${data.ids.length} entr${data.ids.length === 1 ? 'y' : 'ies'} changed`
      })
      void this.refresh(tab)
    })
    events.addEventListener(ActivityEvent.type, event => {
      tab.activities = (event as ActivityEvent).activities
      bus.changed()
    })
    events.addEventListener(SyncEvent.type, event => {
      tab.progress = (event as SyncEvent).progress
      bus.changed()
    })
    port.start()
    bus.changed()
    try {
      await graph.ready()
      tab.ready = true
      await this.refresh(tab)
    } catch (error) {
      tab.error = error instanceof Error ? error.message : String(error)
      bus.log({
        node: this.node,
        part: label,
        kind: 'error',
        text: `${label}: ${tab.error}`
      })
    }
    void this.inspectStorage()
    return tab
  }

  async refresh(tab: Tab) {
    try {
      const config = labConfig(tab.configVersion)
      tab.sha = await tab.graph.sha
      tab.activities = await tab.graph.activities()
      tab.entries = (await tab.graph.find({
        type: config.schema.Page,
        status: 'preferDraft',
        select: {id: Entry.id, title: Entry.title, status: Entry.status}
      })) as Array<TabEntry>
      tab.error = undefined
    } catch (error) {
      tab.error = error instanceof Error ? error.message : String(error)
    }
    bus.changed()
    void this.inspectStorage()
  }

  closeTab(tab: Tab) {
    tab.port.close()
    this.tabs = this.tabs.filter(t => t !== tab)
    bus.log({
      node: this.node,
      part: tab.label,
      kind: 'tab',
      text: `${tab.label} closed`
    })
    bus.changed()
  }

  /** Quit the browser: tabs close and its shared workers stop. */
  quit() {
    for (const tab of this.tabs) tab.port.close()
    this.tabs = []
    for (const realmId of this.#names.keys()) network.terminate(realmId)
    this.#names.clear()
    this.generation++
    bus.log({
      node: this.node,
      kind: 'quit',
      text: 'browser quit: shared workers stop, IndexedDB stays'
    })
    bus.changed()
  }

  async save(tab: Tab, id: string, title: string) {
    const mutation: Mutation = {
      op: 'update',
      id,
      locale: null,
      status: 'published',
      set: {title}
    }
    bus.log({
      node: this.node,
      part: tab.label,
      kind: 'save',
      text: `${this.user} saves "${title}" in ${tab.label}`
    })
    try {
      const result = await tab.graph.mutate([mutation])
      await this.refresh(tab)
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      bus.log({
        node: this.node,
        part: tab.label,
        kind: 'error',
        text: `save failed: ${message}`
      })
      await this.refresh(tab)
      throw error
    }
  }

  async sync(tab: Tab) {
    bus.log({
      node: this.node,
      part: tab.label,
      kind: 'sync',
      text: `${tab.label} asks the worker to sync`
    })
    try {
      await tab.graph.sync()
    } finally {
      await this.refresh(tab)
    }
  }

  async retry(tab: Tab) {
    await tab.graph.retryActivity()
    await this.refresh(tab)
  }

  async discard(tab: Tab) {
    await tab.graph.discardActivity()
    await this.refresh(tab)
  }

  storeName() {
    return `${this.node}/${versionedCacheName('alinea-entry-database')}-snapshots`
  }

  /** The bases the browser keeps in IndexedDB. */
  async inspectStorage() {
    try {
      const store = indexedDBSnapshotStore(this.storeName())
      const bases = await store.list()
      bus.patchState(this.node, {
        bases: bases.sort((a, b) => b.createdAt - a.createdAt)
      })
    } catch (error) {
      bus.patchState(this.node, {bases: [], storageError: String(error)})
    }
  }

  /** Clear site data: every base is removed. */
  async clearStorage() {
    this.quit()
    await new Promise<void>(resolve => {
      const request = indexedDB.deleteDatabase(this.storeName())
      request.onsuccess = request.onerror = request.onblocked = () => resolve()
    })
    bus.log({node: this.node, kind: 'clear', text: 'site data cleared'})
    await this.inspectStorage()
  }
}

/** Events the worker forwards to a tab, as `Boot` receives them. */
function listen(source: MessagePort) {
  const events = new EventTarget()
  source.addEventListener('message', event => {
    const {data} = event as MessageEvent
    if (data?.type === IndexEvent.type) {
      events.dispatchEvent(new IndexEvent(data.data))
    } else if (data?.type === ActivityEvent.type) {
      events.dispatchEvent(new ActivityEvent(data.activities))
    } else if (data?.type === SyncEvent.type) {
      events.dispatchEvent(new SyncEvent(data.progress))
    }
  })
  return events
}

export const browsers = [new Browser('a', 'ada'), new Browser('b', 'grace')]
