import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {FSSource} from '#/core/source/FSSource.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {syncWith, transaction, type Source} from '#/core/source/Source.js'
import {Config as AlineaConfig, Field} from '#/index.js'
import {cms} from '#test/cms.js'
import {createEntrySource, type EntryFixtureEntry} from '#test/EntryFixture.js'
import {config as exampleConfig} from '#test/example.js'
import {asc, eq} from 'rado'
import {DatabaseStateTable} from '../DatabaseTables.js'
import {EntryIndexTable} from '../entry/EntryTable.js'
import {EntryDatabase} from '../EntryDatabase.js'

async function expectInvalidEntries(
  config: Config,
  entries: Array<EntryFixtureEntry>,
  message: string
): Promise<void> {
  const source = await createEntrySource(config, entries)
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, (await new MemorySource().getTree()).sha)
  const runtime = new EntryDatabase(config, db)
  await expect(runtime.syncWith(source)).rejects.toThrow(message)
}

test('runtime serializes sources through one database-bound syncer', async () => {
  const source = new MemorySource()
  await syncWith(source, new FSSource('test/fixtures/demo'))
  let conditionalTreeRequests = 0
  const remote: Source = {
    getTree() {
      throw new Error('EntrySyncer must use getTreeIfDifferent')
    },
    async getTreeIfDifferent(sha) {
      conditionalTreeRequests++
      return source.getTreeIfDifferent(sha)
    },
    getBlobs(shas, options) {
      return source.getBlobs(shas, options)
    },
    applyChanges(batch) {
      return source.applyChanges(batch)
    }
  }
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, 'empty')
  const runtime = new EntryDatabase(cms.config, db)

  const [first, repeated] = await Promise.all([
    runtime.syncWith(remote),
    runtime.syncWith(remote)
  ])
  expect(repeated).toEqual({revision: first.revision, changedEntryIds: []})
  expect(await runtime.getRevision()).toBe(first.revision)
  expect(
    await db
      .select(DatabaseStateTable.tree)
      .from(DatabaseStateTable)
      .where(eq(DatabaseStateTable.id, 1))
      .get()
  ).toMatchObject({sha: first.revision})
  expect(first.changedEntryIds.length).toBeGreaterThan(0)
  expect(conditionalTreeRequests).toBe(2)
  const recipes = await db
    .select({childrenSha: EntryIndexTable.childrenSha})
    .from(EntryIndexTable)
    .where(eq(EntryIndexTable.id, '2cGLQZvsCCxnguLrwCfPDL8uFkm'))
    .get()
  expect(recipes?.childrenSha).toBe(
    (await source.getTree()).getNode('pages/recipes').sha
  )
  expect(
    await runtime.resolve({
      path: 'recipes',
      select: {title: Entry.title, filePath: Entry.filePath}
    })
  ).toEqual([{title: 'Recipes', filePath: 'pages/recipes.json'}])

  const leafChange = await transaction(source)
  const updatedLeaf = await leafChange
    .add(
      'pages/recipes/chocolate-chip.json',
      new TextEncoder().encode(
        JSON.stringify({
          _id: 'oi4qtV9YaXNRIUDT2s61Y',
          _type: 'DemoRecipe',
          _index: 'Zz',
          _i18nId: 'oi4qtV9YaXNRIUDT2s61Y',
          _root: 'pages',
          title: 'Updated chocolate chip'
        })
      )
    )
    .compile()
  await source.applyChanges({
    fromSha: updatedLeaf.from.sha,
    changes: updatedLeaf.changes
  })

  const leafSync = await runtime.syncWith(remote)
  expect(leafSync.changedEntryIds).toEqual([
    '2cGLQZvsCCxnguLrwCfPDL8uFkm',
    'oi4qtV9YaXNRIUDT2s61Y'
  ])
  expect(
    await runtime.resolve({
      path: 'chocolate-chip',
      select: Entry.title
    })
  ).toEqual(['Updated chocolate chip'])

  const change = await transaction(source)
  const next = await change
    .add(
      'pages/recipes.json',
      new TextEncoder().encode(
        JSON.stringify({
          _id: '2cGLQZvsCCxnguLrwCfPDL8uFkm',
          _type: 'DemoRecipes',
          _index: 'a1',
          _i18nId: '2cGLQZvsCCxnguLrwCfPDL8uFkm',
          _seeded: '/recipes.json',
          _root: 'pages',
          title: 'Updated recipes'
        })
      )
    )
    .compile()
  await source.applyChanges({fromSha: next.from.sha, changes: next.changes})

  const second = await runtime.syncWith(remote)
  expect(second.revision).not.toBe(leafSync.revision)
  expect(second.changedEntryIds).toContain('2cGLQZvsCCxnguLrwCfPDL8uFkm')
  expect(await runtime.getRevision()).toBe(second.revision)
  expect(await runtime.resolve({path: 'recipes', select: Entry.title})).toEqual(
    ['Updated recipes']
  )

  const archive = await transaction(source)
  const archived = await archive
    .rename('pages/recipes.json', 'pages/recipes.archived.json')
    .compile()
  await source.applyChanges({
    fromSha: archived.from.sha,
    changes: archived.changes
  })

  const archivedSync = await runtime.syncWith(remote)
  expect(archivedSync.changedEntryIds).toContain('2cGLQZvsCCxnguLrwCfPDL8uFkm')
  expect(
    await runtime.resolve({status: 'published', select: Entry.path})
  ).not.toContain('recipes')
  expect(
    await runtime.resolve({status: 'archived', select: Entry.path})
  ).toEqual(expect.arrayContaining(['recipes', 'chocolate-chip']))
})

