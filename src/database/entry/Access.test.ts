import {describe, expect, test} from 'bun:test'
import {Permission, Policy} from '#/core/Role.js'
import {entrySyncAccess} from './Access.js'
import type {EntryCoreRecord} from './Model.js'

const entry: EntryCoreRecord = {
  kind: 'entry',
  queryable: true,
  id: 'entry:page:published',
  entryId: 'page',
  versionStatus: 'published',
  status: 'published',
  active: true,
  main: true,
  type: 'Page',
  title: 'Page',
  seeded: null,
  workspace: 'main',
  root: 'pages',
  locale: null,
  level: 0,
  index: 'a',
  parentId: null,
  parents: [],
  path: 'page',
  url: '/page'
}

describe('entry synchronization access', () => {
  test('syncs picker metadata but not payload for explore access', () => {
    expect(entrySyncAccess(new Policy(Permission.Explore), entry)).toBe(
      'explore'
    )
  })

  test('syncs payload and full search only for read access', () => {
    expect(entrySyncAccess(new Policy(Permission.Read), entry)).toBe('read')
  })

  test('does not sync entries without either access right', () => {
    expect(entrySyncAccess(Policy.ALLOW_NONE, entry)).toBe('none')
  })
})
