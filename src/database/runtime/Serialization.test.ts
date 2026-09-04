import {expect, test} from 'bun:test'
import type {RuntimeDatabaseIndex} from './Model.js'
import {
  deserializeRuntimeDatabaseIndex,
  serializeRuntimeDatabaseIndex
} from './Serialization.js'

test('packs repeated core fields and reconstructs derived fields', () => {
  const index: RuntimeDatabaseIndex = {
    revision: 'revision',
    bundleId: 'bundle',
    bundleUrl: '/payload.bundle',
    entries: [
      {
        kind: 'entry',
        id: 'ignored-physical-id',
        queryable: true,
        entryId: 'entry-id',
        versionStatus: 'draft',
        status: 'archived',
        active: false,
        main: true,
        type: 'Page',
        title: 'Page',
        seeded: null,
        workspace: 'main',
        root: 'pages',
        locale: 'en',
        level: 1,
        index: 'a0',
        parentId: 'parent',
        parents: ['parent'],
        path: 'page',
        url: '/page',
        urlAliases: ['/old-page'],
        frames: {
          decodeKey: 'key',
          data: {offset: 1, length: 2, nonce: 'nonce'}
        }
      }
    ]
  }
  const serialized = serializeRuntimeDatabaseIndex(index)
  expect(serialized.strings.workspaces).toEqual(['main'])
  expect(serialized.strings.roots).toEqual(['pages'])
  expect(serialized.entries[0]).not.toContain('ignored-physical-id')
  expect(deserializeRuntimeDatabaseIndex(serialized)).toEqual({
    ...index,
    entries: [
      {
        ...index.entries[0],
        id: 'entry:entry-id:en:draft',
        urlAliases: ['/old-page']
      }
    ]
  })
})
