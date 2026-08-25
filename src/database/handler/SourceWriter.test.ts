import {describe, expect, test} from 'bun:test'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {cms} from '#test/cms.js'
import {createEntrySource} from '#test/EntryFixture.js'
import {buildEntryDatabase} from '../entry/Source.js'
import {EntryQueryEngine} from '../entry/Query.js'
import {requestSourceMutations} from './SourceWriter.js'

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
