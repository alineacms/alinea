import {describe, expect, test} from 'bun:test'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import {Policy} from '#/core/Role.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {cms} from '#test/cms.js'
import {createEntrySource} from '#test/EntryFixture.js'
import {MemoryRangeSource} from '../replica/Bundle.js'
import {exportRuntimeDatabase} from '../runtime/Exporter.js'
import {RuntimeEntryStore} from '../runtime/Store.js'
import {requestRuntimeSourceMutations} from './SourceWriter.js'

describe('requestSourceMutations', () => {
  for (const [name, mutation] of cases()) {
    test(`writes runtime source changes for ${name}`, async () => {
      const source = await createEntrySource(cms.config, [
        {
          id: 'recipes',
          type: 'DemoRecipes',
          index: 'a1',
          root: 'pages',
          path: 'recipes',
          data: {title: 'Recipes'}
        },
        {
          id: 'apple',
          type: 'DemoRecipe',
          index: 'a2',
          root: 'pages',
          path: 'apple',
          parentPaths: ['recipes'],
          data: {title: 'Apple'}
        },
        {
          id: 'draft',
          type: 'DemoRecipes',
          index: 'a3',
          root: 'pages',
          path: 'draft',
          status: 'draft',
          data: {title: 'Draft'}
        }
      ])
      const release = await exportRuntimeDatabase({
        config: cms.config,
        source,
        bundleId: 'base',
        bundleUrl: '/base.bundle',
        compression: 'none'
      })
      const store = new RuntimeEntryStore({
        index: release.index,
        source: () => new MemoryRangeSource(release.bundle)
      })
      const request = await requestRuntimeSourceMutations(
        cms.config,
        source,
        store,
        release.index,
        [mutation],
        Policy.ALLOW_ALL
      )
      expect(request.changes.length).toBeGreaterThan(0)
      await source.applyChanges(sourceChanges(request))
      const updated = await exportRuntimeDatabase({
        config: cms.config,
        source,
        bundleId: 'updated',
        bundleUrl: '/updated.bundle',
        compression: 'none'
      })
      const entries = updated.index.entries
      if (name === 'update')
        expect(entries.find(entry => entry.entryId === 'apple')?.title).toBe(
          'Green apple'
        )
      if (name === 'create')
        expect(entries.some(entry => entry.entryId === 'pear')).toBe(true)
      if (name === 'move')
        expect(entries.find(entry => entry.entryId === 'apple')?.parentId).toBe(
          null
        )
      if (name === 'remove')
        expect(entries.some(entry => entry.entryId === 'apple')).toBe(false)
      if (name === 'publish')
        expect(
          entries.some(
            entry =>
              entry.entryId === 'draft' && entry.versionStatus === 'published'
          )
        ).toBe(true)
    })
  }
})

test('builds a content-only runtime update from one lazy entry', async () => {
  const source = await createEntrySource(cms.config, [
    {
      id: 'recipes',
      type: 'DemoRecipes',
      index: 'a1',
      root: 'pages',
      path: 'recipes',
      data: {title: 'Recipes'}
    },
    {
      id: 'apple',
      type: 'DemoRecipe',
      index: 'a2',
      root: 'pages',
      path: 'apple',
      parentPaths: ['recipes'],
      data: {title: 'Apple'}
    }
  ])
  const release = await exportRuntimeDatabase({
    config: cms.config,
    bundleId: 'runtime',
    bundleUrl: '/payload.bundle',
    source,
    compression: 'none'
  })
  let loadedBytes = 0
  const store = new RuntimeEntryStore({
    index: release.index,
    source: () => ({
      async read(offset, length) {
        loadedBytes += length
        return release.bundle.slice(offset, offset + length)
      }
    })
  })

  const request = await requestRuntimeSourceMutations(
    cms.config,
    source,
    store,
    release.index,
    [
      {
        op: 'update',
        id: 'apple',
        locale: null,
        status: 'published',
        set: {title: 'Green apple'}
      }
    ],
    Policy.ALLOW_ALL
  )

  expect(request).toBeDefined()
  expect(request!.changes).toHaveLength(1)
  expect(loadedBytes).toBeLessThan(release.bundle.length)
  await source.applyChanges(sourceChanges(request!))
  const updated = await exportRuntimeDatabase({
    config: cms.config,
    source,
    bundleId: 'updated',
    bundleUrl: '/updated.bundle',
    compression: 'none'
  })
  expect(
    updated.index.entries.find(entry => entry.entryId === 'apple')?.title
  ).toBe('Green apple')
})

