import {suite} from '@alinea/suite'
import {cms} from '../../test/cms'
import {Entry} from '../Entry.js'
import {FSSource} from '../source/FSSource.js'
import {MemorySource} from '../source/MemorySource.js'
import {syncWith} from '../source/Source.js'
import {LocalDB} from './LocalDB.js'

const dir = 'src/test/fixtures/demo'
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

test('create entry', async () => {
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

/*test('remove entry', async () => {
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
})*/

test('update entry', async () => {
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
