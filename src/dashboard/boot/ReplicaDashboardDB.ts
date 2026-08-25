import type {Config} from '#/core/Config.js'
import type {
  LocalConnection,
  UploadMetadata,
  UploadResponse
} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
import {createId} from '#/core/Id.js'
import type {Resolver} from '#/core/Resolver.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {AlineaDatabaseRecord} from '#/database/entry/Model.js'
import {EntryReplicaClient} from '#/database/replica/EntryClient.js'
import {HttpReplicaTransport} from '#/database/replica/HttpTransport.js'
import {IndexedDBReplicaCache} from '#/database/replica/IndexedDBCache.js'
import {replicaCommandsFromMutations} from '#/database/replica/Commands.js'
import {
  FieldConflictError,
  hashFieldValue,
  type FieldOperation,
  type FieldTransaction
} from '#/database/replica/Operations.js'
import {getScope} from '#/core/Scope.js'

export class ReplicaDashboardDB extends WriteableGraph {
  #replica: EntryReplicaClient
  #client: LocalConnection
  #events = new EventTarget()
  #transport: HttpReplicaTransport

  constructor(
    public config: Config,
    client: LocalConnection,
    replica: EntryReplicaClient,
    transport: HttpReplicaTransport
  ) {
    super()
    this.#client = client
    this.#replica = replica
    this.#transport = transport
  }

  static async load(
    config: Config,
    client: LocalConnection,
    handlerUrl: string,
    indexedDB: IDBFactory,
    fetch?: typeof globalThis.fetch
  ): Promise<ReplicaDashboardDB> {
    const transport = new HttpReplicaTransport({handlerUrl, fetch})
    const replica = new EntryReplicaClient({
      transport,
      cache: new IndexedDBReplicaCache<AlineaDatabaseRecord>(
        indexedDB,
        'alinea-replica'
      ),
      fetch
    })
    await replica.sync()
    return new ReplicaDashboardDB(config, client, replica, transport)
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    if (!query.filter) return this.#replica.resolver(this.config).resolve(query)
    return this.#resolveEligible(query)
  }

  async #resolveEligible<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    const scope = getScope(this.config)
    const ids = await this.#transport.eligible(scope.stringify(query))
    return this.#replica.resolver(this.config).resolve({
      ...query,
      id: {in: ids},
      filter: undefined
    }) as Promise<AnyQueryResult<Query>>
  }

  referencesTo(query: EntryReferenceQuery): Promise<EntryReferenceResult> {
    return this.#replica.resolver(this.config).referencesTo(query)
  }

  async sync(): Promise<string> {
    const result = await this.#replica.sync()
    if (result.changed) {
      const ids = await this.#replica.resolver(this.config).resolve({
        status: 'all',
        groupBy: Entry.id,
        select: Entry.id
      })
      this.#events.dispatchEvent(
        new IndexEvent({op: 'index', sha: result.revision, ids})
      )
    }
    return result.revision
  }

  get sha(): string {
    return this.#replica.revision ?? ''
  }

  async mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    const transaction = await fieldTransactionForUpdates(
      this.#replica.resolver(this.config),
      this.sha,
      mutations
    )
    if (!transaction) {
      await this.#transport.command(replicaCommandsFromMutations(mutations))
      return {sha: await this.sync()}
    }
    const result = await this.#transport.mutate(transaction)
    if (result.conflicts.length > 0)
      throw new FieldConflictError(result.conflicts)
    return {sha: await this.sync()}
  }

  prepareUpload(
    file: string,
    metadata?: UploadMetadata
  ): Promise<UploadResponse> {
    return this.#client.prepareUpload(file, metadata)
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void {
    this.#events.addEventListener(type, listener)
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void {
    this.#events.removeEventListener(type, listener)
  }
}

export async function fieldTransactionForUpdates(
  resolver: Pick<Resolver, 'resolve'>,
  baseRevision: string,
  mutations: ReadonlyArray<Mutation>,
  transactionId = createId()
): Promise<FieldTransaction | undefined> {
  if (mutations.some(mutation => mutation.op !== 'update')) return
  const operations: Array<FieldOperation> = []
  for (const mutation of mutations) {
    if (mutation.op !== 'update') return
    const entry = await resolver.resolve({
      id: mutation.id,
      locale: mutation.locale,
      status: mutation.status,
      first: true,
      select: Entry
    })
    if (!entry)
      throw new Error(
        `Cannot update missing entry "${mutation.id}" (${mutation.locale ?? 'default'}, ${mutation.status})`
      )
    if (!entry.filePath)
      throw new Error(`Cannot update explore-only entry "${mutation.id}"`)
    for (const [field, value] of Object.entries(mutation.set)) {
      operations.push({
        kind: 'set',
        recordId: `payload:${entry.filePath}`,
        path: `/${escapePointerSegment(field)}`,
        baseHash: await hashFieldValue(entry.data[field]),
        value
      })
    }
  }
  return {id: transactionId, baseRevision, operations}
}

function escapePointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1')
}
