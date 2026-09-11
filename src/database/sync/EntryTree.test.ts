import {expect, test} from 'bun:test'
import {entryTree, type EntryTreeRow} from './EntryTree.js'

function replacement(
  entry: Partial<EntryTreeRow> & Pick<EntryTreeRow, 'id' | 'rowHash'>
): EntryTreeRow {
  return {
    versionId: JSON.stringify([entry.id, null, 'published']),
    parentId: null,
    childrenSha: null,
    ...entry
  }
}

test('retains hidden authored versions beneath an archived parent', () => {
  const tree = entryTree(
    [
      replacement({
        id: 'parent',
        rowHash: 'parent-published',
        childrenSha: 'parent-directory'
      }),
      replacement({
        id: 'child',
        rowHash: 'child-draft',
        versionId: JSON.stringify(['child', null, 'draft']),
        parentId: 'parent',
        childrenSha: 'child-directory'
      }),
      replacement({
        id: 'child',
        rowHash: 'child-published',
        parentId: 'parent',
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
