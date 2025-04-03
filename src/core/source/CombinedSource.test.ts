import {suite} from '@alinea/suite'
import {CombinedSource} from './CombinedSource.js'
import {MemorySource} from './MemorySource.js'

const test = suite(import.meta)

const encoder = new TextEncoder()

const sourceA = new MemorySource()
const hello = encoder.encode('hello world')
const helloSha = await sourceA.addBlob(hello)
await sourceA.applyChanges([
  {op: 'add', path: 'hello.txt', sha: helloSha, contents: hello},
  {op: 'add', path: 'hello1.txt', sha: helloSha, contents: hello}
])

const lorem = encoder.encode('lorem ipsum')
const loremSha = await sourceA.addBlob(lorem)
const sourceB = new MemorySource()
await sourceB.applyChanges([
  {op: 'add', path: 'xyz.txt', sha: helloSha, contents: hello},
  {op: 'add', path: 'lorem.txt', sha: loremSha, contents: lorem}
])

const combined = new CombinedSource({
  a: sourceA,
  b: sourceB
})

test('combined source', async () => {
  const tree = await combined.getTree()
  test.ok(tree.has('a/hello1.txt'))
  test.ok(tree.has('b/lorem.txt'))
  const blob = await combined.getBlob(helloSha)
  test.equal(blob, hello)

  await test.throws(
    () =>
      combined.applyChanges([
        {op: 'add', path: 'a', sha: helloSha, contents: hello}
      ]),
    'Invalid path'
  )

  await combined.applyChanges([
    {op: 'add', path: 'a/xyz.txt', sha: helloSha, contents: hello},
    {op: 'delete', path: 'b/lorem.txt', sha: loremSha}
  ])

  const tree2 = await combined.getTree()
  test.ok(tree2.has('a/xyz.txt'))
  test.not.ok(tree2.has('b/lorem.txt'))
})
