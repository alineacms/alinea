import {describe, expect, test} from 'bun:test'
import {Entry} from '#/core.js'
import {Query} from '#/index.js'
import {FSSource} from '#/core/source/FSSource.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {cms} from '#test/cms.js'
import {DemoRecipe} from '#test/schema/DemoRecipe.js'
import {DemoRecipes} from '#test/schema/DemoRecipes.js'
import {type DatabaseReader, SnapshotDatabaseReader} from '../Reader.js'
import type {DatabaseIndex, IndexedRecord} from '../SecondaryIndex.js'
import type {Entry as EntryValue} from '#/core/Entry.js'
import type {
  AlineaDatabaseRecord,
  EntryCoreRecord,
  EntrySearchRecord
} from '../entry/Model.js'
import type {EntryStore} from '../entry/Store.js'
import {buildEntryDatabase} from '../entry/Source.js'
import {DatabaseResolver} from './Resolver.js'

const source = new FSSource('test/fixtures/demo')
const database = await buildEntryDatabase(cms.config, source)
const current = new DatabaseResolver(cms.config, database)

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

  test('selects fields and nested objects', async () => {
    const query = {
      id: 'oi4qtV9YaXNRIUDT2s61Y',
      select: {
        title: DemoRecipe.title,
        intro: DemoRecipe.intro,
        id: Entry.id,
        url: Entry.url
      }
    }
    expect(await current.resolve(query)).toEqual([
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
        id: 'oU_7ZAszAXwar__BCXVIt',
        select: Query.next({select: Entry.id})
      },
      {
        first: true as const,
        id: 'oi4qtV9YaXNRIUDT2s61Y',
        select: Query.previous({select: Entry.id})
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
    const [children, siblings, next, previous, parent, parents] =
      await Promise.all(queries.map(query => current.resolve(query)))
    expect(children).toContain('oi4qtV9YaXNRIUDT2s61Y')
    expect(siblings).toContain('oU_7ZAszAXwar__BCXVIt')
    expect(next).toEqual(expect.any(String))
    expect(next).not.toBe('oU_7ZAszAXwar__BCXVIt')
    expect(previous).toEqual(expect.any(String))
    expect(previous).not.toBe('oi4qtV9YaXNRIUDT2s61Y')
    expect(parent).toBe('2cGLQZvsCCxnguLrwCfPDL8uFkm')
    expect(parents).toEqual(['2cGLQZvsCCxnguLrwCfPDL8uFkm'])
  })

  test('orders, groups and pages', async () => {
    const query = {
      type: DemoRecipe,
      orderBy: {asc: DemoRecipe.title},
      groupBy: Entry.parentId,
      skip: 0,
      take: 1,
      select: {id: Entry.id, title: DemoRecipe.title}
    }
    expect(await current.resolve(query)).toEqual([
      {id: 'P7QDb99Sp1JS5FyqCXXn3', title: 'Gingerbread'}
    ])
  })

  test('searches with deterministic ranking', async () => {
    const query = {
      type: [DemoRecipe, DemoRecipes],
      search: 'chocolate',
      select: {id: Entry.id, title: Entry.title}
    }
    expect(await current.resolve(query)).toEqual([
      {id: 'oi4qtV9YaXNRIUDT2s61Y', title: 'Chocolate chip'}
    ])
  })

  test('previews an existing entry', async () => {
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
    expect(
      await current.resolve({
        ...query,
        filter: {title: 'Chocolate chip preview'} as never
      })
    ).toEqual({
      title: 'Chocolate chip preview',
      id: 'oi4qtV9YaXNRIUDT2s61Y'
    })
  })

  test('resolves an index-only projection without loading payloads', async () => {
    const base = new SnapshotDatabaseReader(database)
    const requested: Array<string> = []
    const reader: DatabaseReader<AlineaDatabaseRecord> = {
      revision: base.revision,
      get(id, signal) {
        requested.push(id)
        return base.get(id, signal)
      },
      scan<Metadata>(
        index: DatabaseIndex<AlineaDatabaseRecord, Metadata>,
        key: string,
        signal?: AbortSignal
      ): AsyncIterable<IndexedRecord<Metadata>> {
        return base.scan(index, key, signal)
      }
    }
    const resolver = new DatabaseResolver(cms.config, reader)
    await resolver.resolve({
      id: 'oi4qtV9YaXNRIUDT2s61Y',
      select: Entry.id,
      first: true
    })
    expect(requested.filter(id => id.startsWith('payload:'))).toHaveLength(0)
  })

  test('pages index candidates before loading projected payloads', async () => {
    const base = new SnapshotDatabaseReader(database)
    const requested: Array<string> = []
    const reader: DatabaseReader<AlineaDatabaseRecord> = {
      revision: base.revision,
      get(id, signal) {
        requested.push(id)
        return base.get(id, signal)
      },
      scan<Metadata>(
        index: DatabaseIndex<AlineaDatabaseRecord, Metadata>,
        key: string,
        signal?: AbortSignal
      ): AsyncIterable<IndexedRecord<Metadata>> {
        return base.scan(index, key, signal)
      }
    }
    const resolver = new DatabaseResolver(cms.config, reader)
    const result = await resolver.resolve({
      type: DemoRecipe,
      orderBy: {asc: Entry.title},
      take: 1,
      select: {title: Entry.title, intro: DemoRecipe.intro}
    })
    expect(result).toEqual([
      {title: 'Chocolate chip', intro: expect.any(Array)}
    ])
    expect(requested.filter(id => id.startsWith('payload:'))).toHaveLength(1)
  })

  test('counts index candidates without loading payloads', async () => {
    const base = new SnapshotDatabaseReader(database)
    const requested: Array<string> = []
    const reader: DatabaseReader<AlineaDatabaseRecord> = {
      revision: base.revision,
      get(id, signal) {
        requested.push(id)
        return base.get(id, signal)
      },
      scan<Metadata>(
        index: DatabaseIndex<AlineaDatabaseRecord, Metadata>,
        key: string,
        signal?: AbortSignal
      ): AsyncIterable<IndexedRecord<Metadata>> {
        return base.scan(index, key, signal)
      }
    }
    const resolver = new DatabaseResolver(cms.config, reader)
    const count = await resolver.resolve({type: DemoRecipe, count: true})
    expect(count).toBeGreaterThan(0)
    expect(requested.filter(id => id.startsWith('payload:'))).toHaveLength(0)
  })

  test('evaluates entry metadata filters on the index', async () => {
    const base = new SnapshotDatabaseReader(database)
    const requested: Array<string> = []
    const reader: DatabaseReader<AlineaDatabaseRecord> = {
      revision: base.revision,
      get(id, signal) {
        requested.push(id)
        return base.get(id, signal)
      },
      scan<Metadata>(
        index: DatabaseIndex<AlineaDatabaseRecord, Metadata>,
        key: string,
        signal?: AbortSignal
      ): AsyncIterable<IndexedRecord<Metadata>> {
        return base.scan(index, key, signal)
      }
    }
    const resolver = new DatabaseResolver(cms.config, reader)

    expect(
      await resolver.resolve({
        filter: {_type: 'DemoRecipe'},
        select: Entry.id
      })
    ).toHaveLength(4)
    expect(requested.filter(id => id.startsWith('payload:'))).toHaveLength(0)
  })

  test('uses index conjuncts before loading data filters', async () => {
    const base = new SnapshotDatabaseReader(database)
    const requested: Array<string> = []
    const reader: DatabaseReader<AlineaDatabaseRecord> = {
      revision: base.revision,
      get(id, signal) {
        requested.push(id)
        return base.get(id, signal)
      },
      scan<Metadata>(
        index: DatabaseIndex<AlineaDatabaseRecord, Metadata>,
        key: string,
        signal?: AbortSignal
      ): AsyncIterable<IndexedRecord<Metadata>> {
        return base.scan(index, key, signal)
      }
    }
    const resolver = new DatabaseResolver(cms.config, reader)

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
    expect(requested.filter(id => id.startsWith('payload:'))).toHaveLength(4)
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
    const store: EntryStore = {
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
        return undefined
      },
      async searchMany(items) {
        return new Array<EntrySearchRecord | undefined>(items.length)
      },
      async *referencesTo() {},
      async *referencesFrom() {}
    }
    const resolver = new DatabaseResolver(cms.config, store)

    expect(
      await resolver.resolve({
        filter: {match: true} as never,
        take: 2,
        select: Entry.id
      })
    ).toEqual(['entry-0', 'entry-10'])
    expect(loaded).toBe(16)
  })

  test('searches dedicated search frames without loading result payloads', async () => {
    const base = new SnapshotDatabaseReader(database)
    const requested: Array<string> = []
    const reader: DatabaseReader<AlineaDatabaseRecord> = {
      revision: base.revision,
      get(id, signal) {
        requested.push(id)
        return base.get(id, signal)
      },
      scan<Metadata>(
        index: DatabaseIndex<AlineaDatabaseRecord, Metadata>,
        key: string,
        signal?: AbortSignal
      ): AsyncIterable<IndexedRecord<Metadata>> {
        return base.scan(index, key, signal)
      }
    }
    const resolver = new DatabaseResolver(cms.config, reader)
    const result = await resolver.resolve({
      search: 'chocolate',
      select: Entry.id
    })

    expect(requested.filter(id => id.startsWith('payload:'))).toHaveLength(0)
    expect(result.length).toBeLessThan(database.size)
  })

  test('reads references from the persistent reference index', async () => {
    const link = [...database.records()].find(record => record.kind === 'link')
    expect(link).toBeDefined()
    const query = {targetId: link!.targetId, status: 'all' as const}
    const actual = await current.referencesTo(query)
    expect(actual.references.length).toBeGreaterThan(0)
    expect(
      actual.references.every(
        reference => reference.targetId === link!.targetId
      )
    ).toBe(true)
    expect(actual.total).toBe(actual.references.length)
    expect(actual.scan.complete).toBe(true)
  })
})
