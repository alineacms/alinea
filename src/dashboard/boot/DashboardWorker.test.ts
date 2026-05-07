import {createCMS} from '#/core.js'
import {Entry} from '#/core/Entry.js'
import {getScope} from '#/core/Scope.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {TestDB} from '#/core/db/TestDB.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import type {ReadonlyTree} from '#/core/source/Tree.js'
import {Config, Field} from '#/index.js'
import {suite} from '@alinea/suite'
import {DashboardWorker} from './DashboardWorker.js'
import {
  MutationQueueEvent,
  type MutationQueueEntry
} from './MutationQueueEvent.js'

const test = suite(import.meta)

const Page = Config.document('Page', {
  fields: {
    title: Field.text('Title')
  }
})

const cms = createCMS({
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        pages: Config.root('Pages', {contains: [Page]})
      }
    })
  }
})

class TestConnection extends TestDB {
  mutateCalls = 0
  failMutate: Error | undefined
  failGetTree: Error | undefined
  mutateDelay: Promise<void> | undefined
  forceDifferentSha = false
  failMutateOnce: Error | undefined

  async mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    this.mutateCalls += 1
    await this.mutateDelay
    if (this.failMutateOnce) {
      const error = this.failMutateOnce
      this.failMutateOnce = undefined
      throw error
    }
    if (this.failMutate) throw this.failMutate
    const result = await super.mutate(mutations)
    return this.forceDifferentSha ? {sha: 'different'} : result
  }

  getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    if (this.failGetTree) throw this.failGetTree
    return super.getTreeIfDifferent(sha)
  }
}

class TestWorker extends DashboardWorker {
  dispatchEvent(event: Event): boolean {
    if (event.type === 'index') return true
    return super.dispatchEvent(event)
  }
}

function createPageMutation(id: string, title: string): Mutation {
  return {
    op: 'create',
    id,
    type: 'Page',
    locale: null,
    data: {title},
    status: 'published',
    workspace: 'main',
    root: 'pages'
  }
}

async function createWorker() {
  const worker = new TestWorker(new MemorySource())
  const connection = new TestConnection(cms.config)
  await worker.load('test', cms.config, connection)
  return {worker, connection}
}

function nextQueueEvent(worker: DashboardWorker) {
  return new Promise<Array<MutationQueueEntry>>(resolve => {
    const listen = (event: Event) => {
      if (!(event instanceof MutationQueueEvent)) return
      worker.removeEventListener(MutationQueueEvent.type, listen)
      resolve(event.entries)
    }
    worker.addEventListener(MutationQueueEvent.type, listen)
  })
}

async function waitForQueue(
  worker: DashboardWorker,
  check: (entries: Array<MutationQueueEntry>) => boolean
) {
  for (let i = 0; i < 20; i++) {
    const entries = await nextQueueEvent(worker)
    if (check(entries)) return entries
  }
  throw new Error('Timed out waiting for mutation queue event')
}

test('DashboardWorker serializes local queue mutations', async () => {
  const {worker, connection} = await createWorker()
  const first = worker.queue('first', [createPageMutation('page-1', 'Page 1')])
  const second = worker.queue('second', [
    createPageMutation('page-2', 'Page 2')
  ])

  const results = await Promise.allSettled([first, second])

  test.equal(
    results.map(result => result.status),
    ['fulfilled', 'fulfilled']
  )
  test.is(connection.mutateCalls, 2)
})

test('DashboardWorker emits failed queue state when remote mutation and resync fail', async () => {
  const {worker, connection} = await createWorker()
  connection.failMutate = new Error('Remote mutation failed')
  connection.failGetTree = new Error('Remote sync failed')

  await worker.queue('failing', [createPageMutation('page-failing', 'Failing')])
  const entries = await waitForQueue(worker, entries =>
    entries.some(entry => entry.status === 'failed')
  )

  test.is(entries.length, 1)
  test.is(entries[0].status, 'failed')
  test.is(entries[0].error, 'Remote mutation failed')
})

test('DashboardWorker keeps queue item failed when post-mutation resync fails', async () => {
  const {worker, connection} = await createWorker()
  connection.forceDifferentSha = true
  connection.failGetTree = new Error('Remote sync failed')

  await worker.queue('sync-failing', [
    createPageMutation('page-sync-failing', 'Sync failing')
  ])
  const entries = await waitForQueue(worker, entries =>
    entries.some(entry => entry.status === 'failed')
  )

  test.is(entries.length, 1)
  test.is(entries[0].status, 'failed')
  test.is(entries[0].error, 'Remote sync failed')
})

test('DashboardWorker reapplies local mutation after failed remote mutation resyncs local DB', async () => {
  const {worker, connection} = await createWorker()
  connection.failMutateOnce = new Error('Remote mutation failed')

  await worker.queue('retry-after-resync', [
    createPageMutation('page-retry-after-resync', 'Retry after resync')
  ])
  await waitForQueue(worker, entries =>
    entries.some(entry => entry.status === 'failed')
  )

  await worker.retryQueue()
  await waitForQueue(worker, entries => entries.length === 0)
  const localEntry = await worker.resolve(
    getScope(cms.config).stringify({
      select: {title: Entry.title},
      id: 'page-retry-after-resync',
      status: 'preferPublished'
    })
  )

  test.equal(localEntry, [{title: 'Retry after resync'}])
  test.is(connection.mutateCalls, 2)
})
