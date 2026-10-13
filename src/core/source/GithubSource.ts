import * as paths from '#/core/util/Paths.js'
import pLimit from 'p-limit'
import {HttpError} from '../HttpError.js'
import {assert} from '../util/Assert.js'
import {isRecord} from '#/core/util/Objects.js'
import {chunks} from '../util/Arrays.js'
import type {ChangesBatch} from './Change.js'
import {hashBlob} from './GitUtils.js'
import {GithubUsage} from './GithubUsage.js'
import type {GetBlobsOptions, Source} from './Source.js'
import {type FlatTree, Leaf, ReadonlyTree} from './Tree.js'

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

/**
 * Backends construct a source per request, so conditional request state is
 * kept per module to let polls resolve as 304s, which GitHub does not count
 * against the rate limit.
 */
const shaCache = new Map<string, ShaCacheEntry>()

/** Directories GitHub truncated before, listed one level without retrying. */
const truncatedTrees = new Set<string>()

/** Blobs looked up per GraphQL query, which keeps a query well within 10s. */
const blobsPerQuery = 100

/**
 * The smallest query that is asked again in halves when GitHub cannot
 * answer it: one this small fails, so an outage costs a few queries.
 */
const smallestBlobQuery = 25

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
  /** Blob queries in flight, each holding up to a hundred blobs in memory. */
  #blobQueries = pLimit(2)
  #usage = new GithubUsage()

  constructor(options: GithubSourceOptions) {
    this.#options = normalizeGithubSourceOptions(options)
  }

  /** Request GitHub, counting the request against its budget. */
  protected async githubFetch(
    input: string,
    init?: RequestInit
  ): Promise<Response> {
    const response = await fetch(input, init)
    this.#usage.record(response)
    return response
  }

  /** Run an operation, and log what it spent of GitHub's budgets. */
  protected async spending<T>(
    operation: string,
    run: () => Promise<T>
  ): Promise<T> {
    const before = this.#usage.count()
    try {
      return await run()
    } finally {
      this.#usage.log(operation, before)
    }
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
    const cached = shaCache.get(url)
    const headers = new Headers({Authorization: `Bearer ${authToken}`})
    if (cached) headers.set('If-None-Match', cached.etag)
    const parentInfo = await this.githubFetch(url, {headers})
    if (parentInfo.status === 304) {
      assert(cached, 'Received 304 without a cached GitHub response')
      return cached.sha
    }
    if (!parentInfo.ok)
      throw await githubError(parentInfo, 'Failed to get parent')
    const parents = await parentInfo.json()
    assert(Array.isArray(parents))
    const parent = parents.find(entry => entry.path === this.contentLocation)
    const sha = parent ? parent.sha : ReadonlyTree.EMPTY.sha
    assert(typeof sha === 'string')
    const etag = parentInfo.headers.get('etag')
    if (etag) shaCache.set(url, {etag, sha})
    else shaCache.delete(url)
    return sha
  }

  getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    return this.spending('sync', async () => {
      const remoteSha = await this.shaAt(this.#options.branch)
      if (remoteSha === sha) return undefined
      return this.#fetchTree(remoteSha, this.contentLocation)
    })
  }

  /**
   * GitHub truncates recursive listings above 100k entries or 7 MB, so a
   * truncated tree is listed one level and each directory fetched on its own.
   */
  async #fetchTree(sha: string, location: string): Promise<ReadonlyTree> {
    const {owner, repo, authToken} = this.#options
    const key = `${owner}/${repo}:${location}`
    const list = async (query: string) => {
      const response = await this.#limit(() =>
        this.githubFetch(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}${query}`,
          {headers: {Authorization: `Bearer ${authToken}`}}
        )
      )
      if (!response.ok) throw await githubError(response, 'Failed to get tree')
      const data: FlatTree & {truncated: boolean} = await response.json()
      return data
    }
    if (!truncatedTrees.has(key)) {
      const flat = await list('?recursive=true')
      if (!flat.truncated) return ReadonlyTree.fromFlat(flat)
      truncatedTrees.add(key)
    }
    const level = await list('')
    if (level.truncated)
      throw new Error(`Tree ${sha} has too many entries for GitHub to list`)
    const nodes = await Promise.all(
      level.tree.map(
        async (entry): Promise<[string, ReadonlyTree | Leaf]> => [
          entry.path,
          entry.type === 'tree'
            ? await this.#fetchTree(entry.sha, paths.join(location, entry.path))
            : new Leaf(entry)
        ]
      )
    )
    return ReadonlyTree.fromNodes(new Map(nodes), sha)
  }

  async *getBlobs(
    shas: ReadonlyArray<string>,
    options: GetBlobsOptions = {}
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    const before = this.#usage.count()
    const batches = Array.from(chunks(shas, blobsPerQuery), batch =>
      this.#blobQueries(() => this.#queryBlobs(batch, options.signal))
    )
    // A failure is thrown where its batch is awaited: the batches after it
    // must not fail unobserved meanwhile.
    for (const batch of batches) batch.catch(() => {})
    try {
      for (const batch of batches) yield* await batch
    } finally {
      this.#usage.log('blobs', before)
    }
  }

  /**
   * Look blobs up in one GraphQL query, which costs a single point of
   * GitHub's GraphQL budget however many it holds, where the REST API counts
   * a request per blob. A query GitHub cannot answer in time, such as one
   * for many large files, is asked again in halves, down to a small one.
   */
  async #queryBlobs(
    shas: Array<string>,
    signal?: AbortSignal
  ): Promise<Array<[sha: string, blob: Uint8Array]>> {
    const blobs = await this.#graphqlBlobs(shas, signal)
    if (blobs) return blobs
    if (shas.length <= smallestBlobQuery)
      throw new HttpError(502, 'Failed to get blobs: GitHub did not answer')
    const half = Math.ceil(shas.length / 2)
    return [
      ...(await this.#queryBlobs(shas.slice(0, half), signal)),
      ...(await this.#queryBlobs(shas.slice(half), signal))
    ]
  }

  /**
   * Blobs found by one GraphQL query, or undefined if GitHub could not
   * answer it, such as when it timed out. Blobs it has no text for, such as
   * binary or very large files, are fetched one by one.
   */
  async #graphqlBlobs(
    shas: Array<string>,
    signal?: AbortSignal
  ): Promise<Array<[sha: string, blob: Uint8Array]> | undefined> {
    const {owner, repo, authToken} = this.#options
    const params = shas.map((_, i) => `$b${i}: GitObjectID!`).join(', ')
    const fields = shas
      .map(
        (_, i) =>
          `b${i}: object(oid: $b${i}) { ... on Blob { text isBinary isTruncated } }`
      )
      .join('\n')
    const query = `query ($owner: String!, $repo: String!, ${params}) {
      repository(owner: $owner, name: $repo) {
        ${fields}
      }
    }`
    const variables: Record<string, string> = {owner, repo}
    for (const [i, sha] of shas.entries()) variables[`b${i}`] = sha
    const response = await this.githubFetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({query, variables}),
      signal
    })
    if (response.status >= 500) return undefined
    if (!response.ok) throw await githubError(response, 'Failed to get blobs')
    const result: unknown = await response.json()
    assert(isRecord(result))
    const errors = Array.isArray(result.errors) ? result.errors : []
    if (errors.length > 0) {
      // GitHub types errors such as NOT_FOUND or RATE_LIMITED, but not a
      // query it gave up on, such as one that timed out.
      const typed = errors.some(
        error => isRecord(error) && typeof error.type === 'string'
      )
      if (!typed) return undefined
      const reasons = errors.map(error =>
        isRecord(error) ? String(error.message) : String(error)
      )
      throw new Error(`Failed to get blobs: ${reasons.join('; ')}`)
    }
    const data = isRecord(result.data) ? result.data : {}
    const repository = isRecord(data.repository) ? data.repository : {}
    const encoder = new TextEncoder()
    const blobs = Array<[sha: string, blob: Uint8Array]>()
    for (const [i, sha] of shas.entries()) {
      const blob = repository[`b${i}`]
      const text =
        isRecord(blob) && !blob.isBinary && !blob.isTruncated
          ? blob.text
          : undefined
      // Text is decoded as UTF-8: only bytes that hash back to the sha are
      // the blob, others, such as text in another encoding, are fetched.
      const bytes = typeof text === 'string' ? encoder.encode(text) : undefined
      blobs.push([
        sha,
        bytes && (await hashBlob(bytes)) === sha
          ? bytes
          : await this.#fetchBlob(sha, signal)
      ])
    }
    return blobs
  }

  async #fetchBlob(sha: string, signal?: AbortSignal): Promise<Uint8Array> {
    const {owner, repo, authToken} = this.#options
    const response = await this.githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}`,
      {headers: {Authorization: `Bearer ${authToken}`}, signal}
    )
    if (!response.ok) throw await githubError(response, 'Failed to get blob')
    const blobData = await response.json()
    assert(blobData.encoding === 'base64')
    assert(typeof blobData.content === 'string')
    assert(blobData.size > 0)
    return Uint8Array.from(atob(blobData.content), c => c.charCodeAt(0))
  }

  async applyChanges(batch: ChangesBatch) {
    throw new Error('Not implemented')
  }
}

/** Include GitHub's explanation, which tells a rate limit from a missing permission. */
async function githubError(
  response: Response,
  description: string
): Promise<HttpError> {
  let reason = response.statusText
  try {
    const body: unknown = await response.json()
    if (isRecord(body) && typeof body.message === 'string')
      reason = body.message
  } catch {}
  return new HttpError(
    response.status,
    `${description}: ${response.status} ${reason}`
  )
}

function normalizeDirectory(directory: string): string {
  const normalized = paths.normalize(directory)
  if (normalized === '.' || normalized === '/') return ''
  return normalized.replace(/^\/+|\/+$/g, '')
}
