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
import type {AlineaDatabaseRecord} from '../entry/Model.js'
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
  })

  test('narrows structural candidates before loading payloads', async () => {
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
    expect(requested.filter(id => id.startsWith('payload:'))).toHaveLength(1)
  })

  test('searches dedicated search frames before loading matching payloads', async () => {
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

    expect(requested.filter(id => id.startsWith('payload:'))).toHaveLength(
      result.length
    )
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
