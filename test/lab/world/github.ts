/**
 * The git host: a branch of commits over the content directory. Isolates of
 * a self-hosted backend reach it through `LabGithub`, the cloud commits to it
 * on their behalf, a developer pushes to it and deploys build from it.
 */
import {
  BLOB_SEQUENCE_CONTENT_TYPE,
  encodeBlobSequence
} from '#/core/BlobTransport.js'
import type {Revision} from '#/core/Connection.js'
import {type CommitRequest, sourceChanges} from '#/core/db/CommitRequest.js'
import type {Change, ChangesBatch} from '#/core/source/Change.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import type {SerializedResponse} from '../shared/protocol.js'
import type {ConfigVersion} from '../shared/schema.js'
import {bus} from './bus.js'
import {jsonResponse, network, requestJson, textResponse} from './network.js'

export interface Commit {
  id: string
  parent?: string
  /** The sha of the content tree, which every database records. */
  contentSha: string
  tree: ReadonlyTree
  message: string
  author: string
  at: number
  /** The config the code of this commit holds. */
  configVersion: ConfigVersion
  changed: Array<{path: string; op: 'add' | 'delete'}>
}

const decoder = new TextDecoder()
const encoder = new TextEncoder()

class GitHost {
  node = 'github'
  commits: Array<Commit> = []
  blobs = new Map<string, Uint8Array>()

  get head(): Commit {
    return this.commits[this.commits.length - 1]
  }

  reset() {
    this.commits = []
    this.blobs.clear()
  }

  /** A remote pinned at a commit, as a build checks it out. */
  sourceAt(commit: Commit): RemoteSource {
    const blobs = this.blobs
    return {
      async getTreeIfDifferent(sha) {
        return sha === commit.tree.sha ? undefined : commit.tree
      },
      async *getBlobs(shas) {
        for (const sha of shas) {
          const blob = blobs.get(sha)
          if (!blob) throw new Error(`Missing blob ${sha}`)
          yield [sha, blob]
        }
      }
    }
  }

  async commit(
    batch: ChangesBatch,
    message: string,
    author: string,
    configVersion = this.head?.configVersion ?? 1
  ): Promise<Commit> {
    const from = this.head?.tree ?? ReadonlyTree.EMPTY
    for (const change of batch.changes)
      if (change.op === 'add' && change.contents)
        this.blobs.set(change.sha, change.contents)
    const tree = await from.withChanges({...batch, fromSha: from.sha})
    const commit: Commit = {
      id: randomSha(),
      parent: this.head?.id,
      contentSha: tree.sha,
      tree,
      message,
      author,
      at: bus.now(),
      configVersion,
      changed: batch.changes.map(change => ({path: change.path, op: change.op}))
    }
    this.commits.push(commit)
    bus.log({
      node: this.node,
      kind: 'commit',
      text: `commit ${commit.id.slice(0, 7)} by ${author}: ${message} → content ${tree.sha.slice(0, 7)}`,
      detail: commit.changed
    })
    return commit
  }

  /** Commit files as they are given, eg. a push of a developer. */
  async push(
    files: Array<{path: string; contents: string | null}>,
    message: string,
    author: string,
    configVersion?: ConfigVersion
  ) {
    const changes: Array<Change> = []
    for (const file of files) {
      if (file.contents === null) {
        const sha = this.head.tree.index().get(file.path)
        if (sha) changes.push({op: 'delete', path: file.path, sha})
        continue
      }
      const contents = encoder.encode(file.contents)
      changes.push({
        op: 'add',
        path: file.path,
        sha: await hashBlob(contents),
        contents
      })
    }
    return this.commit(
      {fromSha: this.head.tree.sha, changes},
      message,
      author,
      configVersion
    )
  }

  read(path: string, commit = this.head): string | undefined {
    const sha = commit.tree.index().get(path)
    const blob = sha && this.blobs.get(sha)
    return blob ? decoder.decode(blob) : undefined
  }

  files(commit = this.head) {
    return [...commit.tree.index()].map(([path, sha]) => ({path, sha}))
  }

  /** Commit a planned request when the branch is where it was planned. */
  async write(
    request: CommitRequest,
    author: string
  ): Promise<
    {sha: string} | {conflict: {actualSha: string; expectedSha: string}}
  > {
    if (this.head.contentSha !== request.fromSha)
      return {
        conflict: {
          actualSha: this.head.contentSha,
          expectedSha: request.fromSha
        }
      }
    const commit = await this.commit(
      sourceChanges(request),
      request.description,
      request.user?.name ? `${request.user.name} via ${author}` : author
    )
    return {sha: commit.contentSha}
  }

  revisions(file: string): Array<Revision> {
    return this.commits
      .filter(commit => commit.changed.some(change => change.path === file))
      .map(commit => ({
        ref: commit.id,
        createdAt: commit.at,
        file,
        description: commit.message,
        user: {name: commit.author, email: `${commit.author}@lab`}
      }))
      .reverse()
  }

  async serve(
    path: string,
    body: any,
    from: string
  ): Promise<SerializedResponse> {
    switch (path) {
      case '/tree': {
        const same = body.sha === this.head.contentSha
        bus.log({
          node: this.node,
          kind: 'read',
          text: same
            ? `${from} is current at ${body.sha.slice(0, 7)}`
            : `${from} is behind: answer tree ${this.head.contentSha.slice(0, 7)}`
        })
        return jsonResponse(same ? null : this.head.tree)
      }
      case '/blobs': {
        const shas: Array<string> = body.shas
        bus.log({
          node: this.node,
          kind: 'read',
          text: `${from} downloads ${shas.length} blob(s)`
        })
        const blobs = this.blobs
        async function* stream(): AsyncGenerator<[string, Uint8Array]> {
          for (const sha of shas) {
            const blob = blobs.get(sha)
            if (blob) yield [sha, blob]
          }
        }
        const response = new Response(encodeBlobSequence(stream()))
        return {
          status: 200,
          headers: [['content-type', BLOB_SEQUENCE_CONTENT_TYPE]],
          body: new Uint8Array(await response.arrayBuffer())
        }
      }
      case '/commit': {
        const result = await this.write(body as CommitRequest, from)
        if ('conflict' in result) {
          bus.log({
            node: this.node,
            kind: 'conflict',
            text: `✗ commit from ${from} rejected: planned on ${result.conflict.expectedSha.slice(0, 7)}, branch is at ${result.conflict.actualSha.slice(0, 7)}`
          })
          return jsonResponse(result.conflict, 409)
        }
        return jsonResponse(result)
      }
      case '/history':
        return jsonResponse(this.revisions(body.file))
      case '/revision': {
        const commit = this.commits.find(c => c.id === body.revisionId)
        const text = commit && this.read(body.file, commit)
        return jsonResponse(text ? JSON.parse(text) : null)
      }
    }
    return textResponse(404, 'Not found')
  }
}

function randomSha() {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

export const github = new GitHost()

network.route(url => {
  if (url.host !== 'github.lab') return
  return {
    node: github.node,
    handle: (request, from) =>
      github.serve(url.pathname, requestJson(request), from)
  }
})
