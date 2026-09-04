import type {Config} from '#/core/Config.js'
import {EventDispatcher} from '#/core/EventDispatcher.js'
import type {LocalConnection} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import type {GraphQuery} from '#/core/Graph.js'
import {createId} from '#/core/Id.js'
import {getScope} from '#/core/Scope.js'
import {trigger} from '#/core/Trigger.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {
  mutationsFromEntryWrites,
  type EntryWrite
} from '#/core/db/EntryWrite.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {EntryUrlConflictError} from '#/core/db/EntryUrlConflictError.js'
import type {Source} from '#/core/source/Source.js'
import pLimit from 'p-limit'
import {
  type Activity,
  ActivityEvent,
  type ActivityOperation,
  type ActivityTarget
} from './ActivityEvent.js'
import {ReplicaDashboardDB} from './ReplicaDashboardDB.js'
import {SourceDB} from '#/database/entry/SourceDB.js'

type DashboardDatabase = SourceDB | ReplicaDashboardDB

const remote = pLimit(1)
const syncInterval = 120_000

interface QueuedMutation {
  id: string
  writes: Array<EntryWrite>
  activity: Activity
  attempt: number
  sha?: string
}

const activityHistoryLimit = 100

export class DashboardWorker extends EventDispatcher {
  #source: Source
  #localDB: DashboardDatabase | undefined
  #localClient: LocalConnection | undefined
  #nextLoad = trigger<{db: DashboardDatabase; client: LocalConnection}>()
  #defer: Function | undefined
  #currentRevision: string | undefined
  #mutations: Array<QueuedMutation> = []
  #activities: Array<Activity> = []
  #local = pLimit(1)
  #blocked = false
  #syncInterval: ReturnType<typeof setInterval> | undefined

  constructor(source: Source) {
    super()
    this.#source = source
  }

  get db() {
    return this.#localDB ?? this.#nextLoad.then(res => res.db)
  }

