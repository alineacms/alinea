import type {CommitApi, SyncApi} from 'alinea/core/Connection'
import type {CommitChange, CommitRequest} from 'alinea/core/db/CommitRequest'
import {HttpError} from 'alinea/core/HttpError'
import {GithubSource} from 'alinea/core/source/GithubSource'
import {ShaMismatchError} from 'alinea/core/source/ShaMismatchError'
import {ReadonlyTree} from 'alinea/core/source/Tree'
import {hashBlob, serializeTreeEntries} from 'alinea/core/source/GitUtils'
import {join} from 'alinea/core/util/Paths'
import {assert} from 'alinea/core/util/Assert'
import type {GithubOptions} from './GithubApi.js'
import {
  createPack,
  parsePack,
  type PackObject
} from './gitSmart/GitSmartPack.js'
import {
  findPackStart,
  buildReceivePackRequest,
  buildUploadPackRequest,
  extractSidebandData,
  gitBasicAuth,
  parseAdvertisement,
  parseReceivePackStatus
} from './gitSmart/GitSmartProtocol.js'
import {
  hashCommitObject,
  serializeCommitObject
} from './gitSmart/GitSmartObjects.js'

const encoder = new TextEncoder()

export class GitSmartApi extends GithubSource implements CommitApi, SyncApi {
  #options: GithubOptions

  constructor(options: GithubOptions) {
    super(options)
    this.#options = options
  }

  async write(request: CommitRequest): Promise<{sha: string}> {
    const author = this.#requireAuthor()
    const head = await this.#getLatestCommitOid()
    const currentSha = await this.shaAt(head)
    if (currentSha !== request.fromSha)
      throw new ShaMismatchError(currentSha, request.fromSha)

    const commitMessage = this.#commitMessage(request.description)
    const planned = await this.#planCommit(
      head,
      request.changes,
      commitMessage,
      author
    )
    if (!planned) return {sha: currentSha}

    const adv = await this.#advertise('git-receive-pack')
    const refName = `refs/heads/${this.#options.branch}`
    const advertisedHead = adv.refs.get(refName)
    if (advertisedHead && advertisedHead !== head)
      throw new ShaMismatchError(advertisedHead, head)

