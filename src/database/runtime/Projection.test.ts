import {describe, expect, test} from 'bun:test'
import type {EntryAccessPolicy} from '../entry/Access.js'
import type {RuntimeDatabaseIndex, RuntimeIndexEntry} from './Model.js'
import {createRuntimeView} from './Projection.js'

function entry(id: string, parentId: string | null = null): RuntimeIndexEntry {
  return {
    kind: 'entry',
    id: `entry:${id}`,
    queryable: true,
    entryId: id,
    versionStatus: 'published',
    status: parentId ? 'archived' : 'published',
    active: true,
    main: true,
    type: 'Page',
    title: id,
    seeded: null,
    workspace: 'main',
    root: 'pages',
    locale: null,
    level: parentId ? 1 : 0,
    index: id,
    parentId,
    parents: parentId ? [parentId] : [],
    path: id,
    url: `/${id}`,
    frames: {
      decodeKey: `key-${id}`,
      data: {
        offset: 0,
        length: 1,
        nonce: '',
        compression: 'none'
      }
    }
  }
}

test('projects readable and explorable runtime rows without source access', () => {
  const index: RuntimeDatabaseIndex = {
    revision: 'revision',
    bundleId: 'bundle',
    bundleUrl: '/payload.bundle',
    entries: [entry('readable'), entry('explorable', 'readable')]
  }
  const policy: EntryAccessPolicy = {
    canRead(resource) {
      return resource?.id === 'readable'
    },
    canExplore(resource) {
      return resource?.id === 'explorable'
    }
  }

  const view = createRuntimeView(index, policy)

  expect(view.source).toBeUndefined()
  expect(view.entries[0].frames?.decodeKey).toBe('key-readable')
  expect(view.entries[1].frames).toBeUndefined()
  expect(view.entries[1]).toMatchObject({
    versionStatus: 'published',
    status: 'archived'
  })
})
