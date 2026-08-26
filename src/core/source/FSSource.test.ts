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

test('blob reads have bounded concurrency without buffering the result', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'alinea-fs-blobs-'))
  const fileCount = 64
  try {
    await Promise.all(
      Array.from({length: fileCount}, (_, index) =>
        writeFile(join(dir, `${index}.txt`), `File ${index}`)
      )
    )
    class InstrumentedFSSource extends FSSource {
      activeReads = 0
      maxActiveReads = 0

      async readBlob(sha: string, file: string) {
        this.activeReads++
        this.maxActiveReads = Math.max(this.maxActiveReads, this.activeReads)
        await new Promise(resolve => setTimeout(resolve, 5))
        try {
          return await super.readBlob(sha, file)
        } finally {
          this.activeReads--
        }
      }
    }

    const source = new InstrumentedFSSource(dir)
    const tree = await source.getTree()
    const blobs = []
    for await (const blob of source.getBlobs([...tree.index().values()]))
      blobs.push(blob)

    test.is(source.maxActiveReads, 32)
    test.is(blobs.length, fileCount)
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
})

test('blob read cancellation does not wait for pending reads', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'alinea-fs-abort-'))
  let release = () => {}
  const blocked = new Promise<void>(resolve => {
    release = resolve
  })
  try {
    await writeFile(join(dir, 'file.txt'), 'File')
    class BlockingFSSource extends FSSource {
      started = false

      async readBlob(sha: string) {
        this.started = true
        await blocked
        return [sha, new Uint8Array()] as [string, Uint8Array]
      }
    }

    const source = new BlockingFSSource(dir)
    const tree = await source.getTree()
    const controller = new AbortController()
    const iterator = source.getBlobs([...tree.index().values()], {
      signal: controller.signal
    })
    const next = iterator.next()
    await Promise.resolve()
    test.is(source.started, true)

    const error = new Error('Cancelled blob reads')
    controller.abort(error)
    let timeout: ReturnType<typeof setTimeout> | undefined
    const result = await Promise.race([
      next.then(
        () => undefined,
        reason => reason
      ),
      new Promise(resolve => {
        timeout = setTimeout(() => resolve('timeout'), 100)
      })
    ])
    clearTimeout(timeout)

    test.is(result, error)
  } finally {
    release()
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

test('cached source retains unchanged blobs and prunes removed blobs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'alinea-fs-cache-'))
  try {
    await writeFile(join(dir, 'unchanged.txt'), 'Unchanged')
    await writeFile(join(dir, 'removed.txt'), 'Removed')

    class TrackingCachedFSSource extends CachedFSSource {
      blobReads = 0

      async readBlob(sha: string, file: string, signal?: AbortSignal) {
        this.blobReads++
        return super.readBlob(sha, file, signal)
      }
    }

    const source = new TrackingCachedFSSource(dir)
    const initial = await source.getTree()
    const removedSha = initial.getLeaf('removed.txt').sha

    await rm(join(dir, 'removed.txt'))
    const refreshed = await source.refresh()
    const blobs = []
    for await (const blob of source.getBlobs([...refreshed.index().values()]))
      blobs.push(blob)

    test.is(blobs.length, 1)
    test.is(source.blobReads, 0)
    await test.throws(async () => {
      for await (const _ of source.getBlobs([removedSha])) {
        // Consume the generator.
      }
    })
    test.is(source.blobReads, 1)
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
})

test('cached source retries a failed tree refresh', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'alinea-fs-retry-'))
  try {
    await writeFile(join(dir, 'file.txt'), 'File')

    class FlakyCachedFSSource extends CachedFSSource {
      fail = true

      async getFile(
        current: ReadonlyTree,
        builder: WriteableTree,
        file: string
      ) {
        if (this.fail) {
          this.fail = false
          throw new Error('Tree refresh failed')
        }
        return super.getFile(current, builder, file)
      }
    }

    const source = new FlakyCachedFSSource(dir)
    await test.throws(() => source.getTree(), 'Tree refresh failed')
    const tree = await source.getTree()

    test.is(tree.index().size, 1)
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
})
