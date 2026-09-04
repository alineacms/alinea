import {describe, expect, test} from 'bun:test'
import {Entry} from '#/core/Entry.js'
import {FSSource} from '#/core/source/FSSource.js'
import {cms} from '#test/cms.js'
import {DemoRecipe} from '#test/schema/DemoRecipe.js'
import {createEntrySource} from '#test/EntryFixture.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {buildEntryDatabase} from '../entry/Source.js'
import {DatabaseResolver} from '../query/Resolver.js'
import {MemoryRangeSource, type ByteRangeSource} from '../replica/Bundle.js'
import type {ReplicaTransport} from '../replica/Protocol.js'
import {
  exportRuntimeDatabase,
  exportRuntimeDelta,
  exportRuntimeEntryOverlay
} from './Exporter.js'
import {RuntimeEntryStore} from './Store.js'
import {SourceDB} from '../entry/SourceDB.js'
import {projectRuntimeDatabase} from './Projection.js'

describe('runtime database', () => {
  test('opens only the index and range-loads projected entry frames', async () => {
    const sourceFiles = new FSSource('test/fixtures/demo')
    const snapshot = await buildEntryDatabase(cms.config, sourceFiles)
    const release = await exportRuntimeDatabase({
      bundleId: 'release',
      bundleUrl: '/admin/release/payload.bundle',
      snapshot,
      source: sourceFiles,
      compression: 'none'
    })
    const ranges: Array<{offset: number; length: number}> = []
    const source: ByteRangeSource = {
      async read(offset, length) {
        ranges.push({offset, length})
        return release.bundle.slice(offset, offset + length)
      }
    }
    const resolver = new DatabaseResolver(
      cms.config,
      new RuntimeEntryStore({index: release.index, source: () => source})
    )

    expect(
      await resolver.resolve({
        id: 'oi4qtV9YaXNRIUDT2s61Y',
        select: Entry.id,
        first: true
      })
    ).toBe('oi4qtV9YaXNRIUDT2s61Y')
    expect(ranges).toHaveLength(0)

    expect(
      await resolver.resolve({
        id: 'oi4qtV9YaXNRIUDT2s61Y',
        select: DemoRecipe.intro,
        first: true
      })
    ).toEqual(expect.any(Array))
    expect(ranges.length).toBeGreaterThan(0)
    const readsAfterFirstLoad = ranges.length
    expect(
      await resolver.resolve({
        id: 'oi4qtV9YaXNRIUDT2s61Y',
        select: DemoRecipe.intro,
        first: true
      })
    ).toEqual(expect.any(Array))
    expect(ranges).toHaveLength(readsAfterFirstLoad)
    expect(
      ranges.reduce((total, range) => total + range.length, 0)
    ).toBeLessThan(release.bundle.length)
  })

  test('preserves search and reference query semantics', async () => {
    const snapshot = await buildEntryDatabase(
      cms.config,
      new FSSource('test/fixtures/demo')
    )
    const release = await exportRuntimeDatabase({
      bundleId: 'release',
      bundleUrl: '/payload.bundle',
      snapshot,
      compression: 'none'
    })
    const ranges: Array<{offset: number; length: number}> = []
    const source: ByteRangeSource = {
      async read(offset, length) {
        ranges.push({offset, length})
        return release.bundle.slice(offset, offset + length)
      }
    }
    const resolver = new DatabaseResolver(
      cms.config,
      new RuntimeEntryStore({index: release.index, source: () => source})
    )

    expect(
      await resolver.resolve({search: 'chocolate', select: Entry.id})
    ).toContain('oi4qtV9YaXNRIUDT2s61Y')
    expect(ranges).toHaveLength(1)

    const link = [...snapshot.records()].find(record => record.kind === 'link')
    expect(link).toBeDefined()
    expect(
      (await resolver.referencesTo({targetId: link!.targetId, status: 'all'}))
        .references
    ).toContainEqual(
      expect.objectContaining({
        targetId: link!.targetId,
        sourceId: link!.sourceEntryId
      })
    )
    expect(await resolver.referencesFrom(link!.sourceEntryId)).toContainEqual(
      expect.objectContaining({targetId: link!.targetId})
    )
  })

  test('matches normalized entries when data comes from source frames', async () => {
    const source = new FSSource('test/fixtures/demo')
    const snapshot = await buildEntryDatabase(cms.config, source)
    const release = await exportRuntimeDatabase({
      bundleId: 'release',
      bundleUrl: '/payload.bundle',
      snapshot,
      source,
      compression: 'none'
    })
    const runtime = new DatabaseResolver(
      cms.config,
      new RuntimeEntryStore({
        index: release.index,
        source: () => ({
          async read(offset, length) {
            return release.bundle.slice(offset, offset + length)
          }
        })
      })
    )
    const normalized = new DatabaseResolver(cms.config, snapshot)
    const query = {
      status: 'all' as const,
      orderBy: {asc: Entry.index},
      select: Entry
    }

    expect(await runtime.resolve(query)).toEqual(
      await normalized.resolve(query)
    )
  })

  test('searches discovery-safe index text for explore-only entries', async () => {
    const source = new FSSource('test/fixtures/demo')
    const release = await exportRuntimeDatabase({
      bundleId: 'release',
      bundleUrl: '/payload.bundle',
      snapshot: await buildEntryDatabase(cms.config, source),
      source,
      compression: 'none'
    })
    const view = projectRuntimeDatabase(release.index, {
      canRead() {
        return false
      },
      canExplore() {
        return true
      }
    })
    let reads = 0
    const resolver = new DatabaseResolver(
      cms.config,
      new RuntimeEntryStore({
        index: view.index,
        source: () => ({
          async read() {
            reads++
            throw new Error('Explore search must not read payloads')
          }
        })
      })
    )

    expect(
      await resolver.resolve({search: 'chocolate chip', select: Entry.id})
    ).toContain('oi4qtV9YaXNRIUDT2s61Y')
    expect(reads).toBe(0)
  })

  test('retains stored status and lazily serves exact source blobs', async () => {
    const source = new FSSource('test/fixtures/demo')
    const snapshot = await buildEntryDatabase(cms.config, source)
    const release = await exportRuntimeDatabase({
      bundleId: 'release',
      bundleUrl: '/payload.bundle',
      snapshot,
      source,
      compression: 'none'
    })
    const ranges: Array<{offset: number; length: number}> = []
    const store = new RuntimeEntryStore({
      index: release.index,
      source: () => ({
        async read(offset, length) {
          ranges.push({offset, length})
          return release.bundle.slice(offset, offset + length)
        }
      })
    })

    const tree = await store.getTree()
    expect(ranges).toHaveLength(0)
    const shared = release.index.entries.find(entry =>
      Boolean(entry.frames?.read?.fileHash)
    )!
    const path = shared.frames!.read!.filePath
    const sha = tree.index().get(path)!
    expect(release.index.source!.blobs[sha].frame.id).toBe(
      shared.frames!.data!.id
    )
    const [[loadedSha, actual]] = await Array.fromAsync(store.getBlobs([sha]))
    const [[, expected]] = await Array.fromAsync(source.getBlobs([sha]))
    expect({path, loadedSha, actual: [...actual]}).toEqual({
      path,
      loadedSha: sha,
      actual: [...expected]
    })
    expect(ranges).toHaveLength(1)
  })

  test('boots SourceDB from the runtime index without reading payloads', async () => {
    const source = new FSSource('test/fixtures/demo')
    const snapshot = await buildEntryDatabase(cms.config, source)
    const release = await exportRuntimeDatabase({
      bundleId: 'release',
      bundleUrl: '/payload.bundle',
      snapshot,
      source,
      compression: 'none'
    })
    let reads = 0
    const store = new RuntimeEntryStore({
      index: release.index,
      source: () => ({
        async read(offset, length) {
          reads++
          return release.bundle.slice(offset, offset + length)
        }
      })
    })
    const db = new SourceDB(cms.config, store)

    await db.sync()

    expect(reads).toBe(0)
    expect(await db.count({status: 'all'})).toBeGreaterThan(0)
    expect(reads).toBe(0)
  })

  test('installs a remote replica index without opening its payload', async () => {
    const source = new FSSource('test/fixtures/demo')
    const snapshot = await buildEntryDatabase(cms.config, source)
    const base = await exportRuntimeDatabase({
      bundleId: 'base',
      bundleUrl: '/admin/base/payload.bundle',
      snapshot,
      source,
      compression: 'none'
    })
    const remote = await exportRuntimeDatabase({
      bundleId: 'remote',
      bundleUrl:
        'https://example.com/api/cms?action=replicaBundle&bundle=remote',
      snapshot,
      source,
      compression: 'none'
    })
    remote.index = {...remote.index, revision: 'tree-2'}
    let baseReads = 0
    let remoteReads = 0
    const store = new RuntimeEntryStore({
      index: base.index,
      source: () => ({
        async read(offset, length) {
          baseReads++
          return base.bundle.slice(offset, offset + length)
        }
      })
    })
    const db = new SourceDB(cms.config, store)
    await db.sync()
    const state = {
      viewId: 'server',
      catalog: {
        version: 1 as const,
        bundleId: 'remote',
        bundleUrl: remote.index.bundleUrl,
        revision: 'tree-2',
        records: {},
        indexes: {}
      },
      grants: [],
      recordAccess: {},
      runtime: remote.index
    }
    const transport: ReplicaTransport = {
      async bootstrap() {
        throw new Error('Bootstrap is not needed for server synchronization')
      },
      async state(revision) {
        return revision === 'tree-2' ? undefined : state
      },
      async mutate() {
        throw new Error('Not used')
      },
      async command() {
        throw new Error('Not used')
      }
    }

    await db.syncReplica(transport, () => ({
      async read(offset, length) {
        remoteReads++
        return remote.bundle.slice(offset, offset + length)
      }
    }))

    expect(db.sha).toBe('tree-2')
    expect(baseReads).toBe(0)
    expect(remoteReads).toBe(0)
    expect(
      await db.resolve({
        id: 'oi4qtV9YaXNRIUDT2s61Y',
        select: DemoRecipe.intro,
        first: true
      })
    ).toEqual(expect.any(Array))
    expect(remoteReads).toBeGreaterThan(0)
  })

  test('exports a one-entry overlay without reading the base payload', async () => {
    const source = new FSSource('test/fixtures/demo')
    const snapshot = await buildEntryDatabase(cms.config, source)
    const release = await exportRuntimeDatabase({
      bundleId: 'base',
      bundleUrl: '/admin/base/payload.bundle',
      snapshot,
      source,
      compression: 'none'
    })
    const target = release.index.entries.find(
      entry => entry.entryId === 'oi4qtV9YaXNRIUDT2s61Y' && entry.main
    )!
    const filePath = target.frames!.read!.filePath
    const tree = await source.getTree()
    const previousSha = tree.index().get(filePath)!
    const [[, previousContents]] = await Array.fromAsync(
      source.getBlobs([previousSha])
    )
    const raw = JSON.parse(new TextDecoder().decode(previousContents))
    raw.title = 'Overlay title'
    const contents = new TextEncoder().encode(JSON.stringify(raw))
    const sha = await hashBlob(contents)
    const nextTree = await tree.withChanges({
      fromSha: tree.sha,
      changes: [{op: 'add', path: filePath, sha, contents}]
    })
    const overlay = await exportRuntimeEntryOverlay({
      config: cms.config,
      index: release.index,
      bundleId: 'overlay',
      bundleUrl:
        'https://example.com/api/cms?action=replicaBundle&bundle=overlay',
      filePath,
      fileHash: sha,
      contents,
      tree: nextTree,
      compression: 'none'
    })
    expect(overlay).toBeDefined()
    expect(overlay!.bundle.length).toBeLessThan(release.bundle.length)
    let baseReads = 0
    let overlayReads = 0
    const store = new RuntimeEntryStore({
      index: release.index,
      source: () => ({
        async read(offset, length) {
          baseReads++
          return release.bundle.slice(offset, offset + length)
        }
      })
    })
    store.install(overlay!.index, () => ({
      async read(offset, length) {
        overlayReads++
        return overlay!.bundle.slice(offset, offset + length)
      }
    }))
    const resolver = new DatabaseResolver(cms.config, store)

    expect(
      await resolver.resolve({
        id: target.entryId,
        first: true,
        select: Entry.title
      })
    ).toBe('Overlay title')
    expect(baseReads).toBe(0)
    expect(overlayReads).toBe(0)
    expect(
      await resolver.resolve({
        id: target.entryId,
        first: true,
        select: DemoRecipe.intro
      })
    ).toEqual(expect.any(Array))
    expect(baseReads).toBe(0)
    expect(overlayReads).toBeGreaterThan(0)
  })

  test('keeps stored status separate from inherited effective status', async () => {
    const source = await createEntrySource(cms.config, [
      {
        id: 'parent',
        type: 'DemoRecipes',
        index: 'a',
        path: 'parent',
        status: 'archived',
        data: {title: 'Parent'}
      },
      {
        id: 'child',
        type: 'DemoRecipe',
        index: 'a',
        parentPaths: ['parent'],
        path: 'child',
        status: 'published',
        data: {title: 'Child'}
      }
    ])
    const release = await exportRuntimeDatabase({
      bundleId: 'release',
      bundleUrl: '/payload.bundle',
      snapshot: await buildEntryDatabase(cms.config, source),
      source,
      compression: 'none'
    })

    expect(
      release.index.entries.find(entry => entry.entryId === 'child')
    ).toMatchObject({versionStatus: 'published', status: 'archived'})
    const resolver = new DatabaseResolver(
      cms.config,
      new RuntimeEntryStore({
        index: release.index,
        source: () => ({
          async read(offset, length) {
            return release.bundle.slice(offset, offset + length)
          }
        })
      })
    )
    expect(
      await resolver.resolve({
        id: 'child',
        status: 'all',
        first: true,
        select: {
          versionStatus: Entry.versionStatus,
          status: Entry.status
        }
      })
    ).toEqual({versionStatus: 'published', status: 'archived'})
  })

  test('packs a structural rebuild as changed frames over the existing base', async () => {
    const entries = [
      {
        id: 'recipes',
        type: 'DemoRecipes',
        index: 'a',
        path: 'recipes',
        data: {title: 'Recipes'}
      },
      {
        id: 'apple',
        type: 'DemoRecipe',
        index: 'b',
        parentPaths: ['recipes'],
        path: 'apple',
        data: {title: 'Apple', intro: []}
      }
    ]
    const baseSource = await createEntrySource(cms.config, entries)
    const nextSource = await createEntrySource(cms.config, [
      ...entries,
      {
        id: 'pear',
        type: 'DemoRecipe',
        index: 'c',
        parentPaths: ['recipes'],
        path: 'pear',
        data: {title: 'Pear', intro: []}
      }
    ])
    const base = await exportRuntimeDatabase({
      bundleId: 'base',
      bundleUrl: '/base.bundle',
      snapshot: await buildEntryDatabase(cms.config, baseSource),
      source: baseSource,
      compression: 'none'
    })
    const full = await exportRuntimeDatabase({
      bundleId: 'delta',
      bundleUrl: '/full.bundle',
      snapshot: await buildEntryDatabase(cms.config, nextSource),
      source: nextSource,
      compression: 'none'
    })
    const delta = exportRuntimeDelta({
      previous: base.index,
      next: full,
      bundleId: 'delta',
      bundleUrl: '/api?bundle=delta'
    })
    const previousApple = base.index.entries.find(
      entry => entry.entryId === 'apple'
    )!
    const nextApple = delta.index.entries.find(
      entry => entry.entryId === 'apple'
    )!
    const pear = delta.index.entries.find(entry => entry.entryId === 'pear')!

    expect(delta.bundle.length).toBeLessThan(full.bundle.length)
    expect(nextApple.frames?.data).toEqual(previousApple.frames?.data)
    expect(pear.frames?.data?.bundleId).toBe('delta')

    const store = new RuntimeEntryStore({
      index: base.index,
      source: () => new MemoryRangeSource(base.bundle)
    })
    store.install(delta.index, () => new MemoryRangeSource(delta.bundle))
    const resolver = new DatabaseResolver(cms.config, store)
    expect(
      await resolver.resolve({
        id: 'pear',
        select: DemoRecipe.intro,
        first: true
      })
    ).toEqual([])
  })
})
