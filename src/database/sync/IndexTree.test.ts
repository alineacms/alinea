import {expect, test} from 'bun:test'
import {entryVersionId, type IndexedEntry} from '../entry/Schema.js'
import type {EntryReplacement} from '../runtime/EntryRuntime.js'
import {IndexTree} from './IndexTree.js'

function replacement(id: string, title: string): EntryReplacement {
  const entry: IndexedEntry = {
    id,
    locale: null,
    versionStatus: 'published',
    status: 'published',
    type: 'Page',
    title,
    workspace: 'main',
    root: 'pages',
    sourceRoot: 'pages',
    parentId: null,
    parents: [],
    level: 0,
    index: id,
    ordinal: 0,
    path: id,
    url: `/${id}`,
    active: true,
    main: true,
    visible: true,
    seeded: null,
    rowHash: `${id}:${title}`
  }
  return {entry, payloadId: `payload:${title}`}
}

test('derives stable bucket hashes and exact entry deltas', async () => {
  const original = await IndexTree.from([
    replacement('a', 'A'),
    replacement('b', 'B'),
    replacement('c', 'C')
  ])
  const same = await IndexTree.from([
    replacement('c', 'C'),
    replacement('a', 'A'),
    replacement('b', 'B')
  ])
  expect(same.root.hash).toBe(original.root.hash)

  const updated = await IndexTree.from([
    replacement('a', 'A'),
    replacement('b', 'Updated'),
    replacement('d', 'D')
  ])
  expect(original.diff(updated)).toEqual({
    fromHash: original.root.hash,
    toHash: updated.root.hash,
    replacements: [
      entryVersionId('b', null, 'published'),
      entryVersionId('d', null, 'published')
    ].sort(),
    removedVersionIds: [entryVersionId('c', null, 'published')]
  })
})

test('an insertion leaves every unrelated bucket hash intact', async () => {
  const entries = Array.from({length: 1000}, (_, index) =>
    replacement(`entry-${index}`, `Entry ${index}`)
  )
  const before = await IndexTree.from(entries)
  const after = await IndexTree.from([...entries, replacement('new', 'New')])
  const previous = new Map(
    before.root.children.map(node => [node.key, node.hash])
  )
  const retained = after.root.children.filter(
    node => previous.get(node.key) === node.hash
  )
  expect(retained.length).toBeGreaterThanOrEqual(
    before.root.children.length - 1
  )
})

test('rejects duplicate physical versions', async () => {
  await expect(
    IndexTree.from([replacement('same', 'A'), replacement('same', 'B')])
  ).rejects.toThrow('Duplicate indexed entry')
})
