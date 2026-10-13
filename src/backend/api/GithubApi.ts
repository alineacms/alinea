import {parseCoAuthoredBy} from '#/cli/util/CommitMessage.js'
import type {
  CommitApi,
  HistoryApi,
  Revision,
  SyncApi
} from '#/core/Connection.js'
import type {EntryRecord} from '#/core/EntryRecord.js'
import {HttpError} from '#/core/HttpError.js'
import type {CommitChange, CommitRequest} from '#/core/db/CommitRequest.js'
import {
  GithubSource,
  type GithubSourceOptions,
  normalizeGithubSourceOptions
} from '#/core/source/GithubSource.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {assert} from '#/core/util/Assert.js'
import {base64, btoa} from '#/core/util/Encoding.js'
import {fileVersions} from '#/core/util/EntryFilenames.js'
import {isRecord} from '#/core/util/Objects.js'
import {join, relative} from '#/core/util/Paths.js'
import pLimit from 'p-limit'

export interface GithubOptions extends GithubSourceOptions {
  /**
   * Commit as this author instead of the account that owns the token. Such
   * commits are written through the REST API, which GraphQL commits do not
   * allow, so GitHub does not mark them as verified and each save spends
   * three REST requests, plus one per uploaded file.
   */
  author?: GithubCommitAuthor
}

export interface GithubCommitAuthor {
  name: string
  email: string
}

