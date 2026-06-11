import type {LocalConnection, Revision} from 'alinea/core/Connection'
import type {GraphQuery} from 'alinea/core/Graph'
import type {CommitRequest} from 'alinea/core/db/CommitRequest'
import type {Mutation} from 'alinea/core/db/Mutation'
import type {ChangesBatch} from 'alinea/core/source/Change'
import {FSSource} from 'alinea/core/source/FSSource'
import {MemorySource} from 'alinea/core/source/MemorySource'
import type {Source} from 'alinea/core/source/Source'
import {syncWith} from 'alinea/core/source/Source'
import type {ReadonlyTree} from 'alinea/core/source/Tree'
import type {UploadResponse} from 'alinea/core/Connection'
import type {EntryRecord} from 'alinea/core/EntryRecord'
import {LocalDB} from 'alinea/core/db/LocalDB'
import {suite} from '@alinea/suite'
import {cms} from '#test/cms.js'
import {DashboardWorker} from './DashboardWorker.js'

const test = suite(import.meta)
const fixtureSource = new FSSource('test/fixtures/demo')

test('DashboardWorker syncs with remote after local index recovery', async () => {
  const localSource = new MemorySource()
  const remoteSource = new MemorySource()
  await syncWith(localSource, fixtureSource)
  await syncWith(remoteSource, fixtureSource)

  const remoteDB = new LocalDB(cms.config, remoteSource)
  await remoteDB.sync()
  await remoteDB.create({
    type: cms.schema.DemoRecipes,
    set: {title: 'Recovered remote entry', path: 'recovered-remote-entry'}
  })

  const source = new FailingBlobSource(localSource)
  const connection = new TestConnection(remoteSource)
  const worker = new DashboardWorker(source)
  const resetInterval = disableInterval()

  try {
    await worker.load('test-revision', cms.config, connection)

    test.is(source.failedBlobReads, 1)
    test.is(connection.syncRequests, 1)
    test.is((await source.getTree()).sha, (await remoteSource.getTree()).sha)
  } finally {
    resetInterval()
  }
})

class FailingBlobSource implements Source {
  failedBlobReads = 0
  #failNextBlobRead = true

  constructor(private source: MemorySource) {}

  getTree(): Promise<ReadonlyTree> {
    return this.source.getTree()
  }

  getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    return this.source.getTreeIfDifferent(sha)
  }

  async *getBlobs(
    shas: Array<string>
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    if (this.#failNextBlobRead) {
      this.#failNextBlobRead = false
      this.failedBlobReads += 1
      throw new Error('Cached blob missing')
    }
    yield* this.source.getBlobs(shas)
  }

  applyChanges(batch: ChangesBatch): Promise<void> {
    return this.source.applyChanges(batch)
  }
}

class TestConnection implements LocalConnection {
  syncRequests = 0

  constructor(private source: Source) {}

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    this.syncRequests += 1
    return this.source.getTreeIfDifferent(sha)
  }

  getBlobs(
    shas: Array<string>
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    return this.source.getBlobs(shas)
  }

  write(_request: CommitRequest): Promise<{sha: string}> {
    throw new Error('Not implemented')
  }

  mutate(_mutations: Array<Mutation>): Promise<{sha: string}> {
    throw new Error('Not implemented')
  }

  previewToken(_request: unknown): Promise<string> {
    throw new Error('Not implemented')
  }

  resolve<Query extends GraphQuery>(_query: Query): Promise<never> {
    throw new Error('Not implemented')
  }

  user(): Promise<undefined> {
    return Promise.resolve(undefined)
  }

  revisions(_file: string): Promise<Array<Revision>> {
    return Promise.resolve([])
  }

  revisionData(
    _file: string,
    _revisionId: string
  ): Promise<EntryRecord | undefined> {
    return Promise.resolve(undefined)
  }

  getDraft(_draftKey: never): Promise<undefined> {
    return Promise.resolve(undefined)
  }

  storeDraft(_draft: never): Promise<void> {
    return Promise.resolve()
  }

  prepareUpload(_file: string): Promise<UploadResponse> {
    throw new Error('Not implemented')
  }
}

function disableInterval(): () => void {
  const setInterval = globalThis.setInterval
  globalThis.setInterval = (() => 0) as unknown as typeof globalThis.setInterval
  return () => {
    globalThis.setInterval = setInterval
  }
}
