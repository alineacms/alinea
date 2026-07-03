import {createCMS, Entry} from '#/core.js'
import {Config, Field, Query} from '#/index.js'
import {createEntryIndex} from '#test/EntryFixture.js'
import {cms} from '#test/cms.js'
import {DemoRecipe} from '#test/schema/DemoRecipe.js'
import {DemoRecipes} from '#test/schema/DemoRecipes.js'
import {suite} from '@alinea/suite'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import type {Config as CoreConfig} from '../Config.js'
import {DocDB} from '../docdb/DocDB.js'
import {
  createEntryDocOptions,
  EntryDocIndex
} from './EntryDocIndex.js'
import {EntryDocResolver} from './EntryDocResolver.js'

const test = suite(import.meta)

function createDocIndex(config: CoreConfig) {
  const docs = new DocDB(
    connect(new Database(':memory:')),
    createEntryDocOptions(config)
  )
  return new EntryDocIndex(config, docs)
}

test('syncs source entries into DocDB-backed graph', async () => {
  const {source} = await createEntryIndex(cms.config, [
    {
      id: 'recipes',
      type: 'DemoRecipes',
      index: 'a1',
      path: 'recipes',
      data: {title: 'Recipes'}
    },
    {
      id: 'cookie',
      type: 'DemoRecipe',
      index: 'a1',
      parentPaths: ['recipes'],
      path: 'cookie',
      data: {title: 'Cookie'}
    }
  ])
  const index = createDocIndex(cms.config)
  await index.syncWith(source)
  const entries = Array.from(index.filter({}))
  test.equal(
    entries.map(entry => entry.id),
    ['recipes', 'cookie']
  )
  const cookie = index.findFirst(entry => entry.id === 'cookie')
  test.ok(cookie)
  test.is(cookie!.parentId, 'recipes')
  test.equal(cookie!.parents, ['recipes'])
  test.is(cookie!.url, '/recipes/cookie')
})

test('resolves basic projections through EntryDocResolver', async () => {
  const {source} = await createEntryIndex(cms.config, [
    {
      id: 'recipe-a',
      type: 'DemoRecipe',
      index: 'a1',
      path: 'recipe-a',
      data: {title: 'Recipe A'}
    },
    {
      id: 'recipe-b',
      type: 'DemoRecipe',
      index: 'a2',
      path: 'recipe-b',
      data: {title: 'Recipe B'}
    }
  ])
  const index = createDocIndex(cms.config)
  await index.syncWith(source)
  const resolver = new EntryDocResolver(cms.config, index)
  const recipes = await resolver.resolve({
    type: DemoRecipe,
    select: {
      id: Entry.id,
      title: DemoRecipe.title
    },
    orderBy: {asc: DemoRecipe.title}
  })
  test.equal(recipes, [
    {id: 'recipe-a', title: 'Recipe A'},
    {id: 'recipe-b', title: 'Recipe B'}
  ])
})

test('resolves graph edges through EntryDocResolver', async () => {
  const {source} = await createEntryIndex(cms.config, [
    {
      id: 'recipes',
      type: 'DemoRecipes',
      index: 'a1',
      path: 'recipes',
      data: {title: 'Recipes'}
    },
    {
      id: 'cookie',
      type: 'DemoRecipe',
      index: 'a1',
      parentPaths: ['recipes'],
      path: 'cookie',
      data: {title: 'Cookie'}
    }
  ])
  const index = createDocIndex(cms.config)
  await index.syncWith(source)
  const resolver = new EntryDocResolver(cms.config, index)
  const children = await resolver.resolve({
    type: DemoRecipes,
    first: true,
    select: Query.children({
      select: {
        id: Entry.id,
        title: DemoRecipe.title
      }
    })
  })
  test.equal(children, [{id: 'cookie', title: 'Cookie'}])
})

test('removes a deleted status variant without removing the entry node', async () => {
  const {source} = await createEntryIndex(cms.config, [
    {
      id: 'recipe',
      type: 'DemoRecipe',
      index: 'a1',
      path: 'recipe',
      status: 'published',
      data: {title: 'Recipe'}
    },
    {
      id: 'recipe',
      type: 'DemoRecipe',
      index: 'a1',
      path: 'recipe',
      status: 'draft',
      data: {title: 'Recipe draft'}
    }
  ])
  const index = createDocIndex(cms.config)
  await index.syncWith(source)
  test.equal(
    Array.from(index.findMany(entry => entry.id === 'recipe')).map(
      entry => entry.status
    ),
    ['draft', 'published']
  )
  const tree = await source.getTree()
  const draftPath = [...tree.index().keys()].find(path =>
    path.endsWith('.draft.json')
  )
  test.ok(draftPath)
  await index.indexChanges({
    fromSha: index.sha,
    changes: [
      {
        op: 'delete',
        path: draftPath!,
        sha: tree.index().get(draftPath!)!
      }
    ]
  })
  const remaining = Array.from(index.findMany(entry => entry.id === 'recipe'))
  test.equal(
    remaining.map(entry => entry.status),
    ['published']
  )
})

test('indexes references through DocDB edges', async () => {
  const Article = Config.document('Article', {
    fields: {
      title: Field.text('Title'),
      path: Field.path('Path'),
      link: Field.entry('Link')
    }
  })
  const localCms = createCMS({
    schema: {Article},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {pages: Config.root('Pages', {contains: ['Article']})}
      })
    }
  })
  const {source} = await createEntryIndex(localCms.config, [
    {
      id: 'target',
      type: 'Article',
      index: 'a1',
      path: 'target',
      data: {title: 'Target'}
    },
    {
      id: 'source',
      type: 'Article',
      index: 'a2',
      path: 'source',
      data: {title: 'Source', link: {_entry: 'target'}}
    }
  ])
  const index = createDocIndex(localCms.config)
  await index.syncWith(source)
  const refs = await index.referencesTo({targetId: 'target'})
  test.is(refs.total, 1)
  test.is(refs.references[0].sourceId, 'source')
  test.is(refs.references[0].fieldPath, 'link')
})
