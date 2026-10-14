import {accumulate} from '../util/Async.js'
import type {Change, ChangesBatch} from './Change.js'
import {hashBlob} from './GitUtils.js'
import type {ReadonlyTree, WriteableTree} from './Tree.js'
import {UnknownTreeError} from './UnknownTreeError.js'

export interface GetBlobsOptions {
  signal?: AbortSignal
}

/** The changes from a tree up to the latest one, with their contents. */
export interface SourceChanges extends ChangesBatch {
  intoSha: string
}

export interface RemoteSource {
  getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined>
  /**
   * What changed since tree `sha`, or undefined when it is the latest. Throws
   * an UnknownTreeError when the remote does not know `sha`.
   */
  getChanges?(sha: string): Promise<SourceChanges | undefined>
  getBlobs(
    shas: ReadonlyArray<string>,
    options?: GetBlobsOptions
  ): AsyncIterable<[sha: string, blob: Uint8Array]>
}

export interface Source extends RemoteSource {
  getTree(): Promise<ReadonlyTree>
  applyChanges(batch: ChangesBatch): Promise<void>
  /** Consume remote blobs incrementally instead of materializing one bundle. */
  applyChangesFrom?(
    remote: RemoteSource,
    batch: ChangesBatch,
    tree: ReadonlyTree
  ): Promise<void>
}

/** Pin the tree while streaming blobs from the revision already fetched. */
export function sourceAtTree(
  source: RemoteSource,
  tree: ReadonlyTree
): RemoteSource {
  return {
    async getTreeIfDifferent(revision) {
      return revision === tree.sha ? undefined : tree
    },
    getBlobs(shas, options) {
      return source.getBlobs(shas, options)
    }
  }
}

/** The latest tree of a remote, with a source serving its blobs. */
export interface LatestTree {
  tree: ReadonlyTree
  source: RemoteSource
}

/**
 * The latest tree of a remote, or undefined when `from` is current. A remote
 * that knows the tree `from` sends what changed since, with the contents,
 * rather than the whole latest tree.
 */
export async function latestTree(
  remote: RemoteSource,
  from: ReadonlyTree | string
): Promise<LatestTree | undefined> {
  if (typeof from !== 'string' && remote.getChanges) {
    const latest = await fromChanges(remote, from)
    if (latest !== null) return latest
  }
  const tree = await remote.getTreeIfDifferent(
    typeof from === 'string' ? from : from.sha
  )
  return tree && {tree, source: sourceAtTree(remote, tree)}
}

/** The latest tree built from changes, or null to fetch the whole tree. */
async function fromChanges(
  remote: RemoteSource,
  from: ReadonlyTree
): Promise<LatestTree | undefined | null> {
  let changes: SourceChanges | undefined
  try {
    changes = await remote.getChanges!(from.sha)
  } catch (error) {
    if (error instanceof UnknownTreeError) return null
    throw error
  }
  if (!changes) return undefined
  // Changes that do not lead to the latest tree exactly, such as a file that
  // only changed its mode, are not trusted
  try {
    const tree = await from.withChanges(changes)
    if (tree.sha === changes.intoSha)
      return {tree, source: sourceWithContents(remote, tree, changes)}
  } catch {}
  return null
}

/** Serve the contents of a batch, and other blobs from the source. */
function sourceWithContents(
  source: RemoteSource,
  tree: ReadonlyTree,
  batch: ChangesBatch
): RemoteSource {
  const contents = new Map(
    batch.changes.flatMap(change =>
      change.op === 'add' && change.contents
        ? [[change.sha, change.contents] as const]
        : []
    )
  )
  return {
    async getTreeIfDifferent(revision) {
      return revision === tree.sha ? undefined : tree
    },
    async *getBlobs(shas, options) {
      const missing = shas.filter(sha => !contents.has(sha))
      for (const sha of shas) {
        const blob = contents.get(sha)
        if (blob) yield [sha, blob]
      }
      if (missing.length > 0) yield* source.getBlobs(missing, options)
    }
  }
}

export async function applyChangesFrom(
  source: Source,
  remote: RemoteSource,
  batch: ChangesBatch,
  tree: ReadonlyTree
): Promise<void> {
  if (source.applyChangesFrom)
    return source.applyChangesFrom(remote, batch, tree)
  return source.applyChanges(await bundleContents(remote, batch))
}

export async function bundleContents(
  source: RemoteSource,
  batch: ChangesBatch
): Promise<ChangesBatch> {
  const {changes} = batch
  const shas = Array.from(
    new Set(
      changes.filter(change => change.op !== 'delete').map(change => change.sha)
    )
  )
  if (shas.length === 0) return batch
  const blobs = new Map(await accumulate(source.getBlobs(shas)))
  return {
    ...batch,
    changes: changes.map(change => {
      if (change.op === 'delete') return change
      return {
        ...change,
        contents: blobs.get(change.sha)
      }
    })
  }
}

export async function diff(
  source: Source,
  remote: RemoteSource
): Promise<ChangesBatch> {
  const localTree = await source.getTree()
  const remoteTree = await remote.getTreeIfDifferent(localTree.sha)
  if (!remoteTree)
    return {
      fromSha: localTree.sha,
      changes: []
    }
  const batch = localTree.diff(remoteTree)
  return bundleContents(remote, batch)
}

export async function syncWith(
  source: Source,
  remote: RemoteSource
): Promise<ChangesBatch> {
  const localTree = await source.getTree()
  const remoteTree = await remote.getTreeIfDifferent(localTree.sha)
  if (!remoteTree)
    return {
      fromSha: localTree.sha,
      changes: []
    }
  const batch = localTree.diff(remoteTree)
  await applyChangesFrom(source, remote, batch, remoteTree)
  return batch
}

export async function transaction(source: Source): Promise<SourceTransaction> {
  const from = await source.getTree()
  return new SourceTransaction(source, from)
}

export class SourceTransaction {
  #source: Source
  #from: ReadonlyTree
  #into: WriteableTree
  #blobs = new Map<string, Uint8Array>()
  #tasks = Array<() => void | Promise<void>>()

  constructor(source: Source, from: ReadonlyTree) {
    this.#source = source
    this.#from = from
    this.#into = from.clone()
  }

  add(path: string, contents: Uint8Array) {
    this.#tasks.push(async () => {
      const sha = await hashBlob(contents)
      this.#blobs.set(sha, contents)
      this.#into.add(path, sha)
    })
    return this
  }

  remove(path: string) {
    this.#tasks.push(() => {
      this.#into.remove(path)
    })
    return this
  }

  rename(from: string, to: string) {
    if (from !== to)
      this.#tasks.push(() => {
        this.#into.rename(from, to)
      })
    return this
  }

  async compile(previous?: ReadonlyTree) {
    const todo = this.#tasks.splice(0)
    for (const task of todo) await task()
    const from = previous ?? this.#from
    const into = await this.#into.compile(previous)
    const forwards = from.diff(into)
    const fromSource = Array.from(
      new Set(
        forwards.changes
          .filter(change => change.op === 'add')
          .map(change => change.sha)
          .filter(sha => !this.#blobs.has(sha))
      )
    )
    const blobs = new Map(
      fromSource.length === 0
        ? []
        : await accumulate(this.#source.getBlobs(fromSource))
    )
    const bundleContents = (change: Change) => {
      if (change.op === 'delete') return change
      const contents = this.#blobs.get(change.sha) ?? blobs.get(change.sha)
      return {...change, contents}
    }
    return {
      from,
      into,
      changes: forwards.changes.map(bundleContents)
    }
  }
}
