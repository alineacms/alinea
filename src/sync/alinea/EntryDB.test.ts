import {suite} from '@alinea/suite'
import {Entry} from 'alinea/core'
import {assign} from 'alinea/core/util/Objects'
import {cms} from '../../test/cms.tsx'
import {DemoRecipe} from '../../test/schema/DemoRecipe.ts'
import {FSSource} from '../source/FSSource.ts'
import {MemorySource} from '../source/MemorySource.ts'
import type {CommitRequest} from './CommitRequest.ts'
import {EntryDB} from './EntryDB.ts'

const dir = 'test/demo'
const source = new FSSource(dir)
const from = new MemorySource()
const into = new MemorySource()

const remote = assign(into, {
  async commit(request: CommitRequest) {
    const entryChanges = request.changes.filter(
      change => change.op === 'add' || change.op === 'delete'
    )
    await into.applyChanges(entryChanges)
    //console.log(request.description)
    //for (const {op, path} of entryChanges) console.log(`comm> ${op} ${path}`)
    return request.intoSha
  }
})

const db = new EntryDB(cms.config, from, remote)

const test = suite(import.meta, {
  async beforeEach() {
    await remote.syncWith(source)
    await from.syncWith(source)
    await db.sync()
  }
})

test('create entry', async () => {
  const {schema} = cms
  const parent = await db.get({
    type: schema.DemoRecipes
  })
  const newRecipe = await db.create({
    type: schema.DemoRecipe,
    parentId: parent._id,
    set: {title: 'New Recipe'}
  })
  test.is(newRecipe.title, 'New Recipe')
  test.is(newRecipe._parentId, parent._id)
})

test('remove entry', async () => {
  const {schema} = cms
  const parent = await db.get({
    type: schema.DemoRecipes
  })
  const recipes1 = await db.count({type: DemoRecipe})
  test.is(recipes1, 4)
  await db.remove(parent._id)
  const recipes2 = await db.count({type: DemoRecipe})
  test.is(recipes2, 0)
  const recipesParent = await db.first({
    type: schema.DemoRecipes
  })
  test.is(recipesParent, null)
})

test('update entry', async () => {
  const {schema} = cms
  const chocolateChip = await db.get({
    type: schema.DemoRecipe,
    path: 'chocolate-chip'
  })
  test.is(chocolateChip.title, 'Chocolate chip')
  const updatedEntry = await db.update({
    type: schema.DemoRecipe,
    id: chocolateChip._id,
    set: {title: 'Chocolate Chip Cookies'}
  })
  test.is(updatedEntry.title, 'Chocolate Chip Cookies')
})

test('update path', async () => {
  const {schema} = cms
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

test('change order', async () => {
  const {schema} = cms
  const parent = await db.create({
    type: schema.DemoRecipes,
    set: {title: 'Recipes'}
  })
  let sub1 = await db.create({
    type: schema.DemoRecipe,
    parentId: parent._id,
    set: {title: 'sub1'}
  })
  test.is(sub1._index, 'a0')
  const sub2 = await db.create({
    type: schema.DemoRecipe,
    parentId: parent._id,
    set: {title: 'sub2'}
  })
  test.is(sub2._index, 'a1')
  const sub3 = await db.create({
    type: schema.DemoRecipe,
    parentId: parent._id,
    set: {title: 'sub3'}
  })
  test.is(sub3._index, 'a2')
  await db.move({
    id: sub1._id,
    after: sub2._id
  })
  sub1 = await db.get({type: schema.DemoRecipe, id: sub1._id})
  test.is(sub1._index, 'a1V')
})
