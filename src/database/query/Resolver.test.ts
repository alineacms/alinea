import {describe, expect, test} from 'bun:test'
import {Entry, type Entry as EntryValue} from '#/core/Entry.js'
import {Query} from '#/index.js'
import {FSSource} from '#/core/source/FSSource.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {cms} from '#test/cms.js'
import {createRuntimeStore} from '#test/EntryFixture.js'
import {DemoRecipe} from '#test/schema/DemoRecipe.js'
import {DemoRecipes} from '#test/schema/DemoRecipes.js'
import type {EntryCoreRecord, EntrySearchRecord} from '../entry/Model.js'
import type {EntryStore} from '../entry/Store.js'
import {DatabaseResolver} from './Resolver.js'

const store = await createRuntimeStore(
  cms.config,
  new FSSource('test/fixtures/demo')
)
const current = new DatabaseResolver(cms.config, store)

describe('DatabaseResolver', () => {
  test('filters structural fields', async () => {
    const queries = [
      {id: 'oi4qtV9YaXNRIUDT2s61Y', select: Entry.id},
      {type: MediaFile, select: Entry.id},
      {location: cms.workspaces.demo.media, select: Entry.id},
      {parentId: '2cGLQZvsCCxnguLrwCfPDL8uFkm', select: Entry.id}
    ] as const
    for (const query of queries)
      expect((await current.resolve(query)).length).toBeGreaterThan(0)
  })

  test('combines top-level boolean filters', async () => {
    expect(
      await current.resolve({
        filter: {
          or: [
            {title: 'Chocolate chip'},
            {
              and: [{_type: 'DemoRecipe'}, {title: 'Gingerbread'}]
            }
          ]
        },
        select: Entry.title
      })
    ).toEqual(['Gingerbread', 'Chocolate chip'])
  })

  test('selects fields and nested objects', async () => {
    expect(
      await current.resolve({
        id: 'oi4qtV9YaXNRIUDT2s61Y',
        select: {
          title: DemoRecipe.title,
          intro: DemoRecipe.intro,
          id: Entry.id,
          url: Entry.url
        }
      })
    ).toEqual([
      {
        title: 'Chocolate chip',
        intro: expect.any(Array),
        id: 'oi4qtV9YaXNRIUDT2s61Y',
        url: '/recipes/chocolate-chip'
      }
    ])
  })

  test('traverses structural edges', async () => {
    const queries = [
      {
        first: true as const,
        id: '2cGLQZvsCCxnguLrwCfPDL8uFkm',
        select: Query.children({select: Entry.id})
      },
      {
        first: true as const,
        id: 'oi4qtV9YaXNRIUDT2s61Y',
        select: Query.siblings({select: Entry.id})
      },
      {
        first: true as const,
        id: 'oi4qtV9YaXNRIUDT2s61Y',
        select: Query.parent({select: Entry.id})
      },
      {
        first: true as const,
        id: 'oi4qtV9YaXNRIUDT2s61Y',
        select: Query.parents({select: Entry.id})
      }
    ]
    const [children, siblings, parent, parents] = await Promise.all(
      queries.map(query => current.resolve(query))
    )
    expect(children).toContain('oi4qtV9YaXNRIUDT2s61Y')
    expect(siblings).toContain('oU_7ZAszAXwar__BCXVIt')
    expect(parent).toBe('2cGLQZvsCCxnguLrwCfPDL8uFkm')
    expect(parents).toEqual(['2cGLQZvsCCxnguLrwCfPDL8uFkm'])
  })

  test('orders, groups and pages', async () => {
    expect(
      await current.resolve({
        type: DemoRecipe,
        orderBy: {asc: DemoRecipe.title},
        groupBy: Entry.parentId,
        take: 1,
        select: {id: Entry.id, title: DemoRecipe.title}
      })
    ).toEqual([{id: 'P7QDb99Sp1JS5FyqCXXn3', title: 'Gingerbread'}])
  })

  test('searches with deterministic ranking', async () => {
    expect(
      await current.resolve({
        type: [DemoRecipe, DemoRecipes],
        search: 'chocolate',
        select: {id: Entry.id, title: Entry.title}
      })
    ).toEqual([{id: 'oi4qtV9YaXNRIUDT2s61Y', title: 'Chocolate chip'}])
  })

  test('previews an existing entry without rebuilding the store', async () => {
    const entry = await current.resolve({
      id: 'oi4qtV9YaXNRIUDT2s61Y',
      select: Entry,
      first: true
    })
    const query = {
      id: entry!.id,
      select: {title: Entry.title, id: Entry.id},
      first: true as const,
      preview: {
        entry: {
          ...entry!,
          fileHash: 'preview',
          data: {...entry!.data, title: 'Chocolate chip preview'}
        }
      }
    }
    expect(await current.resolve(query)).toEqual({
      title: 'Chocolate chip preview',
      id: 'oi4qtV9YaXNRIUDT2s61Y'
    })
  })

  test('stages preview core changes without loading candidate payloads', async () => {
    const entry = await current.resolve({
      id: 'oi4qtV9YaXNRIUDT2s61Y',
      select: Entry,
      first: true
    })
    const previewTitle = 'A preview recipe'
    const previewUrl = '/preview-recipe'
    const preview = {
      entry: {
        ...entry!,
        fileHash: 'preview',
        url: previewUrl,
        data: {...entry!.data, title: previewTitle}
      }
    }
    const tracked = trackingStore(store)
    const resolver = new DatabaseResolver(cms.config, tracked.store)

    expect(
      await resolver.resolve({
        type: DemoRecipe,
        preview,
        select: Entry.id
      })
    ).toHaveLength(4)
    expect(
      await resolver.resolve({
        filter: {title: previewTitle},
        preview,
        select: Entry.id
      })
    ).toEqual([entry!.id])
    expect(
      await resolver.resolve({
        filter: {title: entry!.title},
        preview,
        select: Entry.id
      })
    ).toEqual([])
    expect(
      await resolver.resolve({
        url: previewUrl,
        preview,
        select: Entry.id
      })
    ).toEqual([entry!.id])
    expect(
      await resolver.resolve({
        url: entry!.url,
        preview,
        select: Entry.id
      })
    ).toEqual([])
    expect(
      await resolver.resolve({
        type: DemoRecipe,
        orderBy: {asc: Entry.title},
        take: 1,
        preview,
        select: {id: Entry.id, intro: DemoRecipe.intro}
      })
    ).toEqual([{id: entry!.id, intro: entry!.data.intro}])
    expect(tracked.dataLoads()).toBe(0)
  })

  test('reuses the hot search index for preview queries', async () => {
    const entry = await current.resolve({
      id: 'oi4qtV9YaXNRIUDT2s61Y',
      select: Entry,
      first: true
    })
    const tracked = trackingStore(store)
    const resolver = new DatabaseResolver(cms.config, tracked.store)
    await resolver.resolve({search: 'chocolate', select: Entry.id})
    const warmLoads = tracked.searchLoads()
    const preview = {
      entry: {
        ...entry!,
        fileHash: 'preview',
        data: {...entry!.data, title: 'Quasar recipe'}
      }
    }

    expect(
      await resolver.resolve({
        search: 'quasar',
        preview,
        select: Entry.id
      })
    ).toEqual([entry!.id])
    expect(tracked.searchLoads()).toBe(warmLoads)
  })

  test('does not load payloads for index-only projections and counts', async () => {
    const tracked = trackingStore(store)
    const resolver = new DatabaseResolver(cms.config, tracked.store)
    await resolver.resolve({
      id: 'oi4qtV9YaXNRIUDT2s61Y',
      select: Entry.id,
      first: true
    })
    expect(await resolver.resolve({type: DemoRecipe, count: true})).toBe(4)
    expect(tracked.dataLoads()).toBe(0)
  })

  test('pages index candidates before loading projected payloads', async () => {
    const tracked = trackingStore(store)
    const resolver = new DatabaseResolver(cms.config, tracked.store)
    expect(
      await resolver.resolve({
        type: DemoRecipe,
        orderBy: {asc: Entry.title},
        take: 1,
        select: {title: Entry.title, intro: DemoRecipe.intro}
      })
    ).toEqual([{title: 'Chocolate chip', intro: expect.any(Array)}])
    expect(tracked.dataLoads()).toBe(1)
  })

  test('uses structural conjuncts before loading data filters', async () => {
    const tracked = trackingStore(store)
    const resolver = new DatabaseResolver(cms.config, tracked.store)
    expect(
      await resolver.resolve({
        filter: {
          and: [
            {_type: 'DemoRecipe'},
            {intro: {includes: {_type: 'paragraph'}}}
          ]
        },
        select: Entry.id
      })
    ).toHaveLength(4)
    expect(tracked.dataLoads()).toBe(4)
  })

  test('stops loading data frames after a filtered page is full', async () => {
    const cores: Array<EntryCoreRecord> = Array.from(
      {length: 100},
      (_, index) => ({
        kind: 'entry',
        id: `entry:test/${index}.json`,
        queryable: true,
        entryId: `entry-${index}`,
        versionStatus: 'published',
        status: 'published',
        active: true,
        main: true,
        type: 'DemoRecipe',
        title: `Entry ${index}`,
        seeded: null,
        workspace: 'demo',
        root: 'pages',
        locale: null,
        level: 0,
        index: String(index).padStart(3, '0'),
        parentId: null,
        parents: [],
        path: `entry-${index}`,
        url: `/entry-${index}`
      })
    )
    let loaded = 0
    function toEntry(core: EntryCoreRecord): EntryValue {
      return {
        id: core.entryId,
        versionStatus: core.versionStatus,
        status: core.status,
        title: core.title,
        type: core.type,
        seeded: core.seeded,
        workspace: core.workspace,
        root: core.root,
        level: core.level,
        filePath: `${core.path}.json`,
        parentDir: 'pages',
        childrenDir: `pages/${core.path}`,
        index: core.index,
        parentId: core.parentId,
        parents: [...core.parents],
        locale: core.locale,
        rowHash: core.id,
        active: core.active,
        main: core.main,
        path: core.path,
        fileHash: core.id,
        url: core.url,
        data: {match: Number(core.index) % 10 === 0},
        searchableText: ''
      }
    }
    const staged: EntryStore = {
      revision: 'test',
      async cores() {
        return cores
      },
      async load(core) {
        loaded++
        return toEntry(core)
      },
      async loadMany(items) {
        loaded += items.length
        return items.map(toEntry)
      },
      async search() {
        return
      },
      async searchMany(items) {
        return new Array<EntrySearchRecord | undefined>(items.length)
      },
      async *referencesTo() {},
      async *referencesFrom() {}
    }
    const resolver = new DatabaseResolver(cms.config, staged)
    expect(
      await resolver.resolve({
        filter: {match: true} as never,
        take: 2,
        select: Entry.id
      })
    ).toEqual(['entry-0', 'entry-10'])
    expect(loaded).toBe(16)
  })

  test('reads references from lazy reference frames', async () => {
    const [link] = await current.referencesFrom('oi4qtV9YaXNRIUDT2s61Y')
    expect(link).toBeDefined()
    const actual = await current.referencesTo({
      targetId: link.targetId,
      status: 'all'
    })
    expect(actual.references).toContainEqual(link)
    expect(actual.scan.complete).toBe(true)
  })
})

function trackingStore(source: EntryStore): {
  store: EntryStore
  dataLoads(): number
  searchLoads(): number
} {
  let dataLoads = 0
  let searchLoads = 0
  return {
    dataLoads: () => dataLoads,
    searchLoads: () => searchLoads,
    store: {
      revision: source.revision,
      cores: signal => source.cores(signal),
      load(core, signal) {
        dataLoads++
        return source.load(core, signal)
      },
      loadMany(cores, signal) {
        dataLoads += cores.length
        return source.loadMany(cores, signal)
      },
      search(core, audience, signal) {
        searchLoads++
        return source.search(core, audience, signal)
      },
      searchMany(cores, audience, signal) {
        searchLoads += cores.length
        return source.searchMany(cores, audience, signal)
      },
      referencesTo: (targetId, signal) => source.referencesTo(targetId, signal),
      referencesFrom: (sourceId, signal) =>
        source.referencesFrom(sourceId, signal)
    }
  }
}
