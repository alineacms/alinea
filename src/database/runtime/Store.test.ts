import {describe, expect, test} from 'bun:test'
import {Entry} from '#/core/Entry.js'
import {FSSource} from '#/core/source/FSSource.js'
import {cms} from '#test/cms.js'
import {DemoRecipe} from '#test/schema/DemoRecipe.js'
import {createEntrySource} from '#test/EntryFixture.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {Policy} from '#/core/Role.js'
import {DatabaseResolver} from '../query/Resolver.js'
import {MemoryRangeSource, type ByteRangeSource} from '../replica/Bundle.js'
import type {ReplicaTransport} from '../replica/Protocol.js'
import {exportRuntimeDatabase, exportRuntimeSourceChanges} from './Exporter.js'
import {RuntimeEntryStore} from './Store.js'
import {SourceDB} from '../entry/SourceDB.js'
import {projectRuntimeDatabase} from './Projection.js'
import {requestRuntimeSourceMutations} from '../handler/SourceWriter.js'
import {runtimeSourcePathResolver} from './Model.js'

describe('runtime database', () => {
  test('opens only the index and range-loads projected entry frames', async () => {
    const sourceFiles = new FSSource('test/fixtures/demo')
    const release = await exportRuntimeDatabase({
      config: cms.config,
      bundleId: 'release',
      bundleUrl: '/admin/release/payload.bundle',
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
    const sourceFiles = new FSSource('test/fixtures/demo')
    const release = await exportRuntimeDatabase({
      config: cms.config,
      bundleId: 'release',
      bundleUrl: '/payload.bundle',
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
      await resolver.resolve({search: 'chocolate', select: Entry.id})
    ).toContain('oi4qtV9YaXNRIUDT2s61Y')
    expect(ranges).toHaveLength(1)

    const [link] = await resolver.referencesFrom('oi4qtV9YaXNRIUDT2s61Y')
    expect(link).toBeDefined()
    expect(
      (await resolver.referencesTo({targetId: link!.targetId, status: 'all'}))
        .references
    ).toContainEqual(
      expect.objectContaining({
        targetId: link!.targetId,
        sourceId: link!.sourceId
      })
    )
    expect(await resolver.referencesFrom(link!.sourceId)).toContainEqual(
      expect.objectContaining({targetId: link!.targetId})
    )
  })

  test('loads complete entries from source frames', async () => {
    const source = new FSSource('test/fixtures/demo')
    const release = await exportRuntimeDatabase({
      config: cms.config,
      bundleId: 'release',
      bundleUrl: '/payload.bundle',
      source,
      compression: 'none'
    })
    const store = new RuntimeEntryStore({
      index: release.index,
      source: () => ({
        async read(offset, length) {
          return release.bundle.slice(offset, offset + length)
        }
      })
    })
    const runtime = new DatabaseResolver(cms.config, store)
    const query = {
      status: 'all' as const,
      orderBy: {asc: Entry.index},
      select: Entry
    }

    const entries = await runtime.resolve(query)
    expect(entries.length).toBe(release.index.entries.length)
    expect(entries.every(entry => Object.keys(entry.data).length > 0)).toBe(
      true
    )
    const core = release.index.entries[0]
    expect(await store.load(core)).toBe(await store.load(core))
  })

  test('searches discovery-safe index text for explore-only entries', async () => {
    const source = new FSSource('test/fixtures/demo')
    const release = await exportRuntimeDatabase({
      config: cms.config,
      bundleId: 'release',
      bundleUrl: '/payload.bundle',
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
    const release = await exportRuntimeDatabase({
      config: cms.config,
      bundleId: 'release',
      bundleUrl: '/payload.bundle',
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
    expect(ranges).toHaveLength(1)
    const shared = release.index.entries.find(entry => entry.frames?.data)!
    const path = runtimeSourcePathResolver(
      cms.config,
      release.index.entries
    )(shared)
    const sha = tree.index().get(path)!
    expect(release.index.source!.blobs[sha]).toBeUndefined()
    const [[loadedSha, actual]] = await Array.fromAsync(store.getBlobs([sha]))
    const [[, expected]] = await Array.fromAsync(source.getBlobs([sha]))
    expect({path, loadedSha, actual: [...actual]}).toEqual({
      path,
      loadedSha: sha,
      actual: [...expected]
    })
    expect(ranges).toHaveLength(2)
  })

  test('boots SourceDB from the runtime index without reading payloads', async () => {
    const source = new FSSource('test/fixtures/demo')
    const release = await exportRuntimeDatabase({
      config: cms.config,
      bundleId: 'release',
      bundleUrl: '/payload.bundle',
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
    const base = await exportRuntimeDatabase({
      config: cms.config,
      bundleId: 'base',
      bundleUrl: '/admin/base/payload.bundle',
      source,
      compression: 'none'
    })
    const remote = await exportRuntimeDatabase({
      config: cms.config,
      bundleId: 'remote',
      bundleUrl:
        'https://example.com/api/cms?action=replicaBundle&bundle=remote',
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

  test('reconciles one changed entry without reading the base payload', async () => {
    const source = new FSSource('test/fixtures/demo')
    const release = await exportRuntimeDatabase({
      config: cms.config,
      bundleId: 'base',
      bundleUrl: '/admin/base/payload.bundle',
      source,
      compression: 'none'
    })
    const target = release.index.entries.find(
      entry => entry.entryId === 'oi4qtV9YaXNRIUDT2s61Y' && entry.main
    )!
    const filePath = runtimeSourcePathResolver(
      cms.config,
      release.index.entries
    )(target)
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
    const changes = {
      fromSha: tree.sha,
      changes: [{op: 'add' as const, path: filePath, sha, contents}]
    }
    const overlay = await exportRuntimeSourceChanges({
      config: cms.config,
      previous: release.index,
      tree: nextTree,
      changes,
      bundleId: 'overlay',
      bundleUrl:
        'https://example.com/api/cms?action=replicaBundle&bundle=overlay',
      compression: 'none'
    })
    expect(overlay.bundle.length).toBeLessThan(release.bundle.length)
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
    store.install(overlay.index, () => ({
      async read(offset, length) {
        overlayReads++
        return overlay.bundle.slice(offset, offset + length)
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
      config: cms.config,
      bundleId: 'release',
      bundleUrl: '/payload.bundle',
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

  test('reconciles an archived subtree without rebuilding unchanged payloads', async () => {
    const source = await createEntrySource(cms.config, [
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
    ])
    const base = await exportRuntimeDatabase({
      config: cms.config,
      bundleId: 'base',
      bundleUrl: '/base.bundle',
      source,
      compression: 'none'
    })
    let payloadReads = 0
    const store = new RuntimeEntryStore({
      index: base.index,
      source: () => ({
        async read(offset, length) {
          payloadReads++
          return base.bundle.slice(offset, offset + length)
        }
      })
    })
    const warmResolver = new DatabaseResolver(cms.config, store)
    expect(
      await warmResolver.resolve({
        id: 'apple',
        first: true,
        select: DemoRecipe.intro
      })
    ).toEqual([])
    const readsAfterWarm = payloadReads
    const request = await requestRuntimeSourceMutations(
      cms.config,
      source,
      store,
      base.index,
      [{op: 'archive', id: 'recipes', locale: null}],
      Policy.ALLOW_ALL
    )
    expect(payloadReads).toBe(readsAfterWarm)
    const changes = sourceChanges(request)
    await source.applyChanges(changes)
    const delta = await exportRuntimeSourceChanges({
      config: cms.config,
      previous: base.index,
      tree: await source.getTree(),
      changes,
      bundleId: 'delta',
      bundleUrl: '/delta.bundle',
      compression: 'none'
    })
    const previousChild = base.index.entries.find(
      entry => entry.entryId === 'apple'
    )!
    const child = delta.index.entries.find(entry => entry.entryId === 'apple')!
    expect(child).toMatchObject({
      versionStatus: 'published',
      status: 'archived'
    })
    expect(child.frames).toEqual(previousChild.frames)
    expect(delta.bundle.length).toBeLessThan(base.bundle.length)

    store.install(delta.index, () => new MemoryRangeSource(delta.bundle))
    const resolver = new DatabaseResolver(cms.config, store)
    expect(
      await resolver.resolve({
        id: 'apple',
        status: 'all',
        first: true,
        select: {
          versionStatus: Entry.versionStatus,
          status: Entry.status,
          intro: DemoRecipe.intro
        }
      })
    ).toEqual({versionStatus: 'published', status: 'archived', intro: []})
    expect(payloadReads).toBe(readsAfterWarm)
  })

  for (const [name, mutation] of structuralMutations()) {
    test(`matches full normalization after incremental ${name}`, async () => {
      const source = await createEntrySource(cms.config, [
        {
          id: 'recipes',
          type: 'DemoRecipes',
          index: 'a1',
          path: 'recipes',
          data: {title: 'Recipes'}
        },
        {
          id: 'apple',
          type: 'DemoRecipe',
          index: 'a2',
          parentPaths: ['recipes'],
          path: 'apple',
          data: {title: 'Apple', intro: []}
        },
        {
          id: 'draft',
          type: 'DemoRecipes',
          index: 'a3',
          path: 'draft',
          status: 'draft',
          data: {title: 'Draft'}
        }
      ])
      const base = await exportRuntimeDatabase({
        config: cms.config,
        bundleId: 'base',
        bundleUrl: '/base.bundle',
        source,
        compression: 'none'
      })
      const store = new RuntimeEntryStore({
        index: base.index,
        source: () => new MemoryRangeSource(base.bundle)
      })
      const request = await requestRuntimeSourceMutations(
        cms.config,
        source,
        store,
        base.index,
        [mutation],
        Policy.ALLOW_ALL
      )
      const changes = sourceChanges(request)
      await source.applyChanges(changes)
      const incremental = await exportRuntimeSourceChanges({
        config: cms.config,
        previous: base.index,
        tree: await source.getTree(),
        changes,
        bundleId: 'delta',
        bundleUrl: '/delta.bundle',
        compression: 'none'
      })
      const rebuilt = await exportRuntimeDatabase({
        config: cms.config,
        bundleId: 'expected',
        bundleUrl: '/expected.bundle',
        source,
        compression: 'none'
      })
      const expected = [...rebuilt.index.entries]
        .map(({frames: _, ...core}) => core)
        .sort((left, right) => left.id.localeCompare(right.id))
      const actual = incremental.index.entries
        .map(({frames: _, ...core}) => core)
        .sort((left, right) => left.id.localeCompare(right.id))
      expect(actual).toEqual(expected)
    })
  }
})

function structuralMutations(): ReadonlyArray<readonly [string, Mutation]> {
  return [
    [
      'create',
      {
        op: 'create',
        id: 'pear',
        type: 'DemoRecipe',
        locale: null,
        root: 'pages',
        workspace: 'demo',
        parentId: 'recipes',
        data: {title: 'Pear', path: 'pear', intro: []}
      }
    ],
    [
      'move',
      {
        op: 'move',
        id: 'apple',
        target: 'pages',
        targetType: 'root',
        dropPosition: 'on'
      }
    ],
    ['remove', {op: 'remove', id: 'apple'}],
    ['publish', {op: 'publish', id: 'draft', locale: null, status: 'draft'}]
  ]
}
