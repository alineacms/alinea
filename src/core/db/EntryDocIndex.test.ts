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
import type {ChangesBatch} from '../source/Change.js'
import type {Source} from '../source/Source.js'
import type {ReadonlyTree} from '../source/Tree.js'
import {createEntryDocOptions, EntryDocIndex} from './EntryDocIndex.js'
import {EntryDocResolver} from './EntryDocResolver.js'

const test = suite(import.meta)

class TreeOnlySource implements Source {
  requestedBlobs = Array<string>()

  constructor(
    private tree: ReadonlyTree,
    private blobs: Map<string, Uint8Array>
  ) {}

  async getTree(): Promise<ReadonlyTree> {
    return this.tree
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    return sha === this.tree.sha ? undefined : this.tree
  }

  async *getBlobs(
    shas: Array<string>
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    for (const sha of shas) {
      this.requestedBlobs.push(sha)
      const blob = this.blobs.get(sha)
      if (!blob) throw new Error(`Unexpected blob request: ${sha}`)
      yield [sha, blob]
    }
  }

  async applyChanges(batch: ChangesBatch): Promise<void> {
    void batch
    throw new Error('TreeOnlySource cannot be mutated')
  }
}

function createDocIndex(config: CoreConfig) {
  const docs = new DocDB(
    connect(new Database(':memory:')),
    createEntryDocOptions(config)
  )
  return new EntryDocIndex(config, docs)
}

test('syncs source entries into DocDB', async () => {
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
  test.is(index.docs.count({kind: 'entry'}), 2)
  const resolver = new EntryDocResolver(cms.config, index)
  const entries = await resolver.resolve({
    status: 'all',
    select: {
      id: Entry.id,
      parentId: Entry.parentId,
      parents: Entry.parents,
      url: Entry.url
    }
  })
  test.equal(
    entries.map(entry => entry.id),
    ['recipes', 'cookie']
  )
  const cookie = entries.find(entry => entry.id === 'cookie')
  test.ok(cookie)
  test.is(cookie?.parentId, 'recipes')
  test.equal(cookie?.parents, ['recipes'])
  test.is(cookie?.url, '/recipes/cookie')
})

