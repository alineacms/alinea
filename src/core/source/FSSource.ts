import {createHash} from 'node:crypto'
import type {Stats} from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path/posix'
import pDebounce from 'p-debounce'
import pLimit from 'p-limit'
import {assert} from '../util/Assert.js'
import {mapConcurrent} from '../util/Async.js'
import {isRecord} from '../util/Objects.js'
import type {ChangesBatch} from './Change.js'
import type {GetBlobsOptions, Source} from './Source.js'
import type {Tree} from './Tree.js'
import {ReadonlyTree, WriteableTree} from './Tree.js'

const limit = pLimit(1)
const fileConcurrency = 64
const blobReadConcurrency = 32
const encoder = new TextEncoder()

function hashFileBlob(contents: Uint8Array): string {
  const header = encoder.encode(`blob ${contents.byteLength}\0`)
  return createHash('sha1').update(header).update(contents).digest('hex')
}

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
      for await (const result of mapConcurrent(
        files,
        file => this.getFile(current, builder, file),
        {concurrency: fileConcurrency}
      ))
        void result
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
    const sha = hashFileBlob(contents)
    this.#locations.set(sha, filePath)
    this.#fingerprints.set(filePath, fingerprint)
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