export class GithubApi
  extends GithubSource
  implements HistoryApi, CommitApi, SyncApi
{
  #options: GithubOptions

  constructor(options: GithubOptions) {
    const normalized = normalizeGithubSourceOptions(options)
    super(normalized)
    this.#options = normalized
  }

  write(request: CommitRequest): Promise<{sha: string}> {
    return this.spending('save', () => this.#write(request))
  }

  /**
   * Commit through GraphQL, which also answers the content sha before and
   * after: a save spends none of the REST rate limit. A configured author
   * commits through REST, writing only the commit there.
   */
  async #write(request: CommitRequest): Promise<{sha: string}> {
    const current = await this.#getLatestCommit()
    const currentSha = current.contentSha

    if (currentSha !== request.fromSha)
      throw new ShaMismatchError(currentSha, request.fromSha)

    const {user} = request

    let commitMessage = request.description
    if (user?.name && user.email) {
      commitMessage += `\n\nCo-authored-by: ${user.name} <${user.email}>`
    }
    const newCommit = this.#options.author
      ? await this.#commitThroughRest(
          current,
          request.changes,
          commitMessage,
          this.#options.author
        )
      : await this.#applyChangesToRepo(
          current.oid,
          request.changes,
          commitMessage
        )

    return {sha: newCommit.contentSha}
  }

  revisions(file: string): Promise<Array<Revision>> {
    return this.spending('history', () => this.#getFileCommitHistory(file))
  }

  async revisionData(
    file: string,
    revisionId: string
  ): Promise<EntryRecord | undefined> {
    const content = await this.spending('revision', () =>
      this.#getFileContentAtCommit(file, revisionId)
    )
    try {
      return content ? (JSON.parse(content) as EntryRecord) : undefined
    } catch (error) {
      return undefined
    }
  }

  async #graphQL(query: string, variables: object, token: string) {
    return this.githubFetch('https://api.github.com/graphql', {
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
        const errors = Array.isArray(result.errors)
          ? result.errors.filter((error: unknown) => !isMissingFile(error))
          : []
        if (errors.length > 0) {
          const message = errors
            .map((error: unknown) =>
              isRecord(error) && typeof error.message === 'string'
                ? error.message
                : JSON.stringify(error)
            )
            .join('; ')
          console.trace(errors)
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
        const res = await this.githubFetch(
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
  ): Promise<CommitState> {
    const {additions, deletions} = await this.#processChanges(changes)
    const {owner, repo, branch, authToken} = this.#options
    return this.#graphQL(
      `mutation CreateCommitOnBranch($input: CreateCommitOnBranchInput!, $content: String!) {
      createCommitOnBranch(input: $input) {
        commit {
          ${commitStateFields}
        }
      }
    }`,
      {
        input: {
          branch: {
            repositoryNameWithOwner: `${owner}/${repo}`,
            branchName: branch
          },
          message: {headline: commitMessage},
          fileChanges: {additions, deletions},
          expectedHeadOid
        },
        content: this.contentLocation
      },
      authToken
    )
      .then(result => commitState(result.data.createCommitOnBranch.commit))
      .catch(error => {
        if (error instanceof Error) {
          const mismatchMessage = /is at ([a-z0-9]+) but expected ([a-z0-9]+)/
          const match = error.message.match(mismatchMessage)
          if (match) {
            const [_, actual, expected] = match
            throw new ShaMismatchError(actual, expected)
          }
          const expectedMessage = /Expected branch to point to "([a-z0-9]+)"/
          const expectedMatch = error.message.match(expectedMessage)
          if (expectedMatch) {
            const actualSha = expectedMatch[1]
            throw new ShaMismatchError(actualSha, expectedHeadOid)
          }
        }
        console.error('Alinea GitHub commit failed', {
          expectedHeadOid,
          additions: additions.map(change => change.path),
          deletions: deletions.map(change => change.path),
          error
        })
        throw error
      })
  }

  /**
   * Write a commit with its own author through the REST API: a tree on the
   * current one, the commit, and the branch moved to it. Uploaded files are
   * stored as blobs first, entries are passed in the tree as text.
   */
  async #commitThroughRest(
    parent: CommitState,
    changes: Array<CommitChange>,
    commitMessage: string,
    author: GithubCommitAuthor
  ): Promise<CommitState> {
    const {branch} = this.#options
    // Without its base the tree would hold only the changed files, and the
    // commit would remove everything else.
    if (!parent.treeOid)
      throw new Error(`GitHub did not answer the tree of ${parent.oid}`)
    const limit = pLimit(4)
    let entries = await Promise.all(
      changes.map(change => limit(() => this.#treeEntry(change)))
    )
    const writeTree = () =>
      this.#rest('POST', 'git/trees', {
        base_tree: parent.treeOid,
        tree: entries
      })
    let tree: unknown
    try {
      tree = await writeTree()
    } catch (error) {
      // GitHub refuses a tree that removes a path its base does not have,
      // such as a file already removed outside the dashboard.
      const removed = entries.filter(entry => entry.sha === null)
      if (
        !(error instanceof HttpError && error.code === 422) ||
        !removed.length
      )
        throw error
      const existing = await this.#existingPaths(
        parent.oid,
        removed.map(entry => entry.path)
      )
      // Every removed path exists: GitHub refused the tree for another reason
      if (existing.size === removed.length) throw error
      entries = entries.filter(
        entry => entry.sha !== null || existing.has(entry.path)
      )
      tree = await writeTree()
    }
    assert(isRecord(tree) && typeof tree.sha === 'string')
    const commit = await this.#rest('POST', 'git/commits', {
      message: commitMessage,
      tree: tree.sha,
      parents: [parent.oid],
      author
    })
    assert(isRecord(commit) && typeof commit.sha === 'string')
    const ref = `git/refs/heads/${branch.split('/').map(encodeURIComponent).join('/')}`
    try {
      await this.#rest('PATCH', ref, {sha: commit.sha, force: false})
    } catch (error) {
      // The branch moved since the current commit was read. Other refusals,
      // such as branch protection, are reported as they are.
      if (
        error instanceof HttpError &&
        error.code === 422 &&
        /fast.forward/i.test(error.message)
      )
        throw new HttpError(409, error.message)
      throw error
    }
    return this.#getCommit(commit.sha)
  }

  /** The paths that exist in a commit. */
  async #existingPaths(
    commit: string,
    paths: Array<string>
  ): Promise<Set<string>> {
    const {owner, repo, authToken} = this.#options
    const params = paths.map((_, i) => `$p${i}: String!`).join(', ')
    const fields = paths
      .map((_, i) => `p${i}: object(expression: $p${i}) { oid }`)
      .join('\n')
    const variables: Record<string, string> = {owner, repo}
    for (const [i, path] of paths.entries())
      variables[`p${i}`] = `${commit}:${path}`
    const result = await this.#graphQL(
      `query ExistingPaths($owner: String!, $repo: String!, ${params}) {
      repository(owner: $owner, name: $repo) {
        ${fields}
      }
    }`,
      variables,
      authToken
    )
    const repository = result.data.repository
    return new Set(paths.filter((_, i) => isRecord(repository[`p${i}`])))
  }

  async #treeEntry(change: CommitChange): Promise<RestTreeEntry> {
    const path = this.#changePath(change)
    const mode = '100644'
    switch (change.op) {
      case 'addContent':
        return {path, mode, type: 'blob', content: change.contents}
      case 'uploadFile': {
        const blob = await this.#rest('POST', 'git/blobs', {
          content: await this.#fetchUploadedContent(change.url),
          encoding: 'base64'
        })
        assert(isRecord(blob) && typeof blob.sha === 'string')
        return {path, mode, type: 'blob', sha: blob.sha}
      }
      case 'deleteContent':
      case 'removeFile':
        return {path, mode, type: 'blob', sha: null}
    }
  }

  /** The repository path a change writes or removes. */
  #changePath(change: CommitChange): string {
    switch (change.op) {
      case 'addContent':
      case 'deleteContent':
        return repositoryPath(this.contentLocation, change.path)
      case 'uploadFile':
      case 'removeFile':
        return repositoryPath(this.#options.rootDir, change.location)
    }
  }

  async #rest(method: string, path: string, body: object): Promise<unknown> {
    const {owner, repo, authToken} = this.#options
    const response = await this.githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    )
    if (!response.ok)
      throw new HttpError(
        response.status,
        `GitHub ${method} ${path} failed: ${await response.text()}`
      )
    return response.json()
  }

  async #processChanges(changes: Array<CommitChange>): Promise<{
    additions: {path: string; contents: string}[]
    deletions: {path: string}[]
  }> {
    const additions = Array<{path: string; contents: string}>()
    const deletions = Array<{path: string}>()

    for (const change of changes) {
      const path = this.#changePath(change)
      switch (change.op) {
        case 'addContent':
          additions.push({path, contents: btoa(change.contents)})
          break
        case 'uploadFile':
          additions.push({
            path,
            contents: await this.#fetchUploadedContent(change.url)
          })
          break
        case 'deleteContent':
        case 'removeFile':
          deletions.push({path})
          break
      }
    }

    return {additions, deletions}
  }

  async #getLatestCommit(): Promise<CommitState> {
    const {owner, repo, branch, authToken} = this.#options
    return this.#graphQL(
      `query GetLatestCommit($owner: String!, $repo: String!, $branch: String!, $content: String!) {
      repository(owner: $owner, name: $repo) {
        ref(qualifiedName: $branch) {
          target {
            ${commitStateFields}
          }
        }
      }
    }`,
      {owner, repo, branch, content: this.contentLocation},
      authToken
    ).then(result => commitState(result.data.repository.ref.target))
  }

  async #getCommit(oid: string): Promise<CommitState> {
    const {owner, repo, authToken} = this.#options
    return this.#graphQL(
      `query GetCommit($owner: String!, $repo: String!, $oid: GitObjectID!, $content: String!) {
      repository(owner: $owner, name: $repo) {
        object(oid: $oid) {
          ${commitStateFields}
        }
      }
    }`,
      {owner, repo, oid, content: this.contentLocation},
      authToken
    ).then(result => commitState(result.data.repository.object))
  }

  async #fetchUploadedContent(url: string): Promise<string> {
    const response = await fetch(url)
    if (!response.ok)
      throw new HttpError(response.status, await response.text())
    return base64.stringify(new Uint8Array(await response.arrayBuffer()))
  }
}

