import {cms} from '#test/cms.js'
import {suite} from '@alinea/suite'
import {Entry} from '#/core/Entry.js'
import type {ChangesBatch} from '#/core/source/Change.js'
import {FSSource} from '#/core/source/FSSource.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {type GetBlobsOptions, syncWith} from '#/core/source/Source.js'
import type {Tracer} from '#/core/Trace.js'
import {LocalDB} from './LocalDB.js'

const dir = 'test/fixtures/demo'
const source = new FSSource(dir)
const from = new MemorySource()
const into = new MemorySource()

const db = new LocalDB(cms.config, from)

const test = suite(import.meta, {
  async beforeEach() {
    await syncWith(into, source)
    await syncWith(from, source)
    await db.sync()
  }
})

const {schema} = cms
const {DemoRecipe} = schema

test('create entry with a result selection', async () => {
  const parent = await db.get({
    type: schema.DemoRecipes
  })
  const data = await db.create({
    type: schema.DemoRecipe,
    parentId: parent._id,
    set: {title: 'Selected Recipe'},
    select: Entry.data
  })

  test.is(data.title, 'Selected Recipe')
  test.is('_id' in data, false)
})

test('update path', async () => {
  const chocolateChip = await db.get({
    type: schema.DemoRecipe,
    path: 'chocolate-chip'
  })
  const updated = await db.update({
    type: schema.DemoRecipe,
    id: chocolateChip._id,
    set: {path: 'chocolate-chip2'}
  })
  test.is(updated.path, 'chocolate-chip2')
  const recipes1 = await db.count({type: DemoRecipe})
  test.is(recipes1, 4)
  const parent = await db.get({
    select: Entry,
    type: schema.DemoRecipes
  })
  await db.update({
    type: schema.DemoRecipes,
    id: parent.id,
    set: {path: 'recipes2'}
  })
  const updatedParent = await db.get({
    select: Entry,
    type: schema.DemoRecipes
  })
  const recipes = await db.find({type: DemoRecipe, select: Entry.parentDir})
  test.equal(recipes, [
    updatedParent.childrenDir,
    updatedParent.childrenDir,
    updatedParent.childrenDir,
    updatedParent.childrenDir
  ])
})

test('syncWith indexes the downloaded batch without rereading local blobs', async () => {
  class TrackingMemorySource extends MemorySource {
    blobReads = 0

    async *getBlobs(
      shas: ReadonlyArray<string>,
      options?: GetBlobsOptions
    ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
      this.blobReads++
      yield* super.getBlobs(shas, options)
    }
  }

  const remote = new TrackingMemorySource()
  await syncWith(remote, source)
  remote.blobReads = 0
  const local = new TrackingMemorySource()
  const fresh = new LocalDB(cms.config, local)

  await fresh.syncWith(remote)

  test.is(local.blobReads, 0)
  test.is(remote.blobReads, 1)
  const {sha} = await remote.getTree()
  test.is(await fresh.sha, sha)
  test.is((await local.getTree()).sha, sha)
})

test('traces syncWith at the database boundary', async () => {
  const spans: Array<string> = []
  const tracer: Tracer = async (name, run) => {
    spans.push(name)
    return run()
  }
  const traced = new LocalDB({...cms.config, tracer}, new MemorySource())

  await traced.syncWith(new MemorySource())

  test.equal(spans, ['alinea.local_db.sync_with'])
})
