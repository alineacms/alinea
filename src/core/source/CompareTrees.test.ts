import {expect, test} from 'bun:test'
import {compareTrees, treeReader} from './CompareTrees.js'
import {WriteableTree} from './Tree.js'

const a = 'a'.repeat(40)
const b = 'b'.repeat(40)
const c = 'c'.repeat(40)

async function tree(files: Record<string, string>) {
  const result = new WriteableTree()
  for (const [path, sha] of Object.entries(files)) result.add(path, sha)
  return result.compile()
}

async function compare(
  from: Record<string, string>,
  to: Record<string, string>
) {
  const x = await tree(from)
  const y = await tree(to)
  return compareTrees(treeReader(x, y), x.sha, y.sha)
}

test('changed files', async () => {
  const {changes, moves} = await compare(
    {'pages/a.json': a, 'pages/b.json': b},
    {'pages/a.json': c, 'pages/c.json': c}
  )
  expect(changes).toEqual([
    {op: 'delete', path: 'pages/b.json', sha: b},
    {op: 'add', path: 'pages/a.json', sha: c},
    {op: 'add', path: 'pages/c.json', sha: c}
  ])
  expect(moves).toEqual([])
})

test('a moved directory', async () => {
  const {changes, moves} = await compare(
    {'pages/x.json': a, 'pages/x/1.json': a, 'pages/x/2.json': b},
    {'pages/y/x.json': a, 'pages/y/x/1.json': a, 'pages/y/x/2.json': b}
  )
  expect(changes).toEqual([
    {op: 'delete', path: 'pages/x.json', sha: a},
    {op: 'add', path: 'pages/y/x.json', sha: a}
  ])
  expect(moves.map(({from, to}) => [from, to])).toEqual([
    ['pages/x', 'pages/y/x']
  ])
})

test('a copied directory is added', async () => {
  const {changes, moves} = await compare(
    {'pages/x/1.json': a},
    {'pages/x/1.json': a, 'pages/y/1.json': a}
  )
  expect(changes).toEqual([{op: 'add', path: 'pages/y/1.json', sha: a}])
  expect(moves).toEqual([])
})

test('a move expands to its files', async () => {
  const comparison = await compare({'x/1.json': a}, {'y/1.json': a})
  const [move] = comparison.moves
  expect(await comparison.expand(move)).toEqual([
    {op: 'delete', path: 'x/1.json', sha: a},
    {op: 'add', path: 'y/1.json', sha: a}
  ])
  expect(comparison.dirSha('y')).toBe(move.sha)
})
