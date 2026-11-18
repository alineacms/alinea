import type {ObjectStore} from '@alinea/graft'
import {accumulate} from '../util/Async.js'
import type {Change, ChangesBatch} from './Change.js'
import {hashBlob} from './GitUtils.js'
import type {ReadonlyTree, WriteableTree} from './Tree.js'

export interface GetBlobsOptions {
  signal?: AbortSignal
}

/** A content tree and the git objects holding it, such as a graft store. */
export interface ContentHead {
  sha: string
  objects: ObjectStore
}

/** The content tree at a head, with the objects that lead up to it. */
export interface ContentPack {
  sha: string
  /**
   * A git pack, thin: it may store objects as deltas of what `have` holds.
   * Missing when asked without `have`, which only names the head.
   */
  pack?: Uint8Array
}

export interface RemoteSource {
  getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined>
  getBlobs(
    shas: ReadonlyArray<string>,
    options?: GetBlobsOptions
  ): AsyncIterable<[sha: string, blob: Uint8Array]>
  /**
   * The content tree this source is at, with the objects holding it: a sync
   * then reads the directories that changed by sha, instead of whole trees.
   */
  getHead?(): Promise<ContentHead>
  /**
   * A pack of the objects the content gained since `have`, a content tree
   * whose objects the caller holds all of, or all of them for the empty
   * tree; undefined when `have` is current.
   */
  getPack?(have?: string): Promise<ContentPack | undefined>
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
