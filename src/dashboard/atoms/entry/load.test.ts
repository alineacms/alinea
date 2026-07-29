import {expect, test} from 'bun:test'
import type {Config as ConfigType} from '#/core/Config.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {Policy} from '#/core/Role.js'
import {atom, createStore} from 'jotai'
import {
  createEntryLoaderAtom,
  createVersionLoaderAtom,
  MissingEntryError
} from './load.js'
import {
  createDashboardAtomFixture,
  dashboardTestConfig
} from '#test/DashboardFixture.js'

function loaderAtoms(db: LocalDB, policy: Policy) {
  const graph = atom<WriteableGraph>(db)
  return {
    entry: createEntryLoaderAtom({
      config: atom<ConfigType>(dashboardTestConfig),
      graph,
      policy: atom(policy)
    }),
    version: createVersionLoaderAtom(graph)
  }
}

test('entry loaders read real entries, children and versions', async () => {
  const {db, parent, child} = await createDashboardAtomFixture()
  const sourceSha = (await db.source.getTree()).sha
  const store = createStore()
  const loaders = loaderAtoms(db, Policy.ALLOW_ALL)
  const loadEntry = store.get(loaders.entry)
  const loadVersions = store.get(loaders.version)

  const [[parentData, parentError], [childData, childError], versions] =
    await Promise.all([
      loadEntry(parent._id),
      loadEntry(child._id),
      loadVersions(parent._id)
    ])

  expect(parentError).toBeNull()
  expect(parentData?.id).toBe(parent._id)
  expect(parentData?.hasChildren).toBeTrue()
  expect(parentData?.entries.map(entry => entry.title)).toEqual([
    'Parent draft'
  ])
  expect(childError).toBeNull()
  expect(childData?.parentId).toBe(parent._id)
  expect(childData?.hasChildren).toBeFalse()
  expect(versions[1]).toBeNull()
  expect(versions[0]?.map(entry => entry.status).sort()).toEqual([
    'draft',
    'published'
  ])
  expect((await db.source.getTree()).sha).toBe(sourceSha)
})

test('entry loaders apply policy and report missing entries', async () => {
  const {db, parent} = await createDashboardAtomFixture()
  const store = createStore()
  const loadEntry = store.get(loaderAtoms(db, Policy.ALLOW_NONE).entry)

  const [denied, missing] = await Promise.all([
    loadEntry(parent._id),
    loadEntry('missing-entry')
  ])

  expect(denied[0]).toBeNull()
  expect(denied[1]).toBeInstanceOf(MissingEntryError)
  expect(missing[0]).toBeNull()
  expect(missing[1]).toBeInstanceOf(MissingEntryError)
})
