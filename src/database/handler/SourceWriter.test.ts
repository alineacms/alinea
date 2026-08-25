import {describe, expect, test} from 'bun:test'
import type {Mutation} from '#/core/db/Mutation.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {cms} from '#test/cms.js'
import {createEntryIndex} from '#test/EntryFixture.js'
import {requestSourceMutations} from './SourceWriter.js'

describe('requestSourceMutations', () => {
  for (const [name, mutation] of cases()) {
    test(`matches the legacy source transaction for ${name}`, async () => {
      const {source} = await createEntryIndex(cms.config, [
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
      const legacy = new LocalDB(cms.config, source)
      await legacy.sync()

      const expected = await legacy.request([mutation])
      const actual = await requestSourceMutations(cms.config, source, [
        mutation
      ])

      expect(actual).toEqual(expected)
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
