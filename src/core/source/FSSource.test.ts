import demoTree from '#test/fixtures/demo.json' with {type: 'json'}
import {suite} from '@alinea/suite'
import {spyOn} from 'bun:test'
import fs, {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {CachedFSSource, FSSource} from './FSSource.js'
import {hashBlob} from './GitUtils.js'
import {ReadonlyTree, WriteableTree} from './Tree.js'

const test = suite(import.meta)

test('compare', async () => {
  const dir = 'test/fixtures/demo'
  const fsSource = new FSSource(dir)
  const tree = ReadonlyTree.fromFlat(demoTree)
  const fsTree = await fsSource.getTree()
  const batch = fsTree.diff(tree)
  test.is(batch.changes.length, 0)
})

test('filesystem reads have bounded concurrency without omitting files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'alinea-fs-source-'))
  const fileCount = 128
  try {
    await Promise.all(
      Array.from({length: fileCount}, (_, index) =>
        writeFile(join(dir, `${index}.txt`), `File ${index}`)
      )
    )
    class InstrumentedFSSource extends FSSource {
      activeReads = 0
      maxActiveReads = 0

      async getFile(
        current: ReadonlyTree,
        builder: WriteableTree,
        file: string
      ) {
        this.activeReads++
        this.maxActiveReads = Math.max(this.maxActiveReads, this.activeReads)
        await new Promise(resolve => setTimeout(resolve, 5))
        try {
          return await super.getFile(current, builder, file)
        } finally {
          this.activeReads--
        }
      }
    }

    const source = new InstrumentedFSSource(dir)
    const tree = await source.getTree()

    test.is(source.maxActiveReads, 64)
    test.is(tree.index().size, fileCount)
    for (let index = 0; index < fileCount; index++)
      test.ok(tree.has(`${index}.txt`))
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
})

test('non-ENOENT filesystem read errors are propagated', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'alinea-fs-source-'))
  const error = Object.assign(new Error('Too many open files'), {
    code: 'EMFILE'
  })
  const readFile = spyOn(fs, 'readFile').mockRejectedValue(error)
  try {
    await writeFile(join(dir, 'hello.txt'), 'Hello')
    const source = new FSSource(dir)
    await test.throws(() => source.getTree(), 'Too many open files')
  } finally {
    readFile.mockRestore()
    await rm(dir, {recursive: true, force: true})
  }
})

test('cached source invalidates its tree after applying changes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'alinea-fs-source-'))
  try {
    const source = new CachedFSSource(dir)
    const before = await source.getTree()
    const contents = new TextEncoder().encode('Hello')
    const sha = await hashBlob(contents)

    await source.applyChanges({
      fromSha: before.sha,
      changes: [{op: 'add', path: 'hello.txt', sha, contents}]
    })

    const after = await source.getTree()
    test.is(after.getLeaf('hello.txt').sha, sha)
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
})

test('a filesystem snapshot avoids rereading unchanged files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'alinea-fs-source-'))
  try {
    await writeFile(join(dir, 'hello.txt'), 'Hello')
    const first = new FSSource(dir)
    const expected = await first.getTree()
    const readFile = spyOn(fs, 'readFile')
    try {
      const restored = new FSSource(dir, first.snapshot())

      const tree = await restored.getTree()

      test.is(tree.sha, expected.sha)
      test.is(readFile.mock.calls.length, 0)
    } finally {
      readFile.mockRestore()
    }
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
})
