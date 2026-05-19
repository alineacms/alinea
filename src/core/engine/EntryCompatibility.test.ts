import {suite} from '@alinea/suite'
import {cms} from '../../test/cms.js'
import {Entry} from '../Entry.js'
import {createRecord} from '../EntryRecord.js'
import {LocalDB as BaseLocalDB} from '../db/LocalDB.js'
import {EntryIndex as BaseEntryIndex} from '../db/EntryIndex.js'
import {EntryResolver as BaseEntryResolver} from '../db/EntryResolver.js'
import {hashBlob} from '../source/GitUtils.js'
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

test('native EntryIndex incrementally updates same-shape snapshots', async () => {
  const source = await copyFixture()
  const engine = new EntryIndex(cms.config)
  await engine.syncWith(source)
  test.ok(engine.snapshot)

  const entry = Array.from(engine.filter({})).find(
    entry => entry.path === 'chocolate-chip' && entry.status === 'published'
  )
  test.ok(entry)

  const record = createRecord(
    {
      ...entry!,
      data: {
        ...entry!.data,
        title: 'Chocolate chip incremental'
      }
    },
    entry!.status
  )
  const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
  const sha = await hashBlob(contents)
  const batch = {
    fromSha: engine.sha,
    changes: [
      {
        op: 'add' as const,
        path: entry!.filePath,
        sha,
        contents
      }
    ]
  }

  await engine.indexChanges(batch)
  const incremental = engine.snapshot
  await source.applyChanges(batch)

  const rebuilt = new EntryIndex(cms.config)
  await rebuilt.syncWith(source)

  test.equal(incremental.rows, rebuilt.snapshot.rows)
  test.equal(incremental.indexes, rebuilt.snapshot.indexes)
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

  const recipe = Array.from(engineIndex.filter({})).find(
    entry => entry.path === 'chocolate-chip' && entry.status === 'published'
  )
  test.ok(recipe)
  const indexedQueries = [
    {
      path: recipe!.path,
      select: {id: Entry.id, path: Entry.path}
    },
    {
      url: recipe!.url,
      select: {id: Entry.id, url: Entry.url}
    },
    {
      type: schema.DemoRecipe,
      level: recipe!.level,
      count: true
    },
    {
      type: schema.DemoRecipe,
      workspace: recipe!.workspace,
      root: recipe!.root,
      count: true
    }
  ]
  for (const indexedQuery of indexedQueries) {
    test.equal(
      await engine.resolve(indexedQuery as any),
      await base.resolve(indexedQuery as any)
    )
  }
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

test('engine LocalDB transaction operations match current LocalDB', async () => {
  const base = new BaseLocalDB(cms.config, await copyFixture())
  const engine = new LocalDB(cms.config, await copyFixture())
  await base.sync()
  await engine.sync()

  const parent = await base.get({type: schema.DemoRecipes, select: Entry})
  const engineParent = await engine.get({
    type: schema.DemoRecipes,
    select: Entry
  })
  test.is(engineParent.id, parent.id)

  const first = {
    id: 'engine-tx-first',
    type: schema.DemoRecipe,
    parentId: parent.id,
    set: {title: 'Engine tx first'}
  }
  const second = {
    id: 'engine-tx-second',
    type: schema.DemoRecipe,
    parentId: parent.id,
    set: {title: 'Engine tx second'}
  }
  await base.create(first)
  await engine.create(first)
  await base.create(second)
  await engine.create(second)

  const baseUpdated = await base.update({
    id: first.id,
    type: schema.DemoRecipe,
    set: {title: 'Engine tx updated', path: 'engine-tx-updated'}
  })
  const engineUpdated = await engine.update({
    id: first.id,
    type: schema.DemoRecipe,
    set: {title: 'Engine tx updated', path: 'engine-tx-updated'}
  })
  test.equal(
    {
      title: engineUpdated.title,
      path: engineUpdated._path
    },
    {
      title: baseUpdated.title,
      path: baseUpdated._path
    }
  )

  const baseMoved = await base.move({id: first.id, after: second.id})
  const engineMoved = await engine.move({id: first.id, after: second.id})
  test.equal(engineMoved, baseMoved)

  await base.unpublish({id: first.id, locale: null})
  await engine.unpublish({id: first.id, locale: null})
  test.equal(
    await engine.get({id: first.id, status: 'draft', select: Entry.path}),
    await base.get({id: first.id, status: 'draft', select: Entry.path})
  )

  await base.publish({id: first.id, locale: null, status: 'draft'})
  await engine.publish({id: first.id, locale: null, status: 'draft'})
  await base.archive({id: first.id, locale: null})
  await engine.archive({id: first.id, locale: null})
  test.equal(
    await engine.get({id: first.id, status: 'archived', select: Entry.path}),
    await base.get({id: first.id, status: 'archived', select: Entry.path})
  )

  await base.remove(first.id)
  await engine.remove(first.id)
  test.is(
    await engine.count({id: first.id, status: 'all'}),
    await base.count({id: first.id, status: 'all'})
  )
})
