import type {Stats} from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path/posix'
import pDebounce from 'p-debounce'
import pLimit from 'p-limit'
import {assert} from '../util/Assert.js'
import {accumulate} from '../util/Async.js'
import {isRecord} from '../util/Objects.js'
import type {ChangesBatch} from './Change.js'
import {hashBlob} from './GitUtils.js'
import type {Source} from './Source.js'
import type {Tree} from './Tree.js'
import {ReadonlyTree, WriteableTree} from './Tree.js'

const limit = pLimit(1)
const fileConcurrency = 64

export interface FileFingerprint {
  mtimeMs: number
  ctimeMs: number
  size: number
}

export interface FSSourceSnapshot {
  tree: Tree
  files: Readonly<Record<string, FileFingerprint>>
}

export class FSSource implements Source {
  #current: ReadonlyTree
  #cwd: string
  #locations = new Map<string, string>()
  #fingerprints: Map<string, FileFingerprint>

  constructor(cwd: string, snapshot?: FSSourceSnapshot) {
    this.#cwd = cwd
    this.#current = snapshot
      ? new ReadonlyTree(snapshot.tree)
      : ReadonlyTree.EMPTY
    this.#fingerprints = new Map(Object.entries(snapshot?.files ?? {}))
    for (const [file, sha] of this.#current.fileIndex(''))
      this.#locations.set(sha, file)
  }

  async getTree() {
    return limit(async () => {
      const current = this.#current
      const builder = new WriteableTree()
      const files = await fs.readdir(this.#cwd, {
        recursive: true
      })
      const fileLimit = pLimit(fileConcurrency)
      const tasks = files.map(file =>
        fileLimit(() => this.getFile(current, builder, file))
      )
      await Promise.all(tasks)
      const live = new Set(files.map(file => file.replaceAll('\\', '/')))
      for (const file of this.#fingerprints.keys())
        if (!live.has(file)) this.#fingerprints.delete(file)
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
    const previousFingerprint = this.#fingerprints.get(filePath)
    const fingerprint = fileFingerprint(stat)
    if (
      previousFingerprint &&
      fingerprintsEqual(previousFingerprint, fingerprint)
    ) {
      const previous = current.get(filePath)
      if (previous && typeof previous.sha === 'string') {
        this.#locations.set(previous.sha, filePath)
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
    this.#fingerprints.set(filePath, fingerprint)
    builder.add(filePath, sha)
    return [sha, contents] as const
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

  snapshot(): FSSourceSnapshot {
    return {
      tree: this.#current.toJSON(),
      files: Object.fromEntries(this.#fingerprints)
    }
  }
}

export class CachedFSSource extends FSSource {
  #tree: Promise<ReadonlyTree> | undefined
  #blobs: Map<string, Uint8Array> = new Map()

  constructor(cwd: string, snapshot?: FSSourceSnapshot) {
    super(cwd, snapshot)
  }

  refresh = pDebounce(async () => {
    this.#blobs = new Map()
    return (this.#tree = super.getTree())
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

function fileFingerprint(stat: Stats): FileFingerprint {
  return {mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs, size: stat.size}
}

function fingerprintsEqual(
  left: FileFingerprint,
  right: FileFingerprint
): boolean {
  return (
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs &&
    left.size === right.size
  )
}
