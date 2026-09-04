import {describe, expect, test} from 'bun:test'
import {cms} from '#test/cms.js'
import {MemoryRangeSource} from '../replica/Bundle.js'
import type {RuntimeDatabaseIndex, RuntimeIndexEntry} from './Model.js'
import {
  applyRuntimeDelta,
  createRuntimeDelta,
  RuntimeSnapshot,
  runtimeDeltaEntryIds
} from './Snapshot.js'

describe('RuntimeSnapshot', () => {
  test('materializes a minimal delta without a lookup chain', () => {
    const first = entry('first', 'a')
    const removed = entry('removed', 'b')
    const previous = index('one', [first, removed])
    const changed = {...first, title: 'Changed'}
    const added = entry('added', 'c')
    const next = index('two', [changed, added])
    const delta = createRuntimeDelta(previous, next, 'delta', '/delta.bundle')

    expect(delta.entries).toEqual([
      {op: 'set', entry: changed, previous: first},
      {op: 'set', entry: added},
      {
        op: 'remove',
        id: removed.id,
        entryId: removed.entryId,
        previous: removed
      }
    ])
    expect(applyRuntimeDelta(previous, delta)).toEqual(next)
    expect(runtimeDeltaEntryIds(delta)).toEqual(
      new Set(['first', 'added', 'removed'])
    )
  })

  test('forks a hot store instead of mutating the previous snapshot', () => {
    const previous = index('one', [entry('first', 'a')])
    const next = index('two', [entry('first', 'a'), entry('second', 'b')])
    const snapshot = RuntimeSnapshot.open(
      cms.config,
      previous,
      () => new MemoryRangeSource(new Uint8Array())
    )
    const delta = createRuntimeDelta(previous, next, 'delta', '/delta.bundle')
    const updated = snapshot.apply({delta, bundle: new Uint8Array()})

    expect(snapshot.index).toBe(previous)
    expect(snapshot.store.index).toBe(previous)
    expect(updated.index).toEqual(next)
    expect(updated.store.index).toBe(updated.index)
  })
})

function index(
  revision: string,
  entries: ReadonlyArray<RuntimeIndexEntry>
): RuntimeDatabaseIndex {
  return {
    revision,
    bundleId: 'base',
    bundleUrl: '/base.bundle',
    entries
  }
}

function entry(entryId: string, index: string): RuntimeIndexEntry {
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
    index,
    parentId: null,
    parents: [],
    path: entryId,
    url: `/${entryId}`
  }
}
