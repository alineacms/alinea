import {parseCoAuthoredBy} from 'alinea/cli/util/CommitMessage'
import type {
  CommitApi,
  HistoryApi,
  Revision,
  SyncApi
} from 'alinea/core/Connection'
import type {CommitChange, CommitRequest} from 'alinea/core/db/CommitRequest'
import type {EntryRecord} from 'alinea/core/EntryRecord'
import {HttpError} from 'alinea/core/HttpError'
import {
  GithubSource,
  type GithubSourceOptions
} from 'alinea/core/source/GithubSource'
import {ShaMismatchError} from 'alinea/core/source/ShaMismatchError'
import {base64, btoa} from 'alinea/core/util/Encoding'
import {fileVersions} from 'alinea/core/util/EntryFilenames'
import {join} from 'alinea/core/util/Paths'

export interface GithubOptions extends GithubSourceOptions {
  author?: {name: string; email: string}
  blobUploadConcurrency?: number
  blobChunkBytes?: number
  maxBlobBytes?: number
}

export class GithubApi
  extends GithubSource
  implements HistoryApi, CommitApi, SyncApi
{
  #options: GithubOptions

  constructor(options: GithubOptions) {
    super(options)
    this.#options = options
  }

  async write(request: CommitRequest): Promise<{sha: string}> {
    const currentCommit = await this.#getLatestCommitOid()
    const currentSha = await this.shaAt(currentCommit)

    if (currentSha !== request.fromSha)
      throw new ShaMismatchError(currentSha, request.fromSha)

    const {author} = this.#options

    let commitMessage = request.description
    if (author) {
      commitMessage += `\n\nCo-authored-by: ${author.name} <${author.email}>`
    }
    const newCommit = await this.#applyChangesToRepo(
      currentCommit,
      request.changes,
      commitMessage
    )

    return {sha: await this.shaAt(newCommit)}
  }

  async revisions(file: string): Promise<Array<Revision>> {
    return this.#getFileCommitHistory(file)
  }

  async revisionData(
    file: string,
    revisionId: string
  ): Promise<EntryRecord | undefined> {
    const content = await this.#getFileContentAtCommit(file, revisionId)
    try {
      return content ? (JSON.parse(content) as EntryRecord) : undefined
    } catch (error) {
      return undefined
    }
  }

  async #graphQL(query: string, variables: object, token: string) {
    return fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({query, variables})
    })
      .then(async response => {
        if (response.ok) return response.json()
        throw new HttpError(response.status, await response.text())
      })
      .then(result => {
        if (Array.isArray(result.errors) && result.errors.length > 0) {
          const message = result.errors.map((e: any) => e.message).join('; ')
          console.trace(result.errors)
          throw new Error(message)
        }
        return result
      })
  }

  async #getFileCommitHistory(file: string): Promise<Array<Revision>> {
    const {owner, repo, branch, authToken, rootDir} = this.#options
    // Support multiple files and follow rename history
    const seen = new Set<string>()
    const queue = fileVersions(file)
    const allRevisions = Array<Revision>()
    const maxRequests = 3
    let requestCount = 0

    while (queue.length) {
      if (requestCount === maxRequests) break
      requestCount++
      // Get history for all file versions of the current file
      const versions = [...queue].filter(v => !seen.has(v))
      for (const v of versions) seen.add(v)
      queue.length = 0
      const aliasMap = versions.map((v, idx) => ({
        alias: `file${idx}`,
        version: v,
        path: join(rootDir, v)
      }))
      const query = aliasMap
        .map(
          ({alias, path}) => `
          ${alias}: history(path: "${path}", first: 100) {
            nodes {
              oid
              committedDate
              message
              author { name email }
            }
          }`
        )
        .join('')

      const gql = `
        query GetFileHistory($owner: String!, $repo: String!, $branch: String!) {
          repository(owner: $owner, name: $repo) {
            ref(qualifiedName: $branch) {
              target { ... on Commit {${query}} }
            }
          }
        }`
      const result = await this.#graphQL(gql, {owner, repo, branch}, authToken)

      for (const {alias, version, path} of aliasMap) {
        const commits = result.data.repository.ref.target[alias]?.nodes || []
        if (!commits.length) continue

        // Add revisions
        allRevisions.push(
          ...commits.map((commit: any) => ({
            ref: commit.oid,
            createdAt: new Date(commit.committedDate).getTime(),
            file: version,
            user:
              parseCoAuthoredBy(commit.message) ??
              (commit.author
                ? {name: commit.author.name, email: commit.author.email}
                : undefined),
            description: commit.message
          }))
        )

        // Follow rename of the earliest commit
        const earliest = commits[commits.length - 1].oid
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/commits/${earliest}`,
          {headers: {Authorization: `Bearer ${authToken}`}}
        )
        if (!res.ok) throw new HttpError(res.status, await res.text())

        const commitData = await res.json()
        const fileEntry = Array.isArray(commitData.files)
          ? commitData.files.find((f: any) => f.filename === path)
          : undefined
        const prev = fileEntry?.previous_filename
        if (prev) {
          const prefix = rootDir ? `${rootDir}/` : ''
          const relative = prev.startsWith(prefix)
            ? prev.slice(prefix.length)
            : prev
          queue.push(...fileVersions(relative))
        }
      }
    }

    return allRevisions.sort((a, b) => b.createdAt - a.createdAt)
  }

  async #getFileContentAtCommit(
    file: string,
    ref: string
  ): Promise<string | undefined> {
    const {owner, repo, authToken, rootDir} = this.#options
    const result = await this.#graphQL(
      `query GetFileContent($owner: String!, $repo: String!, $expression: String!) {
      repository(owner: $owner, name: $repo) {
        object(expression: $expression) {
          ... on Blob {
            text
          }
        }
      }
    }`,
      {owner, repo, expression: `${ref}:${join(rootDir, file)}`},
      authToken
    )
    return result.data.repository.object?.text
  }

  async #applyChangesToRepo(
    expectedHeadOid: string,
    changes: Array<CommitChange>,
    commitMessage: string
  ): Promise<string> {
    const {owner, repo, branch} = this.#options
    const [{additions, deletions}, baseCommit] = await Promise.all([
      this.#processChanges(changes),
      this.#restRequest<{tree: {sha: string}}>(
        `/repos/${owner}/${repo}/git/commits/${expectedHeadOid}`
      )
    ])
    const entries = Array<{
      path: string
      mode: '100644'
      type: 'blob'
      sha: string | null
    }>()
    if (additions.length) {
      const blobs = await this.#uploadBlobs(additions)
      entries.push(
        ...blobs.map(blob => ({
          path: blob.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha
        }))
      )
    }
    entries.push(
      ...deletions.map(deletion => ({
        path: deletion.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: null
      }))
    )
    if (!entries.length) return expectedHeadOid
    const createdTree = await this.#restRequest<{sha: string}>(
      `/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        body: {base_tree: baseCommit.tree.sha, tree: entries}
      }
    )
    const createdCommit = await this.#restRequest<{sha: string}>(
      `/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',
        body: {
          message: commitMessage,
          tree: createdTree.sha,
          parents: [expectedHeadOid]
        }
      }
    )
    try {
      await this.#restRequest(
        `/repos/${owner}/${repo}/git/refs/heads/${branch}`,
        {
          method: 'PATCH',
          body: {sha: createdCommit.sha, force: false}
        }
      )
    } catch (error) {
      if (
        error instanceof HttpError &&
        (error.code === 409 || error.code === 422)
      ) {
        const actualHead = await this.#getLatestCommitOid()
        if (actualHead !== expectedHeadOid)
          throw new ShaMismatchError(actualHead, expectedHeadOid)
      }
      throw error
    }
    return createdCommit.sha
  }

  async #processChanges(changes: Array<CommitChange>): Promise<{
    additions: {path: string; contents?: string; uploadUrl?: string}[]
    deletions: {path: string}[]
  }> {
    const {rootDir} = this.#options
    const additions = Array<{
      path: string
      contents?: string
      uploadUrl?: string
    }>()
    const deletions = Array<{path: string}>()

    for (const change of changes) {
      switch (change.op) {
        case 'addContent': {
          additions.push({
            path: join(this.contentLocation, change.path),
            contents: btoa(change.contents!)
          })
          break
        }
        case 'uploadFile': {
          const file = join(rootDir, change.location)
          additions.push({
            path: file,
            uploadUrl: change.url
          })
          break
        }
        case 'deleteContent': {
          const file = join(this.contentLocation, change.path)
          deletions.push({path: file})
          break
        }
        case 'removeFile': {
          const file = join(rootDir, change.location)
          deletions.push({path: file})
          break
        }
      }
    }

    return {additions, deletions}
  }

  async #getLatestCommitOid(): Promise<string> {
    const {owner, repo, branch} = this.#options
    const ref = await this.#restRequest<{object: {sha: string}}>(
      `/repos/${owner}/${repo}/git/ref/heads/${branch}`
    )
    return ref.object.sha
  }

  async #fetchUploadedContent(url: string): Promise<string> {
    const response = await fetch(url)
    if (!response.ok)
      throw new HttpError(response.status, await response.text())
    const buffer = new Uint8Array(await response.arrayBuffer())
    const {maxBlobBytes} = this.#options
    if (maxBlobBytes && buffer.byteLength > maxBlobBytes) {
      throw new HttpError(
        413,
        `Upload exceeds max blob size (${buffer.byteLength} > ${maxBlobBytes})`
      )
    }
    return base64.stringify(buffer)
  }

  async #uploadBlobs(
    additions: Array<{path: string; contents?: string; uploadUrl?: string}>
  ): Promise<Array<{path: string; sha: string}>> {
    const concurrency = Math.max(1, this.#options.blobUploadConcurrency ?? 1)
    const limit = Math.min(concurrency, additions.length)
    const result = Array<{path: string; sha: string}>(additions.length)
    let next = 0
    const worker = async () => {
      while (true) {
        const index = next++
        if (index >= additions.length) return
        const addition = additions[index]
        const blob = await this.#createBlob(addition)
        result[index] = {path: addition.path, sha: blob.sha}
      }
    }
    await Promise.all(Array.from({length: limit}, () => worker()))
    return result
  }

  async #createBlob(addition: {
    path: string
    contents?: string
    uploadUrl?: string
  }): Promise<{sha: string}> {
    const {owner, repo} = this.#options
    if (addition.contents !== undefined) {
      return this.#restRequest<{sha: string}>(
        `/repos/${owner}/${repo}/git/blobs`,
        {
          method: 'POST',
          body: {content: addition.contents, encoding: 'base64'}
        }
      )
    }
    if (addition.uploadUrl) return this.#streamBlobFromUrl(addition.uploadUrl)
    throw new Error(`Missing blob contents for ${addition.path}`)
  }

  async #streamBlobFromUrl(url: string): Promise<{sha: string}> {
    const source = await fetch(url)
    if (!source.ok) throw new HttpError(source.status, await source.text())
    const {maxBlobBytes, blobChunkBytes} = this.#options
    if (!source.body) {
      const fallback = await this.#fetchUploadedContent(url)
      const {owner, repo} = this.#options
      return this.#restRequest<{sha: string}>(
        `/repos/${owner}/${repo}/git/blobs`,
        {
          method: 'POST',
          body: {content: fallback, encoding: 'base64'}
        }
      )
    }
    const chunkSize = Math.max(3, blobChunkBytes ?? 64 * 1024)
    const chunked = this.#chunkStream(source.body, chunkSize, maxBlobBytes)
    const body = this.#jsonBlobBody(this.#base64EncodeStream(chunked))
    const {owner, repo, authToken} = this.#options
    const init: RequestInit & {duplex?: 'half'} = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body,
      duplex: 'half'
    }
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
      init
    )
    if (!response.ok)
      throw new HttpError(response.status, await response.text())
    return response.json() as Promise<{sha: string}>
  }

  #jsonBlobBody(
    base64Stream: ReadableStream<Uint8Array>
  ): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    const prefix = encoder.encode('{"content":"')
    const suffix = encoder.encode('","encoding":"base64"}')
    const reader = base64Stream.getReader()
    let sentPrefix = false
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (!sentPrefix) {
          sentPrefix = true
          controller.enqueue(prefix)
          return
        }
        const {done, value} = await reader.read()
        if (done) {
          controller.enqueue(suffix)
          controller.close()
          return
        }
        controller.enqueue(value)
      },
      async cancel(reason) {
        await reader.cancel(reason)
      }
    })
  }

  #base64EncodeStream(
    source: ReadableStream<Uint8Array>
  ): ReadableStream<Uint8Array> {
    const alphabet = Uint8Array.from(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
      char => char.charCodeAt(0)
    )
    const eq = '='.charCodeAt(0)
    let carry = new Uint8Array(0)
    return source.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          const bytes = new Uint8Array(carry.length + chunk.length)
          bytes.set(carry, 0)
          bytes.set(chunk, carry.length)
          const fullLength = bytes.length - (bytes.length % 3)
          if (fullLength > 0) {
            const out = new Uint8Array((fullLength / 3) * 4)
            let outPos = 0
            for (let i = 0; i < fullLength; i += 3) {
              const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
              out[outPos++] = alphabet[(n >> 18) & 63]
              out[outPos++] = alphabet[(n >> 12) & 63]
              out[outPos++] = alphabet[(n >> 6) & 63]
              out[outPos++] = alphabet[n & 63]
            }
            controller.enqueue(out)
          }
          carry = bytes.slice(fullLength)
        },
        flush(controller) {
          if (carry.length === 0) return
          const a = carry[0]
          const b = carry.length > 1 ? carry[1] : 0
          const n = (a << 16) | (b << 8)
          const out = new Uint8Array(4)
          out[0] = alphabet[(n >> 18) & 63]
          out[1] = alphabet[(n >> 12) & 63]
          out[2] = carry.length > 1 ? alphabet[(n >> 6) & 63] : eq
          out[3] = eq
          controller.enqueue(out)
        }
      })
    )
  }

  #chunkStream(
    source: ReadableStream<Uint8Array>,
    chunkSize: number,
    maxBytes?: number
  ): ReadableStream<Uint8Array> {
    let carry = new Uint8Array(0)
    let total = 0
    return source.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          total += chunk.byteLength
          if (maxBytes && total > maxBytes) {
            throw new HttpError(
              413,
              `Upload exceeds max blob size (${total} > ${maxBytes})`
            )
          }
          const merged = new Uint8Array(carry.length + chunk.length)
          merged.set(carry, 0)
          merged.set(chunk, carry.length)
          let offset = 0
          while (merged.length - offset >= chunkSize) {
            controller.enqueue(merged.subarray(offset, offset + chunkSize))
            offset += chunkSize
          }
          carry = merged.subarray(offset)
        },
        flush(controller) {
          if (carry.length) controller.enqueue(carry)
        }
      })
    )
  }

  async #restRequest<T = any>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PATCH'
      body?: object
    } = {}
  ): Promise<T> {
    const {authToken} = this.#options
    const response = await fetch(`https://api.github.com${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    })
    if (!response.ok)
      throw new HttpError(response.status, await response.text())
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }
}
