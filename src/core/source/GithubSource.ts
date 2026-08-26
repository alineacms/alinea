import * as paths from '#/core/util/Paths.js'
import pLimit from 'p-limit'
import {HttpError} from '../HttpError.js'
import {assert} from '../util/Assert.js'
import type {ChangesBatch} from './Change.js'
import type {Source} from './Source.js'
import {ReadonlyTree} from './Tree.js'

export interface GithubSourceOptions {
  authToken: string
  owner: string
  repo: string
  branch: string
  rootDir: string
  contentDir: string
}

interface ShaCacheEntry {
  etag: string
  sha: string
}

export function normalizeGithubSourceOptions<
  Options extends GithubSourceOptions
>(options: Options): Options {
  return {
    ...options,
    rootDir: normalizeDirectory(options.rootDir),
    contentDir: normalizeDirectory(options.contentDir)
  }
}

export class GithubSource implements Source {
  #current: ReadonlyTree = ReadonlyTree.EMPTY
  #options: GithubSourceOptions
  #limit = pLimit(8)
  #shaCache = new Map<string, ShaCacheEntry>()

  constructor(options: GithubSourceOptions) {
    this.#options = normalizeGithubSourceOptions(options)
  }

  protected get contentLocation() {
    const {contentDir, rootDir} = this.#options
    return paths.join(rootDir, contentDir)
  }

  async getTree() {
    const current = this.#current
    const newTree = await this.getTreeIfDifferent(current.sha)
    if (newTree) return (this.#current = newTree)
    return current
  }

  async shaAt(ref: string): Promise<string> {
    const {owner, repo, authToken} = this.#options
    const parentDir = this.contentLocation.split('/').slice(0, -1).join('/')
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${parentDir}?ref=${ref}`
    const cached = this.#shaCache.get(url)
    const headers = new Headers({Authorization: `Bearer ${authToken}`})
    if (cached) headers.set('If-None-Match', cached.etag)
    const parentInfo = await fetch(url, {headers})
    if (parentInfo.status === 304) {
      assert(cached, 'Received 304 without a cached GitHub response')
      return cached.sha
    }
    assert(parentInfo.ok, `Failed to get parent: ${parentInfo.statusText}`)
    const parents = await parentInfo.json()
    assert(Array.isArray(parents))
    const parent = parents.find(entry => entry.path === this.contentLocation)
    const sha = parent ? parent.sha : ReadonlyTree.EMPTY.sha
    assert(typeof sha === 'string')
    const etag = parentInfo.headers.get('etag')
    if (etag) this.#shaCache.set(url, {etag, sha})
    else this.#shaCache.delete(url)
    return sha
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const {branch, owner, repo, authToken} = this.#options
    const remoteSha = await this.shaAt(branch)
    if (remoteSha === sha) return undefined
    const treeInfo = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${remoteSha}?recursive=true`,
      {headers: {Authorization: `Bearer ${authToken}`}}
    )
    assert(treeInfo.ok, `Failed to get tree: ${treeInfo.statusText}`)
    const treeData = await treeInfo.json()
    assert(treeData.truncated === false)
    const tree = ReadonlyTree.fromFlat(treeData)
    return tree
  }

  async *getBlobs(
    shas: Array<string>
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    const {owner, repo, authToken} = this.#options
    const responses = shas.map(sha => {
      const promise = this.#limit(() =>
        fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}`,
          {headers: {Authorization: `Bearer ${authToken}`}}
        )
      )
      return [sha, promise] as const
    })
    for (const [sha, promise] of responses) {
      const response = await promise
      if (!response.ok)
        throw new HttpError(
          response.status,
          `Failed to get blob: ${response.statusText}`
        )
      const blobData = await response.json()
      assert(blobData.encoding === 'base64')
      assert(typeof blobData.content === 'string')
      assert(blobData.size > 0)
      yield [sha, Uint8Array.from(atob(blobData.content), c => c.charCodeAt(0))]
    }
  }

  async applyChanges(batch: ChangesBatch) {
    throw new Error('Not implemented')
  }
}

function normalizeDirectory(directory: string): string {
  const normalized = paths.normalize(directory)
  if (normalized === '.' || normalized === '/') return ''
  return normalized.replace(/^\/+|\/+$/g, '')
}
