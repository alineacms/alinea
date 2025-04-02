import type {Config} from '../Config.js'
import type {SyncApi, UploadResponse} from '../Connection.js'
import {Entry} from '../Entry.js'
import type {AnyQueryResult, GraphQuery} from '../Graph.js'
import type {Change} from '../source/Change.js'
import {MemorySource} from '../source/MemorySource.js'
import {syncWith} from '../source/Source.js'
import type {Source} from '../source/Source.js'
import {type CommitRequest, sourceChanges} from './CommitRequest.js'
import {EntryIndex} from './EntryIndex.js'
import {EntryResolver} from './EntryResolver.js'
import {EntryTransaction} from './EntryTransaction.js'
import type {Mutation} from './Mutation.js'
import {WriteableGraph} from './WriteableGraph.js'

export class LocalDB extends WriteableGraph {
  public index: EntryIndex
  protected source: Source
  #resolver: EntryResolver

  constructor(
    public config: Config,
    source: Source = new MemorySource()
  ) {
    super()
    const index = new EntryIndex(config)
    const resolver = new EntryResolver(config, index)
    this.#resolver = resolver
    this.index = index
    this.source = source
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    return this.#resolver.resolve(query)
  }

  get sha() {
    return this.index.sha
  }

  indexChanges(changes: Array<Change>) {
    return this.index.indexChanges(changes)
  }

  applyChanges(changes: Array<Change>) {
    return this.source.applyChanges(changes)
  }

  getTreeIfDifferent(sha: string) {
    return this.source.getTreeIfDifferent(sha)
  }

  getBlob(sha: string) {
    return this.source.getBlob(sha)
  }

  async sync() {
    await this.index.syncWith(this.source)
    await this.index.seed(this.source)
    return this.sha
  }

  async syncWith(remote: SyncApi) {
    await syncWith(this.source, remote)
    return this.sync()
  }

  async logEntries() {
    const entries = await this.find({
      select: {
        id: Entry.id,
        root: Entry.root,
        workspace: Entry.workspace,
        parentId: Entry.parentId,
        locale: Entry.locale,
        status: Entry.status,
        path: Entry.path,
        index: Entry.index
      }
    })
    console.table(entries)
  }

  async request(mutations: Array<Mutation>) {
    const from = await this.source.getTree()
    const tx = new EntryTransaction(this.config, this.index, this.source, from)
    tx.apply(mutations)
    return tx.toRequest()
  }

  async mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    const request = await this.request(mutations)
    return this.commit(request)
  }

  async commit(request: CommitRequest): Promise<{sha: string}> {
    const contentChanges = sourceChanges(request.changes)
    await this.applyChanges(contentChanges)
    return {sha: await this.sync()}
  }

  async prepareUpload(file: string): Promise<UploadResponse> {
    throw new Error('Uploads not supported on local DB')
  }
}
