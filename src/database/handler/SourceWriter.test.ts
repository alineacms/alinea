import {describe, expect, test} from 'bun:test'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import {Policy} from '#/core/Role.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {cms} from '#test/cms.js'
import {createEntrySource} from '#test/EntryFixture.js'
import {buildEntryDatabase} from '../entry/Source.js'
import {EntryQueryEngine} from '../entry/Query.js'
import {MemoryRangeSource} from '../replica/Bundle.js'
import {exportRuntimeDatabase} from '../runtime/Exporter.js'
import {RuntimeEntryStore} from '../runtime/Store.js'
import {
  requestRuntimeSourceUpdates,
  requestSourceMutations
} from './SourceWriter.js'

describe('requestSourceMutations', () => {
  for (const [name, mutation] of cases()) {
    test(`writes normalized source changes for ${name}`, async () => {
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
      const request = await requestSourceMutations(cms.config, source, [
        mutation
      ])
      expect(request.changes.length).toBeGreaterThan(0)
      await source.applyChanges(sourceChanges(request))
      const query = new EntryQueryEngine(
        await buildEntryDatabase(cms.config, source)
      )
      const entries = await query.find({status: 'all'})
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
  const snapshot = await buildEntryDatabase(cms.config, source)
  const release = await exportRuntimeDatabase({
    bundleId: 'runtime',
    bundleUrl: '/payload.bundle',
    snapshot,
    source,
    compression: 'none'
  })
  const store = new RuntimeEntryStore({
    index: release.index,
    source: () => new MemoryRangeSource(release.bundle)
  })

  const request = await requestRuntimeSourceUpdates(
    cms.config,
    source,
    store,
    release.index.entries,
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
  expect(request!.checks).toHaveLength(1)
  await source.applyChanges(sourceChanges(request!))
  const query = new EntryQueryEngine(
    await buildEntryDatabase(cms.config, source)
  )
  expect(
    (await query.find({status: 'all'})).find(entry => entry.entryId === 'apple')
      ?.title
  ).toBe('Green apple')
})

test('keeps path updates on the structural fallback', async () => {
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
  const snapshot = await buildEntryDatabase(cms.config, source)
  const release = await exportRuntimeDatabase({
    bundleId: 'runtime',
    bundleUrl: '/payload.bundle',
    snapshot,
    source,
    compression: 'none'
  })
  const store = new RuntimeEntryStore({
    index: release.index,
    source: () => new MemoryRangeSource(release.bundle)
  })

  expect(
    await requestRuntimeSourceUpdates(
      cms.config,
      source,
      store,
      release.index.entries,
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
  ).toBeUndefined()
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
