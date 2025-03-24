import type {Change} from '../Change.ts'
import {Source} from '../Source.ts'
import {ReadonlyTree} from '../Tree.ts'
import {assert} from '../Utils.ts'

export interface GithubOptions {
  authToken: string
  owner: string
  repo: string
  branch: string
  cwd: string
}

export class GithubSource extends Source {
  #current: ReadonlyTree = ReadonlyTree.EMPTY
  #options: GithubOptions

  constructor(options: GithubOptions) {
    super()
    this.#options = options
  }

  async getTree() {
    const current = this.#current
    const newTree = await this.getTreeIfDifferent(current.sha)
    if (newTree) return (this.#current = newTree)
    return current
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const {cwd, owner, repo, branch, authToken} = this.#options
    const parentDir = cwd.split('/').slice(0, -1).join('/')
    const parentInfo = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${parentDir}?ref=${branch}`,
      {headers: {Authorization: `Bearer ${authToken}`}}
    )
    assert(parentInfo.ok, `Failed to get parent: ${parentInfo.statusText}`)
    const parents = await parentInfo.json()
    assert(Array.isArray(parents))
    const parent = parents.find(entry => entry.path === cwd)
    assert(parent, `Failed to find parent: ${cwd}`)
    assert(typeof parent.sha === 'string')
    if (parent.sha === sha) return undefined
    const treeInfo = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${parent.sha}?ref=${branch}&recursive=true`,
      {headers: {Authorization: `Bearer ${authToken}`}}
    )
    assert(treeInfo.ok, `Failed to get tree: ${treeInfo.statusText}`)
    const treeData = await treeInfo.json()
    assert(treeData.truncated === false)
    const tree = ReadonlyTree.fromFlat(treeData)
    return tree
  }

  async getBlob(sha: string): Promise<Uint8Array> {
    const {owner, repo, authToken} = this.#options
    const blobInfo = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}`,
      {headers: {Authorization: `Bearer ${authToken}`}}
    )
    assert(blobInfo.ok, `Failed to get blob: ${blobInfo.statusText}`)
    const blobData = await blobInfo.json()
    assert(blobData.encoding === 'base64')
    assert(typeof blobData.content === 'string')
    assert(blobData.size > 0)
    return Uint8Array.from(atob(blobData.content), c => c.charCodeAt(0))
  }

  async applyChanges(changes: Array<Change>) {
    throw new Error('Not implemented')
  }
}