test('hydrates tree from DocDB rows and syncs changed blobs only', async () => {
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
  const persistedDatabase = new Database(':memory:')
  const persistedDocs = new DocDB(
    connect(persistedDatabase),
    createEntryDocOptions(cms.config)
  )
  const original = new EntryDocIndex(cms.config, persistedDocs)
  await original.syncWith(source)

  const image = persistedDatabase.serialize()
  const restoredDocs = new DocDB(
    connect(Database.deserialize(image)),
    createEntryDocOptions(cms.config)
  )
  const hydrated = new EntryDocIndex(cms.config, restoredDocs)
  await hydrated.hydrateTreeFromDocs()
  test.is(hydrated.sha, original.sha)

  const {source: updatedSource} = await createEntryIndex(cms.config, [
    {
      id: 'recipes',
      type: 'DemoRecipes',
      index: 'a1',
      path: 'recipes',
      data: {title: 'Updated recipes'}
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
  const remoteTree = await updatedSource.getTree()
  const changedShas = [...remoteTree.shas].filter(sha => {
    return !hydrated.tree.hasSha(sha)
  })
  const changedBlobs = new Map<string, Uint8Array>()
  for await (const [sha, blob] of updatedSource.getBlobs(changedShas)) {
    changedBlobs.set(sha, blob)
  }
  const remote = new TreeOnlySource(remoteTree, changedBlobs)

  await hydrated.syncWith(remote)

  test.equal(remote.requestedBlobs, changedShas)
  const resolver = new EntryDocResolver(cms.config, hydrated)
  test.equal(
    await resolver.resolve({
      id: 'recipes',
      first: true,
      select: {
        title: DemoRecipes.title
      }
    }),
    {title: 'Updated recipes'}
  )
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

test('resolves structural edges through EntryDocResolver', async () => {
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
    },
    {
      id: 'brownie',
      type: 'DemoRecipe',
      index: 'a2',
      parentPaths: ['recipes'],
      path: 'brownie',
      data: {title: 'Brownie'}
    },
    {
      id: 'chunky',
      type: 'DemoRecipe',
      index: 'a1',
      parentPaths: ['recipes', 'cookie'],
      path: 'chunky',
      data: {title: 'Chunky'}
    }
  ])
  const index = createDocIndex(cms.config)
  await index.syncWith(source)
  const resolver = new EntryDocResolver(cms.config, index)

  test.is(
    await resolver.resolve({
      id: 'cookie',
      first: true,
      select: Query.parent({select: Entry.id})
    }),
    'recipes'
  )
  test.equal(
    await resolver.resolve({
      id: 'chunky',
      first: true,
      select: Query.parents({select: Entry.id})
    }),
    ['recipes', 'cookie']
  )
  test.equal(
    await resolver.resolve({
      id: 'cookie',
      first: true,
      select: Query.siblings({select: Entry.id})
    }),
    ['brownie']
  )
  test.is(
    await resolver.resolve({
      id: 'cookie',
      first: true,
      select: Query.next({select: Entry.id})
    }),
    'brownie'
  )
  test.is(
    await resolver.resolve({
      id: 'brownie',
      first: true,
      select: Query.previous({select: Entry.id})
    }),
    'cookie'
  )
})

test('resolves translations through EntryDocResolver', async () => {
  const Article = Config.document('Article', {
    fields: {
      title: Field.text('Title'),
      path: Field.path('Path')
    }
  })
  const localizedRoot = Config.root('Localized', {
    i18n: {locales: ['en', 'de']},
    contains: ['Article']
  })
  const localCms = createCMS({
    schema: {Article},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {localized: localizedRoot}
      })
    }
  })
  const {source} = await createEntryIndex(localCms.config, [
    {
      id: 'trans',
      type: 'Article',
      index: 'a1',
      root: 'localized',
      locale: 'en',
      path: 'trans',
      data: {title: 'Trans EN'}
    },
    {
      id: 'trans',
      type: 'Article',
      index: 'a1',
      root: 'localized',
      locale: 'de',
      path: 'trans',
      data: {title: 'Trans DE'}
    }
  ])
  const index = createDocIndex(localCms.config)
  await index.syncWith(source)
  const resolver = new EntryDocResolver(localCms.config, index)

  test.equal(
    await resolver.resolve({
      id: 'trans',
      root: localizedRoot,
      locale: 'en',
      first: true,
      select: Query.translations({select: Entry.locale})
    }),
    ['de']
  )
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
  const resolver = new EntryDocResolver(cms.config, index)
  test.equal(
    await resolver.resolve({
      status: 'all',
      id: 'recipe',
      select: Entry.status,
      orderBy: {asc: Entry.status}
    }),
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
  test.equal(
    await resolver.resolve({
      status: 'all',
      id: 'recipe',
      select: Entry.status,
      orderBy: {asc: Entry.status}
    }),
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
      data: {
        title: 'Source',
        link: {
          _id: 'source-link',
          _type: 'entry',
          _entry: 'target',
          _suffix: '?from=source'
        }
      }
    }
  ])
  const index = createDocIndex(localCms.config)
  await index.syncWith(source)
  const refs = await index.referencesTo({targetId: 'target'})
  test.is(refs.total, 1)
  test.is(refs.references[0].sourceId, 'source')
  test.is(refs.references[0].fieldPath, 'link')

  const resolver = new EntryDocResolver(localCms.config, index)
  const link = await resolver.resolve({
    id: 'source',
    first: true,
    select: Article.link
  })
  test.is(link?.entryId, 'target')
  test.is(link?.title, 'Target')
  test.is(link?.url, '/target?from=source')
  test.is(link?.href, '/target?from=source')
})
