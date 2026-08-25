import {suite} from '@alinea/suite'
import type {FrameLoader} from './Bundle.js'
import {JsonReplicaCodec} from './IndexReader.js'
import type {FieldTransaction} from './Operations.js'
import type {ReplicaTransport} from './Protocol.js'
import {ReplicaSnapshot, ReplicaStore} from './Snapshot.js'
import {
  ReplicaSynchronizer,
  type ReplicaSnapshotFactory
} from './Synchronizer.js'
import type {ReplicaCatalog, ReplicaState} from './Types.js'

const test = suite(import.meta)

const loader: FrameLoader = {
  async load() {
    throw new Error('No frames expected')
  }
}

test('coalesces concurrent synchronization and installs one snapshot', async () => {
  const initial = snapshot(catalog('r1'))
  const store = new ReplicaStore(initial)
  const nextState: ReplicaState = {
    viewId: 'view-1',
    catalog: catalog('r2'),
    grants: [],
    recordAccess: {'entry-1': 'explore'}
  }
  let calls = 0
  const transport: ReplicaTransport = {
    async bootstrap() {
      return {
        user: {id: 'user-1', roles: ['editor']},
        configId: 'config-1',
        configUrl: '/config.js',
        cacheKey: 'cache-1'
      }
    },
    async state() {
      calls += 1
      await Promise.resolve()
      return calls === 1 ? nextState : undefined
    },
    async mutate(_transaction: FieldTransaction) {
      return {revision: 'r2', conflicts: []}
    }
  }
  const factory: ReplicaSnapshotFactory<unknown> = {
    async create(state) {
      return snapshot(state.catalog, state.recordAccess)
    }
  }
  const synchronizer = new ReplicaSynchronizer(transport, store, factory)

  const [first, second] = await Promise.all([
    synchronizer.sync(),
    synchronizer.sync()
  ])
  test.equal(calls, 1)
  test.equal(first, second)
  test.is(store.snapshot().catalog.revision, 'r2')
  test.is(store.snapshot().access('entry-1'), 'explore')

  test.equal(await synchronizer.sync(), {revision: 'r2', changed: false})
  test.equal(calls, 2)
})

function catalog(revision: string): ReplicaCatalog {
  return {
    version: 1,
    bundleId: 'bundle-1',
    bundleUrl: '/release/bundle-1/replica.bundle',
    revision,
    records: {},
    indexes: {}
  }
}

function snapshot(
  value: ReplicaCatalog,
  recordAccess: ReplicaState['recordAccess'] = {}
): ReplicaSnapshot<unknown> {
  return new ReplicaSnapshot(
    value,
    loader,
    new JsonReplicaCodec(),
    recordAccess
  )
}
