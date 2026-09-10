import {expect, test} from 'bun:test'
import type {IndexedEntry} from '../entry/Schema.js'
import type {EntryReplacement} from '../runtime/EntryRuntime.js'
import {entryTree} from './EntryTree.js'

function replacement(
  entry: Partial<IndexedEntry> & Pick<IndexedEntry, 'id' | 'rowHash'>
): EntryReplacement {
  return {
    entry: {
      locale: null,
      versionStatus: 'published',
      status: 'archived',
      type: 'Page',
      title: entry.id,
      workspace: 'main',
      root: 'pages',
      parentId: null,
      parents: [],
      level: 0,
      index: entry.id,
      path: entry.id,
      url: `/${entry.id}`,
      active: true,
      main: true,
      visible: true,
      seeded: null,
      ...entry
    },
    data: {}
  }
}

test('retains hidden authored versions beneath an archived parent', () => {
  const tree = entryTree(
    [
      replacement({
        id: 'parent',
        rowHash: 'parent-published',
        parentSha: 'root',
        childrenSha: 'parent-directory'
      }),
      replacement({
        id: 'child',
        rowHash: 'child-published',
        parentId: 'parent',
        parents: ['parent'],
        parentSha: 'parent-directory',
        childrenSha: 'child-directory'
      }),
      replacement({
        id: 'child',
        rowHash: 'child-draft',
        versionStatus: 'draft',
        parentId: 'parent',
        parents: ['parent'],
        active: false,
        main: false,
        visible: false,
        parentSha: 'parent-directory',
        childrenSha: 'child-directory'
      })
    ],
    'root'
  )
  expect([...tree.index().values()].sort()).toEqual(
    ['parent-published', 'child-published', 'child-draft'].sort()
  )
})

test('rejects incomplete directory hashes', () => {
  expect(() =>
    entryTree([replacement({id: 'entry', rowHash: 'entry'})], 'root')
  ).toThrow('Incomplete or inconsistent')
})
