import {describe, expect, test} from 'bun:test'
import {DatabaseSnapshot} from '../Database.js'
import type {EntryAccessPolicy} from '../entry/Access.js'
import {entryDatabaseSchema} from '../entry/Indexes.js'
import type {AlineaDatabaseRecord, EntryCoreRecord} from '../entry/Model.js'
import {exportEntryRelease} from '../release/Exporter.js'
import {projectEntryReplicaState} from './EntryProjection.js'
import {ReplicaService} from './Service.js'

function core(entryId: string): EntryCoreRecord {
  return {
    kind: 'entry',
    id: `entry:${entryId}`,
    queryable: true,
    entryId,
    versionStatus: 'published',
    status: 'published',
    active: true,
    main: true,
    type: 'Page',
    title: entryId,
    seeded: null,
    workspace: 'main',
    root: 'pages',
    locale: null,
    level: 0,
    index: entryId,
    parentId: null,
    parents: [],
    path: entryId,
    url: `/${entryId}`
  }
}

function records(entryId: string): Array<AlineaDatabaseRecord> {
  const entry = core(entryId)
  return [
    entry,
    {
      kind: 'entryRead',
      id: `entry-read:${entryId}`,
      entryVersionId: entry.id,
      filePath: `${entryId}.json`,
      parentDir: '',
      childrenDir: entryId,
      rowHash: entryId,
      fileHash: entryId,
      payloadId: `payload:${entryId}`
    },
    {
      kind: 'payload',
      id: `payload:${entryId}`,
      entryVersionId: entry.id,
      data: {body: `Secret ${entryId}`}
    }
  ]
}

describe('projectEntryReplicaState', () => {
  test('separates explore discovery from readable payload grants', async () => {
    const snapshot = new DatabaseSnapshot({
      schema: entryDatabaseSchema,
      revision: 'tree-1',
      records: [...records('readable'), ...records('explorable')]
    })
    const release = await exportEntryRelease({
      bundleId: 'release-1',
      bundleUrl: '/secret/database.bin',
      snapshot
    })
    const policy: EntryAccessPolicy = {
      canRead(resource) {
        return resource?.id === 'readable'
      },
      canExplore(resource) {
        return resource?.id === 'explorable'
      }
    }
    const state = projectEntryReplicaState({
      viewId: 'user-1',
      policy,
      snapshot,
      catalog: release.catalog,
      keys: release.keys
    })

    expect(state.recordAccess).toEqual({
      'entry:readable': 'read',
      'entry:explorable': 'explore'
    })
    expect(state.catalog.records['entry:readable']).toBeDefined()
    expect(state.catalog.records['payload:readable']).toBeDefined()
    expect(state.catalog.records['entry:explorable']).toBeDefined()
    expect(state.catalog.records['payload:explorable']).toBeUndefined()
    expect(state.grants.map(grant => grant.accessClassId).sort()).toEqual([
      'entry-explore:entry:explorable',
      'entry-explore:entry:readable',
      'entry-read:entry:readable'
    ])

    const service = new ReplicaService({
      configId: 'config-1',
      configUrl: '/secret/config.js',
      cacheKey: 'cache-1',
      release: {snapshot, catalog: release.catalog, keys: release.keys}
    })
    const session = {
      user: {id: 'user-1', roles: ['editor']},
      policy,
      policyFingerprint: 'editor-view'
    }
    expect(service.bootstrap(session).configUrl).toBe('/secret/config.js')
    expect(service.state(session)).toBe(service.state(session))
    expect(service.state(session, 'tree-1')).toBeUndefined()
    expect(service.object(session, 'payload:readable')).toBeDefined()
    expect(service.object(session, 'payload:explorable')).toBeUndefined()
  })
})
