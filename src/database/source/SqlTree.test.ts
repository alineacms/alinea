import {describe, expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {ReadonlyTree, WritableTree} from '#/core/source/Tree.js'
import {
  hashBlob,
  hashTree,
  serializeTreeEntries
} from '#/core/source/GitUtils.js'
import {SqlTree} from './SqlTree.js'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

async function source(files: Record<string, string>): Promise<ReadonlyTree> {
  const tree = new WritableTree()
  for (const [path, value] of Object.entries(files))
    tree.add(path, await hashBlob(new TextEncoder().encode(value)))
  return tree.compile()
}

describe('SQL source tree', () => {
  test('applies exact-base changes incrementally, including file/directory replacements', async () => {
    using sqlite = new Database(':memory:')
    const db = connect(sqlite)
    await SqlTree.createSchema(db)
    const versions = [
      await source({
        'same/deep/a': 'unchanged',
        swap: 'file',
        'remove/a': 'gone'
      }),
      await source({
        'same/deep/a': 'unchanged',
        'swap/a': 'nested',
        'new/a/b': 'new'
      }),
      await source({'same/deep/a': 'unchanged', swap: 'file again'}),
      ReadonlyTree.EMPTY
    ]
    let current = await SqlTree.store(db, versions[0])
    for (const tree of versions.slice(1)) {
      using remote = new Database(':memory:')
      const other = connect(remote)
      await SqlTree.createSchema(other)
      const desired = await SqlTree.store(other, tree)
      const delta = await current.diff(desired)
      const next = await current.withChanges(delta.changes)
      expect(next.sha).toBe(tree.sha)
      expect((await next.toTree()).flat().tree).toEqual(
        tree
          .flat()
          .tree.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
      )
      if (delta.changes.length)
        await expect(next.withChanges(delta.changes)).rejects.toThrow(
          'Source changed'
        )
      current = next
    }
  })

  test('opens a previous raw SQLite database without rebuilding the index', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'alinea-sql-tree-'))
    try {
      const path = join(directory, 'release.sqlite')
      const tree = await source({
        'pages/a.json': 'authored',
        'media/a.json': 'image'
      })
      {
        using sqlite = new Database(path)
        const db = connect(sqlite)
        await SqlTree.createSchema(db)
        await SqlTree.store(db, tree)
      }
      using reopened = new Database(path, {readonly: true})
      const saved = new SqlTree(connect(reopened), tree.sha)
      expect((await saved.toTree()).flat().tree).toEqual(
        tree
          .flat()
          .tree.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
      )
      expect(await saved.get('pages/a.json')).toMatchObject({
        sha: tree.getLeaf('pages/a.json').sha
      })
    } finally {
      await rm(directory, {recursive: true})
    }
  })
  test('retains snapshots, reuses directories and compares across databases', async () => {
    using sqlite = new Database(':memory:')
    using other = new Database(':memory:')
    const db = connect(sqlite)
    const remote = connect(other)
    await SqlTree.createSchema(db)
    await SqlTree.createSchema(remote)
    const before = await source({'keep/a.json': 'a', 'old.json': 'old'})
    const after = await source({'keep/a.json': 'a', 'new.json': 'new'})
    const previous = await SqlTree.store(db, before)
    const current = await SqlTree.store(db, after)
    const external = await SqlTree.store(remote, after)
    expect((await previous.toTree()).flat()).toEqual(before.flat())
    expect((await current.toTree()).flat()).toEqual(after.flat())
    expect(await current.get('keep/a.json')).toMatchObject({directory: false})
    expect(await current.get('keep/a.json/missing')).toBeUndefined()
    expect((await previous.diff(external)).changes).toEqual([
      {
        path: 'new.json',
        after: {sha: after.getLeaf('new.json').sha, mode: '100644'}
      },
      {
        path: 'old.json',
        before: {sha: before.getLeaf('old.json').sha, mode: '100644'}
      }
    ])
    expect(
      sqlite.query('select count(*) as n from alinea_source_tree').get()
    ).toEqual({n: 3})
    await SqlTree.store(db, after)
    expect(
      sqlite.query('select count(*) as n from alinea_source_tree').get()
    ).toEqual({n: 3})
  })

  test('mode-only changes and file/directory replacement are visible', async () => {
    using sqlite = new Database(':memory:')
    const db = connect(sqlite)
    await SqlTree.createSchema(db)
    const before = await source({script: 'same', 'nested/a': 'old'})
    const entries = before.entries.map(entry =>
      entry.name === 'script' ? {...entry, mode: '100755'} : entry
    )
    const executable = new ReadonlyTree({
      sha: await hashTree(serializeTreeEntries(entries)),
      entries
    })
    const a = await SqlTree.store(db, before)
    const b = await SqlTree.store(db, executable)
    expect((await a.diff(b)).changes).toEqual([
      {
        path: 'script',
        before: {sha: before.getLeaf('script').sha, mode: '100644'},
        after: {sha: before.getLeaf('script').sha, mode: '100755'}
      }
    ])
    const c = await SqlTree.store(db, await source({nested: 'file'}))
    expect((await a.diff(c)).changes.map(change => change.path)).toEqual([
      'nested',
      'nested/a',
      'script'
    ])
  })

  test('equal hashes skip reads and missing snapshots fail explicitly', async () => {
    using sqlite = new Database(':memory:')
    const db = connect(sqlite)
    await SqlTree.createSchema(db)
    const empty = await SqlTree.store(db, ReadonlyTree.EMPTY)
    expect((await empty.toTree()).sha).toBe(ReadonlyTree.EMPTY.sha)
    const absent = new SqlTree(db, 'missing')
    expect((await absent.diff(absent)).changes).toEqual([])
    await expect(absent.children()).rejects.toThrow('Missing source tree')
    await expect(empty.get('../x')).rejects.toThrow('Invalid source path')
    await expect(
      SqlTree.store(db, new ReadonlyTree({sha: 'invalid', entries: []}))
    ).rejects.toThrow('Invalid source tree hash')
  })
})
