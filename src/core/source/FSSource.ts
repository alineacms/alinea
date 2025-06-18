import type {Stats} from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path/posix'
import pDebounce from 'p-debounce'
import pLimit from 'p-limit'
import {
  type CommitRequest,
  checkCommit,
  sourceChanges
} from '../db/CommitRequest.js'
import {accumulate} from '../util/Async.js'
import type {ChangesBatch} from './Change.js'
import {hashBlob} from './GitUtils.js'
import type {Source} from './Source.js'
import {ReadonlyTree, WriteableTree} from './Tree.js'
import {assert} from './Utils.js'

const limit = pLimit(1)

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
      const tasks = files.map(file => this.getFile(current, builder, file))
      await Promise.all(tasks)
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
    } catch {
      return
    }
    const previouslyModified = this.#lastModified.get(filePath)
    if (previouslyModified && stat.mtimeMs === previouslyModified) {
      const previous = current.get(filePath)
      if (previous && typeof previous.sha === 'string') {
        builder.add(filePath, previous.sha)
        return
      }
    }
    try {
      const contents = await fs.readFile(fullPath)
      const sha = await hashBlob(contents)
      this.#locations.set(sha, filePath)
      this.#lastModified.set(filePath, stat.mtimeMs)
      builder.add(filePath, sha)
      return [sha, contents] as const
    } catch {}
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const current = await this.getTree()
    return current.sha === sha ? undefined : current
  }

  async *getBlobs(
    shas: Array<string>
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    for (const sha of shas) {
      const path = this.#locations.get(sha)
      assert(path, `Missing path for blob ${sha}`)
      yield [sha, await fs.readFile(`${this.#cwd}/${path}`)]
    }
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

  async write(request: CommitRequest) {
    const local = await this.getTree()
    checkCommit(local, request)
    const contentChanges = sourceChanges(request)
    await this.applyChanges(contentChanges)
    const tree = local.clone()
    tree.applyChanges(contentChanges)
    return tree.getSha()
  }
}

export class CachedFSSource extends FSSource {
  #tree: Promise<ReadonlyTree> | undefined
  #blobs: Map<string, Uint8Array> = new Map()

  constructor(cwd: string) {
    super(cwd)
  }

  refresh = pDebounce(async () => {
    this.#blobs = new Map()
    return (this.#tree = super.getTree())
  }, 50)

  getTree() {
    if (!this.#tree) return this.refresh()
    return this.#tree
  }

  async getFile(current: ReadonlyTree, builder: WriteableTree, file: string) {
    const result = await super.getFile(current, builder, file)
    if (result) this.#blobs?.set(result[0], result[1])
    return result
  }

  async *getBlobs(
    shas: Array<string>
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    const fromLocal = shas.filter(sha => this.#blobs.has(sha))
    const localEntries = fromLocal.map(
      (sha): [sha: string, blob: Uint8Array] => [sha, this.#blobs.get(sha)!]
    )
    const fromRemote = shas.filter(sha => !this.#blobs.has(sha))
    const remoteEntries =
      fromRemote.length > 0 ? await accumulate(super.getBlobs(fromRemote)) : []
    const entries = [...localEntries, ...remoteEntries]
    this.#blobs = new Map(entries)
    yield* entries
  }
}