test('rejects incompatible authored versions of one entry', async () => {
  await expectInvalidEntries(
    cms.config,
    [
      {
        id: 'same-entry',
        type: 'DemoRecipe',
        index: 'a0',
        path: 'same',
        status: 'published'
      },
      {
        id: 'same-entry',
        type: 'DemoRecipes',
        index: 'a0',
        path: 'same',
        status: 'draft'
      }
    ],
    'pages/same.draft.json: _type="DemoRecipes"'
  )
})

test('rejects mismatched indexes, roots, and workspaces', async () => {
  await expectInvalidEntries(
    cms.config,
    [
      {
        id: 'same-entry',
        type: 'DemoRecipe',
        index: 'a0',
        path: 'same',
        status: 'published'
      },
      {
        id: 'same-entry',
        type: 'DemoRecipe',
        index: 'b0',
        path: 'same',
        status: 'draft'
      }
    ],
    'pages/same.draft.json: _index="b0"'
  )

  await expectInvalidEntries(
    cms.config,
    [
      {
        id: 'same-entry',
        type: 'DemoRecipe',
        index: 'a0',
        path: 'same',
        status: 'published',
        root: 'pages'
      },
      {
        id: 'same-entry',
        type: 'DemoRecipe',
        index: 'a0',
        path: 'same',
        status: 'draft',
        root: 'media'
      }
    ],
    'Mismatched authored entry versions for same-entry'
  )

  const multiWorkspaceConfig: Config = {
    ...cms.config,
    workspaces: {
      demo: cms.config.workspaces.demo,
      second: cms.config.workspaces.demo
    }
  }
  await expectInvalidEntries(
    multiWorkspaceConfig,
    [
      {
        id: 'same-entry',
        type: 'DemoRecipe',
        index: 'a0',
        path: 'same',
        status: 'published',
        workspace: 'demo'
      },
      {
        id: 'same-entry',
        type: 'DemoRecipe',
        index: 'a0',
        path: 'same',
        status: 'draft',
        workspace: 'second'
      }
    ],
    'Mismatched authored entry versions for same-entry'
  )
})

test('rejects translations with different logical parents', async () => {
  await expectInvalidEntries(
    exampleConfig,
    [
      {
        id: 'parent-en',
        type: 'Page',
        index: 'a0',
        path: 'parent-en',
        root: 'multiLanguage',
        locale: 'en'
      },
      {
        id: 'parent-fr',
        type: 'Page',
        index: 'a0',
        path: 'parent-fr',
        root: 'multiLanguage',
        locale: 'fr'
      },
      {
        id: 'same-entry',
        type: 'Page',
        index: 'a0',
        path: 'child',
        root: 'multiLanguage',
        locale: 'en',
        parentPaths: ['parent-en']
      },
      {
        id: 'same-entry',
        type: 'Page',
        index: 'a0',
        path: 'child',
        root: 'multiLanguage',
        locale: 'fr',
        parentPaths: ['parent-fr']
      }
    ],
    'Mismatched authored entry versions for same-entry'
  )
})

