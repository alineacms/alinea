import {suite} from '@alinea/suite'
import treeExample from '../../test/fixtures/exampleTree.json' with {
  type: 'json'
}
import {ReadonlyTree, WriteableTree} from './Tree.js'

const test = suite(import.meta)

test('construct tree', async () => {
  const tree = new WriteableTree()
  tree.add('file.txt', 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
  tree.add('subdir/a.txt', 'dffd6021bb2bd5b0af676290809ec3a53191dd81')
  tree.add('subdir/deeper/a.txt', 'dffd6021bb2bd5b0af676290809ec3a53191dd81')
  test.ok(tree.has('file.txt'))
  test.ok(tree.has('subdir/a.txt'))
  test.ok(tree.has('subdir/deeper/a.txt'))
  test.ok(tree.getLeaf('file.txt'))
  test.throws(() => tree.getLeaf('subdir'))
  test.ok(tree.getNode('subdir'))
  test.throws(() => tree.getNode('file.txt'))
  const sha = await tree.getSha()
  test.is(sha, 'e7ed88bc0c4055fd92561d514834179395f94882')
})

test('example tree', async () => {
  const tree = new WriteableTree()
  for (const entry of treeExample.tree) {
    if (entry.type === 'blob') {
      tree.add(entry.path, entry.sha)
    }
  }
  const sha = await tree.getSha()
  test.is(sha, treeExample.sha)

  const readonly = await tree.compile()
  test.is(readonly.sha, treeExample.sha)
})

test('init from flat', async () => {
  const tree = ReadonlyTree.fromFlat(treeExample)
  test.is(tree.sha, treeExample.sha)

  test.is(tree.flat().tree.length, treeExample.tree.length)
})

test('mutate tree', async () => {
  const tree = new WriteableTree()
  tree.add('file.txt', 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
  tree.add('subdir/a.txt', 'dffd6021bb2bd5b0af676290809ec3a53191dd81')
  tree.add('subdir/deeper/a.txt', 'dffd6021bb2bd5b0af676290809ec3a53191dd81')
  test.ok(tree.has('file.txt'))
  test.ok(tree.has('subdir/a.txt'))
  test.ok(tree.has('subdir/deeper/a.txt'))

  tree.remove('subdir/a.txt')
  test.not.ok(tree.has('subdir/a.txt'))

  test.ok(tree.has('subdir/deeper/a.txt'))
  tree.remove('subdir/deeper')
  test.not.ok(tree.has('subdir/deeper/a.txt'))

  test.ok(tree.has('file.txt'))
  tree.remove('file.txt')
  test.not.ok(tree.has('file.txt'))
  test.is(await tree.getSha(), '4b825dc642cb6eb9a060e54bf8d69288fbee4904')
})

test('rename paths', async () => {
  const tree = new WriteableTree()
  tree.add('file.txt', 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
  tree.add('subdir/a.txt', 'dffd6021bb2bd5b0af676290809ec3a53191dd81')
  tree.add('subdir/deeper/a.txt', 'dffd6021bb2bd5b0af676290809ec3a53191dd81')
  test.ok(tree.has('subdir/deeper/a.txt'))
  tree.rename('subdir', 'subdir2')
  test.not.ok(tree.has('subdir/deeper/a.txt'))
  test.ok(tree.has('subdir2/deeper/a.txt'))
})

test('diff trees', async () => {
  const tree1 = new WriteableTree()
  tree1.add('file.txt', 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
  tree1.add('subdir/a.txt', 'dffd6021bb2bd5b0af676290809ec3a53191dd81')
  tree1.add('subdir/deeper/a.txt', 'dffd6021bb2bd5b0af676290809ec3a53191dd81')
  const tree1Readonly = await tree1.compile()
  const tree2 = tree1.clone()
  test.is(await tree1.getSha(), await tree2.getSha())

  tree2.remove('subdir/a.txt')
  const diff = tree1Readonly.diff(tree2)
  test.equal(diff.changes, [
    {
      op: 'delete',
      path: 'subdir/a.txt',
      sha: 'dffd6021bb2bd5b0af676290809ec3a53191dd81'
    }
  ])

  tree2.add('subdir/a.txt', 'dffd6021bb2bd5b0af676290809ec3a53191dd81')
  test.is(await tree1.getSha(), await tree2.getSha())
  test.ok(tree2.equals(tree1))
  const diff2 = tree1Readonly.diff(tree2)
  test.equal(diff2.changes, [])

  tree2.add('file.txt', 'dffd6021bb2bd5b0af676290809ec3a53191dd81')
  const diff3 = tree1Readonly.diff(tree2)
  test.equal(diff3.changes, [
    {
      op: 'add',
      path: 'file.txt',
      sha: 'dffd6021bb2bd5b0af676290809ec3a53191dd81'
    }
  ])
})

test('diff pre-existing tree', async () => {
  const tree = ReadonlyTree.fromFlat(treeExample)
  const empty = new WriteableTree()
  const emptyReadonly = await empty.compile()
  const changes = emptyReadonly.diff(tree)
  empty.applyChanges(changes)
  test.is(await empty.getSha(), tree.sha)
  test.ok(tree.equals(empty))
})

test('ignore empty dirs', async () => {
  const empty = ReadonlyTree.EMPTY
  const withEmpty = new WriteableTree()
  test.ok(empty.equals(withEmpty))
  withEmpty.add('dir1', empty)
  withEmpty.add('dir2', empty)
  const finished = await withEmpty.compile()
  test.is(finished.sha, empty.sha)
})
