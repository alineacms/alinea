import type {Stats} from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path/posix'
import {
  type CommitRequest,
  checkCommit,
  sourceChanges
} from '../db/CommitRequest.js'
import type {Change} from './Change.js'
import {hashBlob} from './GitUtils.js'
import type {Source} from './Source.js'
import {ReadonlyTree, WriteableTree} from './Tree.js'
import {assert} from './Utils.js'

export class FSSource implements Source {
  #current: ReadonlyTree = ReadonlyTree.EMPTY
  #cwd: string
  #locations = new Map<string, string>()
  #lastModified = new Map<string, number>()

  constructor(cwd: string) {
    this.#cwd = cwd
  }

  async getTree() {
    const current = this.#current
    const builder = new WriteableTree()
    const files = await fs.readdir(this.#cwd, {
      recursive: true
    })
    const tasks = files.map(async file => {
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
      } catch {}
    })
    await Promise.all(tasks)
    const tree = await builder.compile()
    const diff = current.diff(tree)
    if (diff.length === 0) return current
    this.#current = tree
    return tree
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const current = await this.getTree()
    return current.sha === sha ? undefined : current
  }

  async getBlobs(
    shas: Array<string>
  ): Promise<Array<[sha: string, blob: Uint8Array]>> {
    return Promise.all(
      shas.map(async (sha): Promise<[sha: string, blob: Uint8Array]> => {
        const path = this.#locations.get(sha)
        assert(path, `Missing path for blob ${sha}`)
        return [sha, await fs.readFile(`${this.#cwd}/${path}`)]
      })
    )
  }

  async applyChanges(changes: Array<Change>) {
    await Promise.all(
      changes.map(async change => {
        switch (change.op) {
          case 'delete': {
            return fs.unlink(`${this.#cwd}/${change.path}`)
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
  }

  async commit(request: CommitRequest) {
    const local = await this.getTree()
    checkCommit(local, request)
    const contentChanges = sourceChanges(request.changes)
    await this.applyChanges(contentChanges)
    const tree = local.clone()
    tree.applyChanges(contentChanges)
    return tree.getSha()
  }
}