test('rejects mismatched paths between status versions', async () => {
  await expectInvalidEntries(
    cms.config,
    [
      {
        id: 'same-entry',
        type: 'DemoRecipe',
        index: 'a0',
        path: 'published-path',
        status: 'published'
      },
      {
        id: 'same-entry',
        type: 'DemoRecipe',
        index: 'a0',
        path: 'draft-path',
        status: 'draft'
      }
    ],
    'Mismatched authored language versions for same-entry'
  )
})

async function openRuntime(config: Config) {
  const sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, (await new MemorySource().getTree()).sha)
  return {sqlite, db, runtime: new EntryDatabase(config, db)}
}

function storedRows(db: ReturnType<typeof connect>) {
  return db
    .select()
    .from(EntryIndexTable)
    .orderBy(asc(EntryIndexTable.versionId))
}

/** Sync incrementally, and expect the rows a full sync of the source writes. */
async function syncLikeFullSync(
  config: Config,
  source: MemorySource,
  incremental: Awaited<ReturnType<typeof openRuntime>>
) {
  const result = await incremental.runtime.syncWith(source)
  const full = await openRuntime(config)
  try {
    await full.runtime.syncWith(source)
    expect(await storedRows(incremental.db)).toEqual(await storedRows(full.db))
  } finally {
    await full.runtime.close()
    full.sqlite.close()
  }
  return result
}

async function change(
  source: MemorySource,
  edit: (tx: Awaited<ReturnType<typeof transaction>>) => void
) {
  const tx = await transaction(source)
  edit(tx)
  const compiled = await tx.compile()
  await source.applyChanges({
    fromSha: compiled.from.sha,
    changes: compiled.changes
  })
}

function recipe(id: string, title: string) {
  return new TextEncoder().encode(
    JSON.stringify({
      _id: id,
      _type: 'DemoRecipe',
      _index: 'a0',
      _i18nId: id,
      _root: 'pages',
      title
    })
  )
}

test('incremental syncs derive what a full sync derives', async () => {
  const source = new MemorySource()
  await syncWith(source, new FSSource('test/fixtures/demo'))
  await change(source, tx =>
    tx.add('pages/recipes/chocolate-chip/variant.json', recipe('variant', 'V'))
  )
  const incremental = await openRuntime(cms.config)
  const variant = () =>
    incremental.db
      .select({
        status: EntryIndexTable.status,
        parents: EntryIndexTable.parents,
        level: EntryIndexTable.level,
        url: EntryIndexTable.url
      })
      .from(EntryIndexTable)
      .where(eq(EntryIndexTable.id, 'variant'))
      .get()
  try {
    await syncLikeFullSync(cms.config, source, incremental)
    const recipes = '2cGLQZvsCCxnguLrwCfPDL8uFkm'
    const chocolateChip = 'oi4qtV9YaXNRIUDT2s61Y'
    expect(await variant()).toEqual({
      status: 'published',
      parents: [recipes, chocolateChip],
      level: 2,
      url: '/recipes/chocolate-chip/variant'
    })

    // A parent's status passes on to its children and grandchildren.
    await change(source, tx =>
      tx.rename('pages/recipes.json', 'pages/recipes.draft.json')
    )
    const drafted = await syncLikeFullSync(cms.config, source, incremental)
    expect(drafted.changedEntryIds).toContain('variant')
    expect((await variant())?.status).toBe('draft')
    await change(source, tx =>
      tx.rename('pages/recipes.draft.json', 'pages/recipes.json')
    )
    await syncLikeFullSync(cms.config, source, incremental)
    expect((await variant())?.status).toBe('published')
    await change(source, tx =>
      tx.rename(
        'pages/recipes/chocolate-chip.json',
        'pages/recipes/chocolate-chip.archived.json'
      )
    )
    await syncLikeFullSync(cms.config, source, incremental)
    expect((await variant())?.status).toBe('archived')

    // Moving an entry with its children updates their parents and urls.
    await change(source, tx => {
      tx.rename('pages/recipes.json', 'pages/cookies.json')
      for (const file of [
        'chocolate-chip.archived.json',
        'chocolate-chip/variant.json',
        'gingerbread.json',
        'oatmeal-raisin.json',
        'snickerdoodle.json'
      ])
        tx.rename(`pages/recipes/${file}`, `pages/cookies/${file}`)
    })
    await syncLikeFullSync(cms.config, source, incremental)
    expect(await variant()).toMatchObject({
      parents: [recipes, chocolateChip],
      url: '/cookies/chocolate-chip/variant'
    })

    // Children of a removed entry move up to the next entry above them, and
    // are adopted again once an entry takes its place.
    await change(source, tx => tx.remove('pages/cookies.json'))
    const orphaned = await syncLikeFullSync(cms.config, source, incremental)
    expect(orphaned.changedEntryIds).toContain('variant')
    expect((await variant())?.parents).toEqual([chocolateChip])
    await change(source, tx =>
      tx.add('pages/cookies.json', recipe('cookies', 'Cookies'))
    )
    const adopted = await syncLikeFullSync(cms.config, source, incremental)
    expect(adopted.changedEntryIds).toContain('variant')
    expect((await variant())?.parents).toEqual(['cookies', chocolateChip])
  } finally {
    await incremental.runtime.close()
    incremental.sqlite.close()
  }
})