test('builds path updates from the lazy runtime index', async () => {
  const source = await createEntrySource(cms.config, [
    {
      id: 'recipes',
      type: 'DemoRecipes',
      index: 'a1',
      root: 'pages',
      path: 'recipes',
      data: {title: 'Recipes'}
    }
  ])
  const release = await exportRuntimeDatabase({
    config: cms.config,
    bundleId: 'runtime',
    bundleUrl: '/payload.bundle',
    source,
    compression: 'none'
  })
  const store = new RuntimeEntryStore({
    index: release.index,
    source: () => new MemoryRangeSource(release.bundle)
  })

  const request = await requestRuntimeSourceMutations(
    cms.config,
    source,
    store,
    release.index,
    [
      {
        op: 'update',
        id: 'recipes',
        locale: null,
        status: 'published',
        set: {path: 'new-path'}
      }
    ],
    Policy.ALLOW_ALL
  )
  expect(request.changes.length).toBeGreaterThan(0)
})

test('batches independent content updates without an incremental export', async () => {
  const source = await createEntrySource(cms.config, [
    {
      id: 'apple',
      type: 'DemoRecipe',
      index: 'a1',
      root: 'pages',
      path: 'apple',
      data: {title: 'Apple'}
    },
    {
      id: 'pear',
      type: 'DemoRecipe',
      index: 'a2',
      root: 'pages',
      path: 'pear',
      data: {title: 'Pear'}
    }
  ])
  const release = await exportRuntimeDatabase({
    config: cms.config,
    bundleId: 'runtime',
    bundleUrl: '/payload.bundle',
    source,
    compression: 'none'
  })
  const index = {...release.index, source: undefined}
  const store = new RuntimeEntryStore({
    index,
    source: () => new MemoryRangeSource(release.bundle)
  })

  const request = await requestRuntimeSourceMutations(
    cms.config,
    source,
    store,
    index,
    [
      {
        op: 'update',
        id: 'apple',
        locale: null,
        status: 'published',
        set: {title: 'Green apple'}
      },
      {
        op: 'update',
        id: 'pear',
        locale: null,
        status: 'published',
        set: {title: 'Green pear'}
      }
    ],
    Policy.ALLOW_ALL
  )

  expect(request.description).toBe('(update) Apple\n(update) Pear')
  expect(request.changes).toHaveLength(2)
  await source.applyChanges(sourceChanges(request))
  const updated = await exportRuntimeDatabase({
    config: cms.config,
    source,
    bundleId: 'updated',
    bundleUrl: '/updated.bundle',
    compression: 'none'
  })
  expect(
    updated.index.entries.find(entry => entry.entryId === 'apple')?.title
  ).toBe('Green apple')
  expect(
    updated.index.entries.find(entry => entry.entryId === 'pear')?.title
  ).toBe('Green pear')
})

test('keeps repeated and path-dependent updates sequential', async () => {
  const source = await createEntrySource(cms.config, [
    {
      id: 'apple',
      type: 'DemoRecipe',
      index: 'a1',
      root: 'pages',
      path: 'apple',
      data: {title: 'Apple'}
    }
  ])
  const release = await exportRuntimeDatabase({
    config: cms.config,
    bundleId: 'runtime',
    bundleUrl: '/payload.bundle',
    source,
    compression: 'none'
  })
  const store = new RuntimeEntryStore({
    index: release.index,
    source: () => new MemoryRangeSource(release.bundle)
  })

  const request = await requestRuntimeSourceMutations(
    cms.config,
    source,
    store,
    release.index,
    [
      {
        op: 'update',
        id: 'apple',
        locale: null,
        status: 'published',
        set: {title: 'Green apple'}
      },
      {
        op: 'update',
        id: 'apple',
        locale: null,
        status: 'published',
        set: {path: 'green-apple'}
      }
    ],
    Policy.ALLOW_ALL
  )

  expect(request.description).toBe('(update) Apple\n(update) Green apple')
  await source.applyChanges(sourceChanges(request))
  const updated = await exportRuntimeDatabase({
    config: cms.config,
    source,
    bundleId: 'updated',
    bundleUrl: '/updated.bundle',
    compression: 'none'
  })
  const apple = updated.index.entries.find(entry => entry.entryId === 'apple')
  expect(apple?.title).toBe('Green apple')
  expect(apple?.path).toBe('green-apple')
})

function cases(): ReadonlyArray<readonly [string, Mutation]> {
  return [
    [
      'update',
      {
        op: 'update',
        id: 'apple',
        locale: null,
        status: 'published',
        set: {title: 'Green apple'}
      }
    ],
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
        data: {title: 'Pear', path: 'pear'}
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