    const pack = await createPack(planned.objects)
    const body = buildReceivePackRequest({
      oldSha: head,
      newSha: planned.commitSha,
      ref: refName,
      capabilities: adv.capabilities,
      pack
    })
    const response = await this.#gitRequest('git-receive-pack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-git-receive-pack-request',
        Accept: 'application/x-git-receive-pack-result'
      },
      body
    })
    const bytes = new Uint8Array(await response.arrayBuffer())
    const status = parseReceivePackStatus(bytes)
    if (status.unpackStatus && status.unpackStatus !== 'ok') {
      throw new HttpError(
        500,
        `Receive-pack unpack failed: ${status.unpackStatus}`
      )
    }
    const refStatus = status.refStatus.get(refName)
    if (refStatus && refStatus !== 'ok') {
      if (/(non-fast-forward|stale info|fetch first)/i.test(refStatus)) {
        const actualHead = await this.#getLatestCommitOid()
        throw new ShaMismatchError(actualHead, head)
      }
      throw new HttpError(500, `Receive-pack failed: ${refStatus}`)
    }
    return {sha: planned.contentSha}
  }

  async *getBlobs(
    shas: Array<string>
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    if (shas.length === 0) return
    const unique = Array.from(new Set(shas))
    const adv = await this.#advertise('git-upload-pack')
    if (!adv.capabilities.has('allow-reachable-sha1-in-want')) {
      yield* super.getBlobs(unique)
      return
    }
    const body = buildUploadPackRequest(unique, adv.capabilities)
    const response = await this.#gitRequest('git-upload-pack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-git-upload-pack-request',
        Accept: 'application/x-git-upload-pack-result'
      },
      body
    })
    const bytes = new Uint8Array(await response.arrayBuffer())
    const {channel1} = extractSidebandData(bytes)
    const payload = channel1.length > 0 ? channel1 : bytes
    const packStart = findPackStart(payload)
    assert(packStart >= 0, 'Upload-pack response did not contain a pack')
    const objects = await parsePack(payload.subarray(packStart))
    const bySha = new Map(objects.map(object => [object.sha, object]))
    for (const sha of shas) {
      const object = bySha.get(sha)
      if (!object || object.type !== 'blob') {
        throw new Error(`Blob ${sha} not found in upload-pack response`)
      }
      yield [sha, object.data]
    }
  }

  async #planCommit(
    head: string,
    changes: Array<CommitChange>,
    message: string,
    author: NonNullable<GithubOptions['author']>
  ): Promise<
    | {
        commitSha: string
        contentSha: string
        objects: Array<PackObject>
      }
    | undefined
  > {
    const baseCommit = await this.#restRequest<{tree: {sha: string}}>(
      `/repos/${this.#options.owner}/${this.#options.repo}/git/commits/${head}`
    )
    const flat = await this.#restRequest<{
      sha: string
      tree: Array<{path: string; mode: string; sha: string; type: string}>
      truncated: boolean
    }>(
      `/repos/${this.#options.owner}/${this.#options.repo}/git/trees/${baseCommit.tree.sha}?recursive=true`
    )
    assert(flat.truncated === false, 'Repository tree response was truncated')
    const currentRoot = ReadonlyTree.fromFlat(flat)
    const nextRoot = currentRoot.clone()
    const additions = await this.#loadAdditions(changes)
    for (const addition of additions) nextRoot.add(addition.path, addition.sha)
    for (const deletion of this.#deletions(changes))
      nextRoot.remove(deletion.path)
    const compiledRoot = await nextRoot.compile(currentRoot)
    const contentEntry = compiledRoot.get(this.contentLocation)
    assert(
      contentEntry instanceof ReadonlyTree,
      `Missing content tree ${this.contentLocation}`
    )
    if (compiledRoot.sha === currentRoot.sha) {
      return undefined
    }
    const treeObjects = await this.#collectChangedTreeObjects(
      currentRoot,
      compiledRoot
    )
    const commitData = serializeCommitObject({
      tree: compiledRoot.sha,
      parent: head,
      message,
      author
    })
    const commitSha = await hashCommitObject({
      tree: compiledRoot.sha,
      parent: head,
      message,
      author
    })
    const blobObjects = additions.map(addition => ({
      type: 'blob' as const,
      data: addition.data
    }))
    return {
      commitSha,
      contentSha: contentEntry.sha,
      objects: [
        ...blobObjects,
        ...treeObjects,
        {type: 'commit', data: commitData}
      ]
    }
  }

  async #collectChangedTreeObjects(
    previous: ReadonlyTree | undefined,
    next: ReadonlyTree
  ): Promise<Array<PackObject>> {
    const objects = Array<PackObject>()
    for (const entry of next.entries) {
      if (!entry.entries) continue
      const node = next.get(entry.name)
      assert(node instanceof ReadonlyTree)
      const previousNode = previous?.get(entry.name)
      objects.push(
        ...(await this.#collectChangedTreeObjects(
          previousNode instanceof ReadonlyTree ? previousNode : undefined,
          node
        ))
      )
    }
    if (previous?.sha !== next.sha) {
      objects.push({
        type: 'tree',
        data: serializeTreeEntries(next.entries)
      })
    }
    return objects
  }

  async #loadAdditions(changes: Array<CommitChange>) {
    const additions = Array<{path: string; sha: string; data: Uint8Array}>()
    for (const change of changes) {
      switch (change.op) {
        case 'addContent': {
          const data = encoder.encode(change.contents!)
          additions.push({
            path: join(this.contentLocation, change.path),
            data,
            sha: await hashBlob(data)
          })
          break
        }
        case 'uploadFile': {
          const data = await this.#fetchUpload(change.url)
          additions.push({
            path: join(this.#options.rootDir, change.location),
            data,
            sha: await hashBlob(data)
          })
          break
        }
      }
    }
    return additions
  }

  #deletions(changes: Array<CommitChange>) {
    const deletions = Array<{path: string}>()
    for (const change of changes) {
      switch (change.op) {
        case 'deleteContent':
          deletions.push({path: join(this.contentLocation, change.path)})
          break
        case 'removeFile':
          deletions.push({path: join(this.#options.rootDir, change.location)})
          break
      }
    }
    return deletions
  }

  #commitMessage(message: string) {
    const {author} = this.#options
    if (!author) return message
    return `${message}\n\nCo-authored-by: ${author.name} <${author.email}>`
  }

  #requireAuthor(): NonNullable<GithubOptions['author']> {
    const {author} = this.#options
    if (!author) {
      throw new Error(
        'GitSmartApi requires an author with name and email to create commits'
      )
    }
    return author
  }

  async #fetchUpload(url: string): Promise<Uint8Array> {
    const response = await fetch(url)
    if (!response.ok)
      throw new HttpError(response.status, await response.text())
    const data = new Uint8Array(await response.arrayBuffer())
    const {maxBlobBytes} = this.#options
    if (maxBlobBytes && data.byteLength > maxBlobBytes) {
      throw new HttpError(
        413,
        `Upload exceeds max blob size (${data.byteLength} > ${maxBlobBytes})`
      )
    }
    return data
  }

  async #advertise(service: 'git-upload-pack' | 'git-receive-pack') {
    const response = await this.#gitRequest(`info/refs?service=${service}`, {
      method: 'GET',
      headers: {
        Accept: `application/x-${service}-advertisement`
      }
    })
    return parseAdvertisement(new Uint8Array(await response.arrayBuffer()))
  }

  async #gitRequest(suffix: string, init: RequestInit): Promise<Response> {
    const {owner, repo, authToken} = this.#options
    const response = await fetch(
      `https://github.com/${owner}/${repo}.git/${suffix}`,
      {
        ...init,
        headers: {
          Authorization: gitBasicAuth(authToken),
          ...init.headers
        }
      }
    )
    if (!response.ok)
      throw new HttpError(response.status, await response.text())
    return response
  }

  async #getLatestCommitOid(): Promise<string> {
    const ref = await this.#restRequest<{object: {sha: string}}>(
      `/repos/${this.#options.owner}/${this.#options.repo}/git/ref/heads/${this.#options.branch}`
    )
    return ref.object.sha
  }

  async #restRequest<T = any>(path: string): Promise<T> {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${this.#options.authToken}`,
        'Content-Type': 'application/json'
      }
    })
    if (!response.ok)
      throw new HttpError(response.status, await response.text())
    return response.json() as Promise<T>
  }
}
