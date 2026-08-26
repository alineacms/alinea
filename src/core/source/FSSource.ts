import type {Stats} from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path/posix'
import pDebounce from 'p-debounce'
import pLimit from 'p-limit'
import {assert} from '../util/Assert.js'
import {mapConcurrent} from '../util/Async.js'
import {isRecord} from '../util/Objects.js'
import type {ChangesBatch} from './Change.js'
import {hashBlob} from './GitUtils.js'
import type {GetBlobsOptions, Source} from './Source.js'
import {ReadonlyTree, WriteableTree} from './Tree.js'

const limit = pLimit(1)
const fileConcurrency = 64
const blobReadConcurrency = 32

export class FSSource implements Source {
  #current: ReadonlyTree = ReadonlyTree.EMPTY
  #cwd: string
  #locations = new Map<string, string>()
  #lastModified = new Map<string, number>()

  constructor(cwd: string) {
    this.#cwd = cwd
  }

  async getTree() {
    return limit(async () => {
      const current = this.#current
      const builder = new WriteableTree()
      const files = await fs.readdir(this.#cwd, {
        recursive: true
      })
      for await (const result of mapConcurrent(
        files,
        file => this.getFile(current, builder, file),
        {concurrency: fileConcurrency}
      ))
        void result
      const tree = await builder.compile(current)
      this.#current = tree
      return tree
    })
  }

  async getFile(current: ReadonlyTree, builder: WriteableTree, file: string) {
    const filePath = file.replaceAll('\\', '/')
    const fullPath = path.join(this.#cwd, filePath)
    let stat: Stats
    try {
      stat = await fs.stat(fullPath)
      if (!stat.isFile()) return
    } catch (error) {
      if (isRecord(error) && error.code === 'ENOENT') return
      throw error
    }
    const previouslyModified = this.#lastModified.get(filePath)
    if (previouslyModified && stat.mtimeMs === previouslyModified) {
      const previous = current.get(filePath)
      if (previous && typeof previous.sha === 'string') {
        builder.add(filePath, previous.sha)
        return
      }
    }
    let contents: Uint8Array
    try {
      contents = await fs.readFile(fullPath)
    } catch (error) {
      if (isRecord(error) && error.code === 'ENOENT') return
      throw error
    }
    const sha = await hashBlob(contents)
    this.#locations.set(sha, filePath)
    this.#lastModified.set(filePath, stat.mtimeMs)
    builder.add(filePath, sha)
    return [sha, contents] as const
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const current = await this.getTree()
    return current.sha === sha ? undefined : current
  }

  getBlobs(
    shas: ReadonlyArray<string>,
    options: GetBlobsOptions = {}
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    return mapConcurrent(
      shas,
      (sha, signal) => {
        const file = this.#locations.get(sha)
        assert(file, `Missing path for blob ${sha}`)
        return this.readBlob(sha, file, signal)
      },
      {concurrency: blobReadConcurrency, signal: options.signal}
    )
  }

  async readBlob(
    sha: string,
    file: string,
    signal?: AbortSignal
  ): Promise<[sha: string, blob: Uint8Array]> {
    const blob = await fs.readFile(`${this.#cwd}/${file}`, {signal})
    return [sha, blob]
  }

  async applyChanges(batch: ChangesBatch) {
    return limit(async () => {
      await Promise.all(
        batch.changes.map(async change => {
          switch (change.op) {
            case 'delete': {
              return fs.unlink(`${this.#cwd}/${change.path}`).catch(() => {})
            }
            case 'add': {
              const {contents} = change
              assert(contents, 'Missing contents')
              const dir = path.dirname(change.path)
              await fs
                .mkdir(`${this.#cwd}/${dir}`, {recursive: true})
                .catch(() => {})
              return fs.writeFile(`${this.#cwd}/${change.path}`, contents)
            }
          }
        })
      )
    })
  }
}

export class CachedFSSource extends FSSource {
  #tree: Promise<ReadonlyTree> | undefined
  #blobs: Map<string, Uint8Array> = new Map()

  constructor(cwd: string) {
    super(cwd)
  }

  refresh = pDebounce(() => {
    let refresh: Promise<ReadonlyTree>
    refresh = super.getTree().then(
      tree => {
        const currentShas = new Set(tree.index().values())
        for (const sha of this.#blobs.keys()) {
          if (!currentShas.has(sha)) this.#blobs.delete(sha)
        }
        return tree
      },
      error => {
        if (this.#tree === refresh) this.#tree = undefined
        throw error
      }
    )
    this.#tree = refresh
    return refresh
  }, 50)

  getTree() {
    if (!this.#tree) return this.refresh()
    return this.#tree
  }

  async applyChanges(batch: ChangesBatch) {
    await super.applyChanges(batch)
    this.#tree = undefined
  }

  async getFile(current: ReadonlyTree, builder: WriteableTree, file: string) {
    const result = await super.getFile(current, builder, file)
    if (result) this.#blobs?.set(result[0], result[1])
    return result
  }

  async *getBlobs(
    shas: ReadonlyArray<string>,
    options: GetBlobsOptions = {}
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    const fromRemote = []
    for (const sha of shas) {
      if (options.signal?.aborted)
        throw options.signal.reason ?? new Error('Blob transfer aborted')
      const blob = this.#blobs.get(sha)
      if (blob) yield [sha, blob]
      else fromRemote.push(sha)
    }
    for await (const [sha, blob] of super.getBlobs(fromRemote, options)) {
      this.#blobs.set(sha, blob)
      yield [sha, blob]
    }
  }
}
