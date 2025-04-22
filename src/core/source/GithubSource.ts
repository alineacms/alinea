import pLimit from 'p-limit'
import {HttpError} from '../HttpError.js'
import type {Change} from './Change.js'
import type {Source} from './Source.js'
import {ReadonlyTree} from './Tree.js'
import {assert} from './Utils.js'

export interface GithubSourceOptions {
  authToken: string
  owner: string
  repo: string
  branch: string
  contentDir: string
}

export class GithubSource implements Source {
  #current: ReadonlyTree = ReadonlyTree.EMPTY
  #options: GithubSourceOptions
  #limit = pLimit(8)

  constructor(options: GithubSourceOptions) {
    this.#options = options
  }

  async getTree() {
    const current = this.#current
    const newTree = await this.getTreeIfDifferent(current.sha)
    if (newTree) return (this.#current = newTree)
    return current
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const {contentDir, owner, repo, branch, authToken} = this.#options
    const parentDir = contentDir.split('/').slice(0, -1).join('/')
    const parentInfo = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${parentDir}?ref=${branch}`,
      {headers: {Authorization: `Bearer ${authToken}`}}
    )
    assert(parentInfo.ok, `Failed to get parent: ${parentInfo.statusText}`)
    const parents = await parentInfo.json()
    assert(Array.isArray(parents))
    const parent = parents.find(entry => entry.path === contentDir)
    if (!parent) {
      const result = ReadonlyTree.EMPTY
      this.#current = result
      if (sha !== result.sha) return result
      return undefined
    }
    assert(typeof parent.sha === 'string')
    if (parent.sha === sha) return undefined
    const treeInfo = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${parent.sha}?recursive=true`,
      {headers: {Authorization: `Bearer ${authToken}`}}
    )
    assert(treeInfo.ok, `Failed to get tree: ${treeInfo.statusText}`)
    const treeData = await treeInfo.json()
    assert(treeData.truncated === false)
    const tree = ReadonlyTree.fromFlat(treeData)
    return tree
  }

  async getBlobs(
    shas: Array<string>
  ): Promise<Array<[sha: string, blob: Uint8Array]>> {
    const {owner, repo, authToken} = this.#options
    return Promise.all(
      shas.map(sha =>
        this.#limit(async (): Promise<[sha: string, blob: Uint8Array]> => {
          const blobInfo = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}`,
            {headers: {Authorization: `Bearer ${authToken}`}}
          )
          if (!blobInfo.ok)
            throw new HttpError(
              blobInfo.status,
              `Failed to get blob: ${blobInfo.statusText}`
            )
          const blobData = await blobInfo.json()
          assert(blobData.encoding === 'base64')
          assert(typeof blobData.content === 'string')
          assert(blobData.size > 0)
          return [
            sha,
            Uint8Array.from(atob(blobData.content), c => c.charCodeAt(0))
          ]
        })
      )
    )
  }

  async applyChanges(changes: Array<Change>) {
    throw new Error('Not implemented')
  }
}
