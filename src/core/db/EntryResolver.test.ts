import {suite} from '@alinea/suite'
import {Query} from 'alinea'
import {Entry} from 'alinea/core'
import {MediaFile} from 'alinea/core/media/MediaTypes'
import {cms} from '../../test/cms.js'
import {DemoRecipe} from '../../test/schema/DemoRecipe.js'
import {DemoRecipes} from '../../test/schema/DemoRecipes.js'
import {FSSource} from '../source/FSSource.js'
import {EntryIndex} from './EntryIndex.js'
import {EntryResolver} from './EntryResolver.js'

const test = suite(import.meta)

const dir = 'src/test/fixtures/demo'
const source = new FSSource(dir)

const index = new EntryIndex(cms.config)
const resolver = new EntryResolver(cms.config, index)
await index.syncWith(source)

test('filter by id', async () => {
  console.time('filter by id')
  const entry2 = await resolver.resolve({
    id: 'oi4qtV9YaXNRIUDT2s61Y'
  })
  console.timeEnd('filter by id')
  test.is(entry2.length, 1)
})

test('filter by type', async () => {
  const files = await resolver.resolve({
    type: MediaFile
  })
  test.is(files.length, 5)
})

test('filter by location', async () => {
  const files = await resolver.resolve({
    location: cms.workspaces.demo.media
  })
  test.is(files.length, 5)

  const inWorkspace = await resolver.resolve({
    location: cms.workspaces.demo
  })
  test.is(inWorkspace.length, 11)
})

test('filter by language', async () => {
  const entries = await resolver.resolve({
    locale: 'en'
  })
  test.is(entries.length, 0)
})

test('select fields', async () => {
  const [recipe1] = await resolver.resolve({
    type: DemoRecipe,
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: {
      title_: DemoRecipe.title,
      intro: DemoRecipe.intro,
      id: Entry.id
    }
  })
  test.is(recipe1.title_, 'Chocolate chip')
  test.is(recipe1.id, 'oi4qtV9YaXNRIUDT2s61Y')
  test.ok(recipe1.intro)
})

test('select edges', async () => {
  const [recipes] = await resolver.resolve({
    type: DemoRecipes,
    select: Query.children({
      select: DemoRecipe.header
    })
  })
  test.is(recipes.length, 4)
  for (const header of recipes) {
    test.ok(header.image.src)
  }
})

test('select siblings', async () => {
  const siblings = await resolver.resolve({
    first: true,
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: Query.siblings({
      select: Query.id
    })
  })
  test.is(siblings!.length, 3)
})

test('select next', async () => {
  const nextId = await resolver.resolve({
    first: true,
    id: 'oU_7ZAszAXwar__BCXVIt',
    select: Query.next({
      select: Query.id
    })
  })
  test.is(nextId, 'uENumuMjqX0fSbGtrf2fj')
})

test('select next', async () => {
  const nextId = await resolver.resolve({
    first: true,
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: Query.next({
      select: Query.id
    })
  })
  test.is(nextId, undefined)
})

test('select previous', async () => {
  const previousId = await resolver.resolve({
    first: true,
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: Query.previous({
      select: Query.id
    })
  })
  test.is(previousId, 'uENumuMjqX0fSbGtrf2fj')
})

test('select parent', async () => {
  const id1 = await resolver.resolve({
    first: true,
    type: DemoRecipe,
    select: Entry.parentId
  })
  const id2 = await resolver.resolve({
    first: true,
    type: DemoRecipe,
    select: Query.parent({
      select: Entry.id
    })
  })
  test.is(id1, id2)
})

test('order by', async () => {
  const first = await resolver.resolve({
    type: DemoRecipe,
    select: DemoRecipe.title,
    orderBy: {asc: DemoRecipe.title},
    first: true
  })
  test.is(first, 'Chocolate chip')

  const last = await resolver.resolve({
    type: DemoRecipe,
    select: DemoRecipe.title,
    orderBy: {desc: DemoRecipe.title},
    first: true
  })
  test.is(last, 'Snickerdoodle')
})

test('group by', async () => {
  const files = await resolver.resolve({
    type: MediaFile,
    groupBy: MediaFile.extension
  })
  test.is(files.length, 1)
})

test('preview existing entry', async () => {
  const entry = await resolver.resolve({
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: Entry,
    first: true
  })
  test.is(entry!.title, 'Chocolate chip')

  const entry2 = await resolver.resolve({
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: Entry,
    first: true,
    preview: {
      entry: {...entry!, title: 'Chocolate chip preview'}
    }
  })
  test.is(entry2!.title, 'Chocolate chip preview')
})