test('a language takes the url of the version that becomes main', async () => {
  const Dated = AlineaConfig.type('Dated', {
    fields: {title: Field.text('Title'), path: Field.path('Path')},
    entryUrl: ({status, path}) => `/${status}/${path}`
  })
  const config: Config = {
    ...cms.config,
    schema: {...cms.config.schema, Dated}
  }
  const source = new MemorySource()
  const record = (title: string) =>
    new TextEncoder().encode(
      JSON.stringify({
        _id: 'dated',
        _type: 'Dated',
        _index: 'a0',
        _i18nId: 'dated',
        _root: 'pages',
        title
      })
    )
  await change(source, tx => {
    tx.add('pages/dated.json', record('Published'))
    tx.add('pages/dated.draft.json', record('Draft'))
  })
  const incremental = await openRuntime(config)
  const urls = async () =>
    (
      await incremental.db
        .select({url: EntryIndexTable.url})
        .from(EntryIndexTable)
        .where(eq(EntryIndexTable.id, 'dated'))
    ).map(row => row.url)
  try {
    await syncLikeFullSync(config, source, incremental)
    expect(await urls()).toEqual(['/published/dated', '/published/dated'])
    await change(source, tx => tx.remove('pages/dated.json'))
    await syncLikeFullSync(config, source, incremental)
    expect(await urls()).toEqual(['/draft/dated'])
    await change(source, tx => tx.add('pages/dated.json', record('Again')))
    await syncLikeFullSync(config, source, incremental)
    expect(await urls()).toEqual(['/published/dated', '/published/dated'])
  } finally {
    await incremental.runtime.close()
    incremental.sqlite.close()
  }
})

test('a sync of more than one batch moves an entry to an earlier path', async () => {
  const source = new MemorySource()
  await syncWith(source, new FSSource('test/fixtures/demo'))
  await change(source, tx =>
    tx.add('pages/recipes/zz-moved.json', recipe('moved', 'Moved'))
  )
  const incremental = await openRuntime(cms.config)
  try {
    await syncLikeFullSync(cms.config, source, incremental)
    // More changes than one ingest batch lie between the new and old path.
    await change(source, tx => {
      tx.rename('pages/recipes/zz-moved.json', 'pages/recipes/aa-moved.json')
      for (let index = 0; index < 300; index++) {
        const id = `filler${String(index).padStart(3, '0')}`
        tx.add(`pages/recipes/mm-${id}.json`, recipe(id, id))
      }
    })
    await syncLikeFullSync(cms.config, source, incremental)
    expect(
      await incremental.db
        .select(EntryIndexTable.filePath)
        .from(EntryIndexTable)
        .where(eq(EntryIndexTable.id, 'moved'))
    ).toEqual(['pages/recipes/aa-moved.json'])
  } finally {
    await incremental.runtime.close()
    incremental.sqlite.close()
  }
})