function repositoryPath(...segments: Array<string>): string {
  return relative('/', join('/', ...segments))
}

/** A commit, its tree and the sha of its content directory. */
interface CommitState {
  oid: string
  /** Missing when GitHub did not answer it, the REST commit then fails. */
  treeOid: string | undefined
  contentSha: string
}

/** The fields of a commit that `commitState` reads, given `$content`. */
const commitStateFields = `oid ... on Commit { tree { oid } file(path: $content) { oid } }`

/** A file of a tree written through the REST API, removed when sha is null. */
interface RestTreeEntry {
  path: string
  mode: '100644'
  type: 'blob'
  content?: string
  sha?: string | null
}

function commitState(commit: unknown): CommitState {
  assert(isRecord(commit) && typeof commit.oid === 'string')
  const tree = commit.tree
  const treeOid =
    isRecord(tree) && typeof tree.oid === 'string' ? tree.oid : undefined
  const file = commit.file
  // A content directory without entries is not in the commit at all.
  const contentSha =
    isRecord(file) && typeof file.oid === 'string'
      ? file.oid
      : ReadonlyTree.EMPTY.sha
  return {oid: commit.oid, treeOid, contentSha}
}

/**
 * GitHub reports a path missing from a commit as an error next to a null
 * file, such as a content directory before its first entry.
 */
function isMissingFile(error: unknown): boolean {
  return (
    isRecord(error) &&
    error.type === 'NOT_FOUND' &&
    Array.isArray(error.path) &&
    error.path.at(-1) === 'file'
  )
}
