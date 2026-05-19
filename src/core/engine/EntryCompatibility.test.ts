import {suite} from '@alinea/suite'
import {cms} from '../../test/cms.js'
import {Entry} from '../Entry.js'
import {LocalDB as BaseLocalDB} from '../db/LocalDB.js'
import {EntryIndex as BaseEntryIndex} from '../db/EntryIndex.js'
import {EntryResolver as BaseEntryResolver} from '../db/EntryResolver.js'
import {FSSource} from '../source/FSSource.js'
import {MemorySource} from '../source/MemorySource.js'
import {syncWith} from '../source/Source.js'
import {EntryIndex} from './EntryIndex.js'
import {EntryResolver} from './EntryResolver.js'
import {EntryTransaction} from './EntryTransaction.js'
import {LocalDB} from './LocalDB.js'
import {NativeEntryIndex} from './NativeEntryIndex.js'

const test = suite(import.meta)

const dir = 'src/test/fixtures/demo'
const fixtureSource = new FSSource(dir)
const {schema} = cms

async function copyFixture() {
  const source = new MemorySource()
  await syncWith(source, fixtureSource)
  return source
}

test('engine EntryIndex filters match the current EntryIndex', async () => {
  const source = await copyFixture()
  const base = new BaseEntryIndex(cms.config)
  const engine = new EntryIndex(cms.config)

  await base.syncWith(source)
  await engine.syncWith(source)

  const baseRows = Array.from(base.filter({})).map(entry => ({
    id: entry.id,
    status: entry.status,
    path: entry.path,
    parentId: entry.parentId,
    url: entry.url
  }))
  const engineRows = Array.from(engine.filter({})).map(entry => ({
    id: entry.id,
    status: entry.status,
    path: entry.path,
    parentId: entry.parentId,
    url: entry.url
  }))

  test.equal(engineRows, baseRows)

  const tx = await engine.transaction(source)
  test.ok(tx instanceof EntryTransaction)
})

test('engine EntryIndex builds a queryable snapshot', async () => {
  const source = await copyFixture()
  const engine = new EntryIndex(cms.config)
  await engine.syncWith(source)

  const chocolateChip = Array.from(engine.filter({})).find(
    entry => entry.path === 'chocolate-chip'
  )
  test.ok(chocolateChip)
  const planned = engine.planner.candidates(
    {
      query: {},
      constraints: {
        id: chocolateChip!.id,
        status: chocolateChip!.status,
        type: chocolateChip!.type
      }
    },
    {trace: true}
  )

  test.equal(planned.rowIds, [chocolateChip!.filePath])
  test.ok(planned.trace!.rows.has(chocolateChip!.filePath))
  test.is(engine.snapshot.graphSha, engine.sha)
  test.ok(engine.snapshot.rows.versions.length > 0)
  test.ok(engine.snapshot.indexes.byId[chocolateChip!.id].length > 0)
})

test('native EntryIndex builds the same snapshot rows and indexes', async () => {
  const source = await copyFixture()
  const engine = new EntryIndex(cms.config)
  const native = new NativeEntryIndex(cms.config)
  await engine.syncWith(source)
  await native.syncWith(source)

  test.equal(native.snapshot.rows, engine.snapshot.rows)
  test.equal(native.snapshot.indexes, engine.snapshot.indexes)
  test.equal(
    native.planner.candidates({
      query: {},
      constraints: {type: 'DemoRecipe', status: 'published'}
    }).rowIds,
    engine.planner.candidates({
      query: {},
      constraints: {type: 'DemoRecipe', status: 'published'}
    }).rowIds
  )
})

test('engine EntryResolver resolves the same rows as current resolver', async () => {
  const source = await copyFixture()
  const baseIndex = new BaseEntryIndex(cms.config)
  const engineIndex = new EntryIndex(cms.config)
  await baseIndex.syncWith(source)
  await engineIndex.syncWith(source)

  const base = new BaseEntryResolver(cms.config, baseIndex)
  const engine = new EntryResolver(cms.config, engineIndex)
  const query = {
    type: schema.DemoRecipe,
    select: {
      id: Entry.id,
      title: schema.DemoRecipe.title,
      path: Entry.path,
      parentId: Entry.parentId
    },
    orderBy: {asc: schema.DemoRecipe.title}
  }

  test.equal(await engine.resolve(query), await base.resolve(query))
})

test('engine LocalDB read and mutation behavior matches current LocalDB', async () => {
  const base = new BaseLocalDB(cms.config, await copyFixture())
  const engine = new LocalDB(cms.config, await copyFixture())
  await base.sync()
  await engine.sync()

  const parentQuery = {type: schema.DemoRecipes, select: Entry}
  const baseParent = await base.get(parentQuery)
  const engineParent = await engine.get(parentQuery)

  const create = {
    id: 'engine-parity-recipe',
    type: schema.DemoRecipe,
    parentId: baseParent.id,
    set: {title: 'Engine parity recipe'}
  }
  const baseCreated = await base.create(create)
  const engineCreated = await engine.create({
    ...create,
    parentId: engineParent.id
  })

  test.equal(
    {
      id: engineCreated._id,
      title: engineCreated.title,
      parentId: engineCreated._parentId,
      path: engineCreated._path
    },
    {
      id: baseCreated._id,
      title: baseCreated.title,
      parentId: baseCreated._parentId,
      path: baseCreated._path
    }
  )

  const countQuery = {type: schema.DemoRecipe}
  test.is(await engine.count(countQuery), await base.count(countQuery))
})
