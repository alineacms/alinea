import type {Change} from './Change.js'
import {hashBlob} from './GitUtils.js'
import type {ReadonlyTree, WriteableTree} from './Tree.js'

export abstract class Source {
  abstract getTree(): Promise<ReadonlyTree>
  abstract getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined>
  abstract getBlob(sha: string): Promise<Uint8Array>
  abstract applyChanges(changes: Array<Change>): Promise<void>

  async bundleContents(changes: Array<Change>): Promise<Array<Change>> {
    const shas = Array.from(
      new Set(
        changes
          .filter(change => change.op !== 'delete')
          .map(change => change.sha)
      )
    )
    const blobs = new Map(
      await Promise.all(
        shas.map(async sha => [sha, await this.getBlob(sha)] as const)
      )
    )
    return changes.map(change => {
      if (change.op === 'delete') return change
      return {
        ...change,
        contents: blobs.get(change.sha)
      }
    })
  }

  async diff(remote: Source): Promise<Array<Change>> {
    const localTree = await this.getTree()
    const remoteTree = await remote.getTreeIfDifferent(localTree.sha)
    if (!remoteTree) return []
    const changes = localTree.diff(remoteTree)
    return remote.bundleContents(changes)
  }

  async syncWith(remote: Source): Promise<Array<Change>> {
    const changes = await this.diff(remote)
    await this.applyChanges(changes)
    return changes
  }

  async transaction(): Promise<SourceTransaction> {
    const from = await this.getTree()
    return new SourceTransaction(this, from)
  }
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
    this.#tasks.push(() => {
      this.#into.rename(from, to)
    })
    return this
  }

  async compile() {
    const todo = this.#tasks.splice(0)
    for (const task of todo) await task()
    const from = this.#from
    const into = this.#into
    const forwards = from.diff(into)
    const backwards = into.diff(from)
    const fromSource = Array.from(
      new Set(
        forwards
          .filter(change => change.op === 'add')
          .concat(backwards.filter(change => change.op === 'add'))
          .map(change => change.sha)
          .filter(sha => !this.#blobs.has(sha))
      )
    )

    const blobs = new Map(
      await Promise.all(
        fromSource.map(
          async sha => [sha, await this.#source.getBlob(sha)] as const
        )
      )
    )
    const bundleContents = (change: Change) => {
      if (change.op === 'delete') return change
      const contents = this.#blobs.get(change.sha) ?? blobs.get(change.sha)
      return {...change, contents}
    }
    return {
      from,
      into: await into.compile(),
      changes: forwards.map(bundleContents),
      rollback: backwards.map(bundleContents)
    }
  }
}