  get #client() {
    return this.#localClient ?? this.#nextLoad.then(res => res.client)
  }

  async sync() {
    const db = await this.db
    const client = await this.#client
    if (
      this.#local.activeCount > 0 ||
      this.#local.pendingCount > 0 ||
      remote.activeCount > 0 ||
      remote.pendingCount > 0
    )
      return db.sha
    if (db instanceof ReplicaDashboardDB)
      return remote(() => this.#syncReplica(db))
    // The source is IndexedDB: if it has data, we can boot from cache.
    const sourceTree = await db.source.getTree()
    // The runtime index is rebuilt from cached source only when it is absent.
    if (!db.loaded && !sourceTree.isEmpty) await db.sync()
    // Always schedule a remote freshness check, but do not block boot if local
    // data was enough to build the index.
    const sync = remote(() => this.#syncWithClient(db, client))
    if (sourceTree.isEmpty) await sync
    return db.sha
  }

  async sha() {
    return (await this.db).sha
  }

  async queue(id: string, writes: Array<EntryWrite>): Promise<string> {
    return this.#local(async () => {
      const db = await this.db
      if (this.#blocked) {
        throw new Error('Resolve the sync error before making more changes')
      }
      const summary = await summarizeMutations(
        db,
        mutationsFromEntryWrites(writes)
      )
      const activity: Activity = {
        id,
        type: 'mutation',
        status: 'pending',
        operations: summary.operations,
        target: summary.target,
        startedAt: Date.now()
      }
      const item: QueuedMutation = {
        id,
        writes,
        activity,
        attempt: 0
      }
      this.#activities.unshift(activity)
      this.#mutations.push(item)
      this.#emitActivity()
      try {
        if (db instanceof ReplicaDashboardDB) {
          const {sha} = await db.writeEntries(writes)
          item.sha = sha
          this.#completeMutation(item)
          this.#emitActivity()
          return sha
        }
        await db.writeEntries(writes)
        item.sha = db.sha
        this.#emitActivity()
        void this.#flush(item)
        return item.sha
      } catch (error) {
        if (error instanceof EntryUrlConflictError) {
          this.#cancelMutation(item, error)
          throw error
        }
        this.#blocked = true
        this.#failActivity(activity, error)
        throw error
      }
    })
  }

  async retryActivity(): Promise<void> {
    if (this.#blocked) await this.#retryMutations()
    if (this.#blocked) return
    const latestFetch = this.#activities.find(
      activity => activity.type === 'fetch'
    )
    if (latestFetch?.status === 'failed') {
      const db = await this.db
      const client = await this.#client
      await remote(() =>
        db instanceof ReplicaDashboardDB
          ? this.#syncReplica(db)
          : this.#syncWithClient(db, client)
      )
    }
  }

  async #retryMutations(): Promise<void> {
    await this.#local(async () => {
      const db = await this.db
      this.#blocked = false
      for (const item of this.#mutations) {
        item.attempt += 1
        item.activity.status = 'pending'
        item.activity.finishedAt = undefined
        item.activity.error = undefined
        if (!item.sha) {
          try {
            await db.writeEntries(item.writes)
            item.sha = db.sha
          } catch (error) {
            this.#blocked = true
            this.#failActivity(item.activity, error)
            throw error
          }
        }
      }
    })
    this.#emitActivity()
    await Promise.all(this.#mutations.map(item => this.#flush(item)))
  }

  async discardActivity(): Promise<void> {
    await this.#local(async () => {
      if (this.#mutations.length === 0) return
      const db = await this.db
      const client = await this.#client
      for (const item of this.#mutations) item.attempt += 1
      if (db instanceof ReplicaDashboardDB) await this.#syncReplica(db)
      else await this.#syncWithClient(db, client)
      this.#blocked = false
      const finishedAt = Date.now()
      for (const item of this.#mutations) {
        item.activity.status = 'discarded'
        item.activity.finishedAt = finishedAt
        item.activity.error = undefined
      }
      this.#mutations = []
      this.#trimActivities()
      this.#emitActivity()
    })
  }

  #flush(item: QueuedMutation): Promise<void> {
    const attempt = item.attempt
    return remote(async () => {
      if (item.attempt !== attempt) return
      if (this.#blocked) {
        item.activity.status = 'blocked'
        this.#emitActivity()
        return
      }
      if (item.activity.status === 'failed') return
      item.activity.status = 'running'
      this.#emitActivity()
      const client = await this.#client
      const db = await this.db
      if (db instanceof ReplicaDashboardDB) return
      try {
        const {sha} = await client.mutate(mutationsFromEntryWrites(item.writes))
        if (remote.pendingCount === 0 && sha !== item.sha)
          await this.#syncWithClient(db, client)
        this.#completeMutation(item)
      } catch (error) {
        this.#blocked = true
        this.#failActivity(item.activity, error)
        try {
          await this.#syncWithClient(db, client)
          item.sha = undefined
        } catch {}
      }
    })
  }

  #completeMutation(item: QueuedMutation) {
    item.activity.status = 'succeeded'
    item.activity.finishedAt = Date.now()
    item.activity.error = undefined
    this.#mutations = this.#mutations.filter(entry => entry !== item)
    this.#trimActivities()
    this.#emitActivity()
  }

  #cancelMutation(item: QueuedMutation, error: unknown) {
    item.activity.status = 'cancelled'
    item.activity.finishedAt = Date.now()
    item.activity.error = errorMessage(error)
    this.#mutations = this.#mutations.filter(entry => entry !== item)
    this.#trimActivities()
    this.#emitActivity()
  }

  activities(): Array<Activity> {
    return this.#activities.map(activity => ({
      ...activity,
      target: activity.target ? {...activity.target} : undefined,
      operations: activity.operations.map(operation => ({...operation}))
    }))
  }

  #emitActivity() {
    this.dispatchEvent(new ActivityEvent(this.activities()))
  }

  async #syncWithClient(db: SourceDB, client: LocalConnection) {
    const activity: Activity = {
      id: createId(),
      type: 'fetch',
      status: 'running',
      operations: [],
      startedAt: Date.now()
    }
    this.#activities.unshift(activity)
    this.#emitActivity()
    try {
      const result = await db.syncWith(client)
      activity.status = 'succeeded'
      return result
    } catch (error) {
      activity.status = 'failed'
      activity.error = errorMessage(error)
      throw error
    } finally {
      activity.finishedAt = Date.now()
      this.#trimActivities()
      this.#emitActivity()
    }
  }

  async #syncReplica(db: ReplicaDashboardDB): Promise<string> {
    const activity: Activity = {
      id: createId(),
      type: 'fetch',
      status: 'running',
      operations: [],
      startedAt: Date.now()
    }
    this.#activities.unshift(activity)
    this.#emitActivity()
    try {
      const revision = await db.sync()
      activity.status = 'succeeded'
      return revision
    } catch (error) {
      activity.status = 'failed'
      activity.error = errorMessage(error)
      throw error
    } finally {
      activity.finishedAt = Date.now()
      this.#trimActivities()
      this.#emitActivity()
    }
  }

  #failActivity(activity: Activity, error: unknown) {
    activity.status = 'failed'
    activity.finishedAt = Date.now()
    activity.error = errorMessage(error)
    this.#emitActivity()
  }

  #trimActivities() {
    let excess = this.#activities.length - activityHistoryLimit
    for (let index = this.#activities.length - 1; excess > 0; index--) {
      if (index < 0) break
      const activity = this.#activities[index]
      if (
        activity.status === 'pending' ||
        activity.status === 'running' ||
        activity.status === 'blocked' ||
        (activity.type === 'mutation' && activity.status === 'failed')
      )
        continue
      this.#activities.splice(index, 1)
      excess -= 1
    }
  }

  async resolve(raw: string): Promise<unknown> {
    const db = await this.db
    const scope = getScope(db.config)
    const query = scope.parse<GraphQuery>(raw)
    if (db instanceof ReplicaDashboardDB)
      return db.resolveSerialized(raw, query)
    return db.resolve(query)
  }

  async referencesTo(
    query: EntryReferenceQuery
  ): Promise<EntryReferenceResult> {
    const db = await this.db
    return db.referencesTo(query)
  }

  async load(
    revision: string,
    config: Config,
    client: LocalConnection,
    handlerUrl?: string
  ) {
    if (this.#currentRevision === revision) {
      await this.sync()
      return
    }
    this.#currentRevision = revision
    try {
      if (this.#defer) this.#defer()
      if (handlerUrl) {
        const db = await ReplicaDashboardDB.load(
          config,
          client,
          handlerUrl,
          globalThis.indexedDB
        )
        this.#localDB = db
        this.#localClient = client
        this.#nextLoad.resolve({db, client})
        const listen = (event: Event) => {
          if (event instanceof IndexEvent)
            this.dispatchEvent(new IndexEvent(event.data))
        }
        db.addEventListener(IndexEvent.type, listen)
        this.#defer = () => db.removeEventListener(IndexEvent.type, listen)
        this.#startSyncing(true)
        return
      }
      const db = new SourceDB(config, this.#source)
      const cacheReady = await this.#syncLocalIndex(db)
      if (!cacheReady) await remote(() => this.#syncWithClient(db, client))
      this.#localDB = db
      this.#localClient = client
      this.#nextLoad.resolve({db, client})
      const listen = (event: Event) => {
        if (event instanceof IndexEvent)
          this.dispatchEvent(new IndexEvent(event.data))
      }
      db.addEventListener(IndexEvent.type, listen)
      this.#defer = () => {
        db.removeEventListener(IndexEvent.type, listen)
      }
      this.#startSyncing(cacheReady)
    } catch (cause) {
      this.#nextLoad.reject(new Error('Failed to load database', {cause}))
      throw cause
    }
  }

  async #syncLocalIndex(db: SourceDB): Promise<boolean> {
    const sourceTree = await db.source.getTree()
    if (sourceTree.isEmpty) return false
    try {
      await db.sync()
      return true
    } catch {
      return false
    }
  }

  #startSyncing(refreshImmediately: boolean) {
    if (this.#syncInterval) return
    const sync = () => {
      void this.sync().catch(() => {})
    }
    if (refreshImmediately) sync()
    this.#syncInterval = setInterval(sync, syncInterval)
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface MutationTitleRow {
  id: string
  locale: string | null
  status: string
  title: string
  workspace: string
  root: string
}

interface MutationActivitySummary {
  operations: Array<ActivityOperation>
  target?: ActivityTarget
}

async function summarizeMutations(
  db: WriteableGraph,
  mutations: Array<Mutation>
): Promise<MutationActivitySummary> {
  const targets = mutations.flatMap(mutation =>
    'id' in mutation && mutation.id ? [mutation.id] : []
  )
  const rows =
    targets.length > 0
      ? await db.find({
          select: {
            id: Entry.id,
            locale: Entry.locale,
            status: Entry.status,
            title: Entry.title,
            workspace: Entry.workspace,
            root: Entry.root
          },
          id: {in: targets},
          status: 'all'
        })
      : []
  const titleRows = rows as Array<MutationTitleRow>
  return {
    operations: mutations.map(mutation => mutationSummary(mutation, titleRows)),
    target: activityTarget(mutations, titleRows)
  }
}

function activityTarget(
  mutations: Array<Mutation>,
  rows: Array<MutationTitleRow>
): ActivityTarget | undefined {
  const targets: Array<ActivityTarget> = []
  for (const mutation of mutations) {
    if (mutation.op === 'remove') return
    if (mutation.op === 'uploadFile' || mutation.op === 'removeFile') continue
    if (!mutation.id) return
    const row = mutationRow(mutation, rows)
    const workspace = mutation.op === 'create' ? mutation.workspace : undefined
    const root = mutation.op === 'create' ? mutation.root : undefined
    const targetWorkspace = workspace ?? row?.workspace
    const targetRoot = root ?? row?.root
    if (!targetWorkspace || !targetRoot) return
    targets.push({
      workspace: targetWorkspace,
      root: targetRoot,
      entry: mutation.id,
      locale: 'locale' in mutation ? mutation.locale : row?.locale
    })
  }
  const unique = new Map(
    targets.map(target => [
      `${target.workspace}\0${target.root}\0${target.entry}\0${target.locale ?? ''}`,
      target
    ])
  )
  return unique.size === 1 ? unique.values().next().value : undefined
}

function mutationSummary(
  mutation: Mutation,
  rows: Array<MutationTitleRow>
): ActivityOperation {
  switch (mutation.op) {
    case 'create':
      return {
        op: mutation.op,
        target: mutation.id,
        title: titleFromData(mutation.data) ?? titleForMutation(mutation, rows),
        locale: mutation.locale,
        status: mutation.status
      }
    case 'update':
      return {
        op: mutation.op,
        target: mutation.id,
        title: titleFromData(mutation.set) ?? titleForMutation(mutation, rows),
        locale: mutation.locale,
        status: mutation.status
      }
    case 'remove':
      return {
        op: mutation.op,
        target: mutation.id,
        title: titleForMutation(mutation, rows),
        locale: mutation.locale,
        status: mutation.status
      }
    case 'publish':
      return {
        op: mutation.op,
        target: mutation.id,
        title: titleForMutation(mutation, rows),
        locale: mutation.locale,
        status: mutation.status
      }
    case 'unpublish':
    case 'archive':
      return {
        op: mutation.op,
        target: mutation.id,
        title: titleForMutation(mutation, rows),
        locale: mutation.locale
      }
    case 'move':
      return {
        op: mutation.op,
        target: mutation.id,
        title: titleForMutation(mutation, rows)
      }
    case 'uploadFile':
      return {
        op: mutation.op,
        target: mutation.location,
        title: fileTitle(mutation.location)
      }
    case 'removeFile':
      return {
        op: mutation.op,
        target: mutation.location,
        title: fileTitle(mutation.location)
      }
  }
}

function titleFromData(data: Record<string, unknown>): string | undefined {
  return typeof data.title === 'string' && data.title.trim()
    ? data.title.trim()
    : undefined
}

function titleForMutation(
  mutation: {id?: string; locale?: string | null; status?: string},
  rows: Array<MutationTitleRow>
): string | undefined {
  return mutationRow(mutation, rows)?.title
}

function mutationRow(
  mutation: {id?: string; locale?: string | null; status?: string},
  rows: Array<MutationTitleRow>
): MutationTitleRow | undefined {
  if (!mutation.id) return
  return (
    rows.find(
      row =>
        row.id === mutation.id &&
        (!('locale' in mutation) || row.locale === mutation.locale) &&
        (!('status' in mutation) || row.status === mutation.status)
    ) ?? rows.find(row => row.id === mutation.id)
  )
}

function fileTitle(location: string): string {
  return location.split('/').pop() || location
}
