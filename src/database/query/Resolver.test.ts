import {describe, expect, test} from 'bun:test'
import {Entry} from '#/core.js'
import {Query} from '#/index.js'
import {EntryIndex} from '#/core/db/EntryIndex.js'
import {EntryResolver} from '#/core/db/EntryResolver.js'
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
const legacyIndex = new EntryIndex(cms.config)
await legacyIndex.syncWith(source)
const legacy = new EntryResolver(cms.config, legacyIndex)
const database = await buildEntryDatabase(cms.config, source)
const current = new DatabaseResolver(cms.config, database)

describe('DatabaseResolver parity', () => {
  test('filters structural fields', async () => {
    const queries = [
      {id: 'oi4qtV9YaXNRIUDT2s61Y', select: Entry.id},
      {type: MediaFile, select: Entry.id},
      {location: cms.workspaces.demo.media, select: Entry.id},
      {parentId: '2cGLQZvsCCxnguLrwCfPDL8uFkm', select: Entry.id}
    ] as const
    for (const query of queries)
      expect(await current.resolve(query)).toEqual(await legacy.resolve(query))
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
    expect(await current.resolve(query)).toEqual(await legacy.resolve(query))
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
    for (const query of queries)
      expect(await current.resolve(query)).toEqual(await legacy.resolve(query))
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
    expect(await current.resolve(query)).toEqual(await legacy.resolve(query))
  })

  test('searches with legacy ranking', async () => {
    const query = {
      type: [DemoRecipe, DemoRecipes],
      search: 'chocolate',
      select: {id: Entry.id, title: Entry.title}
    }
    expect(await current.resolve(query)).toEqual(await legacy.resolve(query))
  })

  test('previews an existing entry', async () => {
    const entry = await legacy.resolve({
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
    expect(await current.resolve(query)).toEqual(await legacy.resolve(query))
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
})
